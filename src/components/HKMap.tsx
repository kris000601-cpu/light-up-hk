import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MAP_H, MAP_W, label, useDistricts, useLitPlaces, type District } from '../lib/districts'
import { loadPlaces, type PlaceGeo } from '../lib/places'
import { fitWidth, useMapZoom } from '../lib/useMapZoom'

// 三墨規則：去過 = 墨藍，全部亮了才用印泥紅
// 「點亮」的畫法（M3，Chris 2026-11-24 選 B）：去過的「地方」一塊塊塗上墨藍，沒去過的是紙色；
// 一個區的地方全部亮了，整區變印泥紅。點一個區時淡淡畫出它分成幾塊。
// （放棄的方案 A：整區按亮了幾成由淺變深——在長洲蓋一個章，整個離島區連大嶼山都變灰，像去遍了）
//
// 撥雲見霧（M3 第 3 步）：點一個區，鏡頭推進到它（FLY_MS），推進時整區蓋着霧，到了霧才散開，露出你去過的地方。
// 取消選中時拉回全圖。

/** 亮了的地方的顏色 */
const PLACE_FILL = 'rgba(45, 62, 92, 0.34)'

/** 分組列表裏每區的小色塊：一塊都沒亮 = 紙色；亮了一些 = 墨藍；全部亮了 = 紅 */
export function districtSwatch(d: Pick<District, 'frac'>): string {
  return d.frac <= 0 ? 'var(--card)' : d.frac >= 1 ? 'var(--seal)' : PLACE_FILL
}

// 試看三種霧（給 Chris 選，選定後刪掉另外兩種）：?fog=mist 薄霧（預設）/ part 撥開 / ink 點墨
type Fog = 'mist' | 'part' | 'ink'
const FOG: Fog = (['mist', 'part', 'ink'] as const).find((x) => x === new URLSearchParams(window.location.search).get('fog')) ?? 'mist'

/** 區的範圍 [x0, y0, x1, y1]（地圖座標）：推進鏡頭、放霧用 */
const bboxCache = new Map<string, [number, number, number, number]>()
function bboxOf(d: Pick<District, 'code' | 'd'>): [number, number, number, number] {
  let b = bboxCache.get(d.code)
  if (!b) {
    const n = d.d.match(/-?\d+(\.\d+)?/g)!.map(Number)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < n.length; i += 2) {
      x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i])
      y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1])
    }
    b = [x0, y0, x1, y1]
    bboxCache.set(d.code, b)
  }
  return b
}

/** 截圖（?mock=1）、或者手機設了「減少動態效果」：不要動畫，直接到 */
const noMotion = () => document.documentElement.classList.contains('mock') || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

interface Props {
  selected: District | null
  onSelect: (d: District | null) => void
  onOpen: (d: District) => void
}

