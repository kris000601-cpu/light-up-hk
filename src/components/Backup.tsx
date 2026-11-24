// 備份的介面：「我的」頁的備份卡（匯出 / 從備份還原），和首頁「有幾個章還沒備份」的提示。
import { useEffect, useRef, useState } from 'react'
import { hideBackupHint, backupHintHidden, markBackedUp, planImport, readBackup, saveBackup, useLastBackup, type BackupError, type BackupStamp } from '../lib/backup'
import { useLit, type Lit } from '../lib/lit'
import { isIOS } from '../lib/install'
import { clearNav, navigate, useNavRequest } from '../lib/nav'
import { importStamps, useStamps } from '../lib/stamps'
import { useTestMode } from '../lib/testMode'

const ymd = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms).replace(/-/g, '.')

const ERRORS: Record<BackupError, string> = {
  notOurs: '這不是點亮香港的備份檔案。請選檔名像「點亮香港備份-2026-11-20.json」的檔案。',
  broken: '這個備份檔案有部分內容讀不到，可能壞了，甚麼都沒有匯入。',
  newer: '這個備份來自較新版本的點亮香港。請先關掉 App 再打開（會自動更新），然後再試。',
  tooBig: '這個檔案太大，不像是點亮香港的備份。',
}

/** 沒備份的章（正式章；測試模式開着時也算測試章）；lits：一起匯出的點亮了的地方 */
function useUnbacked() {
  const { stamps, ready } = useStamps()
  const { lit } = useLit()
  const test = useTestMode()
  const last = useLastBackup()
  const list = test ? stamps : stamps.filter((s) => !s.test)
  const lits = test ? lit : lit.filter((x) => !x.test)
  return { ready, list, lits, last, since: last ? list.filter((s) => s.at > last).length : list.length }
}

interface Pending {
  name: string
  total: number
  /** 備份裏亮了的地方 */
  places: number
  from: number
  to: number
  fresh: BackupStamp[]
  renumber: boolean
  lit: Lit[]
  newPlaces: number
}

