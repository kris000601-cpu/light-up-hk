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
import { AIRPORT_IN_TUEN_MUN, loadLand } from './coast-lib.mjs'
import { parseCsv, readSpots } from './spots-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const P = (...p) => path.join(root, ...p)

// ---------- 1. 讀清單、核對 ----------
const dcca = JSON.parse(fs.readFileSync(P('data', 'dcca2019.geojson'), 'utf8'))
const DCCA_NAME = Object.fromEntries(dcca.features.map((f) => [f.properties.code, f.properties.name]))
const LETTER_TO_DISTRICT = Object.fromEntries(
  JSON.parse(fs.readFileSync(P('data', 'hk18-official.geojson'), 'utf8')).features.map((f) => [f.properties['地區號碼'], f.properties['地區']]),
)
const { rows } = parseCsv(fs.readFileSync(P('data', 'places.csv'), 'utf8'))
const errors = []
const places = rows.map((r) => ({ id: r['編號'], district: r['區'], name: r['地方'], codes: r['選區'].split(/\s+/).filter(Boolean) }))
const { rows: splitRows } = parseCsv(fs.readFileSync(P('data', 'place-splits.csv'), 'utf8'))
const range = (t) => t.split('-').map(Number)
const splits = splitRows.map((r) => ({ code: r['選區'], place: r['地方編號'], lat: range(r['緯度範圍']), lng: range(r['經度範圍']), note: r['說明'] }))
const placeOf = {}
const ids = new Set()
for (const p of places) {
  if (!/^p\d{3,}$/.test(p.id)) errors.push(`「${p.name}」的編號「${p.id}」不對，要像 p144`)
  if (ids.has(p.id)) errors.push(`編號 ${p.id} 重複了`)
  ids.add(p.id)
  if (!p.codes.length && !splits.some((x) => x.place === p.id)) errors.push(`${p.id} ${p.name} 沒有選區，也不在 place-splits.csv 裏`)
  for (const c of p.codes) {
    if (!DCCA_NAME[c]) errors.push(`${p.id} ${p.name}：沒有 ${c} 這個選區`)
    else if (LETTER_TO_DISTRICT[c[0]] !== p.district) errors.push(`${p.id} ${p.name}：選區 ${c}（${DCCA_NAME[c]}）屬${LETTER_TO_DISTRICT[c[0]]}，不屬${p.district}`)
    if (placeOf[c]) errors.push(`選區 ${c}（${DCCA_NAME[c]}）同時放在 ${placeOf[c]} 和 ${p.id}`)
    placeOf[c] = p.id
  }
}
const byPid = Object.fromEntries(places.map((p) => [p.id, p]))
for (const x of splits) {
  if (!DCCA_NAME[x.code]) errors.push(`place-splits.csv：沒有 ${x.code} 這個選區`)
  else if (!byPid[x.place]) errors.push(`place-splits.csv：沒有 ${x.place} 這個地方`)
  else if (byPid[x.place].district !== LETTER_TO_DISTRICT[x.code[0]]) errors.push(`place-splits.csv：${x.place} 屬${byPid[x.place].district}，選區 ${x.code} 屬${LETTER_TO_DISTRICT[x.code[0]]}`)
  if ([...x.lat, ...x.lng].some((v) => !Number.isFinite(v))) errors.push(`place-splits.csv：${x.code} → ${x.place} 的範圍寫錯了`)
}
for (const c of Object.keys(DCCA_NAME)) if (!placeOf[c]) errors.push(`選區 ${c}（${DCCA_NAME[c]}）沒有放進任何地方`)
if (errors.length) {
  console.error('data/places.csv 有問題：\n' + errors.join('\n'))
  process.exit(1)
}
console.log(`地方：${places.length} 個，用了全部 ${Object.keys(DCCA_NAME).length} 個選區`)

// ---------- 2. 裁掉海面、合併 ----------
const land = await loadLand()
for (const f of dcca.features) f.properties.place = placeOf[f.properties.code]
const airportPlace = placeOf['T06'] // 東涌北選區包括機場
// 2a. 裁掉海面；機場第三跑道歸回東涌北（見 coast-lib.mjs）
const out0 = await mapshaper.applyCommands(
  [
    '-i land.json name=land',
    '-dissolve2 target=land',
    '-i dcca.json name=c',
    '-clip land target=c',
    '-explode target=c',
    `-each "if (code[0] === 'L' && ${AIRPORT_IN_TUEN_MUN}) { code = 'T06'; name = '${DCCA_NAME.T06}'; place = '${airportPlace}' }" target=c`,
    '-dissolve2 code copy-fields=name,place target=c',
    '-o format=geojson target=c c.json',
  ].join(' '),
  { 'land.json': JSON.stringify(land), 'dcca.json': JSON.stringify(dcca) },
)
let feats = JSON.parse(out0['c.json']).features

// 2b. 郊區大選區再切（data/place-splits.csv）：長方形範圍內的陸地改歸另一個地方
const box = ([la0, la1], [ln0, ln1]) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[ln0, la0], [ln1, la0], [ln1, la1], [ln0, la1], [ln0, la0]]] } }] })
for (const x of splits) {
  const i = feats.findIndex((f) => f.properties.code === x.code && f.properties.place === placeOf[x.code])
  if (i < 0) throw new Error(`${x.code} 已經切光了，${x.place} 分不到陸地`)
  const f = feats[i]
  const r = await mapshaper.applyCommands(
    '-i f.json name=f -i b.json name=b -clip b target=f + name=in -erase b target=f + name=rest -o format=geojson target=in in.json -o format=geojson target=rest rest.json',
    { 'f.json': JSON.stringify({ type: 'FeatureCollection', features: [f] }), 'b.json': JSON.stringify(box(x.lat, x.lng)) },
  )
  const pieceOf = (name) => JSON.parse(r[name]).features.filter((g) => g.geometry)
  const inside = pieceOf('in.json'), rest = pieceOf('rest.json')
  if (!inside.length) console.warn(`place-splits：${x.code} → ${x.place} 範圍裏沒有陸地`)
  feats.splice(i, 1, ...rest.map((g) => ({ ...g, properties: f.properties })), ...inside.map((g) => ({ ...g, properties: { ...f.properties, place: x.place } })))
}

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
