import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MAP_H, MAP_W, label, useDistricts, useLitPlaces, type District } from '../lib/districts'
import { loadPlaces, type PlaceGeo } from '../lib/places'
import { useMapZoom } from '../lib/useMapZoom'

// 三墨規則：去過 = 墨藍，全部亮了才用印泥紅
// 「點亮」的畫法（M3，Chris 2026-11-24 選 B）：去過的「地方」一塊塊塗上墨藍，沒去過的是紙色；
// 一個區的地方全部亮了，整區變印泥紅。點一個區時淡淡畫出它分成幾塊。
// （放棄的方案 A：整區按亮了幾成由淺變深——在長洲蓋一個章，整個離島區連大嶼山都變灰，像去遍了）

/** 亮了的地方的顏色 */
const PLACE_FILL = 'rgba(45, 62, 92, 0.34)'

/** 分組列表裏每區的小色塊：一塊都沒亮 = 紙色；亮了一些 = 墨藍；全部亮了 = 紅 */
export function districtSwatch(d: Pick<District, 'frac'>): string {
  return d.frac <= 0 ? 'var(--card)' : d.frac >= 1 ? 'var(--seal)' : PLACE_FILL
}

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
    // 全區亮了 = 紅；其他是紙色，亮了的地方另外畫在上面。聚焦：選中某區時，其他區只剩紙色
    const fillOf = (d: District) => (complete.has(d.code) && (!selected || selected.code === d.code) ? 'var(--seal)' : 'var(--card)')
    // 亮了的地方（全區亮了的已經整區紅，不用再畫）；選中某區時只畫那一區的
    const litShapes = places ? places.filter((p) => litSet.has(p.id) && !complete.has(p.dc) && (!selected || selected.code === p.dc)) : []
    const selLines = places && selected ? places.filter((p) => p.dc === selected.code) : []
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
