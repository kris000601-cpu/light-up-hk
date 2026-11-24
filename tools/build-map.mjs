// 生成 App 的地圖數據：152 個「地方」→ 拼成 18 區（區的外框就是地方拼起來的外框，完全貼合）→ 簡化 → 投影成 SVG 路徑
//
// 輸入
//   data/dcca2019.geojson + data/places.csv + data/place-splits.csv   地方（見 tools/places-lib.mjs）
//   data/hk18-official.geojson      民政事務總署 18 區界：用來補回選區沒有覆蓋的陸地（落馬洲河套區）
//   tools/.cache/osm-coastline.json OpenStreetMap 海岸線（沒有就自動從 Overpass 下載）
// 輸出
//   src/data/hkmap.json             App 直接讀的地圖：每區一條 SVG 路徑（已裁掉海面）+ 投影參數
//   src/data/places.json            每個地方一條 SVG 路徑（同一個投影）。比較大，App 用到時才載入（不拖慢打開）
//
// 為甚麼區界用選區拼：選區界和民政署區界是同一套政府界線，2026-11-24 量過 18 區逐區對比，
// 只差落馬洲河套區（約 1 平方公里，沒有人住，所以不在任何選區裏）和幾塊幾百平方米的碎邊。
// 用地方拼出區，區的外框和地方的邊就是同一條線，以後畫地方、撥雲見霧都不會有縫。
//
// 用法：npm run map
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'
import { AIRPORT_IN_TUEN_MUN, loadLand } from './coast-lib.mjs'
import { placeFeatures, readPlaces } from './places-lib.mjs'
import { readSpots } from './spots-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const P = (...p) => path.join(root, ...p)

// ---------- 1. 地方（未簡化）----------
const land = await loadLand()
const info = readPlaces()
const { places, byPid, had, DISTRICT_TO_LETTER } = info
const feats = await placeFeatures(land, info)
for (const f of feats) f.properties = { place: f.properties.place, dc: DISTRICT_TO_LETTER[byPid[f.properties.place].district] }

// ---------- 2. 補回選區沒有覆蓋的陸地（民政署區界有、選區沒有：落馬洲河套區）----------
// 每一塊歸給同一區裏離它最近的地方
const gapOut = await mapshaper.applyCommands(
  [
    '-i land.json name=land',
    '-dissolve2 target=land',
    '-i had.json name=h',
    '-clip land target=h',
    '-rename-fields dc=地區號碼 target=h',
    '-explode target=h',
    `-each "if (dc === 'L' && ${AIRPORT_IN_TUEN_MUN}) { dc = 'T' }" target=h`,
    '-dissolve2 dc target=h',
    '-i places.json name=p',
    '-dissolve2 target=p',
    '-erase p target=h',
    '-explode target=h',
    '-filter "this.area > 5000" target=h',
    '-each "km2 = +(this.area / 1e6).toFixed(3)" target=h',
    '-o format=geojson target=h gaps.json',
  ].join(' '),
  { 'land.json': JSON.stringify(land), 'had.json': JSON.stringify(had), 'places.json': JSON.stringify({ type: 'FeatureCollection', features: feats }) },
)
const gaps = JSON.parse(gapOut['gaps.json']).features
const ringsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat()
const kx0 = Math.cos((22.35 * Math.PI) / 180)
for (const g of gaps) {
  const pts = ringsOf(g.geometry).flat()
  let best = null, bestD = Infinity
  for (const f of feats) {
    if (f.properties.dc !== g.properties.dc) continue
    for (const q of ringsOf(f.geometry).flat()) {
      for (let i = 0; i < pts.length; i += 7) {
        const d = ((q[0] - pts[i][0]) * kx0) ** 2 + (q[1] - pts[i][1]) ** 2
        if (d < bestD) { bestD = d; best = f.properties.place }
      }
    }
  }
  console.log(`補回選區沒有的陸地 ${g.properties.km2} 平方公里（${g.properties.dc} 區）→ ${best} ${byPid[best].name}`)
  feats.push({ type: 'Feature', properties: { place: best, dc: g.properties.dc }, geometry: g.geometry })
}

// ---------- 2b. 每個景點在哪個地方（用未簡化的界線）：蓋了章，景點所在的地方就亮 ----------
// 景點座標在地方裏就是那個；不在任何地方裏（座標在水面上：大美督、城門河）就用同一區裏最近的地方
const inRing = (x, y, r) => {
  let c = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const inGeom = (x, y, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)))
