import { label, type District } from '../lib/districts'
import { Sheet } from './Sheet'
import { Dots } from './Dots'
import { monthDay } from '../lib/format'

interface Props {
  district: District | null
  onClose: () => void
}

/** 區詳情：這個區的景點，哪些蓋過了 */
export function DistrictSheet({ district, onClose }: Props) {
  if (!district) return <Sheet open={false} label="" onClose={onClose}>{null}</Sheet>
  const d = district
  return (
    <Sheet open label={`${label(d)}的景點`} onClose={onClose}>
      <div className="sheet-head">
        <h2 className="sheet-title">{d.fullName}</h2>
        <span className="sheet-sub">{d.region}</span>
      </div>
      <div className="district-progress">
        <span className="big">
          {d.visited}
          <small> / {d.total} 個景點</small>
        </span>
        <Dots visited={d.visited} total={d.total} level={d.level} />
      </div>
      <ul className="spot-list">
        {d.spots.map((s) => {
          const st = d.done[s.id]
          const done = !!st
          return (
            <li key={s.id} className={done ? 'spot done' : 'spot'}>
              <span className="spot-mark" aria-hidden="true">
                {done ? '章' : ''}
              </span>
              <span className="spot-text">
                <span className="spot-name">{s.name}</span>
                <span className="spot-tip">
                  {s.area} · {s.tip}
                </span>
              </span>
              <span className="spot-state">{st ? `${st.test ? '測試 · ' : ''}${monthDay(st.at)}` : '未去過'}</span>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
