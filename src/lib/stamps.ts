// 印章存在手機裏（IndexedDB），不上網。
//
// 每蓋一次存一條記錄；同一景點再去可以再蓋（疊蓋），所以一個景點可以有多條。
// 記錄裏另存一份景點名和區名：以後景點清單改了，舊章仍然知道自己是甚麼。
// 每條記錄有全球唯一的 uid：以後導入備份、同步到網上時，靠它認出「這個章已經有了」。
import { useSyncExternalStore } from 'react'
import { LIT, MOCK, STAMPS, transact, uuid } from './db'
import { mergeLit, reloadLit, type Lit } from './lit'
import { holdUpdates } from './updates'

export interface Stamp {
  /** 這部手機裏的自動編號（只在本機有意義） */
  id: number
  /** 全球唯一身份碼，跨手機 / 備份 / 同步都不變 */
  uid: string
  /** 第幾枚（章面上的 No.）：蓋的時候定下，以後不變；測試章不佔號 */
  no: number
  spotId: string
  spotName: string
  district: string
  /** 蓋章時間（毫秒） */
  at: number
  /** 蓋章時的位置和定位誤差（米）；測試章沒有 */
  lat?: number
  lng?: number
  acc?: number
  /** 測試模式蓋的章：只在測試模式開着時才算進進度，可以一鍵清走 */
  test?: boolean
  /** 章蓋在紙上的位置（紙面寬高的比例 0–1）和角度（度）；印章冊照着重現 */
  px?: number
  py?: number
  rot?: number
}

export type NewStamp = Omit<Stamp, 'id' | 'uid' | 'no' | 'at'>

interface State {
  ready: boolean
  stamps: Stamp[]
  /** 讀不到 / 存不了時的原因 */
  error: string | null
}

let state: State = { ready: false, stamps: [], error: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const byTime = (a: Stamp, b: Stamp) => a.at - b.at || a.id - b.id
const READ_ERROR = '讀取不到印章。如果開了私密瀏覽（無痕模式），請改用一般模式打開；否則按「再試一次」。'

// 設計稿截圖用：網址加 ?mock=1，用一套假印章代替手機裏的（不讀也不寫數據庫）。
// 一載入就看網址，不等 App 叫 mockStamps()：不然開頭那一次 reloadStamps() 會先讀了真數據庫
let mocked = MOCK
export function mockStamps(list: Stamp[]) {
  mocked = true
  set({ ready: true, stamps: [...list].sort(byTime), error: null })
}

/** 從數據庫重新讀一次（打開 App、回到前台、出錯重試時） */
export async function reloadStamps() {
  if (mocked) return
  try {
    const all = await transact<Stamp[], [typeof STAMPS]>([STAMPS], 'readonly', ([s], done) => {
      s.getAll().onsuccess = (e) => done((e.target as IDBRequest<Stamp[]>).result)
    })
    if (mocked) return
    set({ ready: true, stamps: all.sort(byTime), error: null })
    // 之前沒批的，這次可能會批（例如剛加到主畫面）
    if (all.length) requestPersist()
  } catch {
    if (!mocked) set({ ready: true, error: READ_ERROR })
  }
}
reloadStamps()
// 在另一個分頁蓋了章、或 App 在後台放了很久：回來時重讀，免得各看各的
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reloadStamps()
})

/** 蓋一個章；寫進手機成功才回傳，失敗會拋出錯誤（由蓋章頁提示重試） */
export async function addStamp(s: NewStamp & { at?: number }): Promise<Stamp> {
  if (mocked) {
    // 截圖模式：只加在畫面上，不寫進手機
    const no = state.stamps.reduce((m, x) => (x.test ? m : Math.max(m, x.no)), 0) + 1
    const stamp: Stamp = { ...s, uid: uuid(), no, at: s.at ?? Date.now(), id: -(state.stamps.length + 1) }
    set({ stamps: [...state.stamps, stamp] })
    return stamp
  }
  // 寫進手機期間不讓自動更新重新載入頁面（蓋章頁剛好關掉也一樣）
  const release = holdUpdates()
  const stamp = await transact<Stamp, [typeof STAMPS]>([STAMPS], 'readwrite', ([store], done) => {
    // 編號在同一個交易裏數：兩個分頁同時蓋也不會撞號；清走測試章也不會影響
    store.getAll().onsuccess = (e) => {
      const all = (e.target as IDBRequest<Stamp[]>).result
      const no = all.reduce((m, x) => (x.test ? m : Math.max(m, x.no)), 0) + 1
      const rec = { ...s, uid: uuid(), no, at: s.at ?? Date.now() }
      store.add(rec).onsuccess = (ev) => done({ ...rec, id: Number((ev.target as IDBRequest).result) })
    }
  }).finally(release)
  await reloadStamps()
  // 有章了才申請「持久儲存」：瀏覽器空間不夠時不要清走印章
  requestPersist()
  return stamp
}

