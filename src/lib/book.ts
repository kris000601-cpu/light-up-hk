// 印章冊：每個景點一頁，章按蓋的時候在紙上的位置（px / py / rot）重現。
import { SPOT_BY_ID, type Spot } from './districts'
import type { Stamp } from './stamps'
import { faceOf, type FaceData } from '../components/StampArt'

/**
 * 印章冊的一頁紙（邏輯尺寸，像素）。蓋章頁的紙面寬約 358、高 320–400；
 * 章的位置記的是紙面寬高的比例，所以印章冊用同一個比例的紙、整張縮放，章和章之間的相對位置不變。
 */
export const PAPER_W = 358
export const PAPER_H = 372

export interface BookPage {
  spotId: string
  /** 景點現在的資料；景點下架了就沒有，用章上存的名字 */
  spot?: Spot
  name: string
  /** 正式區名，例如「油尖旺區」 */
  district: string
  /** 這一頁的章，按時間排 */
  stamps: Stamp[]
  /** 第幾頁 = 第幾個「第一次來」的景點（跟蓋章頁頂部的「第 N 頁」一致） */
  page: number
  first: number
  last: number
}

/** 印章冊的所有頁（按第一次來的先後） */
export function bookPages(stamps: Stamp[]): BookPage[] {
  const map = new Map<string, Stamp[]>()
  for (const s of stamps) {
    const l = map.get(s.spotId)
    if (l) l.push(s)
    else map.set(s.spotId, [s])
  }
  return [...map.entries()].map(([spotId, list], i) => {
    const spot = SPOT_BY_ID[spotId]
    return {
      spotId,
      spot,
      name: spot?.name ?? list[0].spotName,
      district: spot?.district ?? list[0].district,
      stamps: list,
      page: i + 1,
      first: list[0].at,
      last: list[list.length - 1].at,
    }
  })
}

/** 「油尖旺區」→「油尖旺」；東區、南區、北區保留「區」 */
export const shortDistrict = (full: string) => (full.length <= 2 ? full : full.replace(/區$/, ''))

/** 一枚章的章面 */
export function faceOfStamp(s: Stamp): FaceData {
  const spot = SPOT_BY_ID[s.spotId]
  return faceOf({ at: s.at, no: s.test ? null : s.no, name: spot?.name ?? s.spotName, district: shortDistrict(s.district), kind: spot?.kind ?? '', spotId: s.spotId })
}

// 早期的章（第 3 步直接蓋的、測試工具蓋的）沒有記位置：分散放在幾個固定位置，免得全疊在正中間糊成一團
const SLOTS: [number, number, number][] = [
  [0.36, 0.34, -4],
  [0.64, 0.52, 3],
  [0.4, 0.6, -2],
  [0.62, 0.32, 5],
  [0.5, 0.46, -6],
]

export interface Placed {
  stamp: Stamp
  face: FaceData
  px: number
  py: number
  rot: number
  /** 紙紋的隨機種子：同一頁的章紋理不完全一樣 */
  seed: number
}

/** 一頁上每枚章的位置 */
export function placeStamps(stamps: Stamp[]): Placed[] {
  let slot = 0
  return stamps.map((s, i) => {
    const fb = s.px == null || s.py == null ? SLOTS[slot++ % SLOTS.length] : null
    return { stamp: s, face: faceOfStamp(s), px: fb ? fb[0] : s.px!, py: fb ? fb[1] : s.py!, rot: s.rot ?? fb?.[2] ?? 0, seed: 11 + (i % 5) }
  })
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
/** 香港時間的年、月、日、星期幾 */
export function hkParts(ms: number) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(ms)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  const wd = WEEK[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))]
  return { y: +get('year'), m: +get('month'), d: +get('day'), wd }
}
const pad = (n: number) => String(n).padStart(2, '0')
/** 「2026.11.19（四）」 */
export function fullDate(ms: number) {
  const t = hkParts(ms)
  return `${t.y}.${pad(t.m)}.${pad(t.d)}（${t.wd}）`
}
