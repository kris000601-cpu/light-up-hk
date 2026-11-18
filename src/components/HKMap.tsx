import { useId, useMemo, useRef, type CSSProperties } from 'react'
import { DISTRICTS, MAP_H, MAP_W, label, type District } from '../lib/districts'
import { useMapZoom } from '../lib/useMapZoom'

// 三墨規則：進度 = 墨藍深淺，集齊才用印泥紅
const FILL = ['var(--card)', 'rgba(45, 62, 92, 0.2)', 'rgba(45, 62, 92, 0.48)', 'var(--seal)']

interface Props {
  selected: District | null
  onSelect: (d: District | null) => void
  onOpen: (d: District) => void
}

export function HKMap({ selected, onSelect, onOpen }: Props) {
  const clipId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const { view, base, zoomed, fade, reset } = useMapZoom(boxRef, MAP_W, MAP_H)
  const lit = DISTRICTS.filter((d) => d.visited > 0).length

  // 地圖內容只在選中的區改變時才重建；手指移動時不碰它，只改下面的 transform
  const content = useMemo(
    () => (
      <>
        <g className="hkmap-districts">
          {DISTRICTS.map((d) => (
            <path
              key={d.code}
              d={d.d}
              className={selected && selected.code !== d.code ? 'is-dimmed' : undefined}
              style={{ fill: selected && selected.code !== d.code ? 'var(--card)' : FILL[d.level] }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(selected?.code === d.code ? null : d)
              }}
            />
          ))}
        </g>
        {selected && (
          <>
            <defs>
              <clipPath id={clipId}>
                <path d={selected.d} />
              </clipPath>
            </defs>
            {/* 選中描邊：用同一條（已裁掉海面的）邊界路徑，再用它自己裁掉外半邊，所以只描在區內側、完全貼合 */}
            <path className="hkmap-selected" d={selected.d} clipPath={`url(#${clipId})`} />
          </>
        )}
      </>
    ),
    [selected, onSelect, clipId],
  )

  // 手指移動中：SVG 仍按 base 畫好不動，用顯卡把它平移 / 縮放到 view 的位置
  const s = base.w / view.w
  const tx = ((base.x - view.x) / view.w) * 100
  const ty = ((base.y - view.y) / view.h) * 100
  const moving = s !== 1 || tx !== 0 || ty !== 0

  // 標籤放在區的中心上方，跟着地圖縮放移動；靠邊時往裏收，免得出界；區中心移出畫面就不顯示
  const cx = selected ? ((selected.center[0] - view.x) / view.w) * 100 : 0
  const cy = selected ? ((selected.center[1] - view.y) / view.h) * 100 : 0
  const tagVisible = selected && cx >= 0 && cx <= 100 && cy >= 4 && cy <= 100
  const tagLeft = Math.min(84, Math.max(16, cx))

  return (
    <div ref={boxRef} className={`hkmap${zoomed ? ' is-zoomed' : ''}`} style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
      <div className="hkmap-view" style={{ '--fade': `${fade}px` } as CSSProperties}>
        <svg
          viewBox={`${base.x} ${base.y} ${base.w} ${base.h}`}
          style={moving ? { transform: `translate(${tx}%, ${ty}%) scale(${s})` } : undefined}
          role="img"
          aria-label={`全港 18 區地圖：已點亮 ${lit} 區${selected ? `；目前選中${label(selected)}，${selected.visited} / ${selected.total} 個景點` : ''}`}
          onClick={() => onSelect(null)}
        >
          {content}
        </svg>
      </div>

      {tagVisible && (
        <button
          type="button"
          className="hkmap-tag"
          style={{ left: `${tagLeft}%`, top: `${cy}%` }}
          onClick={() => onOpen(selected)}
          aria-label={`${label(selected)}：${selected.visited} / ${selected.total} 個景點，查看詳情`}
        >
          <span className="hkmap-tag-name">{label(selected)}</span>
          <span className="hkmap-tag-count">
            {selected.visited} / {selected.total}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}

      {zoomed && (
        <button type="button" className="hkmap-reset" onClick={reset} aria-label="縮回全圖">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          全圖
        </button>
      )}
    </div>
  )
}
