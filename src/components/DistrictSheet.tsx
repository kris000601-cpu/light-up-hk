import { useMemo } from 'react'
import { label, useCountedStamps, type District } from '../lib/districts'
import { monthDay } from '../lib/format'
import { openBook } from '../lib/nav'
import { navToSpot } from '../lib/where'
import type { Stamp } from '../lib/stamps'
import { EmptyOct, MiniStamp } from './BookPaper'
import { Sheet } from './Sheet'
import { Dots } from './Dots'

interface Props {
  district: District | null
  onClose: () => void
}

/** 區詳情：這個區的景點。蓋過章的左邊是最近那一枚（照蓋的角度），按一下跳到印章冊那一頁；沒去過的是虛線章位，右邊「帶我去」導航 */
export function DistrictSheet({ district, onClose }: Props) {
  const stamps = useCountedStamps()
  const bySpot = useMemo(() => {
    const m: Record<string, Stamp[]> = {}
    for (const s of stamps) (m[s.spotId] ??= []).push(s)
    return m
  }, [stamps])
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
      <ul className="spot-list rd">
        {d.spots.map((s) => {
          const list = bySpot[s.id] ?? []
          const last = list.at(-1)
          const text = (
            <span className="spot-text">
              <span className="spot-name">{s.name}</span>
              <span className="spot-tip">
                {s.area} · {s.tip}
              </span>
            </span>
          )
          return (
            <li key={s.id}>
              {last ? (
                <button type="button" className="spot done" onClick={() => openBook(s.id)} aria-label={`${s.name}：看印章冊那一頁`}>
                  <span className="spot-mark2">
                    <MiniStamp stamp={last} width={62} />
                  </span>
                  {text}
                  <span className="spot-state">
                    {last.test ? '測試 · ' : ''}
                    {monthDay(last.at)}
                    {list.length > 1 ? ` · ${list.length} 次` : ''}
                  </span>
                </button>
              ) : (
                <div className="spot">
                  <span className="spot-mark2">
                    <EmptyOct width={46} />
                  </span>
                  {text}
                  {/* 左邊的問號章位已經說了「沒去過」，右邊鼓勵出發：用 Google 地圖導航過去 */}
                  <a className="go-btn" href={navToSpot(s)} target="_blank" rel="noopener" aria-label={`帶我去${s.name}（Google 地圖導航）`}>
                    帶我去 ›
                  </a>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
