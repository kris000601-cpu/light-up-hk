import mapData from '../data/hkmap.json'
import spotsData from '../../data/spots.json'
import { useMemo } from 'react'
import type { Range } from './range'
import { useStamps, type Stamp } from './stamps'
import { useTestMode } from './testMode'
import { useLit } from './lit'

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

/** 0 一塊都沒亮 · 1 亮了不到一半 · 2 亮了一半或以上 · 3 全部亮了（M3 起按「地方」算，以前按景點） */
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
  /** 蓋過章的景點數 / 景點總數 */
  visited: number
  total: number
  /** 這區的地方（編號），和亮了的那些 */
  places: string[]
  litPlaces: string[]
  /** 亮了幾成（0–1） */
  frac: number
  level: Level
}

export const MAP_W = mapData.width
export const MAP_H = mapData.height

export const SPOTS = spotsData as Spot[]
export const SPOT_BY_ID: Record<string, Spot> = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

const levelOf = (lit: number, total: number): Level => (lit === 0 ? 0 : lit >= total ? 3 : lit * 2 >= total ? 2 : 1)

/** 地方的名字（形狀在 places.ts，用到時才載入） */
export const PLACE_NAMES: Record<string, string> = mapData.placeNames
/** 每個景點在哪個地方（tools/build-map.mjs 算好；座標在水面上的歸同一區最近的地方） */
export const SPOT_PLACE: Record<string, string> = mapData.spotPlace

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
    places: m.places,
  }
})

/** 按手機裏的印章和點亮的地方算出各區進度 */
export function buildDistricts(stamps: Stamp[], lit: Set<string>): District[] {
  const last: Record<string, Stamp> = {}
  // stamps 已按時間排好：顯示最近一次的正式章；只有測試章時才顯示測試章
  for (const st of stamps) if (!last[st.spotId] || last[st.spotId].test || !st.test) last[st.spotId] = st
  return BASE.map((b) => {
    const done: Record<string, Stamp> = {}
    for (const s of b.spots) if (last[s.id]) done[s.id] = last[s.id]
    const visited = Object.keys(done).length
    const litPlaces = b.places.filter((p) => lit.has(p))
    return { ...b, done, visited, total: b.spots.length, litPlaces, frac: litPlaces.length / b.places.length, level: levelOf(litPlaces.length, b.places.length) }
  })
}

/** 算進度用的印章：測試章只在測試模式開着時才算 */
export function useCountedStamps(): Stamp[] {
  const { stamps } = useStamps()
  const test = useTestMode()
  return useMemo(() => (test ? stamps : stamps.filter((s) => !s.test)), [stamps, test])
}

/**
 * 亮了的地方：在首頁按點時亮的（測試的只在測試模式開着時算）+ 蓋過章的景點所在的地方。
 * 後者由章推出來、不另外存：以前（M3 之前）蓋的章也照樣點亮。
 */
export function useLitPlaces(): Set<string> {
  const stamps = useCountedStamps()
  const { lit } = useLit()
  const test = useTestMode()
  return useMemo(() => {
    const s = new Set<string>()
    for (const x of lit) if (test || !x.test) s.add(x.place)
    for (const x of stamps) if (SPOT_PLACE[x.spotId]) s.add(SPOT_PLACE[x.spotId])
    return s
  }, [stamps, lit, test])
}

/** 各區（含進度），印章或點亮的地方一變就重算 */
export function useDistricts(): District[] {
  const stamps = useCountedStamps()
  const lit = useLitPlaces()
  return useMemo(() => buildDistricts(stamps, lit), [stamps, lit])
}

/** lit：點亮了的區（至少一塊亮了） */
export const summary = (ds: District[]) => {
  const lit = ds.filter((d) => d.litPlaces.length > 0).length
  const stamps = ds.reduce((a, d) => a + d.visited, 0)
  const total = ds.reduce((a, d) => a + d.total, 0)
  const places = ds.reduce((a, d) => a + d.litPlaces.length, 0)
  const placeTotal = ds.reduce((a, d) => a + d.places.length, 0)
  return { lit, stamps, total, places, placeTotal }
}

export const regionSummary = (all: District[], r: Region) => {
  const ds = all.filter((d) => d.region === r)
  return { lit: ds.filter((d) => d.litPlaces.length > 0).length, count: ds.length, stamps: ds.reduce((a, d) => a + d.visited, 0), spots: ds.reduce((a, d) => a + d.total, 0) }
}
