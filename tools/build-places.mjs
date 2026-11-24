// 生成「地方」（M3）：2019 年區議會選區 − 海面，按 data/places.csv 合併成香港人熟悉的地名
//
// 輸入
//   data/dcca2019.geojson   2019 年區議會選區界（選舉管理委員會，DATA.GOV.HK，已轉成經緯度，含海面）
//   data/places.csv         地方清單：編號、區、地方名、包括哪些選區（選區代號用空格分開）
//   data/place-splits.csv   郊區大選區再切：選區裏某個經緯度長方形範圍內的陸地改歸另一個地方（按行的先後切）
//   data/spots.csv          景點（核對頁上顯示每個地方裏有哪些景點）
//   tools/.cache/osm-coastline.json  OpenStreetMap 海岸線（跟 18 區地圖共用，見 coast-lib.mjs）
// 輸出
//   public/check/places-data.js  地方核對頁（public/check/places.html）用
//
// 「編號」規則跟景點一樣：一旦上線（手機裏存了點亮記錄）就永遠不改、不重用。
//
// 用法：node tools/build-places.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'
import { loadLand } from './coast-lib.mjs'
import { placeFeatures, readPlaces } from './places-lib.mjs'
import { readSpots } from './spots-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const P = (...p) => path.join(root, ...p)

// ---------- 1. 讀清單、核對；2. 裁掉海面、再切（tools/places-lib.mjs，跟 App 的地圖共用）----------
const info = readPlaces()
const { places, splits, DCCA_NAME } = info
console.log(`地方：${places.length} 個，用了全部 ${Object.keys(DCCA_NAME).length} 個選區`)
const land = await loadLand()
const feats = await placeFeatures(land, info)

// 2c. 簡化、合併成地方；選區界另外合併一份（核對頁畫虛線用）
const out = await mapshaper.applyCommands(
  [
    '-i c.json name=c',
    // 核對頁不需要太小的石頭島（< 0.02 平方公里）
    '-filter-islands min-area=20000 target=c',
    '-simplify interval=15 keep-shapes target=c',
    '-clean target=c',
    '-dissolve2 code copy-fields=name target=c + name=d',
    '-each "km2 = +(this.area / 1e6).toFixed(2)" target=d',
    '-dissolve2 place target=c + name=p',
    '-each "km2 = +(this.area / 1e6).toFixed(2), lx = +this.innerX.toFixed(5), ly = +this.innerY.toFixed(5), parts = this.partCount" target=p',
    '-o format=geojson precision=0.00001 target=d c.json',
    '-o format=geojson precision=0.00001 target=p p.json',
  ].join(' '),
  { 'c.json': JSON.stringify({ type: 'FeatureCollection', features: feats }) },
)
const C = JSON.parse(out['c.json'])
const PL = JSON.parse(out['p.json'])

// ---------- 3. 每個地方裏有哪些景點 ----------
const inRing = (x, y, r) => {
  let c = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const polys = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
const inGeom = (x, y, g) => polys(g).some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)))
const spots = readSpots()
const geomById = Object.fromEntries(PL.features.map((f) => [f.properties.place, f]))
const result = places.map((p) => {
  const f = geomById[p.id]
  return {
    id: p.id,
    name: p.name,
    district: p.district,
    dcca: p.codes.map((c) => [c, DCCA_NAME[c]]),
    cut: splits.filter((x) => x.place === p.id).map((x) => [x.code, DCCA_NAME[x.code]]),
    km2: f?.properties.km2 ?? 0,
    parts: f?.properties.parts ?? 0,
    label: f ? [f.properties.ly, f.properties.lx] : null,
    spots: spots.filter((s) => f && inGeom(s.lng, s.lat, f.geometry)).map((s) => [s.id, s.name]),
  }
})
const empty = result.filter((p) => !p.km2)
if (empty.length) console.warn('裁掉海面後沒有陸地的地方：' + empty.map((p) => p.id + ' ' + p.name).join('、'))
const lost = spots.filter((s) => !result.some((p) => p.spots.some(([id]) => id === s.id)))
if (lost.length) console.warn('不在任何地方裏的景點（多數是在岸邊、海上）：' + lost.map((s) => s.id + ' ' + s.name).join('、'))

// ---------- 4. 輸出核對頁數據 ----------
const data = {
  source: '選區界：選舉管理委員會 2019 年區議會選區（DATA.GOV.HK）；海岸線：© OpenStreetMap 貢獻者',
  built: new Date().toISOString(),
  places: result,
  placeGeo: PL.features.map((f) => ({ id: f.properties.place, g: f.geometry })),
  dccaGeo: C.features.map((f) => ({ code: f.properties.code, name: f.properties.name, km2: f.properties.km2, g: f.geometry })),
}
const file = P('public', 'check', 'places-data.js')
fs.writeFileSync(file, '// 由 tools/build-places.mjs 生成，不要手改\nwindow.PLACE_DATA = ' + JSON.stringify(data) + '\n')
console.log(`完成：public/check/places-data.js ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
