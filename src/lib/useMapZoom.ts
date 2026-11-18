import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** 地圖目前看到的範圍（地圖座標），即 SVG 的 viewBox */
export interface View {
  x: number
  y: number
  w: number
  h: number
}

const MAX_SCALE = 6

/**
 * 只讓地圖本身縮放：雙指捏合放大縮小、放大後單指拖動；電腦上用觸控板捏合或 Ctrl + 滾輪。
 * 未放大時單指照常上下捲動頁面。整頁縮放在 index.html / index.css 關掉了。
 */
export function useMapZoom(boxRef: RefObject<HTMLElement | null>, mapW: number, mapH: number) {
  const full: View = { x: 0, y: 0, w: mapW, h: mapH }
  const [view, setView] = useState<View>(full)
  const viewRef = useRef(view)
  // 拖過或捏過之後，緊接着的「點擊」要吞掉，免得放開手指時誤選了區
  const suppressUntil = useRef(0)
  const anim = useRef(0)

  const apply = useCallback(
    (v: View) => {
      const w = Math.min(mapW, Math.max(mapW / MAX_SCALE, v.w))
      const h = (w * mapH) / mapW
      const x = Math.min(mapW - w, Math.max(0, v.x))
      const y = Math.min(mapH - h, Math.max(0, v.y))
      const next = { x, y, w, h }
      viewRef.current = next
      setView(next)
    },
    [mapW, mapH],
  )

  /** 以畫面上某一點（相對地圖框的 0–1 位置）為中心縮放 */
  const zoomAt = useCallback(
    (fx: number, fy: number, factor: number) => {
      const v = viewRef.current
      const px = v.x + fx * v.w
      const py = v.y + fy * v.h
      const w = Math.min(mapW, Math.max(mapW / MAX_SCALE, v.w / factor))
      const h = (w * mapH) / mapW
      apply({ x: px - fx * w, y: py - fy * h, w, h })
    },
    [apply, mapW, mapH],
  )

  const reset = useCallback(() => {
    cancelAnimationFrame(anim.current)
    const from = viewRef.current
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 260)
      const e = 1 - Math.pow(1 - t, 3)
      apply({
        x: from.x * (1 - e),
        y: from.y * (1 - e),
        w: from.w + (mapW - from.w) * e,
        h: from.h + (mapH - from.h) * e,
      })
      if (t < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [apply, mapW, mapH])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    const zoomed = () => viewRef.current.w < mapW - 0.5
    const rel = (cx: number, cy: number) => {
      const r = box.getBoundingClientRect()
      return { fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height, r }
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
        apply({ x: start.px! - fx * w, y: start.py! - fy * h, w, h })
        moved = true
      } else if (t.length === 1 && start.sx !== undefined && zoomed()) {
        e.preventDefault()
        const r = box.getBoundingClientRect()
        const dx = t[0].clientX - start.sx
        const dy = t[0].clientY - start.sy!
        if (Math.hypot(dx, dy) > 6) moved = true
        const k = start.view.w / r.width
        apply({ ...start.view, x: start.view.x - dx * k, y: start.view.y - dy * k })
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (moved) suppressUntil.current = performance.now() + 400
      // 兩指變一指時，用剩下那隻手指接着拖
      begin(e)
    }

    // ---- 電腦：觸控板捏合 / Ctrl + 滾輪縮放，放大後按住拖動 ----
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const { fx, fy } = rel(e.clientX, e.clientY)
      zoomAt(fx, fy, Math.exp(-e.deltaY * 0.01))
    }

    let drag: { view: View; sx: number; sy: number } | null = null
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !zoomed()) return
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
      apply({ ...drag.view, x: drag.view.x - dx * k, y: drag.view.y - dy * k })
    }
    const onMouseUp = () => {
      if (drag && moved) suppressUntil.current = performance.now() + 400
      drag = null
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
      cancelAnimationFrame(anim.current)
    }
  }, [boxRef, apply, zoomAt, mapW, mapH])

  return { view, zoomed: view.w < mapW - 0.5, reset, zoomAt }
}
