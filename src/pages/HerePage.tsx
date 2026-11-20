// 首頁（2026-11-20 原型，網址 ?home=a）
//
// 一打開是一張空白的紙：正中只有一點，波紋一圈圈往外擴散，沒有字、沒有導航。
// 按一下 → 讀位置（波紋變快，誤差圈越縮越小）→ 最近的 10 個景點變成小印章，從中間向四周散開：
// 方向是真的（上北下南），離中心越遠 = 實際越遠，近的先出現。同時抬頭（收集進度）和底部導航一起浮現。
// 已經在範圍裏的那個景點落在正中，大一號、亮一圈印泥紅，按它蓋章。讀位置失敗也一樣浮現，正中寫原因。
// 定位只在按的那一下讀一次，不在背景追蹤。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SPOT_BY_ID, label, summary, useCountedStamps, useDistricts, type Spot } from '../lib/districts'
import { monthDay } from '../lib/format'
import { FIX_TTL, formatDistance, locate, type Fix, type LocateError } from '../lib/locate'
import { layoutRadar, radarSpots, shortName, type Placed, type RadarSpot } from '../lib/radar'
import { navToSpot } from '../lib/where'
import { PICTOS, pictoFor } from '../lib/pictos'
import { openBook } from '../lib/nav'
import { useStamps, type Stamp } from '../lib/stamps'
import { getFakeLocation } from '../lib/testMode'
import { StampPage } from '../components/StampPage'
import { BrowserWarnSheet, needsBrowserWarning } from '../components/BrowserWarn'
import { ERROR_TEXT, deniedText } from '../components/WhereAmI'

type State =
  | { k: 'idle'; expired?: boolean }
  | { k: 'locating'; acc: number | null }
  | { k: 'error'; err: LocateError }
  | { k: 'done'; fix: Fix }

const params = new URLSearchParams(window.location.search)
const MOCK = params.get('mock') === '1'

/** 試用：?home=a&at=s026（假裝在某景點）或 &at=22.3076,114.2598（假裝在某處）。假位置蓋的章一律是測試章。 */
function demoAt(): { lat: number; lng: number } | null {
  const v = params.get('at')
  if (!v) return null
  if (SPOT_BY_ID[v]) return SPOT_BY_ID[v]
  const [lat, lng] = v.split(',').map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}
const DEMO = demoAt()

/** 設計稿截圖：?mock=1&here=locating&acc=60 / here=done&lat=..&lng=..（或 &spot=s026）/ here=error */
function mockState(): State {
  const h = MOCK ? params.get('here') : null
  if (h === 'locating') return { k: 'locating', acc: Number(params.get('acc') ?? 60) }
  if (h === 'error') return { k: 'error', err: 'denied' }
  if (h === 'done') {
    const s = SPOT_BY_ID[params.get('spot') ?? '']
    return { k: 'done', fix: { lat: Number(params.get('lat') ?? s?.lat), lng: Number(params.get('lng') ?? s?.lng), acc: 12, at: Date.now() } }
  }
  return { k: 'idle' }
}
export const HOME_MOCK_REVEALED = MOCK && !!params.get('here') && params.get('here') !== 'idle'

const clock = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)
const dist = (m: number) => {
  const f = formatDistance(m)
  return `${f.num} ${f.unit}`
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const reduceMotion = () => MOCK || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/** 誤差（米）→ 誤差圈的直徑（像素）：300 米以上畫最大，越準越小 */
const accPx = (acc: number) => Math.round(30 + (Math.min(acc, 300) / 300) * 230)

/** 正中那個東西佔多大（推開別的章用）：可以蓋的大章連上下的字；或者只是你的位置點 */
const AT_SIZE = 92
const CENTER_AT = { w: 150, h: 170, oy: 19 }
const CENTER_ME = { w: 40, h: 40, oy: 0 }

/** 小印章：八角框 + 類型圖案。蓋過 = 紅；沒去過 = 墨藍虛線 */
function MiniSeal({ spot, size, tone }: { spot: Spot; size: number; tone: 'done' | 'todo' | 'can' }) {
  const sw = 1.5 / ((size / 100) * 0.56)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={`seal seal-${tone}`}>
      <path
        d="M30 3H70L97 30V70L70 97H30L3 70V30Z"
        fill={tone === 'todo' ? 'var(--paper)' : 'var(--card)'}
        stroke="currentColor"
        strokeWidth={tone === 'todo' ? 150 / size : 220 / size}
        strokeDasharray={tone === 'todo' ? `${700 / size} ${520 / size}` : undefined}
        strokeLinejoin="round"
      />
      <g transform="translate(22 21) scale(0.56)" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={tone === 'todo' ? 0.55 : 1}>
        <path d={PICTOS[pictoFor(spot.kind, spot.id)]} />
      </g>
    </svg>
  )
}

