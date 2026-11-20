// 備份：把手機裏的章導出成一個檔案；換手機、清了瀏覽器資料、或者把 iPhone Safari 裏蓋的章搬到主畫面 App 時，再導入。
//
// 導入只會「加」：靠每枚章的 uid 認出手機裏已經有的，跳過；手機裏現有的章不刪、不覆蓋。
// 唯一會改的是 No.：兩部手機（或 Safari 和主畫面 App）各自從 No.1 數起，合併後號碼會撞，
// 這時才把全部正式章按蓋章時間重新編號，並且在導入前講清楚。
import { useSyncExternalStore } from 'react'
import { isIOS } from './install'
import type { Stamp } from './stamps'

const FORMAT = 'light-up-hk/stamps'
const VERSION = 1

export type BackupStamp = Omit<Stamp, 'id'>

export type BackupError = 'notOurs' | 'broken' | 'newer' | 'tooBig'

const hkDate = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)

/** 備份檔案的內容（JSON 文字）和檔名 */
export function makeBackup(stamps: Stamp[]) {
  const now = Date.now()
  const body = {
    format: FORMAT,
    version: VERSION,
    app: '點亮香港',
    exportedAt: new Date(now).toISOString(),
    count: stamps.length,
    stamps: stamps.map(({ id: _id, ...rest }) => rest),
  }
  return { name: `點亮香港備份-${hkDate(now)}.json`, text: JSON.stringify(body, null, 1) }
}

/**
 * 把備份交給用戶保存。
 * iPhone：用分享選單（可以「儲存到檔案」、傳給自己、AirDrop）；主畫面 App 裏直接下載常常沒反應。
 * 其他：直接下載（安卓 Chrome 的分享不收 .json 檔）。
 * 一定要在按鈕的點擊裏直接呼叫（中間不要 await），否則 iPhone 不准彈分享選單。
 */
export async function saveBackup(stamps: Stamp[]): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { name, text } = makeBackup(stamps)
  const file = new File([text], name, { type: 'application/json' })
  // 有些 iPhone 版本不肯分享 .json 類型：退一步當純文字分享（檔名不變，導入時一樣認得）
  const shareable = [file, new File([text], name, { type: 'text/plain' })].find((f) => navigator.canShare?.({ files: [f] }))
  if (isIOS && shareable) {
    try {
      await navigator.share({ files: [shareable], title: '點亮香港備份' })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
      // 其他錯誤：退回直接下載
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'downloaded'
}

const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 200
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const optNum = (v: unknown) => v === undefined || num(v)

/** 檢查一枚章的記錄；不合格就丟掉（不讓壞資料進手機） */
function clean(x: unknown): BackupStamp | null {
  if (!x || typeof x !== 'object') return null
  const s = x as Record<string, unknown>
  if (!str(s.uid) || !str(s.spotId) || !str(s.spotName) || !str(s.district) || !num(s.at) || !num(s.no)) return null
  // 編號要是正整數、時間要是正數（手改壞了的檔案不要弄亂手機裏的編號）
  if (!Number.isInteger(s.no) || (s.no as number) < 1 || (s.at as number) <= 0) return null
  if (![s.lat, s.lng, s.acc, s.px, s.py, s.rot].every(optNum)) return null
  const out: BackupStamp = {
    uid: s.uid as string,
    no: s.no as number,
    spotId: s.spotId as string,
    spotName: s.spotName as string,
    district: s.district as string,
    at: s.at as number,
  }
  for (const k of ['lat', 'lng', 'acc', 'px', 'py', 'rot'] as const) if (num(s[k])) out[k] = s[k] as number
  if (s.test === true) out.test = true
  return out
}

/** 讀備份檔案；不是我們的檔案、壞了、太新，都拋出 BackupError */
export async function readBackup(file: File): Promise<BackupStamp[]> {
  if (file.size > 5_000_000) throw 'tooBig' satisfies BackupError
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw 'notOurs' satisfies BackupError
  }
  const d = data as { format?: unknown; version?: unknown; stamps?: unknown }
  if (!d || d.format !== FORMAT || !Array.isArray(d.stamps)) throw 'notOurs' satisfies BackupError
  if (typeof d.version !== 'number' || !Number.isFinite(d.version) || d.version < 1) throw 'notOurs' satisfies BackupError
  if (d.version > VERSION) throw 'newer' satisfies BackupError
  const list = d.stamps.map(clean)
  if (list.some((x) => !x)) throw 'broken' satisfies BackupError
  // 同一個檔案裏重複的 uid 只留一個
  const seen = new Set<string>()
  return (list as BackupStamp[]).filter((s) => !seen.has(s.uid) && seen.add(s.uid))
}

export interface ImportPlan {
  /** 手機裏還沒有、會加進去的章 */
  fresh: BackupStamp[]
  /** 合併後 No. 會撞號，要按時間重新編號 */
  renumber: boolean
}

/** 算出導入會發生甚麼（導入前給用戶看，真正導入時在數據庫交易裏再算一次） */
export function planImport(existing: Pick<Stamp, 'uid' | 'no' | 'test'>[], incoming: BackupStamp[]): ImportPlan {
  const have = new Set(existing.map((s) => s.uid))
  const fresh = incoming.filter((s) => !have.has(s.uid))
  const nos = [...existing, ...fresh].filter((s) => !s.test).map((s) => s.no)
  return { fresh, renumber: new Set(nos).size !== nos.length }
}

// ---------- 上次備份的時間（只記在這部手機） ----------

const KEY = 'lhk.lastBackup'
const listeners = new Set<() => void>()
const read = () => {
  try {
    return Number(localStorage.getItem(KEY)) || null
  } catch {
    return null
  }
}
let last = read()

export function markBackedUp() {
  last = Date.now()
  try {
    localStorage.setItem(KEY, String(last))
  } catch {
    /* 存不了就只在這次有效 */
  }
  listeners.forEach((l) => l())
}

export function useLastBackup(): number | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => last,
  )
}

// ---------- 首頁的備份提示：按「稍後」七天內不再出現 ----------

const HINT_KEY = 'backup-hint-hidden-until'
export function backupHintHidden(): boolean {
  try {
    return Number(localStorage.getItem(HINT_KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}
export function hideBackupHint(days = 7) {
  try {
    localStorage.setItem(HINT_KEY, String(Date.now() + days * 864e5))
  } catch {
    /* 存不了就算 */
  }
}
