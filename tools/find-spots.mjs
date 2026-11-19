// 景點核對（第一步：找候選）
// 對 spots.csv 的每個景點，在現有座標附近約 5 公里內，用 OpenStreetMap 的地名搜索（Nominatim）找同名地點，
// 列出候選（名字、類型、位置、離現有座標多遠），寫到 tools/.cache/spot-candidates.json。
// 只用來幫 Claude 人手挑選正確的地點，不直接改數據。
//
// 用法：node tools/find-spots.mjs [景點id ...]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSpots, haversine } from './spots-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(root, 'tools', '.cache')
fs.mkdirSync(CACHE, { recursive: true })
const OUT = path.join(CACHE, 'spot-candidates.json')

// 搜尋用的關鍵詞：預設由景點名拆出來，個別景點的 OSM 名字不一樣，在這裏指定
const TERMS = {
  '太平山頂 · 獅子亭': ['獅子亭', '太平山頂', '凌霄閣'],
  'PMQ 元創方': ['元創方'],
  '中環海濱 · 摩天輪': ['摩天輪', '中環海濱'],
  '堅尼地城海旁': ['堅彌地城', '堅尼地城', '卑路乍灣'],
  '藍屋建築羣': ['藍屋'],
  '寶雲道 · 姻緣石': ['姻緣石', '寶雲道'],
  '怡和午炮': ['午炮'],
  '益昌大廈（怪獸大廈）': ['益昌大廈', '海山樓', '福昌樓'],
  '小西灣海濱': ['小西灣海濱', '小西灣'],
  '龍脊': ['龍脊', '港島徑'],
  '石澳村 · 石澳泳灘': ['石澳泳灘', '石澳'],
  '赤柱 · 美利樓': ['美利樓', '卜公碼頭'],
  'M+ 博物館': ['M+'],
  '尖沙咀鐘樓 · 星光大道': ['鐘樓', '星光大道'],
  '廟街夜市': ['廟街'],
  '基隆街 · 布料街': ['基隆街'],
  '紅磡海濱長廊': ['紅磡海濱', '海濱長廊'],
  '九龍城泰國菜街': ['衙前塱道', '南角道'],
  '十三街': ['龍圖街', '龍堂街', '十三街'],
  '志蓮淨苑 · 南蓮園池': ['志蓮', '南蓮園池'],
  '鯉魚門 · 燈塔': ['燈塔', '鯉魚門'],
  '魔鬼山': ['魔鬼山'],
  '青嶼幹線觀景台': ['青嶼幹線', '觀景台'],
  '南豐紗廠 The Mills': ['南豐紗廠', 'The Mills'],
  '馬灣公園 · 馬灣舊村': ['馬灣公園', '馬灣'],
  '屏山文物徑 · 聚星樓': ['聚星樓', '屏山文物徑'],
  '林村許願樹': ['許願樹', '放馬莆'],
  '大美督 · 船灣淡水湖': ['船灣淡水湖', '大美督'],
  '城門河': ['城門河'],
  '馬鞍山海濱長廊': ['馬鞍山海濱'],
  '將軍澳海濱長廊': ['將軍澳海濱'],
  '西貢海濱 · 碼頭': ['西貢海濱', '西貢公眾碼頭'],
  '萬宜水庫東壩': ['東壩', '萬宜水庫'],
  '天壇大佛 · 寶蓮禪寺': ['天壇大佛', '寶蓮禪寺'],
  '大澳漁村': ['大澳'],
  '南丫島 · 榕樹灣': ['榕樹灣', '南丫島'],
  '香港濕地公園': ['濕地公園'],
  '大棠楓香林': ['楓香林', '大棠'],
  '吉澳': ['吉澳'],
  '塔門': ['塔門'],
  '長洲': ['長洲'],
  '坪洲': ['坪洲'],
}
const termsOf = (name) => TERMS[name] ?? name.split(' · ').map((t) => t.replace(/（.*?）/g, '').trim())

async function nominatim(q, lat, lng) {
  const d = 0.05 // 現有座標附近約 5 公里
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q, viewbox: [lng - d, lat + d, lng + d, lat - d].join(','), bounded: '1', format: 'jsonv2', limit: '10', 'accept-language': 'zh-HK' })
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'user-agent': 'light-up-hk-data-check/0.1' } }).catch(() => null)
    if (res?.ok) return res.json()
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)))
  }
  throw new Error('Nominatim 失敗')
}

const spots = readSpots()
const only = process.argv.slice(2)
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
for (const s of spots) {
  if (only.length && !only.includes(s.id)) continue
  if (!only.length && out[s.id]) continue
  const seen = new Set(), list = []
  for (const term of termsOf(s.name)) {
    for (const r of await nominatim(term, s.lat, s.lng)) {
      const ref = r.osm_type + '/' + r.osm_id
      if (seen.has(ref)) continue
      seen.add(ref)
      const [a, b, c, d] = r.boundingbox.map(Number)
      list.push({ ref, term, name: r.name, kind: r.category + '=' + r.type, lat: +r.lat, lon: +r.lon, off: Math.round(haversine(s.lat, s.lng, +r.lat, +r.lon)), size: Math.round(haversine(a, c, b, d)) })
    }
    await new Promise((r) => setTimeout(r, 1100))
  }
  out[s.id] = list.sort((a, b) => a.off - b.off)
  const f = out[s.id][0]
  console.log(s.id + ' ' + s.name + '：' + list.length + ' 個候選' + (f ? '，最近 ' + f.off + 'm「' + f.name + '」' + f.kind : ''))
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
}
