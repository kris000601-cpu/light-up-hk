// 「地方」（M3）的幾何：2019 年區議會選區 − 海面，按 data/places.csv 歸到各個地方，郊區大選區按 data/place-splits.csv 再切。
// build-map.mjs（App 的地圖）和 build-places.mjs（核對頁）共用，保證兩邊的地方一模一樣。
//
// 「編號」規則跟景點一樣：一旦上線（手機裏存了點亮記錄）就永遠不改、不重用。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'
import { AIRPORT_IN_TUEN_MUN } from './coast-lib.mjs'
import { parseCsv } from './spots-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const P = (...p) => path.join(root, ...p)

/** 讀清單並核對；有錯就印出來並結束 */
export function readPlaces() {
  const dcca = JSON.parse(fs.readFileSync(P('data', 'dcca2019.geojson'), 'utf8'))
  const DCCA_NAME = Object.fromEntries(dcca.features.map((f) => [f.properties.code, f.properties.name]))
  const had = JSON.parse(fs.readFileSync(P('data', 'hk18-official.geojson'), 'utf8'))
  const LETTER_TO_DISTRICT = Object.fromEntries(had.features.map((f) => [f.properties['地區號碼'], f.properties['地區']]))
  const DISTRICT_TO_LETTER = Object.fromEntries(Object.entries(LETTER_TO_DISTRICT).map(([k, v]) => [v, k]))
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
    if (!DISTRICT_TO_LETTER[p.district]) errors.push(`${p.id} ${p.name}：沒有「${p.district}」這個區`)
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
  return { dcca, had, places, byPid, splits, placeOf, DCCA_NAME, LETTER_TO_DISTRICT, DISTRICT_TO_LETTER }
}

/**
 * 每個選區裁掉海面、機場第三跑道歸回東涌北、郊區大選區再切。
 * 回傳 GeoJSON features（未簡化），properties：code（選區）、name（選區名）、place（地方編號）。
 */
export async function placeFeatures(land, info = readPlaces()) {
  const { dcca, splits, placeOf, DCCA_NAME } = info
  for (const f of dcca.features) f.properties.place = placeOf[f.properties.code]
  const airportPlace = placeOf['T06'] // 東涌北選區包括機場
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
  const feats = JSON.parse(out0['c.json']).features

  // 郊區大選區再切（data/place-splits.csv）：長方形範圍內的陸地改歸另一個地方
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
  return feats
}
