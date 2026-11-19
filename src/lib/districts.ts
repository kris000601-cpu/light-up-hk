import mapData from '../data/hkmap.json'
import spotsData from '../../data/spots.json'
import { useMemo } from 'react'
import type { Range } from './range'
import { useStamps, type Stamp } from './stamps'

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
  /** 蓋過章的景點 → 最近一次蓋的章 */
  done: Record<string, Stamp>
  visited: number
  total: number
  level: Level
}

export const MAP_W = mapData.width
export const MAP_H = mapData.height
export const MAP_SOURCE = mapData.source

export const SPOTS = spotsData as Spot[]
export const SPOT_BY_ID: Record<string, Spot> = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

const levelOf = (visited: number, total: number): Level =>
  visited === 0 ? 0 : visited >= total ? 3 : visited * 2 >= total ? 2 : 1

/** 單字區名要加「區」（東區、南區、北區），其他用簡稱也自然 */
export const label = (d: Pick<District, 'name'>) => (d.name.length === 1 ? d.name + '區' : d.name)

const BASE = mapData.districts.map((m) => {
  const fullName = m.name + '區'
  return {
    code: m.code,
    name: m.name,
    fullName,
    region: m.region as Region,
    center: m.center as [number, number],
    d: m.d,
    spots: SPOTS.filter((s) => s.district === fullName),
  }
})

/** 按手機裏的印章算出各區進度 */
export function buildDistricts(stamps: Stamp[]): District[] {
  const last: Record<string, Stamp> = {}
  for (const st of stamps) last[st.spotId] = st // stamps 已按時間排好，後蓋的蓋過先蓋的
  return BASE.map((b) => {
    const done: Record<string, Stamp> = {}
    for (const s of b.spots) if (last[s.id]) done[s.id] = last[s.id]
    const visited = Object.keys(done).length
    return { ...b, done, visited, total: b.spots.length, level: levelOf(visited, b.spots.length) }
  })
}

/** 各區（含進度），印章一變就重算 */
export function useDistricts(): District[] {
  const { stamps } = useStamps()
  return useMemo(() => buildDistricts(stamps), [stamps])
}

export const summary = (ds: District[]) => {
  const lit = ds.filter((d) => d.visited > 0).length
  const stamps = ds.reduce((a, d) => a + d.visited, 0)
  const total = ds.reduce((a, d) => a + d.total, 0)
  return { lit, stamps, total }
}

export const regionSummary = (all: District[], r: Region) => {
  const ds = all.filter((d) => d.region === r)
  return { lit: ds.filter((d) => d.visited > 0).length, count: ds.length, stamps: ds.reduce((a, d) => a + d.visited, 0), spots: ds.reduce((a, d) => a + d.total, 0) }
}
