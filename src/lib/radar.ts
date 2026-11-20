// 首頁「雷達」的計算：讀到位置之後，最近的 10 個景點放在紙上哪裏。
//
// · 方向是真的：上北下南、左西右東（不用指南針，手機怎樣拿都一樣）。
// · 離中心越遠 = 實際越遠。景點由幾十米到幾十公里都有，所以距離用對數壓縮：近處拉開、遠處收攏，
//   但先後次序不變（近的一定比遠的靠中間）。
// · 已經在範圍裏（可以蓋章）的最近那個放在正中，其他的圍着它。
// · 長條章（只有字）不准互相疊住：近的先放在真實位置，後面的放不下就挪到附近最近的空位（方向盡量不變）。
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

/**
 * arrived：這一次按壓裏，之前讀到的位置已經算「到了」的景點。位置變準之後照樣算到了，
 * 免得「你已到達」出現了又消失（每一個位置本身都已經符合蓋章的規則：誤差 ≤ 100 米、在範圍裏）。
 */
export function radarSpots(fix: Fix, n = RADAR_N, arrived?: ReadonlySet<string>): RadarData {
  const accurate = fix.acc <= ACC_LIMIT
  const all: RadarSpot[] = SPOTS.map((spot) => {
    const near = nearestOnShape(fix.lat, fix.lng, spot)
    const gap = metresToRange(fix.lat, fix.lng, fix.acc, spot)
    // 在範圍裏面時，「最近的一點」就是你自己，看不出方向 → 用景點本身的座標
    const toward = near.d > 5 ? near : spot
    const can = (accurate && gap <= 0) || !!arrived?.has(spot.id)
    return { spot, d: near.d, gap, bearing: bearing(fix, toward), can, almost: !can && accurate && gap > 0 && gap <= ALMOST }
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
  /** 字的大小（像素）：越近越大 */
  font: number
  /** 長條章的寬 / 高 */
  w: number
  h: number
  /** 按距離算出來、還沒推開時離中心多遠（浮現的先後按這個） */
  r: number
}

export interface RadarLayout {
  placed: Placed[]
  /** 最外一圈的半徑 */
  R: number
}

/** 長條章（只有字）：字距 0.12em，字和框之間左右至少 10 像素、上下 5 像素，框 1.5 像素 */
export const SEAL_PAD_X = 10
export const SEAL_PAD_Y = 5
export const SEAL_TRACK = 0.12
export const SEAL_FONT = "900 {px}px 'Noto Serif TC', 'Noto Serif CJK TC', 'PMingLiU', serif"

/** 估算一行字多寬：中文一個字一格，英文數字約 0.6 格（大寫闊一點） */
const estimate = (s: string, font: number) =>
  [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 1 : c === ' ' ? 0.3 : /[A-Z+]/.test(c) ? 0.8 : 0.62) * font + SEAL_TRACK * font, 0)
/** 用瀏覽器真的量一次（字體還沒載入時量到的是後備字體，所以跟估算取大的那個） */
let ctx: CanvasRenderingContext2D | null | undefined
const measure = (s: string, font: number) => {
  if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!ctx) return 0
  ctx.font = SEAL_FONT.replace('{px}', String(font))
  return ctx.measureText(s).width + [...s].length * SEAL_TRACK * font
}
export const textWidth = (s: string, font: number) => Math.max(estimate(s, font), measure(s, font))
/**
 * 章的大小一律是整數像素（框就畫在整數像素上，手機上細邊框才不會時有時無）。
 * 字在框裏居中；字距會在最後一個字後面多留一點，所以左邊補回同樣多（SEAL_TRACK）。
 */
export const sealSize = (name: string, font: number) => ({
  w: Math.ceil(textWidth(name, font) + SEAL_TRACK * font + SEAL_PAD_X * 2 + 3),
  h: Math.ceil(font * 1.3 + SEAL_PAD_Y * 2 + 3),
})

/** W、H：紙面的寬高；centerBox：正中那個東西（你的位置點，或者可以蓋的大章連上下的字）佔多大 */
export function layoutRadar(data: RadarData, W: number, H: number, centerBox: { w: number; h: number }): RadarLayout {
  const R = Math.floor(Math.max(100, Math.min(W / 2 - 24, H / 2 - 40)))
  const rMin = Math.min(centerBox.w, centerBox.h) / 2 + 30
  const items = data.around
  const lo = 60
  const hi = Math.max(1500, ...items.map((x) => x.d))
  const scale = (d: number) => rMin + (R - rMin) * Math.min(1, Math.max(0, Math.log(Math.max(d, lo) / lo) / Math.log(hi / lo)))

  const n = items.length
  const placed: Placed[] = items.map((it, i) => {
    const r = it.can ? rMin : scale(it.d)
    // 最近的 15 像素，最遠的 11.5 像素
    const font = Math.round((15 - (n > 1 ? i / (n - 1) : 0) * 3.5) * 2) / 2
    const { w, h } = sealSize(shortName(it.spot.name), font)
    return { ...it, r, font, w, h, x: r * Math.sin(it.bearing), y: -r * Math.cos(it.bearing) }
  })

  // 章不准壓住的東西：正中那個、頂上的「北」
  // （不畫寫着「1 公里」的比例圈：距離是壓縮過的，章被挪開之後也不在原位，寫數字反而誤導。Chris 2026-11-20）
  const obstacles = [
    { x: 0, y: 0, w: centerBox.w, h: centerBox.h },
    { x: 0, y: -R - 11, w: 22, h: 20 },
  ]

  // 排位置：近的先放，放在真實的方向和距離上；放不下（會疊住別的章或上面的字）就在附近找最近的空位，
  // 同樣近的空位裏優先保住方向。這樣一定不會疊，越近的越準。
  const GAP = 6
  const boxes: { x: number; y: number; w: number; h: number }[] = [...obstacles]
  const fits = (x: number, y: number, w: number, h: number) => {
    if (Math.abs(x) > W / 2 - w / 2 - 6 || Math.abs(y) > H / 2 - h / 2 - 6) return false
    return boxes.every((b) => Math.abs(x - b.x) >= (w + b.w) / 2 + GAP || Math.abs(y - b.y) >= (h + b.h) / 2 + GAP)
  }
  for (const p of placed) {
    const tx = p.x
    const ty = p.y
    if (!fits(tx, ty, p.w, p.h)) {
      let best: { x: number; y: number; score: number } | null = null
      for (let k = 1; k <= 90 && !best; k++) {
        const rad = k * 4
        const steps = Math.max(12, Math.round((2 * Math.PI * rad) / 6))
        for (let s = 0; s < steps; s++) {
          const a = (2 * Math.PI * s) / steps
          const x = tx + rad * Math.cos(a)
          const y = ty + rad * Math.sin(a)
          if (!fits(x, y, p.w, p.h)) continue
          // 偏離真實方向多少（從中心看）
          let da = Math.abs(Math.atan2(x, -y) - p.bearing)
          if (da > Math.PI) da = 2 * Math.PI - da
          const score = rad + da * 40
          if (!best || score < best.score) best = { x, y, score }
        }
      }
      if (best) {
        p.x = best.x
        p.y = best.y
      }
    }
    boxes.push({ x: p.x, y: p.y, w: p.w, h: p.h })
  }

  // 對齊整數像素：小數位置在手機上會令細邊框（尤其虛線）時有時無
  for (const p of placed) {
    p.x = Math.round(p.x)
    p.y = Math.round(p.y)
  }
  return { placed, R }
}
