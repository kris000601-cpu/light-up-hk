// 「地方」的形狀（M3）：判斷手機讀到的位置在哪個地方。
//
// 形狀在 src/data/places.json（約 100 KB 壓縮後），用到時才載入，不拖慢 App 打開。
// 地圖跟 18 區同一個投影（tools/build-map.mjs）：先把經緯度投影到地圖座標，再看落在哪個地方的多邊形裏。
import mapData from '../data/hkmap.json'

export interface PlaceGeo {
  id: string
  name: string
  /** 區代號（A–T） */
  dc: string
  /** 名字放的位置（地圖座標） */
  label: [number, number]
  /** SVG 路徑（地圖座標） */
  d: string
}

interface Shape {
  p: PlaceGeo
  rings: number[][] // 每個環：[x0, y0, x1, y1, …]
  box: [number, number, number, number]
}

const { kx, minX, minY, s, pad } = mapData.proj
/** 經緯度 → 地圖座標 */
export const project = (lat: number, lng: number): [number, number] => [pad + (lng * kx - minX) * s, pad + (-lat - minY) * s]
/** 地圖上一個單位約等於多少米 */
const M_PER_UNIT = 111_320 / s

/** 不在任何地方裏（站在碼頭盡頭、海邊、或地圖去掉了的小島上）：這麼近的話算最近那個地方 */
const NEAR_M = 150

let loading: Promise<Shape[]> | null = null
function shapes(): Promise<Shape[]> {
  loading ??= import('../data/places.json')
    .then((m) => (m.default.places as PlaceGeo[]).map(toShape))
    .catch((err) => {
      loading = null // 載入失敗（例如離線又未緩存）：下次再試
      throw err
    })
  return loading
}

/** 預先載入（例如打開地圖頁時） */
export const loadPlaces = (): Promise<PlaceGeo[]> => shapes().then((list) => list.map((x) => x.p))

function toShape(p: PlaceGeo): Shape {
  const rings: number[][] = []
  for (const sub of p.d.split('M').slice(1)) {
    const nums = sub.replace(/Z/g, '').split(/[L ]/).filter(Boolean).map(Number)
    rings.push(nums)
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of rings)
    for (let i = 0; i < r.length; i += 2) {
      x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i])
      y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1])
    }
  return { p, rings, box: [x0, y0, x1, y1] }
}

/** 點在不在這個地方裏（奇偶規則：洞也算對） */
function inside(sh: Shape, x: number, y: number): boolean {
  const [x0, y0, x1, y1] = sh.box
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  let c = false
  for (const r of sh.rings) {
    const n = r.length
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
  }
  return c
}

/** 點到這個地方邊界的距離（地圖單位） */
function edgeDist(sh: Shape, x: number, y: number): number {
  let best = Infinity
  for (const r of sh.rings) {
    const n = r.length
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const ax = r[j], ay = r[j + 1], bx = r[i], by = r[i + 1]
      const dx = bx - ax, dy = by - ay
      const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
    }
  }
  return best
}

/** 這個位置在哪個地方；不在任何地方裏、附近也沒有，回傳 null */
export async function placeAt(lat: number, lng: number): Promise<PlaceGeo | null> {
  const list = await shapes()
  const [x, y] = project(lat, lng)
  const hit = list.find((sh) => inside(sh, x, y))
  if (hit) return hit.p
  const near = NEAR_M / M_PER_UNIT
  let best: Shape | null = null, bestD = near
  for (const sh of list) {
    const [x0, y0, x1, y1] = sh.box
    if (x < x0 - near || x > x1 + near || y < y0 - near || y > y1 + near) continue
    const d = edgeDist(sh, x, y)
    if (d <= bestD) { bestD = d; best = sh }
  }
  return best?.p ?? null
}
