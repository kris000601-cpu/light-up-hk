import mapData from '../data/hkmap.json'
import spotsData from '../../data/spots.json'
import type { Range } from './range'

export type Region = '港島' | '九龍' | '新界'
export const REGIONS: Region[] = ['港島', '九龍', '新界']

export interface Spot {
  id: string
  district: string
  area: string
  name: string
  tip: string
  lat: number
  lng: number
  kind: string
  verified: boolean
  /** 可蓋章範圍，見 range.ts */
  range: Range
}

/** 0 未去過 · 1 去過一兩個 · 2 過半 · 3 集齊 */
export type Level = 0 | 1 | 2 | 3

export interface District {
  code: string
  /** 簡稱，例如「東」 */
  name: string
  /** 正式名，例如「東區」 */
  fullName: string
  region: Region
  center: [number, number]
  d: string
  spots: Spot[]
  visited: number
  total: number
  level: Level
}

export const MAP_W = mapData.width
export const MAP_H = mapData.height
export const MAP_SOURCE = mapData.source

const spots = spotsData as Spot[]

// ⚠️ 示範數據：M2 做好蓋章之後，換成手機裏真正蓋過的章。
const DEMO_VISITED: Record<string, number> = { 中西: 5, 灣仔: 3, 東: 2, 南: 2, 油尖旺: 4, 九龍城: 1, 西貢: 3, 離島: 1 }
export const IS_DEMO = true

const levelOf = (visited: number, total: number): Level =>
  visited === 0 ? 0 : visited >= total ? 3 : visited * 2 >= total ? 2 : 1

/** 單字區名要加「區」（東區、南區、北區），其他用簡稱也自然 */
export const label = (d: Pick<District, 'name'>) => (d.name.length === 1 ? d.name + '區' : d.name)

export const DISTRICTS: District[] = mapData.districts.map((m) => {
  const fullName = m.name + '區'
  const own = spots.filter((s) => s.district === fullName)
  const visited = Math.min(DEMO_VISITED[m.name] ?? 0, own.length)
  return {
    code: m.code,
    name: m.name,
    fullName,
    region: m.region as Region,
    center: m.center as [number, number],
    d: m.d,
    spots: own,
    visited,
    total: own.length,
    level: levelOf(visited, own.length),
  }
})

export const summary = () => {
  const lit = DISTRICTS.filter((d) => d.visited > 0).length
  const stamps = DISTRICTS.reduce((a, d) => a + d.visited, 0)
  const total = DISTRICTS.reduce((a, d) => a + d.total, 0)
  return { lit, stamps, total }
}

export const regionSummary = (r: Region) => {
  const ds = DISTRICTS.filter((d) => d.region === r)
  return { lit: ds.filter((d) => d.visited > 0).length, count: ds.length, stamps: ds.reduce((a, d) => a + d.visited, 0), spots: ds.reduce((a, d) => a + d.total, 0) }
}