/**
 * 從備份導入（章和點亮的地方在同一個交易裏，要麼全進，要麼全不進）：
 * 只加手機裏還沒有的章（按 uid 認），現有的不刪、不覆蓋。
 * 合併後 No. 撞號（兩部手機各自從 No.1 數起）時，全部正式章按蓋章時間重新編號。
 * 地方：手機裏沒亮的加進去；兩邊都亮了，留較早那次（真的去過蓋過測試的）。
 */
export async function importStamps(list: Omit<Stamp, 'id'>[], lit: Lit[] = []): Promise<{ added: number; renumbered: boolean; places: number }> {
  if (mocked) return { added: 0, renumbered: false, places: 0 }
  const res = { added: 0, renumbered: false, places: 0 }
  const release = holdUpdates() // 導入期間不讓自動更新重新載入頁面
  await transact<typeof res, [typeof STAMPS, typeof LIT]>([STAMPS, LIT], 'readwrite', ([store, litStore], done) => {
    done(res) // 下面的回呼會填好數字；交易寫完才交出去
    store.getAll().onsuccess = (e) => {
      const all = (e.target as IDBRequest<Stamp[]>).result
      const have = new Set(all.map((s) => s.uid))
      // 複製一份：重新編號會改 no，不要改到傳進來的（失敗重試時要用原來的）
      const fresh = list.filter((s) => !have.has(s.uid)).map((s) => ({ ...s }))
      const nos = [...all, ...fresh].filter((s) => !s.test).map((s) => s.no)
      const renumbered = new Set(nos).size !== nos.length
      if (renumbered) {
        const real = [...all, ...fresh].filter((s) => !s.test).sort((a, b) => a.at - b.at || a.uid.localeCompare(b.uid))
        real.forEach((s, i) => (s.no = i + 1))
        for (const s of all) if (!s.test) store.put(s)
      }
      for (const s of fresh) store.add(s)
      res.added = fresh.length
      res.renumbered = renumbered
    }
    if (lit.length)
      litStore.getAll().onsuccess = (e) => {
        const mine = new Map((e.target as IDBRequest<Lit[]>).result.map((x) => [x.place, x]))
        for (const x of lit) {
          const rec = mergeLit(mine.get(x.place), x)
          if (!rec) continue
          // 數「多亮了幾個」：本來沒亮的，或本來只是測試亮的（換成真的）
          if (!mine.has(x.place) || (mine.get(x.place)!.test && !rec.test)) res.places++
          litStore.put(rec)
        }
      }
  }).finally(release)
  await Promise.all([reloadStamps(), reloadLit()])
  if (res.added || res.places) requestPersist()
  return res
}

/** 清走所有測試章（連同測試模式下點亮的地方） */
export async function clearTestStamps() {
  if (mocked) {
    set({ stamps: state.stamps.filter((x) => !x.test) })
    await reloadLit({ dropTest: true })
    return
  }
  await transact<void, [typeof STAMPS, typeof LIT]>([STAMPS, LIT], 'readwrite', ([store, litStore], done) => {
    done()
    for (const s of [store, litStore])
      s.openCursor().onsuccess = (e) => {
        const cur = (e.target as IDBRequest<IDBCursorWithValue | null>).result
        if (!cur) return
        if (cur.value.test) cur.delete()
        cur.continue()
      }
  })
  await Promise.all([reloadStamps(), reloadLit()])
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStamps(): State {
  return useSyncExternalStore(subscribe, () => state)
}

// ---------- 持久儲存 ----------
// 瀏覽器預設的儲存是「盡量保留」：手機空間不夠、或 iPhone 上很久沒打開，可能被清走。
// 申請成「持久」之後，除非用戶自己清，否則不會被刪。
// 不是每個瀏覽器都會批：安卓 Chrome 通常加到主畫面或常用就批；iPhone 要加到主畫面。

export type Persist = 'yes' | 'no' | 'unsupported'
let persist: Persist = 'no'
const persistListeners = new Set<() => void>()
const setPersist = (p: Persist) => {
  persist = p
  persistListeners.forEach((l) => l())
}

async function checkPersist() {
  if (!navigator.storage?.persisted) return setPersist('unsupported')
  try {
    setPersist((await navigator.storage.persisted()) ? 'yes' : 'no')
  } catch {
    setPersist('unsupported')
  }
}
checkPersist()

export async function requestPersist() {
  if (persist === 'yes' || !navigator.storage?.persist) return
  try {
    setPersist((await navigator.storage.persist()) ? 'yes' : 'no')
  } catch {
    /* 不批就算了，下次蓋章再試 */
  }
}

export function usePersist(): Persist {
  return useSyncExternalStore(
    (l) => {
      persistListeners.add(l)
      return () => persistListeners.delete(l)
    },
    () => persist,
  )
}
