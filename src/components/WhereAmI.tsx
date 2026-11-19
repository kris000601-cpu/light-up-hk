import { useEffect, useMemo, useState } from 'react'
import { SPOTS, label, useCountedStamps, useDistricts, type Spot } from '../lib/districts'
import { monthDay } from '../lib/format'
import { platform } from '../lib/install'
import { ACC_LIMIT, FIX_TTL, formatDistance, locate, type Fix, type LocateError } from '../lib/locate'
import { nearestOnShape, navTarget } from '../lib/range'
import { addStamp, useStamps, type Stamp } from '../lib/stamps'
import { getFakeLocation, setFakeLocation, useFakeLocation } from '../lib/testMode'
import { InstallSteps } from './InstallHint'
import { Sheet } from './Sheet'

type Status =
  | { k: 'idle'; expired?: boolean }
  | { k: 'locating' }
  | { k: 'error'; err: LocateError }
  | { k: 'done'; fix: Fix }

interface Scored {
  spot: Spot
  /** 到範圍形狀的距離（米） */
  d: number
  /** 離可蓋章還差多少米（≤ 0 = 可以蓋） */
  gap: number
}

const ERROR_TEXT: Record<LocateError, string> = {
  denied: '',
  unavailable: '讀不到位置。請確認手機已開啟定位服務，再試一次。',
  timeout: '定位太久沒有結果。走到比較空曠的地方，再試一次。',
  unsupported: '這個瀏覽器不支援定位，請改用 Safari 或 Chrome。',
}

function deniedText() {
  const p = platform()
  if (p === 'ios' || (p === 'installed' && /iPhone|iPad/.test(navigator.userAgent)))
    return '沒有定位權限。請到 iPhone「設定」→「私隱與安全性」→「定位服務」，確認已開啟，並允許 Safari 網站使用位置，然後回來再按一次。'
  return '沒有定位權限。請按網址列左邊的圖示（或手機「設定」→「應用程式」→ 瀏覽器 →「權限」），允許使用「位置」，然後再按一次。'
}

const clock = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)

/** iPhone Safari / App 內置瀏覽器裏，第一次正式蓋章前提醒：這裏的章和主畫面 App 是分開存的 */
const BROWSER_OK_KEY = 'browser-stamp-ok'
const needsBrowserWarning = () => {
  const p = platform()
  if (p !== 'ios' && p !== 'inapp') return false
  try {
    return localStorage.getItem(BROWSER_OK_KEY) !== '1'
  } catch {
    return true
  }
}

