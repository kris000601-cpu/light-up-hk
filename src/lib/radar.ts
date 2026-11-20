// 首頁「雷達」的計算：讀到位置之後，最近的 10 個景點放在紙上哪裏。
//
// · 方向是真的：上北下南、左西右東（不用指南針，手機怎樣拿都一樣）。
// · 離中心越遠 = 實際越遠。景點由幾十米到幾十公里都有，所以距離用對數壓縮：近處拉開、遠處收攏，
//   但先後次序不變（近的一定比遠的靠中間）。
// · 已經在範圍裏（可以蓋章）的最近那個放在正中，其他的圍着它。
// · 小印章互相疊住時，往旁邊推開一點（方向會偏一點點，次序大致不變）。
import { SPOTS, type Spot } from './districts'
import { ACC_LIMIT, type Fix } from './locate'
import { ALMOST } from './where'
import { metresToRange, nearestOnShape } from './range'

export const RADAR_N = 10

export interface RadarSpot {
  spot: Spot
  /** 到範圍形狀的距離（米） */
  d: number
  /** 離可蓋章還差多少米（≤ 0 = 可以蓋） */
  gap: number
  /** 從你看過去的方向（弧度，正北 = 0，順時針） */
  bearing: number
  /** 可以蓋章（定位夠準，而且在範圍裏） */
  can: boolean
  /** 就快到了（差不到 100 米） */
  almost: boolean
}

export interface RadarData {
  accurate: boolean
  /** 正中那個：可以蓋章的景點裏最近的一個 */
  center: RadarSpot | null
  /** 圍着中間的，最近的排第一 */
  around: RadarSpot[]
}

const M_LAT = 110574
const mLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180)

const bearing = (fix: Pick<Fix, 'lat' | 'lng'>, p: { lat: number; lng: number }) =>
  Math.atan2((p.lng - fix.lng) * mLng(fix.lat), (p.lat - fix.lat) * M_LAT)

export function radarSpots(fix: Fix, n = RADAR_N): RadarData {
  const accurate = fix.acc <= ACC_LIMIT
  const all: RadarSpot[] = SPOTS.map((spot) => {
    const near = nearestOnShape(fix.lat, fix.lng, spot)
    const gap = metresToRange(fix.lat, fix.lng, fix.acc, spot)
    // 在範圍裏面時，「最近的一點」就是你自己，看不出方向 → 用景點本身的座標
    const toward = near.d > 5 ? near : spot
    return { spot, d: near.d, gap, bearing: bearing(fix, toward), can: accurate && gap <= 0, almost: accurate && gap > 0 && gap <= ALMOST }
  }).sort((a, b) => a.d - b.d)
  const nearest = all.slice(0, n)
  // 可以蓋的不管多遠都要放上去（長山徑可能排不進最近 10 個）
  for (const x of all) if (x.can && !nearest.includes(x)) nearest.push(x)
  const center = nearest.find((x) => x.can) ?? null
  return { accurate, center, around: nearest.filter((x) => x !== center) }
}

/** 雷達上顯示的短名：「太平山頂 · 獅子亭」→「太平山頂」，「益昌大廈（怪獸大廈）」→「益昌大廈」 */
export const shortName = (name: string) => name.split(' · ')[0].replace(/（.*?）/g, '').trim()

export interface Placed extends RadarSpot {
  /** 章的中心（像素，相對雷達中心） */
  x: number
  y: number
  /** 章的大小（像素）：越近越大 */
  size: number
  /** 名字佔多寬 / 多高（一行或兩行） */
  w: number
  labelH: number
  /** 按距離算出來、還沒推開時離中心多遠（出場動畫按這個先後） */
  r: number
}

export interface RadarLayout {
  placed: Placed[]
  /** 最外一圈的半徑 */
  R: number
  /** 比例圈：例如 500 米、2 公里在哪個半徑；字寫在右下方 (lx, ly) */
  rings: { r: number; text: string; lx: number; ly: number }[]
}

const LABEL_FONT = 11
const LABEL_LINE = 13
const MAX_CHARS = 6