export function HKMap({ selected, onSelect, onOpen }: Props) {
  const clipId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const { view, base, zoomed, fade, fit, flyHome } = useMapZoom(boxRef, MAP_W, MAP_H)
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

  // 撥雲見霧：選中某區 → 鏡頭推進到它；取消選中 → 拉回全圖（一打開就沒選中時不用動）
  const selCode = selected?.code ?? null
  const selRef = useRef(selected)
  selRef.current = selected
  const wasSelected = useRef(false)
  useEffect(() => {
    const s = selRef.current
    if (s) fit(bboxOf(s), noMotion())
    else if (wasSelected.current) flyHome(noMotion())
    wasSelected.current = !!s
  }, [selCode, fit, flyHome])

  // 霧的大小按「推進到了」那一刻的畫面算（每像素多少地圖單位），推進途中和到了之後一樣，不會跳
  const boxW = boxRef.current?.clientWidth || 358
  const k = selected ? fitWidth(bboxOf(selected), MAP_W, MAP_H) / boxW : MAP_W / boxW

  // 地圖內容只在選中的區、進度改變時才重建；手指移動時不碰它，只改下面的 transform
  const content = useMemo(() => {
    const sel = selected
    const complete = new Set(districts.filter((d) => d.frac >= 1).map((d) => d.code))
    const isLit = (p: PlaceGeo) => litSet.has(p.id) || complete.has(p.dc)
    // 全區亮了 = 紅；其他是紙色，亮了的地方另外畫在上面。聚焦：選中某區時，其他區只剩紙色
    // 薄霧：選中的區底色換成紙色（米色），白霧才看得見
    const fillOf = (d: District) =>
      sel && sel.code !== d.code ? 'var(--card)' : complete.has(d.code) ? 'var(--seal)' : sel && FOG === 'mist' ? 'var(--paper)' : 'var(--card)'
    // 亮了的地方（全區亮了的已經整區紅，不用再畫）；選中某區時只畫那一區的
    const litShapes = places ? places.filter((p) => litSet.has(p.id) && !complete.has(p.dc) && (!sel || sel.code === p.dc)) : []
    const selPlaces = places && sel ? places.filter((p) => p.dc === sel.code) : []
    const clip = `url(#${clipId})`
    const [bx0, by0, bx1, by1] = sel ? bboxOf(sel) : [0, 0, 0, 0]
    const pad = 30 * k
    return (
      <>
        <defs>
          {sel && (
            <clipPath id={clipId}>
              <path d={sel.d} />
            </clipPath>
          )}
          {/* 薄霧：模糊的白霧，用雜訊做出一團團的雲 */}
          <filter id={`${clipId}-mist`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={5 * k} result="soft" />
            <feTurbulence type="fractalNoise" baseFrequency={1 / (70 * k)} numOctaves={2} seed={7} result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.25" result="clouds" />
            <feComposite in="soft" in2="clouds" operator="in" result="patchy" />
            <feMerge>
              <feMergeNode in="patchy" />
              <feMergeNode in="patchy" />
            </feMerge>
          </filter>
          {/* 撥開：大片模糊的霧 */}
          <filter id={`${clipId}-bank`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={14 * k} />
          </filter>
          {/* 撥開：沒去過的地方鋪一層淡墨點（像舊地圖上沒勘探過的地方） */}
          <pattern id={`${clipId}-dots`} patternUnits="userSpaceOnUse" width={6 * k} height={6 * k}>
            <circle cx={3 * k} cy={3 * k} r={0.75 * k} fill="var(--navy)" fillOpacity={0.32} />
          </pattern>
        </defs>
        <g className="hkmap-districts">
          {districts.map((d) => (
            <path
              key={d.code}
              d={d.d}
              className={sel && sel.code !== d.code ? 'is-dimmed' : undefined}
              style={{ fill: fillOf(d) }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(sel?.code === d.code ? null : d)
              }}
            />
          ))}
        </g>
        <g className="hkmap-places" aria-hidden="true">
          {litShapes.map((p, i) => (
            <path
              key={p.id}
              d={p.d}
              className={sel && FOG === 'ink' ? 'ink-in' : undefined}
              // 點墨：推進到了才一塊塊亮起
              style={{ fill: PLACE_FILL, animationDelay: sel && FOG === 'ink' ? `${0.75 + i * 0.16}s` : undefined }}
            />
          ))}
        </g>
        {sel && FOG === 'part' && (
          <g className="fog-dots" clipPath={clip} aria-hidden="true">
            {selPlaces.filter((p) => !isLit(p)).map((p) => (
              <path key={p.id} d={p.d} fill={`url(#${clipId}-dots)`} />
            ))}
          </g>
        )}
        {/* 選中的區：淡淡畫出它分成哪幾塊（點墨：沒去過的用虛線） */}
        <g className="hkmap-place-lines" aria-hidden="true">
          {selPlaces.map((p) => (
            <path key={p.id} d={p.d} className={FOG === 'ink' && !isLit(p) ? 'unlit' : undefined} />
          ))}
        </g>
        {/* 薄霧：推進時整區蓋着；到了之後，去過的地方的霧散開，沒去過的留着 */}
        {sel && FOG === 'mist' && (
          <g key={sel.code} clipPath={clip} aria-hidden="true">
            <g className="fog-mist stay" filter={`url(#${clipId}-mist)`}>
              {selPlaces.filter((p) => !isLit(p)).map((p) => (
                <path key={p.id} d={p.d} />
              ))}
            </g>
            <g className="fog-mist lift" filter={`url(#${clipId}-mist)`}>
              {selPlaces.filter(isLit).map((p) => (
                <path key={p.id} d={p.d} />
              ))}
            </g>
          </g>
        )}
        {/* 撥開：推進時兩大片霧蓋着整區，到了往左右兩邊散開 */}
        {sel && FOG === 'part' && (
          <g key={sel.code} clipPath={clip} className="fog-part" aria-hidden="true">
            <rect className="l" filter={`url(#${clipId}-bank)`} x={bx0 - pad} y={by0 - pad} width={(bx1 - bx0) / 2 + pad * 2} height={by1 - by0 + pad * 2} />
            <rect className="r" filter={`url(#${clipId}-bank)`} x={(bx0 + bx1) / 2 - pad} y={by0 - pad} width={(bx1 - bx0) / 2 + pad * 2} height={by1 - by0 + pad * 2} />
          </g>
        )}
        {/* 區界畫在最上面（亮了的地方、霧蓋住了區界的內半邊） */}
        <g className="hkmap-outlines" aria-hidden="true">
          {districts.map((d) => (
            <path key={d.code} d={d.d} className={sel && sel.code !== d.code ? 'is-dimmed' : undefined} />
          ))}
        </g>
        {/* 選中描邊：用同一條（已裁掉海面的）邊界路徑，再用它自己裁掉外半邊，所以只描在區內側、完全貼合 */}
        {sel && <path className="hkmap-selected" d={sel.d} clipPath={clip} />}
      </>
    )
  }, [districts, selected, onSelect, clipId, places, litSet, k])

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
        // 「全圖」：拉回全圖，同時取消選中
        <button type="button" className="hkmap-reset" onClick={() => (selected ? onSelect(null) : flyHome(noMotion()))} aria-label="縮回全圖">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          全圖
        </button>
      )}
    </div>
  )
}
