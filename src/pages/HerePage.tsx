// 首頁「蓋章」（2026-11-20 Chris 定稿，取代舊的「我在哪」卡片）
//
// 一打開是一張空白的紙：正中只有一點，波紋一圈圈往外擴散，沒有字、沒有導航。
// 按一下 → 讀位置（波紋變快；第一個能用的位置一到，約 1 秒，就出結果，之後在原地悄悄變準）→ 一圈波紋慢慢掃出去，最近的 10 個景點的長條章（只有字）
// 在原地慢慢浮現，像雷達找到東西：方向是真的（上北下南），離中心越遠 = 實際越遠，近的先出現。同時抬頭（收集進度）和底部導航一起浮現。
// 已經在範圍裏的那個景點落在正中（大一號的實心紅章），亮一圈印泥紅，按它蓋章。讀位置失敗也一樣浮現，正中寫原因。
// 定位只在按的那一下讀一次，不在背景追蹤。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SPOT_BY_ID, label, summary, useCountedStamps, useDistricts, type Spot } from '../lib/districts'
import { monthDay } from '../lib/format'
import { FIX_TTL, SETTLE, formatDistance, startLocate, type Fix, type LocateError, type LocateHandlers } from '../lib/locate'
import { RADAR_N, SEAL_TRACK, layoutRadar, radarSpots, sealSize, shortName, type Placed, type RadarSpot } from '../lib/radar'
import { navToSpot } from '../lib/where'
import { openBook } from '../lib/nav'
import { useStamps, type Stamp } from '../lib/stamps'
import { getFakeLocation } from '../lib/testMode'
import { isIOS, platform } from '../lib/install'
import { StampPage } from '../components/StampPage'
import { BrowserWarnSheet, mustInstallToStamp } from '../components/BrowserWarn'

type State =
  | { k: 'idle'; expired?: boolean }
  | { k: 'locating' }
  | { k: 'error'; err: LocateError }
  | { k: 'done'; fix: Fix }

const params = new URLSearchParams(window.location.search)
const MOCK = params.get('mock') === '1'

/** 試用：?at=s026（假裝在某景點）或 ?at=22.3076,114.2598（假裝在某處）。假位置蓋的章一律是測試章。 */
function demoAt(): { lat: number; lng: number } | null {
  const v = params.get('at')
  if (!v) return null
  if (SPOT_BY_ID[v]) return SPOT_BY_ID[v]
  const [lat, lng] = v.split(',').map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}
const DEMO = demoAt()

/**
 * 假位置也照真的定位那樣交結果：約 0.9 秒先交一個粗的（60 米），1.4 秒後變準（12 米）。
 * 測試工具指定了假誤差（例如 400 米，試「誤差太大不給蓋」）就一直用那個誤差。
 */
function fakeLocate(at: { lat: number; lng: number; acc?: number }, h: LocateHandlers): () => void {
  const fix = (acc: number): Fix => ({ lat: at.lat, lng: at.lng, acc, at: Date.now(), fake: true })
  if (at.acc !== undefined) {
    const t = setTimeout(() => {
      const only = fix(at.acc!)
      h.onFix(only)
      h.onDone(only)
    }, 900)
    return () => clearTimeout(t)
  }
  const t1 = setTimeout(() => h.onFix(fix(60)), 900)
  const t2 = setTimeout(() => {
    const best = fix(12)
    h.onFix(best)
    h.onDone(best)
  }, 2300)
  return () => {
    clearTimeout(t1)
    clearTimeout(t2)
  }
}

