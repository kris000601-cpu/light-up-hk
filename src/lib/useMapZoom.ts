import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** 地圖看到的範圍（地圖座標），即 SVG 的 viewBox */
export interface View {
  x: number
  y: number
  w: number
  h: number
}

const MAX_SCALE = 6
/** 放大後地圖四周可多拖出去的留白（像素）；要比邊緣漸隱寬 */
const EDGE_PAD_PX = 36
/** 放手時若只放大了不到這麼多，就當作想回全圖，平滑縮回去 */
const SNAP_SCALE = 1.2
/** 放手後回彈 / 縮回全圖的動畫長度（毫秒） */
const SETTLE_MS = 320

/** 橡皮筋：越拉越拉不動，最多拉出 dim 那麼遠（iOS 的做法） */
const rubber = (d: number, dim: number) => dim * (1 - 1 / ((d * 0.55) / dim + 1))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * 只讓地圖本身縮放：雙指捏合放大縮小、放大後單指拖動；電腦上用觸控板捏合或 Ctrl + 滾輪。
 * 未放大時單指照常上下捲動頁面。整頁縮放在 index.html / index.css 關掉了。
 *
 * 順滑的關鍵：手指在動時只更新 `view`，地圖用 CSS transform 把已經畫好的圖交給顯卡移動 / 縮放；
 * 停下來才把 `base`（SVG 真正的 viewBox）更新成 `view`，重畫一次讓線條變回清晰。
 * 碰到邊界不硬停，用橡皮筋；放手後用動畫彈回合法範圍。
 */
