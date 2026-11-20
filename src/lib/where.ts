// 「我在哪」的計算：讀到位置之後，哪些景點可以蓋、哪些就快到了、下一站去哪。
import { SPOTS, type Spot } from './districts'
import { ACC_LIMIT, type Fix } from './locate'
import { metresToRange, nearestOnShape, navTarget } from './range'

export interface Scored {
  spot: Spot
  /** 到範圍形狀的距離（米） */
  d: number
  /** 離可蓋章還差多少米（≤ 0 = 可以蓋） */
  gap: number
}

/** 離可蓋章範圍不到這麼多米，就顯示「就快到了」 */
export const ALMOST = 100

export interface WhereResult {
  /** 定位夠準，可以蓋章 */
  accurate: boolean
  /** 可以蓋章的景點，最近的排第一 */
  nearby: Scored[]
  /** 就快到了（差不到 100 米） */
  almost: Scored[]
  /** 下一站：最近的未蓋章景點 */
  next: Scored | null
}

export function scoreSpots(fix: Fix, doneIds: Set<string>): WhereResult {
  const accurate = fix.acc <= ACC_LIMIT
  const all: Scored[] = SPOTS.map((spot) => ({
    spot,
    d: nearestOnShape(fix.lat, fix.lng, spot).d,
    gap: metresToRange(fix.lat, fix.lng, fix.acc, spot),
  }))
  const nearby = accurate ? all.filter((x) => x.gap <= 0).sort((a, b) => a.d - b.d) : []
  const almost = accurate ? all.filter((x) => x.gap > 0 && x.gap <= ALMOST).sort((a, b) => a.gap - b.gap) : []
  const shown = new Set([...nearby, ...almost].map((x) => x.spot.id))
  const rest = all.filter((x) => !doneIds.has(x.spot.id) && !shown.has(x.spot.id)).sort((a, b) => a.d - b.d)
  // 定位太差時，比誤差還近的「下一站」沒有意義（可能其實已經到了），找誤差以外的
  const far = accurate ? rest : rest.filter((x) => x.d > fix.acc)
  return { accurate, nearby, almost, next: far[0] ?? null }
}

/** Google 地圖導航連結 */
export const navHref = (to: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`

/** 導航到景點：有位置就導到範圍裏離你最近的一點，沒有就導到景點本身 */
export const navToSpot = (spot: Spot, fix?: Pick<Fix, 'lat' | 'lng'> | null) => navHref(fix ? navTarget(fix.lat, fix.lng, spot) : spot)
