// 「站在這裏算不算到了」：算一個位置離景點的可蓋章範圍有多遠
//
// 景點範圍（由 tools/build-spots.mjs 生成）：
//   r       往外擴多少米
//   points  額外的點（沒有線 / 面時就用景點座標本身）
//   lines   線：山徑、海濱長廊、河…（[經度, 緯度] 的序列）
//   areas   面：公園、海灘、島…（閉合的 [經度, 緯度] 序列，在裏面距離 = 0）

export interface Range {
  r: number
  points?: [number, number][]
  lines?: [number, number][][]
  areas?: [number, number][][]
}

// 香港範圍很小，用「本地平面」近似：經緯度 → 米，誤差遠小於 GPS 本身
const M_LAT = 110574
const mLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180)

/** 兩點距離（米） */
export function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toR = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * toR) / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(((lng2 - lng1) * toR) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 位置到範圍「形狀」本身的最短距離（米），還沒減去 r；在面裏面 = 0 */
export function distanceToShape(lat: number, lng: number, spot: { lat: number; lng: number; range: Range }): number {
  const { range } = spot
  const kx = mLng(lat)
  const X = (p: [number, number]) => (p[0] - lng) * kx
  const Y = (p: [number, number]) => (p[1] - lat) * M_LAT
  let best = Infinity

  const pts = range.points ?? []
  if (!range.lines && !range.areas && !pts.length) return distance(lat, lng, spot.lat, spot.lng)
  for (const p of pts) best = Math.min(best, Math.hypot(X(p), Y(p)))

  const seg = (a: [number, number], b: [number, number]) => {
    const ax = X(a), ay = Y(a), bx = X(b), by = Y(b)
    const dx = bx - ax, dy = by - ay
    const L = dx * dx + dy * dy
    const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0
    return Math.hypot(ax + t * dx, ay + t * dy)
  }
  const poly = (line: [number, number][]) => {
    for (let i = 1; i < line.length; i++) best = Math.min(best, seg(line[i - 1], line[i]))
    if (line.length === 1) best = Math.min(best, Math.hypot(X(line[0]), Y(line[0])))
  }
  for (const l of range.lines ?? []) poly(l)
  for (const a of range.areas ?? []) {
    // 射線法：從所在位置往右（東）畫一條線，穿過邊界單數次 = 在裏面 → 距離 0
    let inside = false
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const xi = X(a[i]), yi = Y(a[i]), xj = X(a[j]), yj = Y(a[j])
      if (yi > 0 !== yj > 0 && xj + (-yj / (yi - yj)) * (xi - xj) > 0) inside = !inside
    }
    if (inside) return 0
    poly(a)
  }
  return best
}

/**
 * 離「可蓋章」還差多少米（≤ 0 就是到了）。
 * accuracy：手機報告的定位誤差（米），最多補 100 米，免得人到了卻因為定位飄了蓋不到。
 */
export function metresToRange(lat: number, lng: number, accuracy: number, spot: { lat: number; lng: number; range: Range }): number {
  return distanceToShape(lat, lng, spot) - spot.range.r - Math.min(Math.max(accuracy, 0), 100)
}