export function HerePage({ active, revealed, onReveal }: { active: boolean; revealed: boolean; onReveal: () => void }) {
  const [state, setState] = useState<State>(mockState)
  const [sel, setSel] = useState<string | null>(MOCK ? params.get('sel') : null)
  const [stampAt, setStampAt] = useState<RadarSpot | null>(null)
  const [warnFor, setWarnFor] = useState<RadarSpot | null>(null)
  const [just, setJust] = useState<Stamp | null>(null)
  const [round, setRound] = useState(0) // 每讀一次位置 +1：重播散開的動畫
  const districts = useDistricts()
  const counted = useCountedStamps()
  const { ready, stamps } = useStamps()
  const s = summary(districts)
  const latest = counted.at(-1)
  const realCount = stamps.filter((x) => !x.test).length

  const timesBySpot = useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of counted) m[x.spotId] = (m[x.spotId] ?? 0) + 1
    return m
  }, [counted])
  const codeOf = useMemo(() => Object.fromEntries(districts.map((d) => [d.fullName, d])), [districts])
  const districtLabel = (spot: Spot) => (codeOf[spot.district] ? label(codeOf[spot.district]) : spot.district)

  // 紙面大小（雷達按它排）
  const padRef = useRef<HTMLDivElement>(null)
  const [pad, setPad] = useState({ w: 358, h: 480 })
  useLayoutEffect(() => {
    const el = padRef.current
    if (!el) return
    const measure = () => setPad({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fix = state.k === 'done' ? state.fix : null
  const data = useMemo(() => (fix ? radarSpots(fix) : null), [fix])
  const center = data?.center ?? null
  const layout = useMemo(() => (data ? layoutRadar(data, pad.w, pad.h, center ? CENTER_AT : CENTER_ME) : null), [data, pad, center])
  const selected = layout?.placed.find((p) => p.spot.id === sel) ?? null

  const run = useCallback(async () => {
    setSel(null)
    setJust(null)
    setState({ k: 'locating', acc: null })
    const fake = DEMO ?? getFakeLocation()
    let next: State
    if (fake) {
      // 假位置：照樣播一次定位的樣子，看得到整個流程
      for (const acc of [180, 70, 25]) {
        await sleep(450)
        setState({ k: 'locating', acc })
      }
      await sleep(400)
      next = { k: 'done', fix: { lat: fake.lat, lng: fake.lng, acc: 12, at: Date.now(), fake: true } }
    } else {
      try {
        next = { k: 'done', fix: await locate((acc) => setState({ k: 'locating', acc })) }
      } catch (err) {
        next = { k: 'error', err: err as LocateError }
      }
    }
    setState(next)
    setRound((r) => r + 1)
    onReveal() // 不管成功還是失敗，抬頭和導航都浮現出來
  }, [onReveal])

  // 位置太舊就作廢（從後台回來、或者從別的分頁切回來時檢查），要再按一次
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return
      setState((st) => (st.k === 'done' && !st.fix.fake && !MOCK && Date.now() - st.fix.at > FIX_TTL ? { k: 'idle', expired: true } : st))
    }
    if (active) check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [active])

  // 散開的動畫：每個小章從正中飛到自己的位置，近的先走；一圈波紋同時掃出去
  const radarRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = radarRef.current
    if (!root || !layout || round === 0 || reduceMotion()) return
    const SWEEP = 1100
    root.querySelector('.sweep')?.animate(
      [
        { transform: 'scale(0.02)', opacity: 0.55 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: SWEEP, easing: 'cubic-bezier(.2,.6,.35,1)' },
    )
    root.querySelectorAll<HTMLElement>('.rs').forEach((el) => {
      const x = Number(el.dataset.x)
      const y = Number(el.dataset.y)
      const r = Number(el.dataset.r)
      el.animate(
        [
          { transform: `translate(${-x}px, ${-y}px) scale(0.2)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 700, delay: 120 + (r / layout.R) * (SWEEP - 250), easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' },
      )
    })
    root.querySelectorAll<HTMLElement>('.ring, .ring-text, .north').forEach((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 300, fill: 'backwards' }),
    )
    // 只在新讀到位置時播，排版因為紙面大小改變而重算時不播
  }, [round])

  // 按正中的大章：先檢查位置還有效、瀏覽器提醒，然後打開蓋章頁（真正存章在蓋章頁壓到底那一下）
  const stamp = (it: RadarSpot, confirmed = false) => {
    if (!fix) return
    if (!fix.fake && Date.now() - fix.at > FIX_TTL) {
      setState({ k: 'idle', expired: true })
      return
    }
    if (!fix.fake && !confirmed && realCount === 0 && needsBrowserWarning()) {
      setWarnFor(it)
      return
    }
    setStampAt(it)
  }
  const closeStamp = useCallback(() => setStampAt(null), [])

  const tone = (it: RadarSpot) => (it.can ? 'can' : timesBySpot[it.spot.id] ? 'done' : 'todo')
  const k = state.k

  return (
    <div className={`home st-${k}`}>
      <div className={revealed ? 'home-chrome' : 'home-chrome off'} inert={!revealed}>
        <span className="eyebrow">遊歷護照 · 編號 0008</span>
        <h1 className="app-title">點亮香港</h1>
        <p className="here-stats">
          已點亮 <b>{ready ? s.lit : '–'}</b> / 18 區　景點章 <b>{ready ? s.stamps : '–'}</b> / {s.total} 枚
          {latest && <span>　最近 {monthDay(latest.at)}</span>}
        </p>
      </div>

      <div
        className="home-pad"
        ref={padRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSel(null)
        }}
      >
        {/* 還沒有結果：整張紙都可以按（看起來只有正中一點） */}
        {(k === 'idle' || k === 'error') && <button type="button" className="pad-all" onClick={run} aria-label="讀取位置，看看附近可以蓋甚麼章" />}
        <div className="radar" ref={radarRef}>
          {/* 還沒有結果：正中一點 + 波紋 */}
          {(k === 'idle' || k === 'locating') && (
            <span className="ripples" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
          {k === 'locating' && state.acc != null && <span className="acc" style={{ width: accPx(state.acc), height: accPx(state.acc) }} aria-hidden="true" />}

          {layout && (
            <>
              <span className="sweep" style={{ left: -layout.R - 20, top: -layout.R - 20, width: layout.R * 2 + 40, height: layout.R * 2 + 40 }} aria-hidden="true" />
              {layout.rings.map((g) => (
                <span key={g.text} className="ring" style={{ width: g.r * 2, height: g.r * 2 }} aria-hidden="true" />
              ))}
              {layout.rings.map((g) => (
                <span key={g.text} className="ring-text" style={{ left: g.lx, top: g.ly }} aria-hidden="true">
                  {g.text}
                </span>
              ))}
              <span className="north" style={{ top: -layout.R - 19 }} aria-hidden="true">
                北
              </span>
              {layout.placed.map((p) => (
                <RadarStamp key={p.spot.id} p={p} tone={tone(p)} selected={sel === p.spot.id} onClick={() => setSel(sel === p.spot.id ? null : p.spot.id)} />
              ))}
            </>
          )}

          {/* 正中：可以蓋的大章，或者你的位置點 */}
          {center && fix ? (
            <button type="button" className="at" onClick={() => stamp(center)} aria-label={`你已到達${center.spot.name}，按一下蓋章`}>
              <span className="arrive" aria-hidden="true" />
              <span className="at-top">你已到達</span>
              <MiniSeal spot={center.spot} size={AT_SIZE} tone="can" />
              <span className="at-name">{shortName(center.spot.name)}</span>
              <span className="at-hint">
                {just?.spotId === center.spot.id ? (just.test ? '測試章已蓋好 · 可以再蓋' : `No. ${just.no} 已蓋好 · 可以再蓋`) : timesBySpot[center.spot.id] ? `第 ${timesBySpot[center.spot.id] + 1} 次來 · 按一下蓋章` : '第一次來 · 按一下蓋章'}
              </span>
            </button>
          ) : k === 'done' ? (
            <button type="button" className="me" onClick={run} aria-label="你在這裏 · 按一下重新讀取位置">
              <span className="me-dot" aria-hidden="true" />
            </button>
          ) : (
            <span className="me" aria-hidden="true">
              <span className="me-dot" />
            </span>
          )}

          {k === 'error' && (
            <p className="home-msg" role="alert">
              {state.err === 'denied' ? deniedText() : ERROR_TEXT[state.err]}
              <br />
              <b>按中間的點再試一次</b>
            </p>
          )}
          {k === 'idle' && state.expired && <p className="home-msg">剛才的位置已經過了 5 分鐘，按中間的點再讀一次</p>}
        </div>

        {/* 按了某個小章：名字、距離、帶我去 */}
        {selected && fix && (
          <div className="rs-card" role="dialog" aria-label={selected.spot.name}>
            <div className="rs-card-text">
              <b>{selected.spot.name}</b>
              <span>
                {selected.spot.area === districtLabel(selected.spot) ? districtLabel(selected.spot) : `${selected.spot.area} · ${districtLabel(selected.spot)}`}
                {' · '}
                {selected.can ? '在範圍裏' : `距離 ${dist(selected.d)}`}
              </span>
              <span>
                {timesBySpot[selected.spot.id] ? (
                  <button type="button" className="link" onClick={() => openBook(selected.spot.id)}>
                    蓋過 {timesBySpot[selected.spot.id]} 次 · 看印章冊
                  </button>
                ) : (
                  '還沒有來過'
                )}
              </span>
            </div>
            {selected.can ? (
              <button type="button" className="btn-seal" onClick={() => stamp(selected)}>
                蓋章
              </button>
            ) : (
              <a className="go-btn" href={navToSpot(selected.spot, fix)} target="_blank" rel="noopener">
                帶我去 ›
              </a>
            )}
          </div>
        )}
      </div>

      <p className={revealed && fix ? 'home-status' : 'home-status off'}>
        {fix && (
          <>
            {fix.fake ? '假位置（試用）' : `${clock(fix.at)} 的位置`} · 誤差約 {fix.acc} 米
            {data && !data.accurate && ' · 太大，暫時不能蓋章'} ·{' '}
            <button type="button" className="link" onClick={run}>
              重新定位
            </button>
          </>
        )}
      </p>

      {stampAt && fix && <StampPage spot={stampAt.spot} fix={fix} distance={stampAt.d} onClose={closeStamp} onSaved={setJust} />}
      <BrowserWarnSheet
        open={warnFor !== null}
        onCancel={() => setWarnFor(null)}
        onConfirm={() => {
          const w = warnFor
          setWarnFor(null)
          if (w) stamp(w, true)
        }}
      />
    </div>
  )
}

function RadarStamp({ p, tone, selected, onClick }: { p: Placed; tone: 'done' | 'todo' | 'can'; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rs rs-${tone}${p.almost ? ' rs-almost' : ''}${selected ? ' sel' : ''}`}
      style={{ left: p.x - p.w / 2, top: p.y - p.size / 2, width: p.w, transformOrigin: `${p.w / 2}px ${p.size / 2}px` }}
      data-x={p.x}
      data-y={p.y}
      data-r={p.r}
      onClick={onClick}
      aria-label={`${p.spot.name}，${p.can ? '在範圍裏，可以蓋章' : `距離 ${dist(p.d)}`}`}
    >
      <MiniSeal spot={p.spot} size={p.size} tone={tone} />
      <span className="rs-name">{shortName(p.spot.name)}</span>
    </button>
  )
}
