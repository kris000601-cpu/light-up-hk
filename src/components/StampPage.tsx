// 蓋章頁：手指就是印章。按住紙上任何位置 0.7 秒，章紋從手指處以「鋼印凸紋」浮現，越壓越深；
// 後半程紅墨隨壓力滲進凸紋；最後約 0.1 秒減速「著陸」；壓到底即「咔嗒」（聲音 + 安卓震動），
// 只補最後一點紅，章本身一像素都不動。手指抬起後紙才回彈。未滿 0.7 秒放手就平滑退回。
// 濕墨約 1.6 秒內不變，之後按紙纖維噪聲不均勻變乾，約 20 秒乾透。
//
// 互動邏輯移植自 design/prototype/emboss-logic.js（定稿原型 A-Emboss），數字以原型為準。
// 動畫每一幀直接改 DOM 的 style（不經 React 重畫），所以手機上也順。
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { label, useCountedStamps, useDistricts, type Spot } from '../lib/districts'
import { formatDistance, type Fix } from '../lib/locate'
import { addStamp, useStamps, type Stamp } from '../lib/stamps'
import { holdUpdates } from '../lib/updates'
import { DRY_THRESHOLDS, DryStamp, StampLayer, faceOf } from './StampArt'

interface Props {
  spot: Spot
  fix: Fix
  /** 到景點本身的距離（米） */
  distance: number
  onClose: () => void
  /** 存好之後告訴首頁（「附近可蓋章」那裏顯示「已蓋章」） */
  onSaved?: (s: Stamp) => void
}

const GUIDED_KEY = 'lhk.stampGuided'
const readGuided = () => {
  try {
    return localStorage.getItem(GUIDED_KEY) === '1'
  } catch {
    return false
  }
}

// ---------- 緩動 ----------
const eOut = (t: number) => 1 - Math.pow(1 - t, 3)
const eQuart = (t: number) => 1 - Math.pow(1 - t, 4)
const eSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t)
/** 壓力越來越快，最後 15%（約 0.1 秒）減速著陸，像紙在底部頂回來 */
function pressCurve(p: number) {
  const L = 0.85, top = 0.93
  if (p <= L) return top * Math.pow(p / L, 1.6)
  return top + (1 - top) * eOut((p - L) / (1 - L))
}
const setMask = (n: HTMLElement, v: string) => {
  n.style.webkitMaskImage = v
  n.style.maskImage = v
}
const ymd = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms).replace(/-/g, '.')

type Mode = 'idle' | 'press' | 'retreat' | 'set'
type Phase = 'idle' | 'press' | 'done'

