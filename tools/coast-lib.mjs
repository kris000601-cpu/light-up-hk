// 香港的陸地輪廓（OpenStreetMap 海岸線連成的多邊形），用來把區界 / 選區界的海面裁掉。
// build-map.mjs（18 區）和 build-places.mjs（地方）共用，保證兩張圖的海岸線一模一樣。
// 海岸線緩存在 tools/.cache/osm-coastline.json（不入庫，沒有會自動下載）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(root, 'tools', '.cache')

/** 回傳 GeoJSON FeatureCollection：每個陸地輪廓一個多邊形（含連着深圳的香港本體） */
export async function loadLand() {
  fs.mkdirSync(CACHE, { recursive: true })
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
  console.log(`海岸線：${rings.length} 個陸地輪廓（含香港本體），忽略 ${open.length - 1} 條境外的開放線段`)
  return { type: 'FeatureCollection', features: rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [r] } })) }
}

/**
 * 官方界線畫於機場第三跑道填海之前，跑道北端被劃進了屯門區的海域。
 * 機場整個屬離島區：mapshaper -each 用的判斷式（屯門區、在機場一帶的那一塊）。
 */
export const AIRPORT_IN_TUEN_MUN = 'this.centroidX < 113.96 && this.centroidY < 22.335'