/** 「我的」頁：備份卡 */
export function BackupCard() {
  const { stamps } = useStamps()
  const { lit } = useLit()
  const { ready, list, lits, last, since } = useUnbacked()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const card = useRef<HTMLElement>(null)

  // 從首頁提示跳過來：捲到這張卡
  const nav = useNavRequest()
  useEffect(() => {
    if (nav?.tab === 'me' && nav.anchor === 'backup') {
      card.current?.scrollIntoView({ block: 'start' })
      clearNav()
    }
  }, [nav])

  const doExport = async () => {
    setMsg(null)
    setPending(null)
    // 直接呼叫（中間不 await 別的），iPhone 才准彈分享選單
    const r = await saveBackup(list, lits)
    if (r === 'cancelled') return
    markBackedUp()
    setMsg({
      ok: true,
      text:
        r === 'shared'
          ? '備份好了。記住你把它存在哪裏（例如「檔案」App，或傳給自己的對話），換手機時要用。'
          : '備份檔已下載（通常在「下載」資料夾）。最好再傳一份給自己，例如 WhatsApp 或電郵。',
    })
  }

  const onPick = async (f: File | undefined) => {
    if (!f) return
    setMsg(null)
    setPending(null)
    try {
      const incoming = await readBackup(f)
      if (!incoming.stamps.length && !incoming.lit.length) return setMsg({ ok: false, text: '這個備份裏沒有章。' })
      const plan = planImport(stamps, lit, incoming)
      const times = [...incoming.stamps, ...incoming.lit].map((s) => s.at)
      setPending({ name: f.name, total: incoming.stamps.length, places: incoming.lit.length, from: Math.min(...times), to: Math.max(...times), ...plan })
    } catch (e) {
      setMsg({ ok: false, text: ERRORS[(e as BackupError) in ERRORS ? (e as BackupError) : 'notOurs'] })
    } finally {
      // 同一個檔案可以再選一次
      if (file.current) file.current.value = ''
    }
  }

  const doImport = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const r = await importStamps(pending.fresh, pending.lit)
      setPending(null)
      setMsg({ ok: true, text: `加入了 ${r.added} 個章${r.places ? `、${r.places} 個地方` : ''}。${r.renumbered ? '兩邊的章合併之後，No. 按蓋章日子重新排過。' : ''}` })
    } catch {
      setMsg({ ok: false, text: '存不進手機，沒有匯入任何章。請再試一次。' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section ref={card} id="backup" className="card-block" aria-labelledby="backup-title">
      <h2 id="backup-title" className="block-title">
        備份
      </h2>
      <p className="block-text small">
        備份檔案存着你所有的章（日子、地點、蓋在紙上的位置）和點亮了的地方。換手機、清除了瀏覽器資料，或者想把瀏覽器裏蓋的章搬到主畫面 App，都可以用它還原。
      </p>
      <p className="backup-state">
        {!ready
          ? '讀取中…'
          : !list.length && !lits.length
            ? '還沒有章，蓋了章再備份。'
            : last
              ? `上次備份：${ymd(last)}${since ? `，之後蓋了 ${since} 個章` : '，之後沒有新的章'}`
              : `還沒備份過（手機裏有 ${list.length} 個章${lits.length ? `、${lits.length} 個亮了的地方` : ''}）`}
      </p>
      <button type="button" className="btn-primary block" disabled={!ready || (!list.length && !lits.length)} onClick={doExport}>
        匯出備份
      </button>
      <p className="fine">{isIOS ? '在彈出的選單裏選「儲存到檔案」，或者傳給自己。' : '檔案會存到「下載」。'}</p>
      <button type="button" className="btn-outline" disabled={!ready || busy} onClick={() => file.current?.click()}>
        從備份還原
      </button>
      <input ref={file} type="file" accept=".json,application/json,text/plain" hidden onChange={(e) => onPick(e.target.files?.[0])} />

      {pending && (
        <div className="backup-confirm" role="alertdialog" aria-label="確認匯入">
          <p>
            這份備份有 <b>{pending.total}</b> 個章{pending.places ? `、${pending.places} 個亮了的地方` : ''}（{ymd(pending.from)}
            {pending.from !== pending.to && ` – ${ymd(pending.to)}`}）。
          </p>
          {pending.fresh.length || pending.newPlaces ? (
            <>
              <p>
                {pending.fresh.length ? (
                  <>
                    {pending.total > pending.fresh.length ? `手機裏已經有 ${pending.total - pending.fresh.length} 個，` : ''}會加入 <b>{pending.fresh.length}</b> 個新的章
                    {pending.newPlaces ? `和 ${pending.newPlaces} 個地方` : ''}。
                  </>
                ) : (
                  <>章手機裏全部都有了，會加入 <b>{pending.newPlaces}</b> 個亮了的地方。</>
                )}
                {pending.renumber ? '兩邊的章都從 No.1 數起，合併後會按蓋章日子重新編號；章本身不會刪走。' : '手機裏現有的章不會改動。'}
              </p>
              <div className="backup-btns">
                <button type="button" className="btn-primary" disabled={busy} onClick={doImport}>
                  {pending.fresh.length ? `加入 ${pending.fresh.length} 個章` : `加入 ${pending.newPlaces} 個地方`}
                </button>
                <button type="button" className="btn-small" disabled={busy} onClick={() => setPending(null)}>
                  取消
                </button>
              </div>
            </>
          ) : (
            <>
              <p>這份備份裏的{pending.places ? '章和地方' : '章'}，手機裏全部都有了，不用還原。</p>
              <div className="backup-btns">
                <button type="button" className="btn-small" onClick={() => setPending(null)}>
                  好
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && (
        <p className={msg.ok ? 'backup-msg' : 'warn'} role="status">
          {msg.text}
        </p>
      )}
    </section>
  )
}

const MOCK = new URLSearchParams(window.location.search).get('mock') === '1'
/** 沒備份的章到這個數目才提醒 */
const REMIND_AT = 3

/** 首頁：有幾個章還沒備份。不嚇人、不保證甚麼，按「稍後」七天內不再出現 */
export function BackupHint() {
  const { ready, since } = useUnbacked()
  const [hidden, setHidden] = useState(backupHintHidden)
  if (!ready || hidden || MOCK || since < REMIND_AT) return null
  return (
    <aside className="install-hint" aria-label="備份提示">
      <div className="install-hint-text">
        <b>有 {since} 個章還沒備份</b>
        <p>章只存在這部手機。換手機或清除瀏覽器資料時會不見，匯出一份備份比較安心。</p>
        <button type="button" className="btn-primary" onClick={() => navigate({ tab: 'me', anchor: 'backup' })}>
          去備份
        </button>
      </div>
      <button
        type="button"
        className="install-hint-close"
        onClick={() => {
          hideBackupHint()
          setHidden(true)
        }}
      >
        稍後
      </button>
    </aside>
  )
}