/** 首頁的「我在哪」：讀一次位置 → 附近可蓋章 / 下一站票根 */
export function WhereAmI() {
  const [status, setStatus] = useState<Status>({ k: 'idle' })
  const [stamped, setStamped] = useState<Stamp | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [warnFor, setWarnFor] = useState<Spot | null>(null)
  const fake = useFakeLocation()
  const counted = useCountedStamps()
  const { stamps } = useStamps()
  const districts = useDistricts()
  const realCount = stamps.filter((s) => !s.test).length

  const doneIds = useMemo(() => new Set(counted.map((s) => s.spotId)), [counted])
  const lastBySpot = useMemo(() => Object.fromEntries(counted.map((s) => [s.spotId, s])), [counted])
  const codeOf = useMemo(() => Object.fromEntries(districts.map((d) => [d.fullName, d])), [districts])

  // 從後台回來時，位置太舊就作廢，要再按一次
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      setStatus((s) => (s.k === 'done' && Date.now() - s.fix.at > FIX_TTL ? { k: 'idle', expired: true } : s))
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 切換 / 取消假位置時，舊結果作廢
  useEffect(() => setStatus({ k: 'idle' }), [fake])

  const run = async () => {
    setStamped(null)
    setSaveError(false)
    const f = getFakeLocation()
    if (f) {
      setStatus({ k: 'done', fix: { lat: f.lat, lng: f.lng, acc: f.acc, at: Date.now(), fake: true } })
      return
    }
    setStatus({ k: 'locating' })
    try {
      setStatus({ k: 'done', fix: await locate() })
    } catch (err) {
      setStatus({ k: 'error', err: err as LocateError })
    }
  }

  const fix = status.k === 'done' ? status.fix : null
  const accurate = !!fix && fix.acc <= ACC_LIMIT

  const { nearby, next } = useMemo(() => {
    if (!fix) return { nearby: [] as Scored[], next: null as Scored | null }
    const comp = Math.min(fix.acc, 100)
    const all: Scored[] = SPOTS.map((spot) => {
      const d = nearestOnShape(fix.lat, fix.lng, spot).d
      return { spot, d, gap: d - spot.range.r - comp }
    })
    const near = accurate ? all.filter((x) => x.gap <= 0).sort((a, b) => a.d - b.d) : []
    const nearSet = new Set(near.map((x) => x.spot.id))
    const rest = all.filter((x) => !doneIds.has(x.spot.id) && !nearSet.has(x.spot.id)).sort((a, b) => a.d - a.spot.range.r - (b.d - b.spot.range.r))
    // 定位太差時，比誤差還近的「下一站」沒有意義（可能其實已經到了），找誤差以外的
    const far = accurate ? rest : rest.filter((x) => x.d - x.spot.range.r > fix.acc)
    return { nearby: near, next: far[0] ?? null }
  }, [fix, accurate, doneIds])

  const stamp = async (spot: Spot, confirmed = false) => {
    if (!fix) return
    if (Date.now() - fix.at > FIX_TTL) {
      setStatus({ k: 'idle', expired: true })
      return
    }
    if (!fix.fake && !confirmed && realCount === 0 && needsBrowserWarning()) {
      setWarnFor(spot)
      return
    }
    setSaveError(false)
    try {
      // ⚠️ 第 4 步會換成蓋章頁（按住紙面的鋼印動畫）；現在先直接存
      const st = await addStamp({
        spotId: spot.id,
        spotName: spot.name,
        district: spot.district,
        lat: fix.lat,
        lng: fix.lng,
        acc: fix.acc,
        ...(fix.fake ? { test: true } : {}),
      })
      setStamped(st)
    } catch {
      setSaveError(true)
    }
  }

  return (
    <section className="where" aria-label="我在哪">
      {fake && (
        <p className="fake-note">
          測試：假裝在「{fake.label}」，誤差 {fake.acc} 米 ·{' '}
          <button type="button" className="link" onClick={() => setFakeLocation(null)}>
            取消
          </button>
        </p>
      )}

      {status.k !== 'done' ? (
        <div className="where-card">
          <div className="where-text">
            <b>我在哪？</b>
            <p>
              {status.k === 'idle' && status.expired && '剛才的位置已經過了 5 分鐘。'}
              {status.k === 'error'
                ? status.err === 'denied'
                  ? deniedText()
                  : ERROR_TEXT[status.err]
                : '按一下讀取位置，看看附近可以蓋甚麼章。只讀這一次，不會在背景追蹤。'}
            </p>
          </div>
          <button type="button" className="btn-primary where-btn" disabled={status.k === 'locating'} onClick={run}>
            {status.k === 'locating' ? '定位中…' : status.k === 'error' ? '再試一次' : '讀取位置'}
          </button>
        </div>
      ) : (
        <>
          <p className="where-status">
            {fix!.fake ? '假位置' : `${clock(fix!.at)} 的位置`} · 誤差約 {fix!.acc} 米 ·{' '}
            <button type="button" className="link" onClick={run}>
              重新定位
            </button>
          </p>

          {!accurate && (
            <p className="where-warn" role="alert">
              定位誤差約 {fix!.acc} 米，太大了，暫時不能蓋章。走到比較空曠的地方、打開 Wi-Fi（不用連上），再按一次「重新定位」。
            </p>
          )}

          {nearby.length > 0 && (
            <section className="nearby" aria-label="附近可蓋章">
              <span className="nearby-head">附近可蓋章{nearby.length > 1 ? ` · ${nearby.length} 個` : ''}</span>
              {nearby.map(({ spot, d }) => {
                const last = lastBySpot[spot.id]
                const just = stamped?.spotId === spot.id
                return (
                  <div key={spot.id} className="nearby-row">
                    <div className="nearby-text">
                      <span className="nearby-name">{spot.name}</span>
                      <span className="nearby-meta">
                        {spot.area} · {spot.district} · {d < 1 ? '就在這裏' : `${formatDistance(d).num} ${formatDistance(d).unit}`}
                        {last && !just && ` · ${monthDay(last.at)} 蓋過`}
                      </span>
                    </div>
                    {just ? (
                      <span className="nearby-done">
                        已蓋章
                        <small>{stamped!.test ? '測試章' : `No. ${stamped!.no}`}</small>
                      </span>
                    ) : (
                      <button type="button" className="btn-seal" onClick={() => stamp(spot)}>
                        蓋章
                      </button>
                    )}
                  </div>
                )
              })}
              {saveError && <p className="where-warn">存不進手機，請再按一次「蓋章」。</p>}
            </section>
          )}

          {accurate && nearby.length === 0 && <p className="where-none">附近沒有可蓋章的景點。</p>}

          {next && <Ticket item={next} fix={fix!} code={codeOf[next.spot.district]?.code ?? ''} districtLabel={codeOf[next.spot.district] ? label(codeOf[next.spot.district]) : next.spot.district} />}
        </>
      )}

      <Sheet open={warnFor !== null} label="先加到主畫面？" onClose={() => setWarnFor(null)}>
        <div className="sheet-head">
          <h2 className="sheet-title">先加到主畫面？</h2>
        </div>
        <p className="warn-body">
          你現在不是從主畫面打開。在 iPhone 上，瀏覽器和主畫面的「點亮香港」是<b>分開存印章</b>的：在這裏蓋的章，之後從主畫面打開會看不到。
        </p>
        <InstallSteps />
        <div className="warn-actions">
          <button type="button" className="btn-outline" onClick={() => setWarnFor(null)}>
            先不蓋，去加主畫面
          </button>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              try {
                localStorage.setItem(BROWSER_OK_KEY, '1')
              } catch {
                /* 存不了就下次再問 */
              }
              const s = warnFor
              setWarnFor(null)
              if (s) stamp(s, true)
            }}
          >
            照樣在這裏蓋
          </button>
        </div>
      </Sheet>
    </section>
  )
}

