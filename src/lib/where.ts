// 「到了沒有」「帶我去」共用的小工具（首頁雷達、區詳情用）。
import { type Spot } from './districts'
import { type Fix } from './locate'
import { navTarget } from './range'

/** 離可蓋章範圍不到這麼多米，就顯示「就快到了」 */
export const ALMOST = 100

/** Google 地圖導航連結 */
export const navHref = (to: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`

/** 導航到景點：有位置就導到範圍裏離你最近的一點，沒有就導到景點本身 */
export const navToSpot = (spot: Spot, fix?: Pick<Fix, 'lat' | 'lng'> | null) => navHref(fix ? navTarget(fix.lat, fix.lng, spot) : spot)
