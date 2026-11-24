// 生成 docs/FILES.md：倉庫裏每個受版本控制的文件——大小、行數、用途。
// 用途優先取下面 NOTES 裏手寫的說明，沒有就取文件開頭的註釋（代碼）、第一個標題（Markdown）、表頭（CSV）。
// 圖片多的設計資料夾合併成一行。每日工程文檔排程任務會跑它；手動：node tools/gen-files-doc.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// -z：文件名原樣輸出（不然中文文件名會被加引號、轉成 \344… 八進制）
const files = execSync('git ls-files -z', { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)

// 手寫說明（數據、資產、設定等開頭沒有註釋的文件）
const NOTES = {
  'CLAUDE.md': '給 AI 助手的項目規則 + 路線圖看板（每個決定的原話和日期）',
  'package.json': '依賴與 npm 命令（overrides 把 rollup 換成 wasm 版，Windows 智能應用控制需要，不要刪）',
  'package-lock.json': '鎖定依賴版本',
  'tsconfig.json': 'TypeScript 設定',
  'index.html': 'App 入口 HTML（字體、viewport、主題色）',
  '.gitignore': '不入庫：node_modules、dist、tools/.cache 等',
  '.claude/launch.json': 'Claude 桌面 App 預覽窗格用的 dev / preview 伺服器設定',
  'data/spots.csv': '景點清單（真相來源）：編號永不改、不重用；範圍 / 範圍米決定站在哪裏算到了',
  'data/spots.json': '由 npm run spots 從 spots.csv 生成，App 直接 import（含 OSM 範圍形狀）',
  'data/hk18-official.geojson': '民政事務總署 18 區界（DATA.GOV.HK，含海面）',
  'data/hk18-simplified.geojson': '最初的低精度區界（ECharts），已不用，只作參考',
  'data/dcca2019.geojson': '選管會 2019 年區議會選區 452 個，已轉 WGS84，含海面（M3 地方的底子）',
  'data/places.csv': 'M3「地方」152 個：編號 p001…、區、地名、包括哪些選區',
  'data/place-splits.csv': 'M3 郊區大選區再切：選區裏某個經緯度長方形歸另一個地方',
  'src/data/hkmap.json': '由 npm run map 生成：18 區 SVG 路徑（由地方拼成、已裁海面、投影）、每區的地方、每個景點在哪個地方、投影參數；App 直接 import',
  'src/data/places.json': '由 npm run map 生成：152 個地方的 SVG 路徑（同一投影）；App 用到時才動態載入（src/lib/places.ts）',
  'public/check/index.html': '景點核對頁（內部，Leaflet + OSM）',
  'public/check/data.js': '由 npm run spots 生成：景點核對頁數據',
  'public/check/notes.js': '景點核對頁的說明 / 問題',
  'public/check/places.html': '地方核對頁（內部，Leaflet + OSM）',
  'public/check/places-data.js': '由 npm run places 生成：地方核對頁數據（約 1.4 MB）',
  'public/check/places-notes.js': '地方核對頁上要 Chris 看的問題',
  'public/favicon.svg': 'App 圖示原稿（npm run icons 由它生成各尺寸 PNG）',
  'docs/HANDOFF.md': '開工前（2026-11-17）的需求文檔，部分已被取代',
  'docs/ENGINEERING.md': '工程交接文檔（主文件）',
  'docs/PROGRESS.md': '每日進展日誌',
  'docs/FILES.md': '本文件（自動生成）',
  'docs/friend-guide.md': '給試用朋友的使用說明草稿（港式繁體）',
  'design/gemini/prompt.md': '給 Gemini 畫 87 個景點圖案的英文說明（逐個寫了畫甚麼）',
  'design/gemini/reference-clock.png': '圖案參考圖：尖沙咀鐘樓（原型）',
  'design/gemini/reference-clock.svg': '圖案參考圖的 SVG 原稿',
  'design/pictos-board.svg': '8 個通用章面圖案對比板（node tools/picto-board.mjs 生成）',
  'design/select-options.html': '地圖選中樣式的對比板（定了「聚焦 A」）',
  'design/m1-home.png': 'M1 首頁截圖',
  'src/App.tsx': '根組件：四個分頁的切換（首頁一直掛着，其餘切過去才掛載）、測試網址參數、跨頁跳轉',
  'src/main.tsx': '入口：掛載 React、啟動 Service Worker 更新、擋住 iPhone Safari 的整頁捏合縮放',
  'src/components/HKMap.tsx': '全港 18 區 SVG 地圖：三墨上色（墨藍深淺 = 進度，集齊才印泥紅）、選中描邊、配合 useMapZoom',
  'src/pages/MapPage.tsx': '「地圖」分頁：18 區地圖、港島 / 九龍 / 新界分組、區詳情；加到主畫面和備份提示也在這頁',
  'src/index.css': '全部樣式（三墨顏色變量、各頁面、雷達、蓋章頁、印章冊）',
  'vite.config.ts': 'Vite + PWA 設定：BASE_PATH、版本標記 __BUILD__、manifest、Workbox（/check/ 不緩存、字體運行時緩存）',
  'src/components/TabBar.tsx': '底部四格導航「蓋章 · 地圖 · 印章冊 · 我的」；首頁剛打開時先藏起來',
  'tools/decode_echarts_map.py': '解碼 ECharts 的舊區界（生成 hk18-simplified.geojson），已不用',
}
for (const f of ['apple-touch-icon-180x180.png', 'favicon.ico', 'maskable-icon-512x512.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-64x64.png'])
  NOTES['public/' + f] = 'PWA / 網頁圖示（npm run icons 由 public/favicon.svg 生成）'
// 整個資料夾合併成一行
const GROUPS = {
  'design/screens/': '最初 6 屏設計截圖（只作結構參考，和風金雲已放棄）',
  'design/html/': '最初設計稿的靜態 HTML（可直接打開）',
  'design/source/': '最初設計稿原始文件（Claude Design 格式）',
  'design/stamp-renders/': '蓋章方案對比渲染圖（定了「鋼印凸紋」八角章）',
  'design/book-renders/': '印章冊三版設計截圖（定了甲「翻頁護照」）',
  'design/home-renders/': '首頁設計截圖',
  'design/prototype/': '蓋章原型（A-Emboss）源碼備份：數字以此為準',
  'design/gemini/out/': 'Gemini 畫的景點專屬圖案（2048×2048 JPEG）+ 逐張狀態表 README.md',
  'Claude outputs/': 'M0 時期的設計文件副本（早期產物，已不用）',
  'public/': null, // 不合併，只為了排序
}

const TEXT = /\.(m?[jt]sx?|json|md|css|html|csv|ya?ml|svg|py|geojson|txt)$/i
const kb = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`)

function describe(f, text) {
  if (NOTES[f]) return NOTES[f]
  if (!text) return ''
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).slice(0, 25)
  if (f.endsWith('.md')) return (lines.find((l) => /^#\s/.test(l)) || '').replace(/^#\s*/, '')
  if (f.endsWith('.csv')) return '欄位：' + lines[0]
  const out = []
  for (const l of lines) {
    const m = l.match(/^\s*(?:\/\/+|#(?!!)|\/\*\*?|\*(?!\/)|<!--)\s?(.*?)\s*(?:\*\/|-->)?\s*$/)
    if (m && m[1] && !/^(eslint|@ts-|prettier|!)/.test(m[1])) out.push(m[1])
    else if (out.length) break
    if (out.join('').length > 160) break
  }
  return out.join(' ').slice(0, 200)
}

const rows = []
const grouped = {}
for (const f of files) {
  const g = Object.keys(GROUPS).find((p) => GROUPS[p] && f.startsWith(p))
  const st = fs.statSync(path.join(root, f))
  if (g) {
    ;(grouped[g] ||= { n: 0, size: 0 }).n++
    grouped[g].size += st.size
    continue
  }
  const text = TEXT.test(f) && st.size < 3_000_000 ? fs.readFileSync(path.join(root, f), 'utf8') : null
  const lineCount = text ? text.split('\n').length : ''
  rows.push({ f, size: st.size, lines: lineCount, desc: describe(f, text).replace(/\|/g, '\\|') })
}
for (const [g, v] of Object.entries(grouped)) rows.push({ f: g + '*', size: v.size, lines: `${v.n} 個文件`, desc: GROUPS[g] })
rows.sort((a, b) => a.f.localeCompare(b.f))

const dirOf = (f) => (f.includes('/') ? f.split('/')[0] + '/' : '（根目錄）')
let md = `# 文件清單（自動生成）\n\n> 由 \`node tools/gen-files-doc.mjs\` 生成，不要手改。說明取自 \`tools/gen-files-doc.mjs\` 的 NOTES 或文件開頭註釋。\n> 共 ${files.length} 個受版本控制的文件。不入庫的：\`node_modules/\`、\`dist/\`、\`tools/.cache/\`（OSM 緩存）、\`tmp-review/\`（審查用打包，見 .git/info/exclude）。\n\n`
let cur = ''
for (const r of rows) {
  const d = dirOf(r.f)
  if (d !== cur) {
    md += `\n## ${d}\n\n| 文件 | 大小 | 行數 | 用途 |\n|---|---|---|---|\n`
    cur = d
  }
  md += `| \`${r.f}\` | ${kb(r.size)} | ${r.lines} | ${r.desc} |\n`
}
fs.writeFileSync(path.join(root, 'docs', 'FILES.md'), md)
console.log(`docs/FILES.md：${rows.length} 行（${files.length} 個文件）`)
