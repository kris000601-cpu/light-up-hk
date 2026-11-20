import { useCallback, useEffect, useMemo, useState } from 'react'
import { SPOTS, label, useCountedStamps, useDistricts, type Spot } from '../lib/districts'
import { monthDay } from '../lib/format'
import { platform } from '../lib/install'
import { ACC_LIMIT, FIX_TTL, formatDistance, locate, type Fix, type LocateError } from '../lib/locate'
import { metresToRange, nearestOnShape, navTarget } from '../lib/range'
import { useStamps, type Stamp } from '../lib/stamps'
import { getFakeLocation, setFakeLocation, useFakeLocation } from '../lib/testMode'
import { BrowserWarnSheet, needsBrowserWarning } from './BrowserWarn'
import { StampPage } from './StampPage'

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

export const ERROR_TEXT: Record<LocateError, string> = {
  denied: '',
  unavailable: '讀不到位置。請確認手機已開啟定位服務，再試一次。',
  timeout: '定位太久沒有結果。走到比較空曠的地方，再試一次。',
  unsupported: '這個瀏覽器不支援定位，請改用 Safari 或 Chrome。',
}

export function deniedText() {
  const p = platform()
  if (p === 'ios' || (p === 'installed' && /iPhone|iPad/.test(navigator.userAgent)))
    return '沒有定位權限。請到 iPhone「設定」→「私隱與安全性」→「定位服務」，確認已開啟，並允許 Safari 網站使用位置，然後回來再按一次。'
  return '沒有定位權限。請按網址列左邊的圖示（或手機「設定」→「應用程式」→ 瀏覽器 →「權限」），允許使用「位置」，然後再按一次。'
}

/** 離可蓋章範圍不到這麼多米，就顯示「就快到了」 */
const ALMOST = 100

const navHref = (to: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
const dist = (m: number) => {
  const f = formatDistance(m)
  return `${f.num} ${f.unit}`
}

const clock = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)

/** 首頁的「我在哪」：讀一次位置 → 附近可蓋章 / 下一站票根 */
export function WhereAmI() {
  const [status, setStatus] = useState<Status>({ k: 'idle' })
  const [stamped, setStamped] = useState<Stamp | null>(null)
  const [stampAt, setStampAt] = useState<{ spot: Spot; d: number } | null>(null)
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

  // 三種結果：到了（可以蓋）、就快到了（差不到 100 米）、下一站（最近的未蓋章景點）。
  // 給用戶看的距離只有一種：到「那個地方本身」的距離（建築、公園、山徑），跟直覺一致。
  const { nearby, almost, next } = useMemo(() => {
    if (!fix) return { nearby: [] as Scored[], almost: [] as Scored[], next: null as Scored | null }
    const all: Scored[] = SPOTS.map((spot) => ({
      spot,
      d: nearestOnShape(fix.lat, fix.lng, spot).d,
      gap: metresToRange(fix.lat, fix.lng, fix.acc, spot),
    }))
    const near = accurate ? all.filter((x) => x.gap <= 0).sort((a, b) => a.d - b.d) : []
    const close = accurate ? all.filter((x) => x.gap > 0 && x.gap <= ALMOST).sort((a, b) => a.gap - b.gap) : []
    const shown = new Set([...near, ...close].map((x) => x.spot.id))
    const rest = all.filter((x) => !doneIds.has(x.spot.id) && !shown.has(x.spot.id)).sort((a, b) => a.d - b.d)
    // 定位太差時，比誤差還近的「下一站」沒有意義（可能其實已經到了），找誤差以外的
    const far = accurate ? rest : rest.filter((x) => x.d > fix.acc)
    return { nearby: near, almost: close, next: far[0] ?? null }
  }, [fix, accurate, doneIds])

  const closeStamp = useCallback(() => setStampAt(null), [])

  // 按「蓋章」：先檢查位置還有效、瀏覽器提醒，然後打開蓋章頁（真正存章在蓋章頁壓到底那一下）
  const stamp = (spot: Spot, confirmed = false) => {
    if (!fix) return
    if (Date.now() - fix.at > FIX_TTL) {
      setStatus({ k: 'idle', expired: true })
      return
    }
    if (!fix.fake && !confirmed && realCount === 0 && needsBrowserWarning()) {
      setWarnFor(spot)
      return
    }
    setStampAt({ spot, d: nearby.find((x) => x.spot.id === spot.id)?.d ?? 0 })
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
              {nearby.map(({ spot }) => {
                const last = lastBySpot[spot.id]
                const just = stamped?.spotId === spot.id
                return (
                  <div key={spot.id} className="nearby-row">
                    <div className="nearby-text">
                      <span className="nearby-name">{spot.name}</span>
                      <span className="nearby-meta">
                        {spot.area} · {spot.district}
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
            </section>
          )}

          {almost.length > 0 && (
            <section className="almost" aria-label="就快到了">
              <span className="almost-head">就快到了 · 再走近一點</span>
              {almost.map(({ spot, d }) => (
                <div key={spot.id} className="almost-row">
                  <div className="nearby-text">
                    <span className="almost-name">{spot.name}</span>
                    <span className="nearby-meta">
                      距離 {dist(d)} · {spot.area}
                    </span>
                  </div>
                  <a className="btn-small" href={navHref(navTarget(fix!.lat, fix!.lng, spot))} target="_blank" rel="noopener">
                    導航
                  </a>
                </div>
              ))}
              <p className="almost-tip">走到門口或範圍裏面，再按上面的「重新定位」。</p>
            </section>
          )}

          {accurate && nearby.length === 0 && almost.length === 0 && <p className="where-none">附近沒有可蓋章的景點。</p>}

          {next && <Ticket item={next} fix={fix!} code={codeOf[next.spot.district]?.code ?? ''} districtLabel={codeOf[next.spot.district] ? label(codeOf[next.spot.district]) : next.spot.district} />}
        </>
      )}

      {stampAt && fix && (
        <StampPage
          spot={stampAt.spot}
          fix={fix}
          distance={stampAt.d}
          onClose={closeStamp}
          onSaved={setStamped}
        />
      )}

      <BrowserWarnSheet
        open={warnFor !== null}
        onCancel={() => setWarnFor(null)}
        onConfirm={() => {
          const s = warnFor
          setWarnFor(null)
          if (s) stamp(s, true)
        }}
      />
    </section>
  )
}

/** 「下一站」票根：離你最近、還沒蓋章的景點；按下打開 Google 地圖導航 */
export function Ticket({ item, fix, code, districtLabel }: { item: Scored; fix: Fix; code: string; districtLabel: string }) {
  const { spot, d } = item
  const dist = formatDistance(d)
  const href = navHref(navTarget(fix.lat, fix.lng, spot))
  return (
    <a className="ticket" href={href} target="_blank" rel="noopener" aria-label={`下一站：${districtLabel}${spot.name}，${spot.tip}，距離 ${dist.num} ${dist.unit}，用 Google 地圖導航`}>
      <div className="ticket-main">
        <div className="ticket-top">
          <span className="ticket-title">下一站</span>
          <span className="ticket-note">最近的未蓋章景點 · 按下導航</span>
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
        <span className="ticket-unit">距離</span>
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
