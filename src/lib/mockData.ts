// 設計稿截圖用的一套假印章（網址加 ?mock=1）。不會寫進手機。
import { SPOT_BY_ID, SPOTS } from './districts'
import type { Stamp } from './stamps'
import type { Lit } from './lit'

// [景點, 月, 日, 時, 分, px, py, rot]（香港時間）
const RAW: [string, number, number, number, number, number, number, number][] = [
  ['s026', 10, 12, 15, 20, 0.45, 0.38, -3],
  ['s001', 10, 19, 17, 40, 0.55, 0.42, 2],
  ['s016', 10, 26, 10, 5, 0.42, 0.36, -5],
  ['s023', 11, 1, 19, 30, 0.4, 0.35, -4],
  ['s036', 11, 3, 11, 0, 0.6, 0.45, 3],
  ['s085', 11, 8, 13, 15, 0.5, 0.4, -2],
  ['s016', 11, 9, 9, 50, 0.6, 0.55, 4],
  ['s024', 11, 12, 21, 10, 0.48, 0.5, -1],
  ['s057', 11, 14, 14, 30, 0.52, 0.38, 5],
  ['s004', 11, 15, 18, 0, 0.45, 0.47, -3],
  ['s077', 11, 16, 19, 45, 0.55, 0.4, 2],
  ['s011', 11, 17, 12, 20, 0.4, 0.44, -6],
  ['s023', 11, 19, 20, 15, 0.62, 0.55, 3],
  ['s021', 11, 19, 16, 40, 0.5, 0.4, -2],
  ['s016', 11, 20, 8, 30, 0.36, 0.6, -7],
]

export const MOCK_STAMPS: Stamp[] = RAW.map(([spotId, m, d, h, mi, px, py, rot], i) => {
  const spot = SPOT_BY_ID[spotId]
  return {
    id: i + 1,
    uid: `mock-${i + 1}`,
    no: 0,
    spotId,
    spotName: spot.name,
    district: spot.district,
    at: Date.UTC(2026, m - 1, d, h - 8, mi),
    px,
    py,
    rot,
  }
})
  .sort((a, b) => a.at - b.at)
  .map((s, i) => ({ ...s, no: i + 1 }))

/**
 * 壓力測試：網址加 ?mock=1&many=1 → 每個景點兩個章（約 170 個），看章多了印章冊 / 目錄會不會慢。
 * 位置、角度、時間都是固定算出來的（每次一樣）。
 */
export function manyStamps(): Stamp[] {
  const out: Stamp[] = []
  SPOTS.forEach((spot, i) => {
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k
      out.push({
        id: j + 1,
        uid: `many-${j + 1}`,
        no: 0,
        spotId: spot.id,
        spotName: spot.name,
        district: spot.district,
        // 第一輪 87 個景點各一個，第二輪再各一個
        at: Date.UTC(2026, 0, 1) + (k * SPOTS.length + i) * 20 * 3600e3,
        px: 0.35 + ((j * 37) % 30) / 100,
        py: 0.35 + ((j * 53) % 25) / 100,
        rot: ((j * 7) % 13) - 6,
      })
    }
  })
  return out.sort((a, b) => a.at - b.at).map((s, i) => ({ ...s, no: i + 1 }))
}

/**
 * 截圖用：在首頁按點時順手點亮了的地方（M3）。東區全亮（看「全部亮了才變紅」），其他零零星星。
 * 蓋過章的景點所在的地方另外由章推出來，不用列在這裏。
 */
export const MOCK_LIT: Lit[] = ['p014', 'p015', 'p016', 'p017', 'p018', 'p019', 'p020', 'p021', 'p022', 'p008', 'p009', 'p011', 'p002', 'p003', 'p032', 'p033', 'p116', 'p120'].map(
  (place, i) => ({ place, at: Date.UTC(2026, 9, 1) + i * 86400e3 }),
)
