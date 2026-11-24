import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MAP_H, MAP_W, label, useDistricts, useLitPlaces, type District } from '../lib/districts'
import { loadPlaces, type PlaceGeo } from '../lib/places'
import { useMapZoom } from '../lib/useMapZoom'

// 三墨規則：進度 = 墨藍深淺，全部亮了才用印泥紅
/**
 * 區的顏色（M3，Chris 2026-11-20 定）：按「這區亮了幾塊地方」算深淺，全部亮了才變紅。
 * 一塊都沒亮 = 紙色；亮了一點點就看得出（最淡 12%），差一塊就全亮時約 50%。
 */
export function districtFill(d: Pick<District, 'frac'>): string {
  if (d.frac <= 0) return 'var(--card)'
  if (d.frac >= 1) return 'var(--seal)'
  return `rgba(45, 62, 92, ${(0.12 + 0.4 * d.frac).toFixed(3)})`
}

/** 亮了的地方（「一塊塊」畫法）的顏色 */
const PLACE_FILL = 'rgba(45, 62, 92, 0.34)'

// 試看兩種畫法（給 Chris 選，選定後刪掉）：?mapstyle=places = 一塊塊畫出亮了的地方；預設 = 整區按亮了幾成上色
export const MAP_STYLE: 'district' | 'places' = new URLSearchParams(window.location.search).get('mapstyle') === 'places' ? 'places' : 'district'

interface Props {
  selected: District | null
  onSelect: (d: District | null) => void
  onOpen: (d: District) => void
}

export function HKMap({ selected, onSelect, onOpen }: Props) {
  const clipId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const { view, base, zoomed, fade, reset } = useMapZoom(boxRef, MAP_W, MAP_H)
  const districts = useDistricts()
  const litSet = useLitPlaces()
  const lit = districts.filter((d) => d.litPlaces.length > 0).length

  // 地方的形狀（用到時才載入）
  const [places, setPlaces] = useState<PlaceGeo[] | null>(null)
  useEffect(() => {
    if (MAP_STYLE !== 'places') return
    let alive = true
    loadPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // 地圖內容只在選中的區、進度改變時才重建；手指移動時不碰它，只改下面的 transform
  const content = useMemo(() => {
    const complete = new Set(districts.filter((d) => d.frac >= 1).map((d) => d.code))
    const fillOf = (d: District) => {
      if (selected && selected.code !== d.code) return 'var(--card)'
      if (MAP_STYLE === 'places') return complete.has(d.code) ? 'var(--seal)' : 'var(--card)'
      return districtFill(d)
    }
    // 「一塊塊」畫法：亮了的地方（全區亮了的已經整區紅，不用再畫）；選中某區時只畫那一區的
    const litShapes =
      MAP_STYLE === 'places' && places ? places.filter((p) => litSet.has(p.id) && !complete.has(p.dc) && (!selected || selected.code === p.dc)) : []
    const selLines = MAP_STYLE === 'places' && places && selected ? places.filter((p) => p.dc === selected.code) : []
    return (
      <>
        <g className="hkmap-districts">
          {districts.map((d) => (
            <path
              key={d.code}
              d={d.d}
              className={selected && selected.code !== d.code ? 'is-dimmed' : undefined}
              style={{ fill: fillOf(d) }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(selected?.code === d.code ? null : d)
              }}
            />
          ))}
        </g>
        {MAP_STYLE === 'places' && (
          <>
            <g className="hkmap-places" aria-hidden="true">
              {litShapes.map((p) => (
                <path key={p.id} d={p.d} style={{ fill: PLACE_FILL }} />
              ))}
            </g>
            {/* 選中的區：淡淡畫出它分成哪幾塊 */}
            <g className="hkmap-place-lines" aria-hidden="true">
              {selLines.map((p) => (
                <path key={p.id} d={p.d} />
              ))}
            </g>
            {/* 區界畫在最上面（亮了的地方蓋住了區界的內半邊） */}
            <g className="hkmap-outlines" aria-hidden="true">
              {districts.map((d) => (
                <path key={d.code} d={d.d} className={selected && selected.code !== d.code ? 'is-dimmed' : undefined} />
              ))}
            </g>
          </>
        )}
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
    )
  }, [districts, selected, onSelect, clipId, places, litSet])

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
          aria-label={`全港 18 區地圖：已點亮 ${lit} 區${selected ? `；目前選中${label(selected)}，亮了 ${selected.litPlaces.length} / ${selected.places.length} 個地方` : ''}`}
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
          aria-label={`${label(selected)}：亮了 ${selected.litPlaces.length} / ${selected.places.length} 個地方，查看詳情`}
        >
          <span className="hkmap-tag-name">{label(selected)}</span>
          <span className="hkmap-tag-count">
            {selected.litPlaces.length} / {selected.places.length}
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
