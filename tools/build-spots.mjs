// 生成景點數據：data/spots.csv → data/spots.json（App 用）+ public/check/data.js（核對頁用）
//
// spots.csv 的兩欄決定「站在哪裏算到了」：
//   範圍    空白 = 一個點（就是緯度、經度）。
//           否則寫 OpenStreetMap 的地物編號，可以多個，用空格分開，例如「way/123 relation/456」。
//           線（山徑、海濱長廊、河）→ 沿着整條線都算；面（公園、海灘、島）→ 範圍內都算。
//           很長的山徑可以在後面加「@米數」，只取離景點座標這麼遠以內的一段，例如「relation/789@2500」。
//           也可以直接寫座標「22.45,114.03」，當作多一個點。
//   範圍米  再往外擴多少米。空白 = 點 300、線 / 面 200。
//
// 地物的形狀從 OpenStreetMap 下載，緩存在 tools/.cache/osm-shapes.json（不入庫）。
// 用法：npm run spots
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSpots, overpass, haversine } from './spots-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(root, 'tools', '.cache', 'osm-shapes.json')
fs.mkdirSync(path.dirname(CACHE), { recursive: true })
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}

const DEFAULT_POINT = 300
const DEFAULT_SHAPE = 200

const spots = readSpots()

// ---------- 1. 下載還沒緩存的地物 ----------
const tokens = (s) => s.shape.split(/\s+/).filter(Boolean)
const isRef = (t) => /^(node|way|relation)\/\d+/.test(t)
const refs = [...new Set(spots.flatMap((s) => tokens(s).filter(isRef).map((t) => t.split('@')[0])))]
const missing = refs.filter((r) => !cache[r])
if (missing.length) {
  console.log(`下載 ${missing.length} 個地物形狀…`)
  const parts = missing.map((r) => { const [t, id] = r.split('/'); return `${t}(${id});` }).join('')
  const els = await overpass(`[out:json][timeout:120];(${parts});out geom;`)
  for (const e of els) cache[`${e.type}/${e.id}`] = e
  fs.writeFileSync(CACHE, JSON.stringify(cache))
  const still = missing.filter((r) => !cache[r])
  if (still.length) throw new Error('OpenStreetMap 找不到：' + still.join(' '))
}

// ---------- 2. 地物 → 線 / 面 ----------
const AREA_TAGS = ['building', 'leisure', 'landuse', 'natural', 'place', 'amenity', 'tourism', 'historic', 'man_made', 'water', 'area']
const isArea = (e) => {
  const t = e.tags ?? {}
  if (t.area === 'no') return false
  if (t.highway || t.waterway || t.barrier || t.railway) return t.area === 'yes'
  return AREA_TAGS.some((k) => t[k])
}
const closed = (pts) => pts.length > 3 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]

/** 把首尾相接的線段連起來 */
function join(segs) {
  segs = segs.map((s) => s.slice())
  const out = []
  while (segs.length) {
    let cur = segs.shift()
    let grew = true
    while (grew && !closed(cur)) {
      grew = false
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], a = cur[0], b = cur.at(-1)
        const eq = (p, q) => p[0] === q[0] && p[1] === q[1]
        if (eq(b, s[0])) cur = cur.concat(s.slice(1))
        else if (eq(b, s.at(-1))) cur = cur.concat(s.slice(0, -1).reverse())
        else if (eq(a, s.at(-1))) cur = s.concat(cur.slice(1))
        else if (eq(a, s[0])) cur = s.slice().reverse().concat(cur.slice(1))
        else continue
        segs.splice(i, 1); grew = true; break
      }
    }
    out.push(cur)
  }
  return out
}