/** W、H：紙面的寬高；centerBox：正中那個東西（你的位置點，或者可以蓋的大章）佔多大 */
export function layoutRadar(data: RadarData, W: number, H: number, centerBox: { w: number; h: number; oy: number }): RadarLayout {
  const R = Math.max(100, Math.min(W / 2 - 30, H / 2 - 44))
  const rMin = Math.max(centerBox.w, centerBox.h) / 2 + 26
  const items = data.around
  const lo = 60
  const hi = Math.max(1500, ...items.map((x) => x.d))
  const scale = (d: number) => rMin + (R - rMin) * Math.min(1, Math.max(0, Math.log(Math.max(d, lo) / lo) / Math.log(hi / lo)))

  const n = items.length
  const placed: Placed[] = items.map((it, i) => {
    const r = it.can ? rMin : scale(it.d)
    const size = Math.round(50 - (n > 1 ? i / (n - 1) : 0) * 14)
    const chars = shortName(it.spot.name).length
    const lines = chars > MAX_CHARS ? 2 : 1
    const w = Math.max(size, Math.min(chars, MAX_CHARS) * LABEL_FONT + 4)
    return { ...it, r, size, w, labelH: lines * LABEL_LINE, x: r * Math.sin(it.bearing), y: -r * Math.cos(it.bearing) }
  })

  // 比例圈：選在中間和最外圈之間的幾個整數距離，彼此至少隔 34 像素，最多 3 個；字寫在右下方
  const NICE = [100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000]
  const rings: RadarLayout['rings'] = []
  for (const d of NICE) {
    const r = scale(d)
    if (r < rMin + 24 || r > R - 6) continue
    if (rings.length && r - rings[rings.length - 1].r < 34) continue
    rings.push({ r, text: d < 1000 ? `${d} 米` : `${d / 1000} 公里`, lx: r * Math.SQRT1_2, ly: r * Math.SQRT1_2 })
  }
  while (rings.length > 3) rings.splice(1, 1)

  // 小章不准壓住的東西：正中那個、頂上的「北」、比例圈的字
  const obstacles = [
    { x: 0, y: centerBox.oy, w: centerBox.w, h: centerBox.h },
    { x: 0, y: -R - 11, w: 22, h: 20 },
    ...rings.map((g) => ({ x: g.lx, y: g.ly, w: g.text.length * 7 + 14, h: 16 })),
  ]

  // 互相疊住就推開：每個當成一個方框（章 + 下面的名字），橫或豎推最少的那邊
  const GAP = 5
  const boxH = (p: Placed) => p.size + 3 + p.labelH
  const boxOy = (p: Placed) => (boxH(p) - p.size) / 2
  const target = placed.map((p) => ({ x: p.x, y: p.y }))
  const clamp = (p: Placed) => {
    const mx = W / 2 - p.w / 2 - 6
    p.x = Math.max(-mx, Math.min(mx, p.x))
    p.y = Math.max(-H / 2 + p.size / 2 + 6, Math.min(H / 2 - (boxH(p) - p.size / 2) - 6, p.y))
  }
  for (let it = 0; it < 220; it++) {
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j]
        const dx = b.x - a.x
        const dy = b.y + boxOy(b) - (a.y + boxOy(a))
        const ox = (a.w + b.w) / 2 + GAP - Math.abs(dx)
        const oy = (boxH(a) + boxH(b)) / 2 + GAP - Math.abs(dy)
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const s = ((dx >= 0 ? 1 : -1) * ox) / 2
            a.x -= s
            b.x += s
          } else {
            const s = ((dy >= 0 ? 1 : -1) * oy) / 2
            a.y -= s
            b.y += s
          }
        }
      }
      for (const o of obstacles) {
        const dx = a.x - o.x
        const dy = a.y + boxOy(a) - o.y
        const ox = (a.w + o.w) / 2 + GAP - Math.abs(dx)
        const oy = (boxH(a) + o.h) / 2 + GAP - Math.abs(dy)
        if (ox > 0 && oy > 0) {
          if (ox < oy) a.x += (dx >= 0 ? 1 : -1) * ox
          else a.y += (dy >= 0 ? 1 : -1) * oy
        }
      }
    }
    // 前面大部分回合輕輕拉回原本的方向和距離，最後幾十回合只推開
    const pull = it < 180 ? 0.04 : 0
    placed.forEach((p, i) => {
      p.x += (target[i].x - p.x) * pull
      p.y += (target[i].y - p.y) * pull
      clamp(p)
    })
  }

  return { placed, R, rings }
}
