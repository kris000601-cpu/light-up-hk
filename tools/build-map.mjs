// 生成全港地圖數據：官方 18 區界 − 海面 → 簡化 → 投影成 SVG 路徑
//
// 輸入
//   data/hk18-official.geojson      民政事務總署 18 區界（DATA.GOV.HK，含海面）
//   tools/.cache/osm-coastline.json OpenStreetMap 海岸線（沒有就自動從 Overpass 下載）
// 輸出
//   src/data/hkmap.json             App 直接讀的地圖：每區一條 SVG 路徑（已裁掉海面）
//
// 用法：npm run map
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const P = (...p) => path.join(root, ...p)
const CACHE = P('tools', '.cache')
fs.mkdirSync(CACHE, { recursive: true })

// ---------- 1. 海岸線 ----------
const coastFile = path.join(CACHE, 'osm-coastline.json')
if (!fs.existsSync(coastFile)) {
  console.log('下載 OpenStreetMap 海岸線…')
  const q = '[out:json][timeout:150];way["natural"="coastline"](22.10,113.80,22.60,114.48);out geom;'
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'light-up-hk-map-build/0.1' },
    body: 'data=' + encodeURIComponent(q),
  })
  if (!res.ok) throw new Error('Overpass ' + res.status)
  fs.writeFileSync(coastFile, await res.text())
}
const ways = JSON.parse(fs.readFileSync(coastFile, 'utf8')).elements.filter((e) => e.type === 'way')

// OSM 海岸線的規則：陸地永遠在行進方向的左邊。把首尾相接的線段連成環。
const byStart = new Map(), byEnd = new Map()
for (const w of ways) { byStart.set(w.nodes[0], w); byEnd.set(w.nodes.at(-1), w) }
const seen = new Set()
const rings = [], open = []
for (const w of ways) {
  if (seen.has(w.id)) continue
  let head = w
  const guard = new Set([head.id])
  while (byEnd.get(head.nodes[0]) && !guard.has(byEnd.get(head.nodes[0]).id)) { head = byEnd.get(head.nodes[0]); guard.add(head.id) }
  const coords = []
  for (let c = head; c && !seen.has(c.id); c = byStart.get(c.nodes.at(-1))) {
    seen.add(c.id)
    coords.push(...c.geometry.slice(coords.length ? 1 : 0).map((g) => [g.lon, g.lat]))
  }
  const a = coords[0], b = coords.at(-1)
  if (a[0] === b[0] && a[1] === b[1]) rings.push(coords)
  else open.push(coords)
}
// 香港本體（連着深圳）是一條沒閉合的長鏈：從深圳灣一路沿海岸到大鵬灣。
// 從終點往北繞到起點把它閉合（北面在香港境外，裁剪時不影響）。
open.sort((x, y) => y.length - x.length)
const main = open[0]
const NORTH = 23.2
main.push([main.at(-1)[0], NORTH], [main[0][0], NORTH], main[0])
rings.push(main)
const land = { type: 'FeatureCollection', features: rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [r] } })) }
console.log(`海岸線：${rings.length} 個陸地輪廓（含香港本體），忽略 ${open.length - 1} 條境外的開放線段`)

// ---------- 2. 裁掉海面 + 簡化（mapshaper 會保持相鄰區共用邊界的一致）----------
const districts = fs.readFileSync(P('data', 'hk18-official.geojson'), 'utf8')
const out = await mapshaper.applyCommands(
  [
    '-i land.json name=land',
    '-dissolve2 target=land',
    '-i districts.json name=d',
    '-clip land target=d',
    '-rename-fields code=地區號碼,name=地區,en=District target=d',
    // 官方區界畫於機場第三跑道填海之前，跑道北端被劃進了屯門區的海域。機場整個屬離島區，歸回去再合併。
    '-explode target=d',
    `-each "if (code === 'L' && this.centroidX < 113.96 && this.centroidY < 22.335) { code = 'T'; name = '離島區'; en = 'Islands District' }" target=d`,
    '-dissolve2 code copy-fields=name,en target=d',
    // 去掉太小、手機上看不見的小島（< 0.15 平方公里）
    '-filter-islands min-area=150000 target=d',
    '-simplify interval=18 keep-shapes target=d',
    '-clean target=d',
    '-o format=geojson precision=0.000001 target=d out.json',
  ].join(' '),
  { 'land.json': JSON.stringify(land), 'districts.json': districts },
)
const clipped = JSON.parse(out['out.json'])

// ---------- 3. 投影成 SVG 座標 ----------
const REGION = { A: '港島', B: '港島', C: '港島', D: '港島', E: '九龍', F: '九龍', G: '九龍', H: '九龍', J: '九龍' }
const SHORT = (n) => n.replace(/區$/, '')
const lat0 = 22.35, kx = Math.cos((lat0 * Math.PI) / 180)
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
const all = clipped.features.flatMap((f) => polys(f.geometry).flat(2))
const minX = Math.min(...all.map((p) => p[0] * kx)), maxX = Math.max(...all.map((p) => p[0] * kx))
const minY = Math.min(...all.map((p) => -p[1])), maxY = Math.max(...all.map((p) => -p[1]))
const W = 1000, PAD = 6
const s = (W - PAD * 2) / (maxX - minX)
const H = Math.ceil((maxY - minY) * s + PAD * 2)
const proj = ([lon, lat]) => [PAD + (lon * kx - minX) * s, PAD + (-lat - minY) * s]
const f1 = (n) => Math.round(n * 10) / 10
const toPath = (g) => polys(g).map((poly) => poly.map((ring) => {
  const pts = ring.map(proj)
  let d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1])
  for (let i = 1; i < pts.length - 1; i++) d += 'L' + f1(pts[i][0]) + ' ' + f1(pts[i][1])
  return d + 'Z'
}).join('')).join('')
const centroid = (g) => {
  // 用面積最大的那塊算標籤位置
  let best = null, bestA = 0
  for (const poly of polys(g)) {
    const r = poly[0].map(proj)
    let a = 0, cx = 0, cy = 0
    for (let i = 0; i < r.length - 1; i++) { const c = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += c; cx += (r[i][0] + r[i + 1][0]) * c; cy += (r[i][1] + r[i + 1][1]) * c }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)] }
  }
  return best.map(f1)
}
const order = 'ABCDEFGHJKLMNPQRST'
const result = {
  source: '區界：民政事務總署（DATA.GOV.HK）；海岸線：© OpenStreetMap 貢獻者',
  width: W, height: H,
  districts: clipped.features
    .map((f) => {
      const code = f.properties.code
      return { code, name: SHORT(f.properties.name), en: f.properties.en, region: REGION[code] || '新界', center: centroid(f.geometry), d: toPath(f.geometry) }
    })
    .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code)),
}
fs.mkdirSync(P('src', 'data'), { recursive: true })
fs.writeFileSync(P('src', 'data', 'hkmap.json'), JSON.stringify(result))
const kb = (fs.statSync(P('src', 'data', 'hkmap.json')).size / 1024).toFixed(0)
console.log(`完成：${result.districts.length} 區，畫布 ${W}×${H}，src/data/hkmap.json ${kb} KB`)
