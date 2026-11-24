import { REGIONS, label, regionSummary, useDistricts, type District, type Region } from '../lib/districts'
import { Sheet } from './Sheet'
import { districtSwatch } from './HKMap'
import { Dots } from './Dots'

interface Props {
  region: Region | null
  onRegion: (r: Region) => void
  onClose: () => void
  onPick: (d: District) => void
}

/** 「港島 / 九龍 / 新界」分組：列出該組各區和進度 */
export function RegionSheet({ region, onRegion, onClose, onPick }: Props) {
  const r = region ?? '港島'
  const districts = useDistricts()
  const sum = regionSummary(districts, r)
  const list = districts.filter((d) => d.region === r)
  return (
    <Sheet open={region !== null} label={`${r}各區`} onClose={onClose}>
      <div className="sheet-head">
        <h2 className="sheet-title">{r}</h2>
        <span className="sheet-sub">
          已點亮 {sum.lit} / {sum.count} 區 · 景點章 {sum.stamps} / {sum.spots}
        </span>
      </div>
      <div className="segmented" role="tablist" aria-label="地區">
        {REGIONS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={x === r} className={x === r ? 'seg active' : 'seg'} onClick={() => onRegion(x)}>
            {x}
          </button>
        ))}
      </div>
      <ul className="district-list">
        {list.map((d) => (
          <li key={d.code}>
            <button type="button" className="district-row" onClick={() => onPick(d)}>
              <span className="swatch" style={{ background: districtSwatch(d) }} aria-hidden="true" />
              <span className={d.visited || d.litPlaces.length ? 'district-name' : 'district-name dim'}>{label(d)}</span>
              {d.visited || d.litPlaces.length ? <Dots visited={d.visited} total={d.total} level={d.level} /> : <span className="row-note">還沒去過</span>}
              <span className="row-count">
                {d.visited} / {d.total}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
