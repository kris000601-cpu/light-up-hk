import { useId } from 'react'
import { DISTRICTS, MAP_H, MAP_W, label, type District } from '../lib/districts'

// 三墨規則：進度 = 墨藍深淺，集齊才用印泥紅
const FILL = ['var(--card)', 'rgba(45, 62, 92, 0.2)', 'rgba(45, 62, 92, 0.48)', 'var(--seal)']

interface Props {
  selected: District | null
  onSelect: (d: District | null) => void
  onOpen: (d: District) => void
}

export function HKMap({ selected, onSelect, onOpen }: Props) {
  const clipId = useId()
  const lit = DISTRICTS.filter((d) => d.visited > 0).length

  // 標籤放在區的中心上方；靠邊時往裏收，免得出界
  const tagLeft = selected ? Math.min(84, Math.max(16, (selected.center[0] / MAP_W) * 100)) : 0
  const tagTop = selected ? (selected.center[1] / MAP_H) * 100 : 0

  return (
    <div className="hkmap" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label={`全港 18 區地圖：已點亮 ${lit} 區${selected ? `；目前選中${label(selected)}，${selected.visited} / ${selected.total} 個景點` : ''}`}
        onClick={() => onSelect(null)}
      >
        <g className="hkmap-districts">
          {DISTRICTS.map((d) => (
            <path
              key={d.code}
              d={d.d}
              fill={FILL[d.level]}
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
      </svg>

      {selected && (
        <button
          type="button"
          className="hkmap-tag"
          style={{ left: `${tagLeft}%`, top: `${tagTop}%` }}
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
    </div>
  )
}
