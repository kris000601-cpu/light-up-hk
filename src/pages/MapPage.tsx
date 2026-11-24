import { useCallback, useState } from 'react'
import { HKMap, MAP_STYLE } from '../components/HKMap'
import { RegionSheet } from '../components/RegionSheet'
import { DistrictSheet } from '../components/DistrictSheet'
import { InstallHint } from '../components/InstallHint'
import { BackupHint } from '../components/Backup'
import { REGIONS, SPOT_BY_ID, regionSummary, summary, useCountedStamps, useDistricts, type District, type Region } from '../lib/districts'
import { monthDay } from '../lib/format'
import { reloadStamps, useStamps } from '../lib/stamps'

// 圖例：區按「亮了幾塊地方」由淺到深，全部亮了才紅（「一塊塊」畫法：亮了的地方塗墨藍）
const LEGEND =
  MAP_STYLE === 'places'
    ? [
        { cls: '', text: '未去過' },
        { cls: 'lit-place', text: '去過的地方' },
        { cls: 'level-3', text: '全區點亮' },
      ]
    : [
        { cls: '', text: '未去過' },
        { cls: 'ramp', text: '亮了幾塊，越多越深' },
        { cls: 'level-3', text: '全區點亮' },
      ]

// 網址參數只用於截圖檢查：?d=E 選中某區，&sheet=district 打開區詳情，?region=九龍 打開分組列表
const params = new URLSearchParams(window.location.search)
const initial = params.get('d')
const initialRegion = (REGIONS as string[]).includes(params.get('region') ?? '') ? (params.get('region') as Region) : null

export function MapPage() {
  // 只記住區的代號：印章一變，區的進度會重算，要拿新的那份
  const [selCode, setSelCode] = useState<string | null>(initial)
  const [region, setRegion] = useState<Region | null>(initialRegion)
  const [detailCode, setDetailCode] = useState<string | null>(params.get('sheet') === 'district' ? initial : null)
  const districts = useDistricts()
  const { ready, error } = useStamps()
  const stamps = useCountedStamps()
  const selected = districts.find((d) => d.code === selCode) ?? null
  const detail = districts.find((d) => d.code === detailCode) ?? null
  const setSelected = useCallback((d: District | null) => setSelCode(d?.code ?? null), [])
  const setDetail = useCallback((d: District | null) => setDetailCode(d?.code ?? null), [])
  const s = summary(districts)
  const latest = stamps.at(-1)
  const hasTest = stamps.some((x) => x.test)

  const closeRegion = useCallback(() => setRegion(null), [])
  const closeDetail = useCallback(() => setDetailCode(null), [])

  return (
    <>
      <header className="passport-head">
        <div className="passport-top">
          <div>
            <span className="eyebrow">遊歷護照 · 編號 0008</span>
            <h1 className="app-title">點亮香港</h1>
          </div>
          {hasTest && <span className="demo-badge">測試模式 · 含測試章</span>}
        </div>
        <dl className="passport-stats">
          <div>
            <dt>已點亮</dt>
            <dd>
              {ready ? s.lit : '–'}
              <small> / 18 區</small>
            </dd>
            <dd className="stat-place">
              {ready ? s.places : '–'} / {s.placeTotal} 個地方
            </dd>
          </div>
          <div>
            <dt>景點章</dt>
            <dd>
              {ready ? s.stamps : '–'}
              <small> / {s.total} 枚</small>
            </dd>
          </div>
          <div>
            <dt>最近蓋章</dt>
            <dd>
              {latest ? monthDay(latest.at) : ready && <small className="none">還沒蓋章</small>}
            </dd>
            {latest && <dd className="stat-place">{SPOT_BY_ID[latest.spotId]?.area ?? latest.spotName}</dd>}
          </div>
        </dl>
      </header>

      {error && (
        <div className="read-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn-small" onClick={reloadStamps}>
            再試一次
          </button>
        </div>
      )}

      <InstallHint />
      <BackupHint />

      <section className="map-block" aria-label="全港地圖">
        <HKMap selected={selected} onSelect={setSelected} onOpen={setDetail} />
        <p className="map-hint">{selected ? '再點一下名字，看這個區的景點' : '點一下地圖上的區，看名字和進度；兩指可以放大地圖'}</p>
        <ul className="legend" aria-label="圖例">
          {LEGEND.map((l) => (
            <li key={l.text}>
              <span className={`swatch ${l.cls}`} aria-hidden="true" />
              {l.text}
            </li>
          ))}
        </ul>
      </section>

      <div className="region-tabs" role="group" aria-label="按地區看">
        {REGIONS.map((r) => {
          const x = regionSummary(districts, r)
          return (
            <button key={r} type="button" className="region-tab" onClick={() => setRegion(r)}>
              <span className="region-name">{r}</span>
              <span className="region-count">
                {ready ? x.lit : '–'} / {x.count}
              </span>
            </button>
          )
        })}
      </div>

      <p className="credit">
        區界、地方：選舉管理委員會、民政事務總署（DATA.GOV.HK）；海岸線、景點範圍：
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
          © OpenStreetMap 貢獻者
        </a>
      </p>

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