export function StampPage({ spot, fix, distance, onClose, onSaved }: Props) {
  const districts = useDistricts()
  const counted = useCountedStamps()
  const { stamps } = useStamps()
  const reduce = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])
  const holdMs = reduce ? 300 : 700

  // 打開時定下來的資料（蓋完之後印章列表會變，這些不要跟着變）
  const [info] = useState(() => {
    const d = districts.find((x) => x.fullName === spot.district)!
    const before = counted.filter((s) => s.spotId === spot.id)
    const firstVisit = [...new Set(counted.map((s) => s.spotId))]
    const page = firstVisit.includes(spot.id) ? firstVisit.indexOf(spot.id) + 1 : firstVisit.length + 1
    const realMax = stamps.reduce((m, s) => (s.test ? m : Math.max(m, s.no)), 0)
    const at = Date.now()
    return {
      d,
      before,
      page,
      at,
      visitedAfter: d.visited + (d.done[spot.id] ? 0 : 1),
      face: faceOf({ at, no: fix.fake ? null : realMax + 1, name: spot.name, district: label(d), kind: spot.kind }),
    }
  })
  const { d, before, page, face } = info

  const [phase, setPhase] = useState<Phase>('idle')
  const [guided, setGuided] = useState(readGuided)
  const [saved, setSaved] = useState<Stamp | null>(null)
  const [saveError, setSaveError] = useState(false)

  // ---------- 動畫狀態（放在 ref 裏，每幀直接改 DOM） ----------
  const el = {
    stage: useRef<HTMLDivElement>(null),
    stamp: useRef<HTMLDivElement>(null),
    emb: useRef<HTMLDivElement>(null),
    shadow: useRef<HTMLDivElement>(null),
    hi: useRef<HTMLDivElement>(null),
    ink: useRef<HTMLDivElement>(null),
    dent: useRef<HTMLDivElement>(null),
    touch: useRef<HTMLDivElement>(null),
  }
  const st = useRef({ mode: 'idle' as Mode, p: 0, s: 0, r: 0, lifted: false, raf: 0, lx: 115, ly: 95, maxR: 160, cx: 0, cy: 0, rot: 0, W: 0, H: 0 })
  const ctx = useRef<AudioContext | null>(null)
  const pos = useRef<{ px: number; py: number; rot: number } | null>(null)

  // 聲音引擎先建好（第一次建要約 80 毫秒），按下去時只需 resume，不會卡
  useEffect(() => {
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (C) ctx.current = new C()
    } catch {
      /* 沒有聲音也照樣蓋 */
    }
    const s = st.current
    return () => {
      cancelAnimationFrame(s.raf)
      ctx.current?.close().catch(() => {})
    }
  }, [])

  // 蓋章頁開着時，App 的自動更新先等一等
  useEffect(() => holdUpdates(), [])

  // 手機的「返回」手勢 / 按鍵：關掉蓋章頁，不離開 App
  useEffect(() => {
    if (!history.state?.stampPage) history.pushState({ stampPage: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])
  const back = () => (history.state?.stampPage ? history.back() : onClose())

  // ---------- 聲音和震動 ----------
  const noise = (dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass', delay = 0) => {
    try {
      const c = ctx.current
      if (!c) return
      if (c.state === 'suspended') c.resume()
      const n = Math.floor(c.sampleRate * dur)
      const buf = c.createBuffer(1, n, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3)
      const src = c.createBufferSource()
      src.buffer = buf
      const f = c.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      const g = c.createGain()
      g.gain.value = gain
      src.connect(f)
      f.connect(g)
      g.connect(c.destination)
      src.start(c.currentTime + delay)
    } catch {
      /* 沒有聲音也照樣蓋 */
    }
  }
  const buzz = (ms: number) => {
    try {
      navigator.vibrate?.(ms)
    } catch {
      /* iPhone 不支援震動 */
    }
  }

  // ---------- 章從手指處長出來 ----------
  const place = (clientX: number | null, clientY: number | null, isMouse: boolean) => {
    const s = st.current
    const stage = el.stage.current!
    const W = stage.offsetWidth, H = stage.offsetHeight
    s.W = W
    s.H = H
    let fx = W / 2, fy = H * 0.42
    if (clientX != null && clientY != null) {
      const r = stage.getBoundingClientRect()
      fx = clientX - r.left
      fy = clientY - r.top
    }
    // 章的中心不要出界：左右各留 113，上留 93，下留 138（底下有提示字）
    const cx = Math.min(W - 113, Math.max(113, fx)), cy = Math.min(H - 138, Math.max(93, fy))
    const rot = -6 + Math.random() * 9
    const a = (rot * Math.PI) / 180, dx = fx - cx, dy = fy - cy
    s.lx = 115 + dx * Math.cos(a) + dy * Math.sin(a)
    s.ly = 95 - dx * Math.sin(a) + dy * Math.cos(a)
    s.maxR = Math.max(Math.hypot(s.lx, s.ly), Math.hypot(230 - s.lx, s.ly), Math.hypot(s.lx, 190 - s.ly), Math.hypot(230 - s.lx, 190 - s.ly)) + 4
    s.cx = cx
    s.cy = cy
    s.rot = rot
    el.stamp.current!.style.transform = `translate(${cx - 115}px,${cy - 95}px) rotate(${rot.toFixed(2)}deg)`
    el.dent.current!.style.transform = `translate(${fx - 130}px,${fy - 130}px)`
    const t = el.touch.current!
    t.style.transform = `translate(${fx - 22}px,${fy - 22}px)`
    t.style.opacity = isMouse ? '1' : '0'
  }

  // ---------- 一幀 ----------
  const apply = () => {
    const s = st.current
    const E = { emb: el.emb.current, shadow: el.shadow.current, hi: el.hi.current, stamp: el.stamp.current, dent: el.dent.current, ink: el.ink.current }
    if (!E.emb || !E.shadow || !E.hi || !E.stamp || !E.dent || !E.ink) return
    const p = s.p
    let depth = pressCurve(p)
    // 手指抬起後紙慢慢放鬆：凸紋約 2.5 秒內回到一半深
    if (s.mode === 'set') depth *= 1 - 0.5 * eSine(s.r)
    // 顯現半徑最後超出最遠的角一整個羽化寬度：p = 1 時凸紋已經完全出現，墨落下時不會跳
    const feather = 26 + 30 * (1 - p)
    const r = (s.maxR + feather) * eQuart(p)
    const a = Math.max(0, r - feather).toFixed(1), b = Math.max(0.1, r).toFixed(1)
    setMask(E.emb, `radial-gradient(circle at ${s.lx.toFixed(1)}px ${s.ly.toFixed(1)}px, #000 ${a}px, rgba(0,0,0,0) ${b}px)`)
    E.emb.style.opacity = Math.max(0.001, Math.min(1, p * 4)).toFixed(3)
    E.shadow.style.transform = `translate(${(1.7 * depth).toFixed(2)}px,${(1.9 * depth).toFixed(2)}px)`
    E.shadow.style.opacity = Math.max(0.001, 0.34 * depth).toFixed(3)
    E.hi.style.transform = `translate(${(-1.1 * depth).toFixed(2)}px,${(-1.2 * depth).toFixed(2)}px)`
    E.hi.style.opacity = Math.max(0.001, depth).toFixed(3)
    E.stamp.style.scale = (1.012 - 0.012 * pressCurve(p)).toFixed(4)
    let dent = 0.9 * pressCurve(p)
    if (s.mode === 'set') dent *= 1 - eOut(s.s)
    E.dent.style.opacity = dent.toFixed(3)
    // 後半程紅墨隨壓力滲進凸紋，咔嗒時只補最後一點紅：不會從紙白一下閃成紅
    if (s.mode !== 'set') {
      const k = Math.max(0, Math.min(1, (p - 0.45) / 0.55))
      E.ink.style.transition = 'none'
      E.ink.style.opacity = Math.max(0.001, 0.82 * eSine(k) * eSine(k)).toFixed(3)
    }
  }

  const loop = () => {
    const s = st.current
    if (s.raf) return
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (s.mode === 'press') {
        s.p = Math.min(1, s.p + dt / holdMs)
        if (s.p >= 1) commit()
      } else if (s.mode === 'retreat') {
        s.p = Math.max(0, s.p - dt / 320)
      } else if (s.mode === 'set' && s.lifted) {
        // 手指抬起之後紙才回彈
        s.s = Math.min(1, s.s + dt / 420)
        s.r = Math.min(1, s.r + dt / (reduce ? 300 : 2500))
      }
      apply()
      const more = s.mode === 'press' || (s.mode === 'retreat' && s.p > 0) || (s.mode === 'set' && s.lifted && (s.s < 1 || s.r < 1))
      if (s.mode === 'retreat' && s.p <= 0) {
        s.mode = 'idle'
        setPhase('idle')
      }
      s.raf = more ? requestAnimationFrame(step) : 0
    }
    s.raf = requestAnimationFrame(step)
  }

  const save = async () => {
    setSaveError(false)
    try {
      const p = pos.current
      const rec = await addStamp({
        spotId: spot.id,
        spotName: spot.name,
        district: spot.district,
        lat: fix.lat,
        lng: fix.lng,
        acc: fix.acc,
        ...(p ?? {}),
        ...(fix.fake ? { test: true } : {}),
      })
      setSaved(rec)
      onSaved?.(rec)
    } catch {
      setSaveError(true)
    }
  }

  // ---------- 咔嗒：壓到底的那一下 ----------
  // 甚麼都不動。濕墨在凸紋上原地出現，靠聲音 + 震動表達「蓋好了」；之後慢慢、不均勻地變乾。
  const commit = () => {
    const s = st.current
    s.mode = 'set'
    s.s = 0
    s.r = 0
    s.lifted = false
    const ink = el.ink.current
    if (ink) {
      ink.style.transition = 'opacity 80ms cubic-bezier(.2,.6,.3,1)'
      ink.style.opacity = '1'
      const dry = ink.querySelectorAll<HTMLElement>('.dry')
      const start = reduce ? 300 : 1600, gap = reduce ? 200 : 2500, dur = reduce ? 600 : 4200
      dry.forEach((n, i) => {
        n.style.transition = `opacity ${dur}ms cubic-bezier(.45,0,.55,1) ${start + i * gap}ms`
        n.style.opacity = '1'
      })
    }
    if (el.touch.current) el.touch.current.style.opacity = '0'
    noise(0.014, 2400, 0.55, 'highpass')
    noise(0.2, 300, 0.85, 'lowpass', 0.008)
    buzz(18)
    // 第一次蓋成功之後，不再顯示按壓指引
    try {
      localStorage.setItem(GUIDED_KEY, '1')
    } catch {
      /* 存不了就下次再顯示 */
    }
    setGuided(true)
    setPhase('done')
    pos.current = { px: s.W ? s.cx / s.W : 0.5, py: s.H ? s.cy / s.H : 0.4, rot: Math.round(s.rot * 10) / 10 }
    save()
  }

  // ---------- 輸入 ----------
  const start = (x: number | null, y: number | null, isMouse: boolean) => {
    const s = st.current
    if (s.mode === 'set') return
    if (s.mode === 'idle') {
      place(x, y, isMouse)
      noise(0.03, 600, 0.1)
    }
    s.mode = 'press'
    setPhase('press')
    loop()
  }
  const finish = () => {
    const s = st.current
    if (s.mode === 'set') {
      if (!s.lifted) {
        s.lifted = true
        loop()
      }
      return
    }
    if (s.mode !== 'press') return
    s.mode = 'retreat'
    setPhase('idle')
    loop()
  }

  // ---------- 這一頁以前蓋過的章（乾的樣子） ----------
  const olds = before.map((b, i) => {
    const px = b.px ?? 0.5, py = b.py ?? 0.4
    const rot = b.rot ?? ((b.id * 37) % 15) - 7
    const f = faceOf({ at: b.at, no: b.test ? null : b.no, name: spot.name, district: label(d), kind: spot.kind })
    return { key: b.uid ?? b.id, f, px, py, rot, seed: 11 + (i % 5) }
  })

  const done = phase === 'done'
  const showGuide = !done && !guided
  const dist = distance < 1 ? '就在這裏' : `距離 ${formatDistance(distance).num} ${formatDistance(distance).unit}`
  const lastTime = before.at(-1)
  const complete = info.visitedAfter >= d.total

  const page$ = (
    <div className="stamp-page" role="dialog" aria-modal="true" aria-label={`蓋章：${spot.name}`}>
      <div className="sp-top">
        <button type="button" className="sp-back" onClick={back} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="sp-page">遊歷護照 · 第 {page} 頁</span>
      </div>

      <div className="sp-head">
        <span className="sp-sub">你已到達</span>
        <h1 className="sp-title">{spot.name}</h1>
        <span className="sp-sub">
          {spot.area} · {label(d)} · {dist} · {before.length ? `第 ${before.length + 1} 次來` : '第一次來'}
          {fix.fake && ' · 測試章'}
        </span>
      </div>

      <div
        ref={el.stage}
        className={`sp-stage ph-${phase}`}
        role="button"
        tabIndex={0}
        aria-label={`按住蓋章：${spot.name}`}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* 舊瀏覽器 */
          }
          start(e.clientX, e.clientY, e.pointerType === 'mouse')
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            if (!e.repeat) start(null, null, false)
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            finish()
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="sp-layers" aria-hidden="true">
          {olds.map((o) => (
            <DryStamp
              key={o.key}
              f={o.f}
              seed={o.seed}
              style={{ left: `calc(${(o.px * 100).toFixed(2)}% - 115px)`, top: `calc(${(o.py * 100).toFixed(2)}% - 95px)`, transform: `rotate(${o.rot}deg)`, opacity: 0.4 } as CSSProperties}
            />
          ))}
          <div ref={el.dent} className="sp-dent" />
          <div ref={el.stamp} className="stamp-box sp-stamp">
            <div ref={el.emb} className="sp-emb stamp-box">
              <div ref={el.shadow} className="sp-shadow stamp-box">
                <StampLayer f={face} layer={{ k: 'shadow' }} />
              </div>
              <div ref={el.hi} className="sp-hi stamp-box">
                <StampLayer f={face} layer={{ k: 'hi' }} />
              </div>
              <div className="stamp-box">
                <StampLayer f={face} layer={{ k: 'face' }} />
              </div>
            </div>
            <div ref={el.ink} className="sp-ink stamp-box">
              <div className="stamp-box">
                <StampLayer f={face} layer={{ k: 'wet' }} />
              </div>
              {DRY_THRESHOLDS.map((t, i) => (
                <div key={i} className="dry stamp-box">
                  <StampLayer f={face} layer={{ k: 'dry', thr: t }} />
                </div>
              ))}
            </div>
          </div>
          <div ref={el.touch} className="sp-touch" />
        </div>

        {showGuide && (
          <>
            <div className="sp-guide" aria-hidden="true">
              <span className="ring" />
              <span className="dot" />
            </div>
            <span className="sp-hint first" aria-live="polite">
              第一次蓋章
              <br />
              <span>按住紙上任何地方，壓到底就蓋好</span>
            </span>
          </>
        )}
        {!done && guided && <span className="sp-hint later">按住紙面蓋章</span>}
      </div>

      {done && (
        <div className="sp-after rise">
          <div className="sp-after-row">
            <span className="sp-count">
              {label(d)} {info.visitedAfter} / {d.total}
            </span>
            <span className="sp-sub">
              這一頁第 {before.length + 1} 個章{lastTime ? ` · 上次 ${ymd(lastTime.at)}` : ''}
            </span>
          </div>
          <span className="sp-sub">
            {complete
              ? `${label(d)}的 ${d.total} 個景點全部集齊，地圖上的${label(d)}變成紅色了。`
              : `每來一次就多一個章。集齊 ${d.total} 個景點，${label(d)}會變紅。`}
          </span>
          {saveError && (
            <span className="sp-error" role="alert">
              這個章存不進手機。{' '}
              <button type="button" className="link" onClick={save}>
                再試一次
              </button>
            </span>
          )}
        </div>
      )}

      <div className="sp-foot">
        {!done && <span className="sp-sub">定位只在你按「讀取位置」的那一刻讀一次</span>}
        {done && (
          <button type="button" className="btn-primary sp-home rise" onClick={back} disabled={!saved && !saveError}>
            返回地圖
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(page$, document.body)
}