/** 「下一站」票根：離你最近、還沒蓋章的景點；按下打開 Google 地圖導航 */
function Ticket({ item, fix, code, districtLabel }: { item: Scored; fix: Fix; code: string; districtLabel: string }) {
  const { spot, d } = item
  const dist = formatDistance(Math.max(0, d - spot.range.r))
  const to = navTarget(fix.lat, fix.lng, spot)
  const href = `https://www.google.com/maps/dir/?api=1&destination=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
  return (
    <a className="ticket" href={href} target="_blank" rel="noopener" aria-label={`下一站：${districtLabel}${spot.name}，${spot.tip}，${dist.num} ${dist.unit}，用 Google 地圖導航`}>
      <div className="ticket-main">
        <div className="ticket-top">
          <span className="ticket-title">下一站</span>
          <span className="ticket-note">離你最近、未蓋章的景點 · 按下導航</span>
        </div>
        <div className="ticket-band">
          <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
            <path d="M1 7h16M12 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
          </svg>
          <span className="ticket-name">{spot.name}</span>
          <span className="ticket-district">{districtLabel}</span>
        </div>
        <div className="ticket-tip">{spot.tip}</div>
        <span className="ticket-hole" aria-hidden="true" />
      </div>
      <div className="ticket-perf" aria-hidden="true" />
      <div className="ticket-stub">
        <span className="ticket-num">{dist.num}</span>
        <span className="ticket-unit">{dist.unit}</span>
        <span className="ticket-code">
          {code}
          {spot.id.slice(1)}
        </span>
      </div>
      <span className="ticket-notch top" aria-hidden="true" />
      <span className="ticket-notch bottom" aria-hidden="true" />
    </a>
  )
}
