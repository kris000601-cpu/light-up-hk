# 文件清單（自動生成）

> 由 `node tools/gen-files-doc.mjs` 生成，不要手改。說明取自 `tools/gen-files-doc.mjs` 的 NOTES 或文件開頭註釋。
> 共 215 個受版本控制的文件。不入庫的：`node_modules/`、`dist/`、`tools/.cache/`（OSM 緩存）、`tmp-review/`（審查用打包，見 .git/info/exclude）。


## .claude/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `.claude/launch.json` | 307 B | 18 | Claude 桌面 App 預覽窗格用的 dev / preview 伺服器設定 |

## .github/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `.github/workflows/deploy.yml` | 904 B | 44 | 每次把代碼推送到 main 分支，GitHub 就會自動打包並發佈到 GitHub Pages |

## （根目錄）

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `.gitignore` | 72 B |  | 不入庫：node_modules、dist、tools/.cache 等 |

## Claude outputs/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `Claude outputs/*` | 12 KB | 2 個文件 | M0 時期的設計文件副本（早期產物，已不用） |

## （根目錄）

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `CLAUDE.md` | 29 KB | 67 | 給 AI 助手的項目規則 + 路線圖看板（每個決定的原話和日期） |

## data/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `data/dcca2019.geojson` | 2.6 MB | 1 | 選管會 2019 年區議會選區 452 個，已轉 WGS84，含海面（M3 地方的底子） |
| `data/hk18-official.geojson` | 778 KB | 19204 | 民政事務總署 18 區界（DATA.GOV.HK，含海面） |
| `data/hk18-simplified.geojson` | 82 KB | 1 | 最初的低精度區界（ECharts），已不用，只作參考 |
| `data/place-splits.csv` | 1 KB | 14 | M3 郊區大選區再切：選區裏某個經緯度長方形歸另一個地方 |
| `data/places.csv` | 6 KB | 154 | M3「地方」152 個：編號 p001…、區、地名、包括哪些選區 |
| `data/spots.csv` | 12 KB | 89 | 景點清單（真相來源）：編號永不改、不重用；範圍 / 範圍米決定站在哪裏算到了 |
| `data/spots.json` | 183 KB | 15479 | 由 npm run spots 從 spots.csv 生成，App 直接 import（含 OSM 範圍形狀） |

## design/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `design/book-renders/*` | 995 KB | 9 個文件 | 印章冊三版設計截圖（定了甲「翻頁護照」） |
| `design/gemini/out-board-2026-11-23.png` | 481 KB |  |  |
| `design/gemini/out-board-2026-11-23b.png` | 630 KB |  |  |
| `design/gemini/out-board-2026-11-24.png` | 656 KB |  |  |
| `design/gemini/out/*` | 16.8 MB | 53 個文件 | Gemini 畫的景點專屬圖案（2048×2048 JPEG）+ 逐張狀態表 README.md |
| `design/gemini/prompt.md` | 17 KB | 147 | 給 Gemini 畫 87 個景點圖案的英文說明（逐個寫了畫甚麼） |
| `design/gemini/reference-clock.png` | 79 KB |  | 圖案參考圖：尖沙咀鐘樓（原型） |
| `design/gemini/reference-clock.svg` | 601 B | 1 | 圖案參考圖的 SVG 原稿 |
| `design/home-renders/*` | 831 KB | 8 個文件 | 首頁設計截圖 |
| `design/html/*` | 156 KB | 6 個文件 | 最初設計稿的靜態 HTML（可直接打開） |
| `design/m1-home.png` | 278 KB |  | M1 首頁截圖 |
| `design/pictos-board.svg` | 10 KB | 12 | 8 個通用章面圖案對比板（node tools/picto-board.mjs 生成） |
| `design/prototype/*` | 304 KB | 20 個文件 | 蓋章原型（A-Emboss）源碼備份：數字以此為準 |
| `design/screens/*` | 1.2 MB | 6 個文件 | 最初 6 屏設計截圖（只作結構參考，和風金雲已放棄） |
| `design/select-options.html` | 176 KB | 131 | 地圖選中樣式的對比板（定了「聚焦 A」） |
| `design/source/*` | 156 KB | 7 個文件 | 最初設計稿原始文件（Claude Design 格式） |
| `design/stamp-renders/*` | 5.2 MB | 7 個文件 | 蓋章方案對比渲染圖（定了「鋼印凸紋」八角章） |

