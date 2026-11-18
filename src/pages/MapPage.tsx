import { useCallback, useState } from 'react'
import { HKMap } from '../components/HKMap'
import { RegionSheet } from '../components/RegionSheet'
import { DistrictSheet } from '../components/DistrictSheet'
import { DISTRICTS, IS_DEMO, MAP_SOURCE, REGIONS, regionSummary, summary, type District, type Region } from '../lib/districts'

const LEGEND = [
  { level: 0, text: '未去過' },
  { level: 1, text: '去過一兩個' },
  { level: 2, text: '過半' },
  { level: 3, text: '集齊' },
]

// 網址參數只用於截圖檢查：?d=E 選中某區，&sheet=district 打開區詳情，?region=九龍 打開分組列表
const params = new URLSearchParams(window.location.search)
const initial = DISTRICTS.find((d) => d.code === params.get('d')) ?? null
const initialRegion = (REGIONS as string[]).includes(params.get('region') ?? '') ? (params.get('region') as Region) : null

export function MapPage() {
  const [selected, setSelected] = useState<District | null>(initial)
  const [region, setRegion] = useState<Region | null>(initialRegion)
  const [detail, setDetail] = useState<District | null>(params.get('sheet') === 'district' ? initial : null)
  const s = summary()

  const closeRegion = useCallback(() => setRegion(null), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  return (
    <>
      <header className="passport-head">
        <div className="passport-top">
          <div>
            <span className="eyebrow">遊歷護照 · 編號 0008</span>
            <h1 className="app-title">點亮香港</h1>
          </div>
          {IS_DEMO && <span className="demo-badge">示範數據</span>}
        </div>
        <dl className="passport-stats">
          <div>
            <dt>已點亮</dt>
            <dd>
              {s.lit}
              <small> / 18 區</small>
            </dd>
          </div>
          <div>
            <dt>景點章</dt>
            <dd>
              {s.stamps}
              <small> / {s.total} 枚</small>
            </dd>
          </div>
          <div>
            <dt>最近蓋章</dt>
            <dd>
              11.17<small> 柴灣</small>
            </dd>
          </div>
        </dl>
      </header>

      <section className="map-block" aria-label="全港地圖">
        <HKMap selected={selected} onSelect={setSelected} onOpen={setDetail} />
        <p className="map-hint">{selected ? '再點一下名字，看這個區的景點' : '點一下地圖上的區，看名字和進度；兩指可以放大地圖'}</p>
        <ul className="legend" aria-label="圖例">
          {LEGEND.map((l) => (
            <li key={l.level}>
              <span className={`swatch level-${l.level}`} aria-hidden="true" />
              {l.text}
            </li>
          ))}
        </ul>
      </section>

      <div className="region-tabs" role="group" aria-label="按地區看">
        {REGIONS.map((r) => {
          const x = regionSummary(r)
          return (
            <button key={r} type="button" className="region-tab" onClick={() => setRegion(r)}>
              <span className="region-name">{r}</span>
              <span className="region-count">
                {x.lit} / {x.count}
              </span>
            </button>
          )
        })}
      </div>

      <p className="credit">{MAP_SOURCE}</p>

      <RegionSheet
        region={region}
        onRegion={setRegion}
        onClose={closeRegion}
        onPick={(d) => {
          setRegion(null)
          setSelected(d)
          setDetail(d)
        }}
      />
      <DistrictSheet district={detail} onClose={closeDetail} />
    </>
  )
}