/** 設計稿截圖：?mock=1&here=locating / here=done&lat=..&lng=..（或 &spot=s026）/ here=error */
function mockState(): State {
  const h = MOCK ? params.get('here') : null
  if (h === 'locating') return { k: 'locating' }
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

/** 讀不到位置時，正中下面寫的原因 */
const ERROR_TEXT: Record<LocateError, string> = {
  denied: '',
  unavailable: '讀不到位置。請確認手機已開啟定位服務，再試一次。',
  timeout: '定位太久沒有結果。走到比較空曠的地方，再試一次。',
  unsupported: '這個瀏覽器不支援定位，請改用 Safari 或 Chrome。',
}
function deniedText() {
  const p = platform()
  if (p === 'ios' || (p === 'installed' && isIOS))
    return '沒有定位權限。請到 iPhone「設定」→「私隱與安全性」→「定位服務」，確認已開啟，並允許 Safari 網站使用位置，然後回來再按一次。'
  return '沒有定位權限。請按網址列左邊的圖示（或手機「設定」→「應用程式」→ 瀏覽器 →「權限」），允許使用「位置」，然後再按一次。'
}
const reduceMotion = () => MOCK || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/** 正中那個東西佔多大（推開別的章用）：可以蓋的大章連上下兩行字；或者只是你的位置點 */
const AT_FONT = 21
const AT_LINE = 16
const AT_GAP = 6
const CENTER_ME = { w: 40, h: 40 }
const centerAt = (spot: Spot) => {
  const s = sealSize(shortName(spot.name), AT_FONT)
  // 比章闊出來的部分左右平分成整數像素，章的框才會落在整數像素上
  const w = s.w + 2 * Math.ceil(Math.max(0, 150 - s.w) / 2)
  return { w, h: s.h + 2 * (AT_LINE + AT_GAP), seal: s }
}

type Tone = 'done' | 'todo' | 'can'

/**
 * 長條章：只有字（2026-11-20 Chris 定，取代圖案章）。
 * 可以蓋 = 白文（實心印泥紅、紙色字）；蓋過 = 朱文（紅框紅字，雙線框）；沒去過 = 墨藍虛線框。
 */
function TextSeal({ name, font, tone, w, h }: { name: string; font: number; tone: Tone; w: number; h: number }) {
  // 三層：
  // · .tbox：章的位置和大小，一律整數像素（框畫在半個像素上，手機上細虛線會時有時無）
  // · .ink：浮現時「由模糊到清楚」的模糊做在這一層，它比章大一圈（每邊 8 像素）。
  //   模糊直接做在有框的那層的話，iPhone 會在框的邊上裁掉一條，左邊虛線缺一截、動畫完才跳出來（Chris 2026-11-20）
  // · .tseal：章本身，填滿 .tbox，字居中
  return (
    <span className="tbox" style={{ width: w, height: h }}>
      <span className="ink">
        <span className={`tseal tseal-${tone}`} style={{ fontSize: font, letterSpacing: `${SEAL_TRACK}em`, paddingLeft: `${SEAL_TRACK}em` }}>
          {name}
        </span>
      </span>
    </span>
  )
}

export function HerePage({ active, revealed, onReveal }: { active: boolean; revealed: boolean; onReveal: () => void }) {
  const [state, setState] = useState<State>(mockState)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const [sel, setSel] = useState<string | null>(MOCK ? params.get('sel') : null)
  // 蓋章頁：記下打開時的位置。位置過期、或者重新定位，都不會把開着的蓋章頁關掉，也不會留下舊的
  const [stampAt, setStampAt] = useState<{ it: RadarSpot; fix: Fix } | null>(null)
  const stampOpen = useRef(false)
  useEffect(() => {
    stampOpen.current = stampAt !== null
  }, [stampAt])
  const [warnFor, setWarnFor] = useState<RadarSpot | null>(null)
  const [just, setJust] = useState<Stamp | null>(null)
  const [round, setRound] = useState(0) // 每讀一次位置 +1：重播散開的動畫
  const [slow, setSlow] = useState(false) // 定位超過 4.5 秒還沒有結果：正中下面說一句，免得以為卡住了
  const [refining, setRefining] = useState(false) // 已經出了結果，同一次按壓裏還在變準
  // 排位置用的那個位置：第一次出結果時定下；之後變準只更新顏色和距離，章留在原位不跳，
  // 只有正中換了（變準之後發現你已經到了）才重排。位置挪多少都不重排（Chris 2026-11-22：雷達只是大概方向，章一出來就定住）
  const [basis, setBasis] = useState<{ fix: Fix; centerId: string | null } | null>(() => {
    const st = mockState()
    return st.k === 'done' ? { fix: st.fix, centerId: null } : null
  })
  // 這一次按壓裏已經算「到了」的景點（變準之後照樣算，見 radarSpots）
  const arrivedRef = useRef(new Set<string>())
  const cancelRef = useRef<(() => void) | null>(null)
  const districts = useDistricts()
  const counted = useCountedStamps()
  const { ready } = useStamps()
  const s = summary(districts)
  const latest = counted.at(-1)

  const timesBySpot = useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of counted) m[x.spotId] = (m[x.spotId] ?? 0) + 1
    return m
  }, [counted])
  const codeOf = useMemo(() => Object.fromEntries(districts.map((d) => [d.fullName, d])), [districts])
  const districtLabel = (spot: Spot) => (codeOf[spot.district] ? label(codeOf[spot.district]) : spot.district)

  // 紙面大小（雷達按它排）
  const padRef = useRef<HTMLDivElement>(null)
  const [pad, setPad] = useState({ w: 358, h: 480, ox: 179, oy: 240 })
  useLayoutEffect(() => {
    const el = padRef.current
    if (!el) return
    // 雷達的中心（ox、oy）要落在畫面的整數像素上：例如 iPhone 15 闊 393，正中是 196.5，
    // 所有章就會落在半個像素上，細虛線框在手機上時有時無
    const measure = () => {
      // 切到別的分頁時首頁藏起來，量到 0：不理（不然回來時章會從錯的位置滑回來）
      if (!el.clientWidth || !el.clientHeight) return
      const r = el.getBoundingClientRect()
      setPad({ w: el.clientWidth, h: el.clientHeight, ox: Math.round(r.left + r.width / 2) - r.left, oy: Math.round(r.top + r.height / 2) - r.top })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fix = state.k === 'done' ? state.fix : null
  // 最新（最準）的位置：顏色、距離、能不能蓋都跟它
  // （arrivedRef 在交位置時 onFix 裏已經更新好，所以只跟 fix）
  const data = useMemo(() => (fix ? radarSpots(fix, RADAR_N, arrivedRef.current) : null), [fix])
  const live = useMemo(() => new Map([data?.center, ...(data?.around ?? [])].filter((x): x is RadarSpot => !!x).map((x) => [x.spot.id, x])), [data])
  const liveOf = (p: RadarSpot) => live.get(p.spot.id) ?? p
  // 排位置的那一份
  const geo = useMemo(() => (basis ? radarSpots(basis.fix, RADAR_N, arrivedRef.current) : null), [basis])
  const [fontsVer, setFontsVer] = useState(0)
  useEffect(() => {
    document.fonts?.ready.then(() => setFontsVer(1))
  }, [])
  // fontsVer：網頁字體載入之後重排一次（章的寬度是用真的字體量的）
  const layout = useMemo(
    () => (geo ? layoutRadar(geo, pad.w, pad.h, geo.center ? centerAt(geo.center.spot) : CENTER_ME) : null),
    [geo, pad, fontsVer],
  )
  const center = geo?.center ? liveOf(geo.center) : null
  const atBox = geo?.center ? centerAt(geo.center.spot) : null
  const selectedP = layout?.placed.find((p) => p.spot.id === sel) ?? null
  const selected = selectedP ? liveOf(selectedP) : null

  const run = useCallback(() => {
    cancelRef.current?.()
    arrivedRef.current = new Set()
    setSel(null)
    setJust(null)
    setStampAt(null)
    setWarnFor(null)
    setBasis(null)
    setRefining(false)
    setState({ k: 'locating' })
    setSlow(false)
    const slowTimer = setTimeout(() => setSlow(true), SETTLE + 500)
    let first = true
    const handlers: LocateHandlers = {
      onFix: (f) => {
        const d = radarSpots(f, RADAR_N, arrivedRef.current)
        for (const x of [d.center, ...d.around]) if (x?.can) arrivedRef.current.add(x.spot.id)
        const centerId = d.center?.spot.id ?? null
        setState({ k: 'done', fix: f })
        // 章一出來就定住：位置變準只在後台更新能不能蓋、距離，不換章、不挪位。只有正中換了（發現你已經到了）才重排
        setBasis((b) => (b && b.centerId === centerId ? b : { fix: f, centerId }))
        if (first) {
          first = false
          clearTimeout(slowTimer)
          setSlow(false)
          setRefining(true)
          setRound((r) => r + 1)
          onReveal() // 抬頭和導航一起浮現
        }
      },
      onDone: () => {
        cancelRef.current = null
        setRefining(false)
      },
      onError: (err) => {
        cancelRef.current = null
        clearTimeout(slowTimer)
        setSlow(false)
        setState({ k: 'error', err })
        setRound((r) => r + 1)
        onReveal() // 讀不到也一樣浮現
      },
    }
    const fake = DEMO ?? getFakeLocation()
    const cancel = fake ? fakeLocate(fake, handlers) : startLocate(handlers)
    cancelRef.current = () => {
      cancel()
      clearTimeout(slowTimer)
    }
  }, [onReveal])
  useEffect(() => () => cancelRef.current?.(), [])

  // 位置太舊就作廢（從後台回來、或者從別的分頁切回來時檢查），要再按一次
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return
      // 正在蓋章（蓋章頁開着）時不作廢：蓋章頁用的是打開時的位置
      if (stampOpen.current) return
      const st = stateRef.current
      if (st.k !== 'done' || st.fix.fake || MOCK || Date.now() - st.fix.at <= FIX_TTL) return
      cancelRef.current?.()
      setState({ k: 'idle', expired: true })
      setBasis(null)
      setSel(null)
      setWarnFor(null)
    }
    if (active) check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [active])

  // 浮現（像雷達找到東西）：一圈波紋從正中慢慢掃出去，掃到哪個章，那個章就在原地從紙底下慢慢透出來
  // （由淡到濃、由模糊到清楚，位置一點都不動），不飛、不彈、不往上移。近的先出現。
  // 動畫做在每個章的 .ink 那層（比章大一圈，見 TextSeal）和正中的兩行字，不做在按鈕上、也不做在有框的那層：
  // iPhone 做模糊時會在圖層的邊上裁掉一條，邊上剛好是框的話，虛線左邊就缺一截、動畫完了才突然跳出來（Chris 2026-11-20）。
  const radarRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = radarRef.current
    if (!root || !layout || round === 0 || reduceMotion()) return
    const SWEEP = 2000
    root.querySelector('.sweep')?.animate(
      [
        { transform: 'scale(0.02)', opacity: 0.5 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: SWEEP, easing: 'linear' },
    )
    // 等待（delay）直接寫進動畫的前一段（一直透明），不靠 delay + fill: 'backwards'：
    // iPhone 上那樣做等待期間不一定是透明的，CSS 的淡入（.rs .ink）會先把章顯示出來，
    // 等到動畫開始又從透明重來 → 章「虛一下、消失、再浮現」（Chris 2026-11-22）
    const EASE = 'cubic-bezier(.3,.5,.3,1)'
    const emerge = (el: Element, delay: number) => {
      ;(el as HTMLElement).style.animation = 'none' // 關掉 CSS 的淡入，只用這一個
      const total = delay + 1400
      const d = delay / total
      return el.animate(
        [
          { opacity: 0, filter: 'blur(5px)', offset: 0 },
          { opacity: 0, filter: 'blur(5px)', offset: d, easing: EASE },
          { opacity: 0.4, filter: 'blur(2.5px)', offset: d + (1 - d) * 0.35, easing: EASE },
          { opacity: 1, filter: 'blur(0px)', offset: 1 },
        ],
        { duration: total },
      )
    }
    root.querySelectorAll<HTMLElement>('.rs').forEach((el) => {
      // 波紋走到這個章的半徑時開始透出來（波紋是勻速的，所以時間跟半徑成正比）
      const r = Number(el.dataset.r)
      const ink = el.querySelector('.ink')
      if (ink) emerge(ink, Math.max(0, (r / (layout.R + 20)) * SWEEP - 150))
    })
    root.querySelectorAll('.at-top, .at .ink, .at-hint').forEach((el) => emerge(el, 0))
    root.querySelectorAll<HTMLElement>('.north').forEach((el) =>
      el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1 }], { duration: 1600 }),
    )
    // 只在新讀到位置時播，排版因為紙面大小改變而重算時不播
  }, [round])

  // 按正中的大章：先檢查位置還有效、iPhone 瀏覽器要先加主畫面，然後打開蓋章頁（真正存章在蓋章頁壓到底那一下）
  const stamp = (it: RadarSpot) => {
    if (!fix) return
    if (!fix.fake && Date.now() - fix.at > FIX_TTL) {
      setState({ k: 'idle', expired: true })
      return
    }
    if (mustInstallToStamp()) {
      setWarnFor(it)
      return
    }
    setStampAt({ it, fix })
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
        <div className="radar" ref={radarRef} style={{ left: pad.ox, top: pad.oy }}>
          {/* 還沒有結果：正中一點 + 波紋 */}
          {(k === 'idle' || k === 'locating') && (
            <span className="ripples" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}

          {layout && k === 'done' && (
            <>
              <span className="sweep" style={{ left: -layout.R - 20, top: -layout.R - 20, width: layout.R * 2 + 40, height: layout.R * 2 + 40 }} aria-hidden="true" />
              <span className="north" style={{ top: -layout.R - 19 }} aria-hidden="true">
                北
              </span>
              {layout.placed.map((p) => (
                <RadarStamp key={p.spot.id} p={p} live={liveOf(p)} tone={tone(liveOf(p))} selected={sel === p.spot.id} onClick={() => setSel(sel === p.spot.id ? null : p.spot.id)} />
              ))}
            </>
          )}

          {/* 正中：可以蓋的大章，或者你的位置點 */}
          {center && fix && atBox && k === 'done' ? (
            <button
              type="button"
              className="at"
              style={{ left: -Math.round(atBox.w / 2), top: -Math.round(atBox.h / 2), width: Math.round(atBox.w), height: Math.round(atBox.h) }}
              onClick={() => stamp(center)}
              aria-label={`你已到達${center.spot.name}，按一下蓋章`}
            >
              <span className="arrive" aria-hidden="true" />
              <span className="at-top">你已到達</span>
              <TextSeal name={shortName(center.spot.name)} font={AT_FONT} tone="can" w={atBox.seal.w} h={atBox.seal.h} />
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
          {k === 'locating' && slow && (
            <p className="home-msg home-slow" role="status">
              訊號比較弱，再等幾秒……
              <br />
              在室內或高樓之間會慢一點
            </p>
          )}
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
            {refining ? ' · 還在對準…' : data && !data.accurate && ' · 太大，暫時不能蓋章'} ·{' '}
            <button type="button" className="link" onClick={run}>
              重新定位
            </button>
          </>
        )}
      </p>

      {stampAt && <StampPage spot={stampAt.it.spot} fix={fix ?? stampAt.fix} distance={stampAt.it.d} onClose={closeStamp} onSaved={setJust} />}
      <BrowserWarnSheet open={warnFor !== null} onClose={() => setWarnFor(null)} />
    </div>
  )
}

/** p：位置（排版那一份）；live：最新位置算出來的能不能蓋、距離 */
function RadarStamp({ p, live, tone, selected, onClick }: { p: Placed; live: RadarSpot; tone: Tone; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rs rs-${tone}${live.almost ? ' rs-almost' : ''}${selected ? ' sel' : ''}`}
      style={{ left: Math.round(p.x - p.w / 2), top: Math.round(p.y - p.h / 2), width: p.w, height: p.h }}
      data-r={p.r}
      onClick={onClick}
      aria-label={`${p.spot.name}，${live.can ? '在範圍裏，可以蓋章' : `距離 ${dist(live.d)}`}`}
    >
      <TextSeal name={shortName(p.spot.name)} font={p.font} tone={tone} w={p.w} h={p.h} />
    </button>
  )
}
