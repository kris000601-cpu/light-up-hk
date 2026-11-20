// 印章冊用到的紙和章：一頁紙（章按蓋的位置重現）、單獨一枚小章、沒去過的空章位、一頁的完整內容。
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { PAPER_H, PAPER_W, faceOfStamp, fullDate, placeStamps, shortDistrict } from '../lib/book'
import type { Stamp } from '../lib/stamps'
import { DryStamp } from './StampArt'

/** 量一個元素的寬度（隨螢幕變） */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const n = ref.current
    if (!n) return
    setW(n.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(n)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

interface PaperProps {
  stamps: Stamp[]
  /** 縮圖：不加紙紋 */
  lite?: boolean
  /** 加上下兩條細線（跟蓋章頁的紙一樣） */
  ruled?: boolean
  className?: string
  /** 只看清這一枚（uid）：其他章退到很淡，這一枚放到最上面 */
  focus?: string | null
  children?: ReactNode
}

/** 一頁紙：寬度跟着外面，高度按比例；章按蓋的時候的位置和角度放 */
export function BookPaper({ stamps, lite, ruled, className, focus, children }: PaperProps) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const k = w / PAPER_W
  return (
    <div ref={ref} className={`paper${ruled ? ' ruled' : ''}${className ? ' ' + className : ''}`} style={{ aspectRatio: `${PAPER_W} / ${PAPER_H}` }}>
      {w > 0 && (
        <div className="paper-inner" style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${k})` }} aria-hidden="true">
          {placeStamps(stamps).map((o) => (
            <DryStamp
              key={o.stamp.uid ?? o.stamp.id}
              f={o.face}
              seed={o.seed}
              lite={lite}
              style={{
                left: o.px * PAPER_W - 115,
                top: o.py * PAPER_H - 95,
                transform: `rotate(${o.rot}deg)`,
                opacity: focus && o.stamp.uid !== focus ? 0.12 : 1,
                zIndex: focus && o.stamp.uid === focus ? 2 : undefined,
                transition: 'opacity 0.2s',
              }}
            />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

/** 一枚小章（按蓋的時候的角度），寬度 width 像素 */
export function MiniStamp({ stamp, width, lite = true }: { stamp: Stamp; width: number; lite?: boolean }) {
  const k = width / 230
  return (
    <span className="mini-stamp" style={{ width, height: Math.round(190 * k) }} aria-hidden="true">
      <span className="mini-stamp-in" style={{ transform: `scale(${k})` }}>
        <DryStamp f={faceOfStamp(stamp)} lite={lite} style={{ transform: `rotate(${stamp.rot ?? -4}deg)` }} />
      </span>
    </span>
  )
}

/** 還沒蓋的章位：虛線八角 */
export function EmptyOct({ width, mark = '？' }: { width: number; mark?: string }) {
  return (
    <span className="empty-oct" style={{ width, height: Math.round((width * 170) / 210) }} aria-hidden="true">
      <svg viewBox="0 0 210 170" width="100%" height="100%">
        <path d="M30 4H180L206 30V140L180 166H30L4 140V30Z" fill="none" stroke="currentColor" strokeWidth={4} strokeDasharray="10 9" strokeLinejoin="round" />
      </svg>
      {mark && <span className="empty-oct-mark">{mark}</span>}
    </span>
  )
}

/**
 * 一頁的完整內容：標題、紙、蓋章記錄。
 * 同一景點來很多次，章會疊得看不清：按紙面就逐個看（最近 → 最舊 → 全部），按記錄就直接看那一枚。
 * 被看的那枚放到最上面、其他退到很淡；紙上的位置一點都不動。
 */
export function PageBody({ name, area, district, stamps }: { name: string; area?: string; district: string; stamps: Stamp[] }) {
  const n = stamps.length
  const [focus, setFocus] = useState<string | null>(null)
  const newest = [...stamps].reverse()
  const cycle = () => {
    if (n < 2) return
    const i = focus ? newest.findIndex((s) => s.uid === focus) : -1
    setFocus(i + 1 < n ? newest[i + 1].uid : null)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cycle()
    }
  }
  const focused = focus ? newest.findIndex((s) => s.uid === focus) : -1
  return (
    <div className="pv">
      <div className="pv-head">
        <h2 className="pv-title">{name}</h2>
        <span className="pv-sub">
          {area ? `${area} · ` : ''}
          {shortDistrict(district)} · {n ? `來過 ${n} 次` : '還沒來過'}
        </span>
      </div>
      {n > 1 ? (
        <div className="pv-paper-tap" role="button" tabIndex={0} aria-label="逐個看清每個章" onClick={cycle} onKeyDown={onKey}>
          <BookPaper stamps={stamps} ruled focus={focus} />
        </div>
      ) : (
        <BookPaper stamps={stamps} ruled>
          {n === 0 && (
            <span className="pv-empty">
              <EmptyOct width={150} />
              <span>到了這裏，按「我在哪」就可以蓋章</span>
            </span>
          )}
        </BookPaper>
      )}
      {n > 1 && (
        <p className="pv-hint" aria-live="polite">
          {focused < 0 ? '章疊在一起看不清？按一下紙面，逐個看' : `正在看第 ${n - focused} 次的章 · 再按看下一個`}
        </p>
      )}
      {n > 0 && (
        <ol className="pv-log" aria-label="蓋章記錄">
          {newest.map((s, i) => {
            const row = (
              <>
                <span className="pv-no">{s.test ? '測試' : `No.${s.no}`}</span>
                <span className="pv-date">{fullDate(s.at)}</span>
                <span className="pv-nth">{n - i === 1 ? '第一次來' : `第 ${n - i} 次`}</span>
              </>
            )
            return (
              <li key={s.uid ?? s.id}>
                {n > 1 ? (
                  <button type="button" className={s.uid === focus ? 'pv-row on' : 'pv-row'} aria-pressed={s.uid === focus} onClick={() => setFocus(s.uid === focus ? null : s.uid)}>
                    {row}
                  </button>
                ) : (
                  <span className="pv-row">{row}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