function shapeOf(e) {
  const g = (geom) => geom.map((p) => [p.lon, p.lat])
  if (e.type === 'node') return { points: [[e.lon, e.lat]], lines: [], areas: [] }
  if (e.type === 'way') {
    const pts = g(e.geometry)
    return closed(pts) && isArea(e) ? { points: [], lines: [], areas: [pts] } : { points: [], lines: [pts], areas: [] }
  }
  // relation：多邊形（公園、島）的外圈 → 面；路線（行山徑）→ 線
  const ways = e.members.filter((m) => m.type === 'way' && m.geometry)
  const t = e.tags ?? {}
  if (t.type === 'multipolygon' || t.type === 'boundary') {
    const rings = join(ways.filter((m) => m.role !== 'inner').map((m) => g(m.geometry)))
    return { points: [], lines: rings.filter((r) => !closed(r)), areas: rings.filter(closed) }
  }
  const nodes = e.members.filter((m) => m.type === 'node' && m.lat != null).map((m) => [m.lon, m.lat])
  return { points: nodes, lines: join(ways.map((m) => g(m.geometry))), areas: [] }
}

// ---------- 3. 簡化（道格拉斯-普克，誤差 8 米）----------
const M_LAT = 110574, M_LNG = 111320 * Math.cos((22.35 * Math.PI) / 180)
function simplify(pts, tol = 8) {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()
    const ax = pts[i][0] * M_LNG, ay = pts[i][1] * M_LAT, bx = pts[j][0] * M_LNG, by = pts[j][1] * M_LAT
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy
    let best = -1, bi = -1
    for (let k = i + 1; k < j; k++) {
      const px = pts[k][0] * M_LNG, py = pts[k][1] * M_LAT
      const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy)
      if (d > best) { best = d; bi = k }
    }
    if (best > tol) { keep[bi] = 1; stack.push([i, bi], [bi, j]) }
  }
  return pts.filter((_, k) => keep[k])
}
const r5 = (p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]

// ---------- 4. 輸出 ----------
const out = spots.map((s) => {
  const base = { id: s.id, district: s.district, area: s.area, name: s.name, tip: s.tip, lat: s.lat, lng: s.lng, kind: s.kind, verified: s.verified }
  const toks = tokens(s)
  if (!toks.length) return { ...base, range: { r: s.radius || DEFAULT_POINT } }
  const sh = { points: [], lines: [], areas: [] }
  for (const t of toks) {
    if (!isRef(t)) {
      const [lat, lng] = t.split(',').map(Number)
      if (!(lat > 22 && lat < 23 && lng > 113 && lng < 115)) throw new Error(`${s.name}：看不懂範圍「${t}」`)
      sh.points.push([lng, lat])
      continue
    }
    const [id, clip] = t.split('@')
    const x = shapeOf(cache[id])
    if (clip) {
      // 只留離景點座標 clip 米以內的部分（線會被切成幾段）
      const near = (p) => haversine(s.lat, s.lng, p[1], p[0]) <= Number(clip)
      x.points = x.points.filter(near)
      x.lines = x.lines.flatMap((l) => {
        const parts = [[]]
        for (const p of l) near(p) ? parts.at(-1).push(p) : parts.at(-1).length && parts.push([])
        return parts.filter((q) => q.length > 1)
      })
      x.areas = x.areas.filter((a) => a.some(near))
    }
    sh.points.push(...x.points); sh.lines.push(...x.lines); sh.areas.push(...x.areas)
  }
  const range = { r: s.radius || DEFAULT_SHAPE }
  if (sh.points.length) range.points = sh.points.map(r5)
  if (sh.lines.length) range.lines = sh.lines.map((l) => simplify(l).map(r5))
  if (sh.areas.length) range.areas = sh.areas.map((a) => simplify(a).map(r5))
  return { ...base, range }
})

fs.writeFileSync(path.join(root, 'data', 'spots.json'), JSON.stringify(out, null, 1) + '\n')
const checkDir = path.join(root, 'public', 'check')
fs.mkdirSync(checkDir, { recursive: true })
fs.writeFileSync(path.join(checkDir, 'data.js'), '// 由 npm run spots 生成，不要手改\nwindow.SPOTS = ' + JSON.stringify(out) + '\n')
const n = (k) => out.filter((s) => (k === 'point' ? !s.range.lines && !s.range.areas : k === 'line' ? s.range.lines : s.range.areas)).length
console.log(`完成：${out.length} 個景點（點 ${n('point')}、含線 ${n('line')}、含面 ${n('area')}）→ data/spots.json、public/check/data.js`)