## docs/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `docs/ENGINEERING.md` | 37 KB | 366 | 工程交接文檔（主文件） |
| `docs/FILES.md` | 16 KB | 182 | 本文件（自動生成） |
| `docs/friend-guide.md` | 2 KB | 23 | 給試用朋友的使用說明草稿（港式繁體） |
| `docs/HANDOFF.md` | 14 KB | 209 | 開工前（2026-11-17）的需求文檔，部分已被取代 |
| `docs/PROGRESS.md` | 5 KB | 58 | 每日進展日誌 |

## （根目錄）

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `index.html` | 1 KB | 26 | App 入口 HTML（字體、viewport、主題色） |
| `package-lock.json` | 334 KB | 9659 | 鎖定依賴版本 |
| `package.json` | 883 B | 34 | 依賴與 npm 命令（overrides 把 rollup 換成 wasm 版，Windows 智能應用控制需要，不要刪） |

## public/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `public/apple-touch-icon-180x180.png` | 2 KB |  | PWA / 網頁圖示（npm run icons 由 public/favicon.svg 生成） |
| `public/check/data.js` | 89 KB | 3 | 由 npm run spots 生成：景點核對頁數據 |
| `public/check/index.html` | 8 KB | 143 | 景點核對頁（內部，Leaflet + OSM） |
| `public/check/notes.js` | 1 KB | 13 | 景點核對頁的說明 / 問題 |
| `public/check/places-data.js` | 1.4 MB | 3 | 由 npm run places 生成：地方核對頁數據（約 1.4 MB） |
| `public/check/places-notes.js` | 3 KB | 21 | 地方核對頁上要 Chris 看的問題 |
| `public/check/places.html` | 8 KB | 142 | 地方核對頁（內部，Leaflet + OSM） |
| `public/favicon.ico` | 854 B |  | PWA / 網頁圖示（npm run icons 由 public/favicon.svg 生成） |
| `public/favicon.svg` | 495 B | 7 | App 圖示原稿（npm run icons 由它生成各尺寸 PNG） |
| `public/maskable-icon-512x512.png` | 7 KB |  | PWA / 網頁圖示（npm run icons 由 public/favicon.svg 生成） |
| `public/pwa-192x192.png` | 2 KB |  | PWA / 網頁圖示（npm run icons 由 public/favicon.svg 生成） |
| `public/pwa-512x512.png` | 6 KB |  | PWA / 網頁圖示（npm run icons 由 public/favicon.svg 生成） |
| `public/pwa-64x64.png` | 709 B |  | PWA / 網頁圖示（npm run icons 由 public/favicon.svg 生成） |

## （根目錄）

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `pwa-assets.config.ts` | 484 B | 12 | 執行 npm run icons，由 public/favicon.svg 生成手機需要的各種尺寸圖示 |