export function useMapZoom(boxRef: RefObject<HTMLElement | null>, mapW: number, mapH: number) {
  const [view, setView] = useState<View>({ x: 0, y: 0, w: mapW, h: mapH })
  const [base, setBase] = useState<View>(view)
  const viewRef = useRef(view)
  // 拖過或捏過之後，緊接着的「點擊」要吞掉，免得放開手指時誤選了區
  const suppressUntil = useRef(0)
  const anim = useRef(0)

  const show = useCallback((v: View) => {
    viewRef.current = v
    setView(v)
  }, [])
  const commit = useCallback(() => setBase(viewRef.current), [])

  /** 某個縮放下，x / y 可以去到的範圍（含留白） */
  const bounds = useCallback(
    (w: number, h: number) => {
      if (w >= mapW) {
        // 縮得比全圖還小（橡皮筋拉過頭）時，以置中為準
        const cx = (mapW - w) / 2
        const cy = (mapH - h) / 2
        return { x0: cx, x1: cx, y0: cy, y1: cy }
      }
      // 留白隨放大程度很快長滿；回到全圖時正好歸零，所以全圖不變、也不會跳
      const boxW = boxRef.current?.clientWidth || mapW
      const m = Math.min(EDGE_PAD_PX * (w / boxW), (mapW - w) * 4)
      return { x0: -m, x1: mapW - w + m, y0: -m, y1: mapH - h + m }
    },
    [boxRef, mapW, mapH],
  )

  /** 手指操作中：超出範圍的部分用橡皮筋，而不是硬停（fx, fy 是縮放中心在框內的 0–1 位置） */
  const soften = useCallback(
    (v: View, fx = 0.5, fy = 0.5): View => {
      let s = mapW / v.w
      if (s < 1) s = 1 - rubber(1 - s, 0.35)
      else if (s > MAX_SCALE) s = MAX_SCALE + rubber(s - MAX_SCALE, MAX_SCALE * 0.25)
      const w = mapW / s
      const h = (w * mapH) / mapW
      let x = v.x + fx * v.w - fx * w
      let y = v.y + fy * v.h - fy * h
      const b = bounds(w, h)
      if (x < b.x0) x = b.x0 - rubber(b.x0 - x, w * 0.3)
      else if (x > b.x1) x = b.x1 + rubber(x - b.x1, w * 0.3)
      if (y < b.y0) y = b.y0 - rubber(b.y0 - y, h * 0.3)
      else if (y > b.y1) y = b.y1 + rubber(y - b.y1, h * 0.3)
      return { x, y, w, h }
    },
    [bounds, mapW, mapH],
  )

  /** 放手後該停在哪裏：拉回合法範圍；只放大了一點點就回全圖 */
  const target = useCallback(
    (v: View): View => {
      const s = mapW / v.w
      if (s < SNAP_SCALE) return { x: 0, y: 0, w: mapW, h: mapH }
      const w = mapW / Math.min(MAX_SCALE, s)
      const h = (w * mapH) / mapW
      // 縮放上限回彈時，以畫面中心為準
      const x = v.x + (v.w - w) / 2
      const y = v.y + (v.h - h) / 2
      const b = bounds(w, h)
      return { x: Math.min(b.x1, Math.max(b.x0, x)), y: Math.min(b.y1, Math.max(b.y0, y)), w, h }
    },
    [bounds, mapW, mapH],
  )

  const animateTo = useCallback(
    (to: View) => {
      cancelAnimationFrame(anim.current)
      const from = viewRef.current
      const same = Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + Math.abs(from.w - to.w) < 0.01
      if (same) {
        show(to)
        commit()
        return
      }
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / SETTLE_MS)
        const e = easeOut(t)
        show({
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          w: from.w + (to.w - from.w) * e,
          h: from.h + (to.h - from.h) * e,
        })
        if (t < 1) anim.current = requestAnimationFrame(step)
        else commit()
      }
      anim.current = requestAnimationFrame(step)
    },
    [show, commit],
  )

  const settle = useCallback(() => animateTo(target(viewRef.current)), [animateTo, target])
  const reset = useCallback(() => animateTo({ x: 0, y: 0, w: mapW, h: mapH }), [animateTo, mapW, mapH])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    const zoomed = () => viewRef.current.w < mapW - 0.5
    const rel = (cx: number, cy: number) => {
      const r = box.getBoundingClientRect()
      return { fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height }
    }

    // ---- 手指 ----
    let start: {
      view: View
      // 雙指：起始兩指距離、起始中點對應的地圖座標
      dist?: number
      px?: number
      py?: number
      // 單指：起始位置
      sx?: number
      sy?: number
    } | null = null
    let moved = false

    const begin = (e: TouchEvent) => {
      const t = e.touches
      const v = viewRef.current
      if (t.length >= 2) {
        const mx = (t[0].clientX + t[1].clientX) / 2
        const my = (t[0].clientY + t[1].clientY) / 2
        const { fx, fy } = rel(mx, my)
        start = {
          view: v,
          dist: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
          px: v.x + fx * v.w,
          py: v.y + fy * v.h,
        }
      } else if (t.length === 1) {
        start = { view: v, sx: t[0].clientX, sy: t[0].clientY }
      } else {
        start = null
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      cancelAnimationFrame(anim.current)
      if (e.touches.length === 1) {
        moved = false
        suppressUntil.current = 0
      }
      begin(e)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!start) return
      const t = e.touches
      if (t.length >= 2 && start.dist) {
        e.preventDefault()
        const mx = (t[0].clientX + t[1].clientX) / 2
        const my = (t[0].clientY + t[1].clientY) / 2
        const { fx, fy } = rel(mx, my)
        const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
        const w = start.view.w / (dist / start.dist)
        const h = (w * mapH) / mapW
        // 讓起始時兩指中間的那一點，一直跟着兩指中間走
        show(soften({ x: start.px! - fx * w, y: start.py! - fy * h, w, h }, fx, fy))
        moved = true
      } else if (t.length === 1 && start.sx !== undefined && zoomed()) {
        e.preventDefault()
        const r = box.getBoundingClientRect()
        const dx = t[0].clientX - start.sx
        const dy = t[0].clientY - start.sy!
        if (Math.hypot(dx, dy) > 6) moved = true
        const k = start.view.w / r.width
        show(soften({ ...start.view, x: start.view.x - dx * k, y: start.view.y - dy * k }))
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (moved) suppressUntil.current = performance.now() + 400
      // 兩指變一指時，用剩下那隻手指接着拖；全部放開才回彈
      begin(e)
      if (e.touches.length === 0) settle()
    }

    // ---- 電腦：觸控板捏合 / Ctrl + 滾輪縮放，放大後按住拖動 ----
    let wheelTimer = 0
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      cancelAnimationFrame(anim.current)
      const { fx, fy } = rel(e.clientX, e.clientY)
      const v = viewRef.current
      const w = v.w / Math.exp(-e.deltaY * 0.01)
      const h = (w * mapH) / mapW
      show(soften({ x: v.x + fx * (v.w - w), y: v.y + fy * (v.h - h), w, h }, fx, fy))
      clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(settle, 150)
    }

    let drag: { view: View; sx: number; sy: number } | null = null
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !zoomed()) return
      cancelAnimationFrame(anim.current)
      drag = { view: viewRef.current, sx: e.clientX, sy: e.clientY }
      moved = false
      suppressUntil.current = 0
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.sx
      const dy = e.clientY - drag.sy
      if (Math.hypot(dx, dy) > 4) moved = true
      const k = drag.view.w / box.getBoundingClientRect().width
      show(soften({ ...drag.view, x: drag.view.x - dx * k, y: drag.view.y - dy * k }))
    }
    const onMouseUp = () => {
      if (!drag) return
      if (moved) suppressUntil.current = performance.now() + 400
      drag = null
      settle()
    }

    const onClickCapture = (e: MouseEvent) => {
      if (performance.now() < suppressUntil.current) {
        suppressUntil.current = 0
        e.stopPropagation()
        e.preventDefault()
      }
    }

    box.addEventListener('touchstart', onTouchStart, { passive: true })
    box.addEventListener('touchmove', onTouchMove, { passive: false })
    box.addEventListener('touchend', onTouchEnd)
    box.addEventListener('touchcancel', onTouchEnd)
    box.addEventListener('wheel', onWheel, { passive: false })
    box.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    box.addEventListener('click', onClickCapture, true)
    return () => {
      box.removeEventListener('touchstart', onTouchStart)
      box.removeEventListener('touchmove', onTouchMove)
      box.removeEventListener('touchend', onTouchEnd)
      box.removeEventListener('touchcancel', onTouchEnd)
      box.removeEventListener('wheel', onWheel)
      box.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      box.removeEventListener('click', onClickCapture, true)
      clearTimeout(wheelTimer)
      cancelAnimationFrame(anim.current)
    }
  }, [boxRef, show, soften, settle, mapW, mapH])

  const scale = mapW / view.w
  return {
    /** 現在畫面上看到的範圍（手指移動中也即時更新） */
    view,
    /** SVG 實際的 viewBox（停下來才更新） */
    base,
    zoomed: view.w < mapW - 0.5,
    /** 邊緣漸隱的寬度（像素）：全圖時 0，放大到 1.15 倍時長滿 18px */
    fade: Math.max(0, Math.min(18, ((scale - 1) / 0.15) * 18)),
    reset,
  }
}