const spotPlace = {}
for (const sp of readSpots()) {
  const dc = DISTRICT_TO_LETTER[sp.district]
  let hit = feats.find((f) => f.properties.dc === dc && inGeom(sp.lng, sp.lat, f.geometry))?.properties.place
  if (!hit) {
    const other = feats.find((f) => inGeom(sp.lng, sp.lat, f.geometry))
    if (other) console.warn(`景點 ${sp.id} ${sp.name} 的座標落在別區的地方 ${other.properties.place}，改用${sp.district}最近的地方`)
    let bestD = Infinity
    for (const f of feats) {
      if (f.properties.dc !== dc) continue
      for (const q of ringsOf(f.geometry).flat()) {
        const d = ((q[0] - sp.lng) * kx0) ** 2 + (q[1] - sp.lat) ** 2
        if (d < bestD) { bestD = d; hit = f.properties.place }
      }
    }
    console.log(`景點 ${sp.id} ${sp.name} 不在任何地方裏（約 ${Math.round(Math.sqrt(bestD) * 111320)} 米外）→ ${hit} ${byPid[hit].name}`)
  }
  spotPlace[sp.id] = hit
}

// ---------- 3. 簡化（mapshaper 保持相鄰地方共用邊界），合併成地方，再由地方合併成區 ----------
const out = await mapshaper.applyCommands(
  [
    '-i places.json name=c',
    // 去掉太小、手機上看不見的小島（< 0.15 平方公里）
    '-filter-islands min-area=150000 target=c',
    '-simplify interval=18 keep-shapes target=c',
    '-clean target=c',
    '-dissolve2 place copy-fields=dc target=c + name=p',
    '-each "lx = this.innerX, ly = this.innerY" target=p',
    '-dissolve2 dc target=p + name=d',
    '-o format=geojson precision=0.000001 target=p p.json',
    '-o format=geojson precision=0.000001 target=d d.json',
  ].join(' '),
  { 'places.json': JSON.stringify({ type: 'FeatureCollection', features: feats }) },
)
const PL = JSON.parse(out['p.json']).features
const DS = JSON.parse(out['d.json']).features
const lost = places.filter((p) => !PL.some((f) => f.properties.place === p.id))
if (lost.length) {
  console.error('這些地方去掉小島之後沒有陸地了：' + lost.map((p) => p.id + ' ' + p.name).join('、'))
  process.exit(1)
}

// ---------- 4. 投影成 SVG 座標 ----------
const REGION = { A: '港島', B: '港島', C: '港島', D: '港島', E: '九龍', F: '九龍', G: '九龍', H: '九龍', J: '九龍' }
const LETTER = Object.fromEntries(had.features.map((f) => [f.properties['地區號碼'], f.properties]))
const SHORT = (n) => n.replace(/區$/, '')
const lat0 = 22.35, kx = Math.cos((lat0 * Math.PI) / 180)
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
const all = DS.flatMap((f) => polys(f.geometry).flat(2))
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
  source: '區界、地方：選舉管理委員會 2019 年區議會選區、民政事務總署（DATA.GOV.HK）；海岸線：© OpenStreetMap 貢獻者',
  width: W, height: H,
  // App 把手機讀到的經緯度投影到這張圖上（判斷人在哪個地方）：x = pad + (lng·kx − minX)·s，y = pad + (−lat − minY)·s
  proj: { kx: +kx.toFixed(12), minX: +minX.toFixed(9), minY: +minY.toFixed(9), s: +s.toFixed(6), pad: PAD },
  districts: DS
    .map((f) => {
      const code = f.properties.dc
      const p = LETTER[code]
      // places：這區有哪些地方（編號），算「亮了幾塊」用
      return { code, name: SHORT(p['地區']), en: p.District, region: REGION[code] || '新界', center: centroid(f.geometry), places: places.filter((x) => DISTRICT_TO_LETTER[x.district] === code).map((x) => x.id), d: toPath(f.geometry) }
    })
    .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code)),
  // 地方的名字（形狀在 places.json，用到時才載入）
  placeNames: Object.fromEntries(places.map((p) => [p.id, p.name])),
  // 每個景點在哪個地方
  spotPlace,
}
// 按 places.csv 的次序（編號）
const placeData = {
  source: result.source,
  places: places.map((p) => {
    const f = PL.find((x) => x.properties.place === p.id)
    return { id: p.id, name: p.name, dc: f.properties.dc, label: proj([f.properties.lx, f.properties.ly]).map(f1), d: toPath(f.geometry) }
  }),
}
fs.mkdirSync(P('src', 'data'), { recursive: true })
fs.writeFileSync(P('src', 'data', 'hkmap.json'), JSON.stringify(result))
fs.writeFileSync(P('src', 'data', 'places.json'), JSON.stringify(placeData))
const kb = (f) => (fs.statSync(P('src', 'data', f)).size / 1024).toFixed(0) + ' KB'
console.log(`完成：${result.districts.length} 區、${placeData.places.length} 個地方，畫布 ${W}×${H}；src/data/hkmap.json ${kb('hkmap.json')}，src/data/places.json ${kb('places.json')}`)