## src/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `src/App.tsx` | 3 KB | 55 | 根組件：四個分頁的切換（首頁一直掛着，其餘切過去才掛載）、測試網址參數、跨頁跳轉 |
| `src/components/Backup.tsx` | 9 KB | 218 | 備份的介面：「我的」頁的備份卡（匯出 / 從備份還原），和首頁「有幾個章還沒備份」的提示。 |
| `src/components/BookPaper.tsx` | 7 KB | 174 | 印章冊用到的紙和章：一頁紙（章按蓋的位置重現）、單獨一枚小章、沒去過的空章位、一頁的完整內容。 |
| `src/components/BrowserWarn.tsx` | 1 KB | 32 | iPhone 瀏覽器 / App 內置瀏覽器裏不能蓋章，要先加到主畫面。 原因：iPhone Safari 裏長按紙面會被系統搶走（Chris 2026-11-20 試過蓋不成）； 而且瀏覽器和主畫面 App 分開存印章，在瀏覽器裏蓋了也帶不過去。 安卓 Chrome 的瀏覽器和主畫面 App 共用儲存，照常可以蓋。 |
| `src/components/DistrictSheet.tsx` | 4 KB | 92 | 區詳情：這個區的景點。蓋過章的左邊是最近那一枚（照蓋的角度），按一下跳到印章冊那一頁；沒去過的是虛線章位，右邊「帶我去」導航 |
| `src/components/Dots.tsx` | 442 B | 13 | 一排小格：每格一個景點，蓋過的塗上該區的進度色 |
| `src/components/HKMap.tsx` | 7 KB | 169 | 全港 18 區 SVG 地圖：三墨上色（墨藍深淺 = 進度，集齊才印泥紅）、選中描邊、配合 useMapZoom |
| `src/components/InstallHint.tsx` | 3 KB | 70 | 教用戶把 App 加到主畫面的那幾句話（按手機類型不同） |
| `src/components/RegionSheet.tsx` | 2 KB | 54 | 「港島 / 九龍 / 新界」分組：列出該組各區和進度 |
| `src/components/Sheet.tsx` | 1 KB | 38 | 從底部彈出的面板：點背景或按 Esc 關閉 |
| `src/components/StampArt.tsx` | 10 KB | 234 | 八角入境章的章面，以及蓋章動畫用到的各層（移植自 design/prototype/gen-emboss.mjs，以原型為準）。 |
| `src/components/StampPage.tsx` | 22 KB | 571 | 蓋章頁：手指就是印章。按住紙上任何位置 0.7 秒，章紋從手指處以「鋼印凸紋」浮現，越壓越深； 後半程紅墨隨壓力滲進凸紋；最後約 0.1 秒減速「著陸」；壓到底即「咔嗒」（聲音 + 安卓震動）， 只補最後一點紅，章本身一像素都不動。手指抬起後紙才回彈。未滿 0.7 秒放手就平滑退回。 濕墨約 1.6 秒內不變，之後按紙纖維噪聲不均勻變乾，約 20 秒乾透。 |
| `src/components/TabBar.tsx` | 2 KB | 67 | 底部四格導航「蓋章 · 地圖 · 印章冊 · 我的」；首頁剛打開時先藏起來 |
| `src/data/hkmap.json` | 178 KB | 1 | 由 npm run map 生成：18 區 SVG 路徑（由地方拼成、已裁海面、投影）、每區的地方、每個景點在哪個地方、投影參數；App 直接 import |
| `src/data/places.json` | 293 KB | 1 | 由 npm run map 生成：152 個地方的 SVG 路徑（同一投影）；App 用到時才動態載入（src/lib/places.ts） |
| `src/index.css` | 39 KB | 2200 | 全部樣式（三墨顏色變量、各頁面、雷達、蓋章頁、印章冊） |
| `src/lib/backup.ts` | 8 KB | 201 | 備份：把手機裏的章導出成一個檔案；換手機、清了瀏覽器資料、或者把 iPhone Safari 裏蓋的章搬到主畫面 App 時，再導入。 |
| `src/lib/book.ts` | 4 KB | 102 | 印章冊：每個景點一頁，章按蓋的時候在紙上的位置（px / py / rot）重現。 |
| `src/lib/db.ts` | 4 KB | 92 | 手機裏的數據庫（IndexedDB）：印章（stamps）和點亮的地方（lit）。不上網。 |
| `src/lib/districts.ts` | 5 KB | 140 | 可蓋章範圍，見 range.ts |
| `src/lib/format.ts` | 340 B | 7 | 「11.19」這種月·日寫法（香港時間） |
| `src/lib/install.ts` | 3 KB | 84 | 「加到主畫面」：判斷現在是不是從主畫面打開、是甚麼手機，安卓 Chrome 還可以直接彈出安裝框。 |
| `src/lib/lit.ts` | 3 KB | 99 | 點亮的地方（M3，2026-11-20 Chris 定「選 B」）： 按首頁正中那一點讀位置時，人在哪一個「地方」就順手點亮那一塊——不加按鈕、不加字，地圖上悄悄變色。 蓋章仍是唯一的儀式；蓋了章，景點所在的地方也算亮（那部分由章推出來，見 districts.ts，不另外存）。 |
| `src/lib/locate.ts` | 5 KB | 117 | 讀位置：只在用戶按首頁正中那一點時開始，一次最多 10 秒，不在背景追蹤。 |
| `src/lib/mockData.ts` | 3 KB | 77 | 設計稿截圖用的一套假印章（網址加 ?mock=1）。不會寫進手機。 |
| `src/lib/nav.ts` | 989 B | 39 | 跨分頁跳轉：例如在區詳情按一個蓋過章的景點，跳到印章冊的那一頁；首頁的備份提示跳到「我的」頁的備份 |
| `src/lib/pictos.ts` | 5 KB | 70 | 章面左邊的簡筆圖案（100 × 100 的格子，只用線條，章面上縮小到約 66 像素）。 |
| `src/lib/places.ts` | 4 KB | 108 | 「地方」的形狀（M3）：判斷手機讀到的位置在哪個地方。 |
| `src/lib/radar.ts` | 8 KB | 181 | 首頁「雷達」的計算：讀到位置之後，最近的 10 個景點放在紙上哪裏。 |
| `src/lib/range.ts` | 4 KB | 100 | 「站在這裏算不算到了」：算一個位置離景點的可蓋章範圍有多遠 |
| `src/lib/stamps.ts` | 8 KB | 218 | 印章存在手機裏（IndexedDB），不上網。 |
| `src/lib/testMode.ts` | 2 KB | 64 | 隱藏的測試模式：在「我的」頁連按版本號 5 下開關。只給開發和試用時用，一般用戶不會碰到。 測試模式裏可以「假裝在某景點」：在首頁按正中那一點時不讀 GPS，直接用假位置；用假位置蓋的章一律是測試章。 |
| `src/lib/updates.ts` | 1 KB | 40 | 離線副本（Service Worker）的更新：發現新版本就換上，然後重新載入頁面，免得手機一直跑舊版。 正在蓋章時（蓋章頁開着）不重新載入，等蓋章頁關掉才載入，免得按到一半畫面突然刷新。 |
| `src/lib/useMapZoom.ts` | 15 KB | 381 | 地圖看到的範圍（地圖座標），即 SVG 的 viewBox |
| `src/lib/where.ts` | 735 B | 14 | 「到了沒有」「帶我去」共用的小工具（首頁雷達、區詳情用）。 |
| `src/main.tsx` | 497 B | 17 | 入口：掛載 React、啟動 Service Worker 更新、擋住 iPhone Safari 的整頁捏合縮放 |
| `src/pages/BookPage.tsx` | 8 KB | 212 | 印章冊（2026-11-20 Chris 選定「甲 · 翻頁護照」）： 打開就是一整頁，左右掃翻頁；每個景點一頁，按第一次來的先後排（跟蓋章頁頂部的「第 N 頁」一致）。 章按蓋的時候在紙上的位置和角度重現。右上「目錄」打開完整的一頁，看全部頁的小圖。 還差哪些景點，交給地圖和區詳情；印章冊只放「集到了甚麼」。 |
| `src/pages/HerePage.tsx` | 24 KB | 523 | 首頁「蓋章」（2026-11-20 Chris 定稿，取代舊的「我在哪」卡片） |
| `src/pages/MapPage.tsx` | 6 KB | 147 | 「地圖」分頁：18 區地圖、港島 / 九龍 / 新界分組、區詳情；加到主畫面和備份提示也在這頁 |
| `src/pages/MePage.tsx` | 7 KB | 177 | 連按版本號 5 下（2 秒內）開關測試模式 |
| `src/pages/StampPreview.tsx` | 2 KB | 35 | 內部頁：8 個按類型的通用章面圖案，給 Chris 看（網址 ?stamps=preview） |
| `src/vite-env.d.ts` | 134 B | 3 | 打包時寫進去的版本標記，例如「b51c252 · 11.19 21:30」（見 vite.config.ts） |

