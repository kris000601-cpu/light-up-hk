// 上線前的數據檢查（不用上網）：spots.csv 和 App 用的 spots.json、核對頁的 data.js 必須對得上。
// 改了 CSV 卻忘了跑 npm run spots、區名打錯字、座標打錯……都會在這裏擋下來，部署直接失敗。
// 用法：npm run check（npm run build 也會先跑它）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSpots } from './spots-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const bad = (msg) => errors.push(msg)

const csv = readSpots() // 編號格式、重複在這裏已經檢查
const json = JSON.parse(fs.readFileSync(path.join(root, 'data', 'spots.json'), 'utf8'))
const checkJs = fs.readFileSync(path.join(root, 'public', 'check', 'data.js'), 'utf8')
const check = JSON.parse(checkJs.slice(checkJs.indexOf('=') + 1))
const map = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'hkmap.json'), 'utf8'))
const DISTRICTS = new Set(map.districts.map((d) => d.name + '區'))

// 1. CSV 本身
for (const s of csv) {
  const who = `${s.id} ${s.name}`
  if (!DISTRICTS.has(s.district)) bad(`${who}：區名「${s.district}」不是 18 區之一`)
  if (!(s.lat > 22.13 && s.lat < 22.58 && s.lng > 113.82 && s.lng < 114.45)) bad(`${who}：座標 ${s.lat}, ${s.lng} 不在香港`)
  if (!s.name || !s.area || !s.tip || !s.kind) bad(`${who}：景點 / 小地名 / 一句推薦 / 類型 有空白`)
  if (!(s.radius >= 30 && s.radius <= 300)) bad(`${who}：範圍米「${s.radius || '空白'}」不合理（要填 30–300）`)
}

// 2. CSV ↔ spots.json（忘了跑 npm run spots 就會對不上）
const FIELDS = ['district', 'area', 'name', 'tip', 'lat', 'lng', 'kind', 'verified']
if (json.length !== csv.length) bad(`spots.json 有 ${json.length} 個景點，CSV 有 ${csv.length} 個`)
const byId = Object.fromEntries(json.map((s) => [s.id, s]))
for (const s of csv) {
  const j = byId[s.id]
  if (!j) {
    bad(`${s.id} ${s.name}：spots.json 裏沒有`)
    continue
  }
  for (const f of FIELDS) if (j[f] !== s[f]) bad(`${s.id} ${s.name}：${f} 不一致（CSV「${s[f]}」，spots.json「${j[f]}」）`)
  const r = j.range
  if (!r || !(r.r > 0)) bad(`${s.id} ${s.name}：沒有範圍`)
  else if (s.shape && !r.points?.length && !r.lines?.length && !r.areas?.length) bad(`${s.id} ${s.name}：CSV 寫了範圍「${s.shape}」，但 spots.json 裏是空的`)
  else if (r.r !== s.radius) bad(`${s.id} ${s.name}：範圍米不一致`)
}

// 3. 核對頁的數據要跟 App 的一樣
if (JSON.stringify(check) !== JSON.stringify(json)) bad('public/check/data.js 跟 spots.json 不一樣：請跑 npm run spots')

// 4. 地方（M3）：每個景點要知道自己在哪個地方（蓋了章就點亮它），而且是同一區的地方
const places = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'places.json'), 'utf8')).places
const placeDc = Object.fromEntries(places.map((p) => [p.id, p.dc]))
const dcOf = Object.fromEntries(map.districts.map((d) => [d.name + '區', d.code]))
for (const s of csv) {
  const p = map.spotPlace?.[s.id]
  if (!p) bad(`${s.id} ${s.name}：src/data/hkmap.json 不知道它在哪個地方（加了景點要跑 npm run map）`)
  else if (placeDc[p] !== dcOf[s.district]) bad(`${s.id} ${s.name}：地方 ${p} 不在${s.district}（改了區要跑 npm run map）`)
}
const listed = map.districts.flatMap((d) => d.places)
if (listed.length !== places.length || places.some((p) => !listed.includes(p.id))) bad('src/data/hkmap.json 和 places.json 的地方對不上：請跑 npm run map')

if (errors.length) {
  console.error(`景點數據檢查失敗（${errors.length} 個問題）：\n- ` + errors.slice(0, 30).join('\n- '))
  console.error('改好 data/spots.csv 後跑 npm run spots 重新生成（改了景點或地方，再跑 npm run map）。')
  process.exit(1)
}
console.log(`景點數據檢查通過：${csv.length} 個景點`)