## tools/

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `tools/build-map.mjs` | 10 KB | 193 | 生成 App 的地圖數據：152 個「地方」→ 拼成 18 區（區的外框就是地方拼起來的外框，完全貼合）→ 簡化 → 投影成 SVG 路徑 |
| `tools/build-places.mjs` | 5 KB | 96 | 生成「地方」（M3）：2019 年區議會選區 − 海面，按 data/places.csv 合併成香港人熟悉的地名 |
| `tools/build-spots.mjs` | 8 KB | 161 | 生成景點數據：data/spots.csv → data/spots.json（App 用）+ public/check/data.js（核對頁用） |
| `tools/check-spots.mjs` | 4 KB | 67 | 上線前的數據檢查（不用上網）：spots.csv 和 App 用的 spots.json、核對頁的 data.js 必須對得上。 改了 CSV 卻忘了跑 npm run spots、區名打錯字、座標打錯……都會在這裏擋下來，部署直接失敗。 用法：npm run check（npm run build 也會先跑它） |
| `tools/coast-lib.mjs` | 3 KB | 63 | 香港的陸地輪廓（OpenStreetMap 海岸線連成的多邊形），用來把區界 / 選區界的海面裁掉。 build-map.mjs（18 區）和 build-places.mjs（地方）共用，保證兩張圖的海岸線一模一樣。 海岸線緩存在 tools/.cache/osm-coastline.json（不入庫，沒有會自動下載）。 |
| `tools/decode_echarts_map.py` | 1 KB | 26 | 解碼 ECharts 的舊區界（生成 hk18-simplified.geojson），已不用 |
| `tools/find-spots.mjs` | 5 KB | 97 | 景點核對（第一步：找候選） 對 spots.csv 的每個景點，在現有座標附近約 5 公里內，用 OpenStreetMap 的地名搜索（Nominatim）找同名地點， 列出候選（名字、類型、位置、離現有座標多遠），寫到 tools/.cache/spot-candidates.json。 只用來幫 Claude 人手挑選正確的地點，不直接改數據。 |
| `tools/gen-files-doc.mjs` | 8 KB | 123 | 生成 docs/FILES.md：倉庫裏每個受版本控制的文件——大小、行數、用途。 用途優先取下面 NOTES 裏手寫的說明，沒有就取文件開頭的註釋（代碼）、第一個標題（Markdown）、表頭（CSV）。 圖片多的設計資料夾合併成一行。每日工程文檔排程任務會跑它；手動：node tools/gen-files-doc.mjs |
| `tools/picto-board.mjs` | 2 KB | 21 | 把章面圖案畫成一張對比板：design/pictos-board.svg（大圖，墨藍）+ 章面大小（紅）。用法：node tools/picto-board.mjs |
| `tools/places-lib.mjs` | 6 KB | 98 | 「地方」（M3）的幾何：2019 年區議會選區 − 海面，按 data/places.csv 歸到各個地方，郊區大選區按 data/place-splits.csv 再切。 build-map.mjs（App 的地圖）和 build-places.mjs（核對頁）共用，保證兩邊的地方一模一樣。 |
| `tools/spots-lib.mjs` | 3 KB | 90 | 景點數據的共用小工具：讀 spots.csv、算距離 |

## （根目錄）

| 文件 | 大小 | 行數 | 用途 |
|---|---|---|---|
| `tsconfig.json` | 537 B | 29 | TypeScript 設定 |
| `vite.config.ts` | 3 KB | 73 | Vite + PWA 設定：BASE_PATH、版本標記 __BUILD__、manifest、Workbox（/check/ 不緩存、字體運行時緩存） |
