# 點亮香港 · 工程交接文檔

> 給接手的工程師：讀完這一份，就能理解整個項目的架構、數據、現狀和所有文件，並且安全地改代碼。
> **這是活文件**：每天 23:59 由排程任務更新（見最後一節「這份文件怎樣維護」）。
> 最後全面重寫：2026-11-23 ｜ 對應提交：見 `docs/PROGRESS.md` 最新一條

---

## 0. 文件地圖：先讀哪份

| 文件 | 用途 | 誰維護 |
|---|---|---|
| **`docs/ENGINEERING.md`**（本文） | 工程全貌：架構、數據、流程、坑、決策、風險 | 每日排程任務 + 改架構時手動 |
| `docs/PROGRESS.md` | 每日進展日誌（最新在上），含當天提交、改了甚麼、卡在哪 | 每日排程任務 |
| `docs/FILES.md` | **自動生成**的全部文件清單（每個受版本控制的文件：大小、行數、用途） | `node tools/gen-files-doc.mjs` |
| `CLAUDE.md` | 給 AI 助手的項目規則 + **路線圖看板**（每個已定決定的原話和日期，最詳細的「為甚麼」） | 每完成一步就更新 |
| `docs/HANDOFF.md` | 2026-11-17 開工前的需求文檔（背景、調研、最初決定）；部分已被取代，以 CLAUDE.md 為準 | 不再更新 |
| `docs/friend-guide.md` | 給試用朋友的使用說明草稿（港式繁體） | 按需 |
| `design/gemini/prompt.md`、`design/gemini/out/README.md` | 每個景點專屬圖案的畫圖說明和逐張狀態表 | 畫圖時更新 |

**衝突時的優先次序**：代碼 > CLAUDE.md 路線圖看板 > 本文 > HANDOFF.md。本文是整理過的摘要，「當時為甚麼這樣定」以 CLAUDE.md 的原話為準。

---

## 1. 產品與現狀快照

**一句話**：竪屏手機網頁 App（PWA）。香港 18 區地圖一開始是空的，人實際到了某個景點，在現場「蓋章」，把地圖一塊塊點亮，慢慢集齊全港。目標是讓住在香港的人走出自己常去的幾個區。不做排行榜、積分；定位只在用戶按按鈕時讀一次，不在後台追蹤。

**項目負責人**：Chris（產品決定者；**沒有開發和設計經驗**，見第 15 節「與 Chris 合作」）。代碼目前全部由 Claude（AI）寫。

| 項目 | 狀態 |
|---|---|
| 正式網址 | https://kris000601-cpu.github.io/light-up-hk/ |
| 倉庫 | https://github.com/kris000601-cpu/light-up-hk （推送 `main` 即自動部署） |
| 景點核對頁（內部） | https://kris000601-cpu.github.io/light-up-hk/check/index.html |
| 地方核對頁（內部） | https://kris000601-cpu.github.io/light-up-hk/check/places.html |
| 後端 | **沒有**。純靜態網頁，數據只存在用戶手機（IndexedDB）。M5 才計劃接 Supabase |
| 用戶 | 只有 Chris 在試；M2 完成後給朋友試用 |
| 自動化測試 | **沒有**（見第 10、13 節） |

**里程碑**（詳細見第 12 節）：M0 搭架子 ✅ → M1 全港地圖 ✅ → M2 蓋章 ✅（2026-11-23；下一步給朋友試用）→ M3 區內「地方」+ 撥雲見霧動畫（數據已做，App 未接）→ M4 補錄 / 拍照 / 分享卡片 → M5 朋友（Supabase）。

---

## 2. 快速上手

### 環境
- **Node 26**（CI 用 26；本機 Windows 上也是 26.x），npm。
- Windows 上 Chris 的電腦開了「智能應用控制」，會擋沒簽名的原生 `.node` 文件，所以 `package.json` 用 `overrides` 把 rollup 換成 `@rollup/wasm-node`。**不要刪這個 override**，也不要叫 Chris 關掉這個安全功能。
- Git Bash 與 PowerShell 都有；本機沒有 Python、沒有 `gh` CLI。

### 常用命令
| 命令 | 做甚麼 |
|---|---|
| `npm ci` | 安裝依賴 |
| `npm run dev` | 本機開發（Vite，`--host` 方便手機在同一 Wi-Fi 打開） |
| `npm run build` | **先跑數據檢查**（`tools/check-spots.mjs`）→ `tsc --noEmit` → `vite build`。任何一步失敗，CI 部署就失敗 |
| `npm run preview` | 預覽打包結果（測 Service Worker、效能用這個，不要用 dev） |
| `npm run spots` | `data/spots.csv` → `data/spots.json`（App）+ `public/check/data.js`（核對頁）。**改了 CSV 一定要跑** |
| `npm run map` | 官方 18 區界 − 海岸線 → `src/data/hkmap.json` |
| `npm run places` | 選區 → 「地方」→ `public/check/places-data.js`（M3，App 未用） |
| `npm run check` | 只跑數據檢查 |
| `npm run icons` | 由 `public/favicon.svg` 生成 PWA 圖示 |
| `node tools/gen-files-doc.mjs` | 重新生成 `docs/FILES.md` |

`.claude/launch.json` 定義了 `dev`（5173）和 `preview`（4173）兩個伺服器，給 Claude 桌面 App 的預覽窗格用。

### 測試用網址參數（全部只影響當前頁面，不在 App 裏露出）
| 參數 | 作用 |
|---|---|
| `?mock=1` | 用一套假印章（`src/lib/mockData.ts`），**不讀寫真數據庫**，並關掉動畫（截圖用） |
| `?mock=1&many=1` | 每個景點兩個章（174 個），壓力測試 |
| `?at=s026` 或 `?at=緯度,經度` | 假位置（蓋的是測試章） |
| `?tab=map` / `book` / `me` | 直接打開那一格 |
| `?d=E`、`&sheet=district`、`?region=九龍` | 地圖選中某區 / 打開區詳情 / 打開分組列表 |
| `?here=done&lat=..&lng=..&sel=s001`、`here=locating`、`here=error` | 首頁雷達各狀態的截圖 |
| `?page=s023`、`&toc=1` | 印章冊翻到某頁 / 打開目錄 |
| `?stamps=preview` | 8 個章面通用圖案的預覽頁 |

**隱藏測試模式**：「我的」頁連按版本號 5 下（2 秒內）開關。可以「假裝在某景點」、設假定位誤差、蓋「測試章」、一鍵清走測試章。測試章帶 `test: true`，不佔 No.，只在測試模式開着時算進度。

---

## 3. 架構總覽

```
            離線（本機 / CI 打包前）                                 執行時（用戶手機，純前端）
 ┌──────────────────────────────────────────┐        ┌─────────────────────────────────────────────┐
 │ data/spots.csv ──npm run spots──▶ data/spots.json ─┼──import──▶ src/lib/districts.ts（景點、區、進度）│
 │       │                     └──▶ public/check/data.js（核對頁）                                    │
 │ data/hk18-official.geojson ─┐                      │                                             │
 │ OSM 海岸線（tools/.cache）──┼─npm run map─▶ src/data/hkmap.json ─▶ HKMap.tsx（SVG 地圖）           │
 │                             └─npm run places─▶ public/check/places-data.js（M3，App 未接）         │
 │ data/dcca2019.geojson + places.csv + place-splits.csv ┘                                            │
 └──────────────────────────────────────────┘        │  navigator.geolocation（按一下才讀）           │
                                                     │        ▼                                     │
                                                     │  locate.ts ─▶ radar.ts / range.ts ─▶ HerePage │
                                                     │        ▼                                     │
                                                     │  StampPage（按住 0.7 秒）─▶ stamps.ts ─▶ IndexedDB │
                                                     │        ▼                                     │
                                                     │  BookPage / DistrictSheet / MapPage 讀同一份章  │
                                                     │  Service Worker（vite-plugin-pwa）：離線 + 自動更新 │
                                                     └─────────────────────────────────────────────┘
```

- **沒有路由庫**。`App.tsx` 用一個 `tab` 狀態切四個頁面（底部導航「蓋章 · 地圖 · 印章冊 · 我的」）。**只有首頁一直掛着**（切走時用 `hidden` 藏起來，回來時雷達結果還在）；地圖、印章冊、我的是切過去才掛載、切走就卸載。跨頁跳轉（例如區詳情 → 印章冊某頁）用 `src/lib/nav.ts` 的小型全局事件。
- **沒有狀態管理庫**。共享狀態用模組級變量 + `useSyncExternalStore`（`stamps.ts`、`testMode.ts`、`install.ts`、`nav.ts`、`backup.ts` 的 `useLastBackup`）。
- **地圖是自繪 SVG**（不用地圖服務）。投影在打包前做好（`tools/build-map.mjs`），App 只畫路徑。
- **所有地理計算在手機上做**：本地平面近似（經緯度 → 米），香港範圍小，誤差遠小於 GPS。
- 依賴極少：執行時只有 `react` / `react-dom`。開發依賴：vite、vite-plugin-pwa、@vite-pwa/assets-generator、typescript、mapshaper（數據腳本用；`proj4`、`@turf/*` 是它帶進來的間接依賴，腳本沒有直接依賴它們）。

---

## 4. 代碼結構與模組職責

完整文件清單（含每個文件的用途）見自動生成的 **`docs/FILES.md`**。這裏只講重要模組和它們的約束。

### `src/pages/`（四個分頁 + 一個內部頁）
| 文件 | 職責 | 要點 |
|---|---|---|
| `HerePage.tsx`（約 500 行） | 首頁「蓋章」：空白紙 + 正中一點；按一下讀位置 → 雷達浮現最近 10 個景點的長條章；在範圍內的落在正中「你已到達」 | 最複雜的頁面。排版用的位置（`basis`）和判斷能不能蓋的最新位置（`fix`）是**兩份**：章一出來就定住，只有「正中換了」（變準後發現到了）才重排。浮現動畫用 Web Animations，等待寫進關鍵幀（不要用 `delay + fill: backwards`，iPhone 上會閃）。位置 5 分鐘過期 |
| `MapPage.tsx` | 全港 18 區地圖 + 「港島 / 九龍 / 新界」分組 + 區詳情 | 「先加到主畫面」「還沒備份」兩個提示放這頁（首頁要保持空白） |
| `BookPage.tsx` | 印章冊：每個景點一頁，左右掃翻頁；目錄是完整一頁 | 目錄分批畫（先四行，之後每 16ms 補四行）+ `content-visibility: auto`，174 個章時第一屏約 20ms |
| `MePage.tsx` | 「我的」：保存狀態、備份卡、版本號、測試工具 | 版本號連按 5 下開測試模式 |
| `StampPreview.tsx` | `?stamps=preview` 內部預覽 8 個通用圖案 | |

### `src/components/`
| 文件 | 職責 |
|---|---|
| `StampPage.tsx`（約 570 行） | 全屏蓋章頁。手指就是印章：按住 0.7 秒，鋼印凸紋浮現、紅墨滲入、「咔嗒」定型；壓到底那一下才存章。移植自 `design/prototype/emboss-logic.js`，**數字以原型為準**。iPhone 上只用 `touchstart/touchend/touchcancel` 驅動，紙面最上一層透明 `.sp-hit` 擋住 SVG（否則系統長按選單會取消按壓） |
| `StampArt.tsx` | 八角入境章章面（210×170 SVG）+ 各層：凸紋陰影 / 高光 / 表面、濕墨、7 層乾墨（噪聲門檻逐層變乾）、乾透舊章、縮圖 `lite`（不加濾鏡） |
| `BookPaper.tsx` | 印章冊的紙（358×372 邏輯尺寸整張縮放）、小章、空章位、一頁內容（含「逐個看」疊章） |
| `HKMap.tsx` | SVG 地圖，三墨上色；配合 `useMapZoom` 的捏合 / 拖動 / 慣性 |
| `DistrictSheet.tsx`、`RegionSheet.tsx`、`Sheet.tsx` | 從底部彈出的面板 |
| `Backup.tsx` | 備份卡（匯出 / 從備份還原）和首頁「還沒備份」提示 |
| `BrowserWarn.tsx` | iPhone 瀏覽器 / App 內置瀏覽器：一律要先加到主畫面才能蓋（只有「知道了」） |
| `InstallHint.tsx` | 教加到主畫面（安卓可一鍵安裝） |
| `TabBar.tsx`、`Dots.tsx` | 底部導航；進度小格 |

### `src/lib/`
| 文件 | 職責 | 約束 |
|---|---|---|
| `stamps.ts` | IndexedDB 存章；`useStamps()`；`addStamp`、`importStamps`、`clearTestStamps`；申請持久儲存 | 見第 6 節。No. 在寫入交易裏數；iPhone 從後台回來連接會被關，有斷線重開 |
| `districts.ts` | 景點表、18 區、按章算進度（`Level` 0–3）；`useCountedStamps`（測試模式關時排除測試章） | |
| `locate.ts` | `startLocate()`：「先出結果，再悄悄變準」 | 第一個 ≤100m 的位置（約 1 秒）就交；1.5 秒有 ≤300m 也先交；4 秒交最好的；之後同一次按壓繼續讀，≤30m 或 10 秒停。`ACC_LIMIT=100`（誤差 >100m 不給蓋），`FIX_TTL=5 分鐘` |
| `range.ts` | 「站在這裏算不算到了」：到景點形狀（點 / 線 / 面）的距離 − 範圍米 − min(定位誤差, 50) | `MAX_COMP=50`。用戶看到的距離只有一種：到形狀本身的距離 |
| `radar.ts` | 選最近 10 個、算方向（上北下南，不用指南針）、對數壓縮距離、排版不重疊、章的尺寸（用 canvas 量真字寬） | 章的框必須落在整數像素（iPhone 半像素會令虛線缺邊） |
| `book.ts` | 印章冊分頁、`placeStamps`（章在紙上的位置；沒記位置的舊章按固定位置分散） | |
| `backup.ts` | 備份檔格式、匯出（iPhone 用分享選單）、讀檔驗證、導入計劃 | 見第 6 節 |
| `pictos.ts` | 8 個按類型的通用章面圖案（100×100 線條路徑）+ 尖沙咀鐘樓專屬 | 將被每景點專屬圖案取代（見第 12 節） |
| `updates.ts` | Service Worker 更新：新版接管後自動重新載入；`holdUpdates()` 在蓋章頁開着時延後 | |
| `testMode.ts` | 測試模式、假位置（localStorage） | |
| `install.ts` | 判斷平台（installed / ios / android / inapp / desktop）、安卓安裝事件 | |
| `nav.ts` | 跨分頁跳轉請求 | |
| `useMapZoom.ts`（約 380 行） | 地圖捏合縮放 / 拖動 / 橡皮筋 / 慣性 | 移動中只改 CSS transform，停下才重畫 viewBox |
| `where.ts`、`format.ts`、`mockData.ts` | 小工具；假數據 | `where.ts` 的「就快到了」常數現在沒用（Chris 決定不顯示） |

### `tools/`（Node 腳本，打包前在本機跑，輸出入庫）
`build-spots.mjs`、`check-spots.mjs`、`spots-lib.mjs`（CSV 解析、距離、Overpass）、`find-spots.mjs`（OSM 地名搜索找候選座標）、`build-map.mjs`、`coast-lib.mjs`（海岸線連成陸地多邊形，18 區和地方共用）、`build-places.mjs`、`picto-board.mjs`（圖案對比板）、`gen-files-doc.mjs`（生成 `docs/FILES.md`）、`decode_echarts_map.py`（舊，解碼最初的低精度區界，已不用）。

---

## 5. 數據

### 5.1 景點 `data/spots.csv`（真相來源）
87 個景點，18 區每區 3–6 個。欄位：`編號, 區, 小地名, 景點, 一句推薦, 緯度, 經度, 類型, 範圍, 範圍米, 座標已核對`。
- **`編號`（s001…）一旦用過就永遠不改、不重用**：手機裏存的章靠它認景點。新景點接着用下一個號，刪掉的號空着。
- `類型`：觀景 / 文化 / 海濱 / 行山 / 地標 / 街區 / 自然 / 海島（決定通用圖案）。
- `範圍`：空白 = 點；否則是 OSM 地物（`way/…` `relation/…` `node/…`，可多個；長山徑 `@米數` 只取景點座標附近一段；也可寫 `緯度,經度`）。`build-spots.mjs` 從 Overpass 取形狀，寫進 `spots.json` 的 `range: { r, points?, lines?, areas? }`。
- `範圍米`三檔（Chris 2026-11-19 定）：市區建築 / 街道 50、海濱 / 大公園 / 海灘 80、郊野 / 山徑 / 離島 150；只有中心點的村落另外放寬（茶果嶺 120、荔枝窩 200）。原則：「到了」＝ 站在那個地方或它門口。
- 2026-11-19 已用 OSM 逐個核對，Chris 在核對頁看過，全部 `座標已核對 = 是`。
- `npm run build` 會先跑 `check-spots.mjs`：CSV ↔ spots.json ↔ 核對頁數據、區名、座標對不上就失敗（防止改了 CSV 忘了跑 `npm run spots`）。
- Overpass 取形狀的緩存在 `tools/.cache/`（不入庫）。

### 5.2 全港地圖
- `data/hk18-official.geojson`：民政事務總署 18 區界（DATA.GOV.HK，含海面）。
- `tools/build-map.mjs`：官方區界 − OSM 海岸線（`tools/coast-lib.mjs`，緩存在 `tools/.cache/osm-coastline.json`，沒有會自動下載）→ 機場第三跑道（官方界畫於填海之前，被劃進屯門區海域）歸回離島區 → 去掉 < 0.15 km² 的小島 → mapshaper 簡化（保持相鄰區共用邊）→ 投影成 1000 寬的 SVG 路徑 → `src/data/hkmap.json`（約 168 KB）。
- **Chris 特別強調**：地圖必須露出維港；選中某區的加粗描邊必須用「裁好海面之後」的同一條路徑，只描在區內側，完全貼合。
- `data/hk18-simplified.geojson`：最初的低精度區界（來自 ECharts），已不用，只留作參考。

### 5.3 M3「地方」（區內細分；數據已做，App 未接）
- `data/dcca2019.geojson`：選舉管理委員會 2019 年區議會選區 452 個（DATA.GOV.HK，`https://www.eac.hk/datagovhk/dc2019/DCCA2019.json`），已由香港 1980 方格網（EPSG:2326）轉成 WGS84，含海面。全部核對落在自己的區（選區代號首字母 = 區代號）。2023 年改制後只剩 44 個太粗，所以用 2019。
- `data/places.csv`：152 個「地方」（`編號 p001–p152, 區, 地方, 選區`），每個由若干選區合併。編號規則同景點：**上線後永不改、不重用**（未上線前還可以改）。
- `data/place-splits.csv`：郊區大選區用經緯度長方形再切（大嶼山南 → 大澳 / 昂坪 / 長沙 · 貝澳 / 梅窩、東涌炮台舊谷歸東涌；赤柱及石澳 → 赤柱 / 石澳 · 龍脊 / 大潭；西九文化區從尖沙咀西切出；蝴蝶灣海灘歸屯門碼頭；沙打 → 打鼓嶺 / 沙頭角 · 鹿頸 / 荔枝窩 · 吉澳；塔門 · 東平洲、橋咀洲 · 鹽田梓兩個島組）。切線是直的。
- `tools/build-places.mjs` 核對（每個選區恰好用一次、區對得上）→ 裁海面 → 再切 → 簡化 → 合併 → `public/check/places-data.js`（約 1.4 MB，只給核對頁）。
- Chris 2026-11-22 看過核對頁：地名沒問題。79 / 152 個地方沒有景點（所以要「選 B」：按點時順手點亮所在那一塊）。

### 5.4 景點專屬圖案（進行中）
- 現在章面用 `src/lib/pictos.ts` 的 8 個通用圖案（按類型）+ 尖沙咀鐘樓專屬。
- 正在用 Gemini 網頁版按 `design/gemini/prompt.md`（英文畫圖說明，87 個景點逐個寫了要畫甚麼）一張張畫，參考圖 `design/gemini/reference-clock.png`。成品 `design/gemini/out/sNNN.jpg`（2048×2048），逐張狀態 `design/gemini/out/README.md`。
- 之後要描成向量路徑放進章面（章面的凸紋 / 濕墨 / 乾墨都用同一個幾何，所以不能直接貼點陣圖）。

### 5.5 數據來源與授權
- OpenStreetMap（海岸線、景點形狀）：ODbL，App 和核對頁要標「© OpenStreetMap 貢獻者」（`hkmap.json` 的 `source` 欄已寫）。
- DATA.GOV.HK（民政署區界、選管會選區界）：政府開放數據條款；選管會聲明選區圖只適用於 2019 選舉，以其公布為準。

---

## 6. 手機本地數據模型（改動要非常小心：關係到用戶已經蓋的章）

### 6.1 IndexedDB
- 數據庫 `light-up-hk`，**版本 2**，表 `stamps`（keyPath `id` 自增），索引 `spotId`、`uid`（unique）。v1 → v2 時給舊章補 `uid`。
- 記錄（`Stamp`，`src/lib/stamps.ts`）：

| 欄位 | 說明 |
|---|---|
| `id` | 本機自增編號，只在這部手機有意義（不入備份） |
| `uid` | 全球唯一身份碼，跨手機 / 備份 / 以後同步都不變；導入按它去重 |
| `no` | 第幾枚（章面 No.），蓋的時候在寫入交易裏數，以後不變；測試章不佔號 |
| `spotId` | 景點編號（s001…） |
| `spotName`、`district` | 蓋章當時的景點名 / 區名**快照**（景點以後改名，舊章照舊顯示） |
| `at` | 蓋章時間（毫秒） |
| `lat`、`lng`、`acc` | 蓋章時的位置和誤差（米）；測試章沒有 |
| `test` | 測試章 |
| `px`、`py`、`rot` | 章蓋在紙上的位置（0–1）和角度；印章冊照着重現 |

- 有第一個正式章時才申請 `navigator.storage.persist()`。
- **iPhone 注意**：Safari 和主畫面 App 的儲存是分開的；系統在後台會關掉數據庫連接（已處理斷線重開）；長期不打開可能被系統清（所以有備份）。

### 6.2 備份檔（`src/lib/backup.ts`）
- 檔名「點亮香港備份-YYYY-MM-DD.json」，格式 `{ format: 'light-up-hk/stamps', version: 1, ... stamps: [ Stamp 去掉 id ] }`；測試章只在測試模式開着時才匯出。
- iPhone 用分享選單（`.json` 不給分享就退成 `text/plain`），其他平台直接下載。
- 導入：先講清楚「這份有幾個章、手機裏已有幾個、會加入幾個」，按了才加；**只加不刪不覆蓋**（按 uid 去重）；兩邊各自從 No.1 數起而撞號時，全部正式章按蓋章時間重新編號（導入前就說明）。壞檔 / 別的檔 / 新版本的檔都拒絕，不導入半份。
- M3 加了「點亮記錄」後，備份格式要升版本並保持能讀 v1。

### 6.3 localStorage 鍵
`lhk.lastBackup`（上次備份時間，只記在這部手機）、`backup-hint-hidden-until`、`install-hint-hidden-until`、`test-mode`、`test-fake-location`、`lhk.stampGuided`（蓋成功過一次後不再顯示按壓指引）、`browser-stamp-ok`（舊版用過，已不用）。

---

## 7. 核心流程

1. **讀位置**（首頁按正中一點）：`startLocate` 開 `watchPosition`；第一個夠用的位置一到就交給 `HerePage`（約 1 秒），雷達浮現；同一次按壓裏繼續變準，只在後台更新能不能蓋、距離。超過 4.5 秒沒有位置，正中下面淡淡寫「訊號比較弱，再等幾秒」。失敗時也浮現抬頭和導航，正中寫原因。
2. **雷達**：`radarSpots` 選最近 10 個（已在範圍裏的最近那個落在正中，大一號實心紅章「你已到達」）；`layoutRadar` 按真實方向、對數壓縮距離放，放不下挪到最近空位，一定不疊。長條章只分兩種：可以蓋 = 白文實心紅；其他不管去沒去過 = 墨藍虛線框（2026-11-23 起；印泥紅只表示「現在可以蓋」）。按一下底部出小卡片（名字、距離、蓋過幾次 · 看印章冊、「帶我去 ›」= Google 地圖導航到範圍內最近一點，或「蓋章」）。
3. **蓋章**：按「你已到達」→（iPhone 瀏覽器：只彈「先加到主畫面」）→ 全屏蓋章頁 → 按住 0.7 秒 → 壓到底「咔嗒」→ `addStamp` 寫入 → 濕墨約 20 秒內不均勻變乾。蓋章頁開着時延後自動更新。
4. **看章**：印章冊（每景點一頁，按第一次來的先後；疊章可「逐個看」）、區詳情（每行最近那枚小章，按一下跳印章冊）、地圖按進度上色（三墨：去過一兩個墨藍 20%、過半 48%、集齊才變印泥紅）。
5. **更新**：`registerType: 'autoUpdate'` + `virtual:pwa-register`；新版接管後自動重新載入；回到前台檢查更新；`holdUpdates()` 期間延後。`/check/` 不進離線副本（`navigateFallbackDenylist`）。「我的」頁顯示版本（`__BUILD__` = 提交號前 7 位 · 香港時間打包時間），用來確認手機跑的是哪一版。

---

## 8. 設計系統（違反會被 Chris 退回）

- **風格**：「方案 A · 遊歷護照」：米色護照內頁、墨藍線條、印泥紅。設計稿 https://claude.ai/artifact/3JS8mZ6aUkQ259GyMQt8Es 。`design/screens/` 的舊截圖只作結構參考；和風金雲（第 6 屏）已放棄。
- **三墨規則**：紙 `#F3EDDF` / 卡片 `#FBF8F0`（約 60%）；墨藍 `#2D3E5C`、正文 `#1E2B3C`、次要 `#5C667A`、細線 `#C1C1BE`（約 30%）；印泥紅 `#B9473A`（約 10%，只用於蓋章按鈕、可蓋章、已集齊的區）。**不要加第四種顏色（包括金色）**；不要用半透明紅（淡出會變粉）。
- **字體**：Noto Sans TC（正文）、Noto Serif TC（標題、印章）。
- **文字**：介面一律**港式繁體**，地名用香港官方寫法（鰂魚涌、東涌、啟德、筲箕灣）；不要出現簡體字。
- **少文字、用頁面引導**（Chris 2026-11-20）：高級感；不加「就快到了」「繼續按住」之類的引導文字，不加進度條。一切只為蓋章服務。
- **章面**：八角入境章：「區名 · 已抵達」、年份 + No.、大字「月·日」、景點名、左邊一個簡筆圖案。線條銳利乾淨，不要手工毛邊。
- **圖案畫法**（照原型尖沙咀鐘樓）：畫一個具體、認得出的香港東西；一個居中豎直的主角，幾何形一層層搭；一兩個小細節；同一個底座（地平線 + 兩行水紋 / 直線）；筆畫少；縮到 66 像素還認得出。

---

## 9. 構建、部署、版本

- `.github/workflows/deploy.yml`：推送 `main` 或手動觸發 → Node 26 → `npm ci` → `npm run build`（`BASE_PATH=/<倉庫名>/`）→ 上傳 `dist` → GitHub Pages。
- `vite.config.ts`：`base` 由 `BASE_PATH` 決定（本機 `/`）；`__BUILD__` 版本標記；PWA manifest、圖示、Workbox（`/check/` 不攔截、字體運行時緩存）。
- **推送 = 上線**：Chris 手機上的主畫面 App 會在下次打開時自動更新。蓋章中途不會被打斷（`holdUpdates`）。
- 只有 `main` 一個分支，直接提交；沒有 PR 流程。提交訊息英文，結尾帶 `Co-Authored-By` 行（見提交歷史）。

---

## 10. 測試與驗證（現狀：沒有自動化測試）

- 唯一的自動檢查：`check-spots.mjs`（數據一致性）+ `tsc --noEmit`（類型），都在 `npm run build` 裏。
- 改介面後的驗證方式：本機 `npm run dev` / `preview` + 瀏覽器（手機尺寸 375×812）+ 上面的網址參數；動畫 / 時序問題用 JS 每 10ms 取樣（例如記錄每個章的透明度、DOM 增刪）。
- **真機才能測的**：iPhone 的長按、儲存分離、震動、半像素、Safari 動畫細節——電腦 Chrome 測不出來（見第 11 節）。每次改這些都要 Chris 在 iPhone 主畫面 App 上確認，並先看「我的」頁版本號是新的。
- 實地測試（M2 第 6 步）2026-11-23 Chris 說測完（清單在 CLAUDE.md 路線圖）。

---

## 11. 已知的坑（大多是 iPhone）

| 現象 | 原因 | 現在的處理 |
|---|---|---|
| 長按蓋章時彈「儲存圖片」、按壓被取消 | iOS 把 SVG 當圖片；中途 `pointercancel` | 透明 `.sp-hit` 層 + 只用 touch 事件 + `-webkit-touch-callout: none` |
| iPhone 瀏覽器（未加主畫面）蓋不了章 | 長按被系統搶走；而且瀏覽器和主畫面 App 分開存章 | 一律要求先加到主畫面 |
| 虛線章框缺一邊 | 章落在半個像素上；模糊濾鏡在圖層邊上裁一條 | 雷達中心、章的位置和尺寸全是整數；模糊做在大一圈的 `.ink` 層 |
| 章「虛一下、消失、再浮現」 | `delay + fill: 'backwards'` 在 iPhone 上等待期間不透明，CSS 淡入先顯示 | 等待寫進關鍵幀，並關掉那幾個章的 CSS 淡入 |
| 從後台回來讀寫章失敗 | iOS 關掉 IndexedDB 連接 | 斷線重開 |
| 首頁藏起來時量到 0，章滑來滑去 | 切分頁時元素寬高為 0 | 量到 0 就不理 |
| iPhone 瀏覽器不支援網頁震動 | — | 只在安卓震 |
| Claude 預覽窗格隱藏時 `requestAnimationFrame` 不跑 | 背景頁 | 測試時改用 `setTimeout` 計時 |
| 機場第三跑道被劃進屯門區 | 官方界畫於填海之前 | 地圖和地方腳本都歸回離島（`AIRPORT_IN_TUEN_MUN`） |

---

## 12. 決策記錄（摘要；原話和日期見 CLAUDE.md 路線圖）

| 日期 | 決定 | 理由 |
|---|---|---|
| 11-17 | PWA，不上架 App Store；全部免費方案；GitHub Pages | 先做給自己和朋友玩；不花錢 |
| 11-17 | 定位只在按按鈕時讀一次；不做排行榜、積分 | 省電、私隱；Foursquare 的教訓 |
| 11-18 | 風格「遊歷護照」+ 三墨規則；放棄和風金雲 | Chris 選定 |
| 11-18 | 蓋章 =「鋼印凸紋」，手指就是印章，按住 0.7 秒 | 招牌瞬間 |
| 11-18 | 地圖用官方區界、裁海面、描邊貼合內側 | Chris 強調 |
| 11-19 | 範圍按真實形狀 + 三檔外擴 + 補誤差最多 50m；誤差 >100m 不給蓋 | 「到了」＝站在那裏或門口 |
| 11-19 | 先用 8 個按類型的通用圖案，之後換每景點專屬 | 先上線再精修 |
| 11-20 | 首頁 = 空白紙 + 一點（雷達），長條章只有字；底部四格導航 | 少文字的高級感 |
| 11-20 | 讀位置「先出結果再變準」 | 室內等 4–10 秒太慢 |
| 11-20 | 印章冊「翻頁護照」，目錄是完整一頁 | Chris 選甲 |
| 11-20 | 不加回「就快到了」；不做「一頁滿了續頁」；景點下架真碰到再說 | 不為不現實的場景加功能 |
| 11-20 | iPhone 瀏覽器一律要先加主畫面才能蓋 | Chris 實測蓋不了 |
| 11-20 | M3：用戶只管蓋章；沒有景點的地方「按點時順手點亮」（選 B）；區的顏色按「亮了幾塊」；地方不設章 | 大部分地方沒有景點 |
| 11-22 | 雷達的章一出來就定住，精確位置只在後台用 | 雷達只是大概方向 |
| 11-22 | 每景點專屬圖案用 Gemini 生成 | 87 個人手畫不現實 |
| 11-23 | 雷達長條章只分「能蓋（實心紅）/ 不能蓋（虛線）」，去掉「蓋過 = 紅框」 | 紅色只表示一件事；蓋過幾次在小卡片看 |

### 路線圖（截至本文更新日）
- **M2 蓋章**：全部完成（2026-11-23 實地測試）。下一步：把 `docs/friend-guide.md` 發給朋友試用。
- **M3**：第 1 步「地方」數據完成且 Chris 已看。**第 2 步（未開始）**：App 用的地方圖（`src/data/places.json`，與 18 區同一投影；要決定以選區界還是民政署區界為準，兩者有細微差別，區外框要與地方完全貼合）+ 點亮記錄（IndexedDB 新表、備份格式 v2）+ 首頁按點時順手點亮 + 地圖按「亮了幾塊」上色。之後撥雲見霧推進動畫（點區 → 鏡頭推進 → 霧散開露出地方）。
- **景點專屬圖案**：Gemini 已畫 s001–s014，額度用完停在 s015。之後要描成向量路徑。
- **M4** 補錄（虛線章）、拍照、分享卡片（9:16）。**M5** 朋友（Supabase；朋友只讀「點亮了哪些區」，不同步精確位置和時間，行級權限）。
- **未決**：改名（App Store 已有 ExploreHK）；景點數量要不要加（觀塘、葵青、沙田景點少）。

---

## 13. 技術債、風險與建議（給接手者）

1. **沒有自動化測試**。最值得先補的：`range.ts` / `radar.ts` 的純函數單元測試（距離、方向、排版不重疊、整數像素）、`backup.ts` 的導入計劃（去重、重新編號）、`stamps.ts` 的遷移。可以用 Vitest（與 Vite 同生態），不必動現有結構。
2. **大組件**：`HerePage.tsx`（約 500 行）、`StampPage.tsx`（約 570 行）、`useMapZoom.ts`（約 380 行）。改之前先讀頭部註釋；時序相關的狀態（`basis` vs `fix`、`arrivedRef`、`holdUpdates`）是踩過坑才這樣寫的。
3. **IndexedDB 是用戶唯一的數據**。任何 schema 改動都要寫遷移、保持舊備份能導入；先在 `?mock=1` 以外的真數據上測升級。M3 會是第一次加表。
4. **iPhone 行為只能真機驗證**，電腦 Chrome 通過不代表 iPhone 沒問題。
5. **CLAUDE.md 路線圖看板很長**（決定的原話都在裏面），是「為甚麼」的真相來源，但不好讀。本文第 12 節是摘要。
6. **地方數據**：選區界 vs 民政署區界有細微差別；`places-data.js` 1.4 MB 只能給核對頁用，App 版要另外簡化、投影。郊區切線是直的長方形。
7. **景點專屬圖案**：Gemini 輸出是點陣 JPEG，要描成線條路徑才能進章面；Gemini 網頁版有每日額度、偶爾整個請求消失或只回 SVG 代碼（見 `design/gemini/out/README.md` 的做法備忘）。
8. **數據來源依賴**：Overpass / Nominatim 只在跑腳本時用（有緩存）；App 執行時不依賴任何外部服務（Google Fonts 除外，已做運行時緩存）。
9. **沒有錯誤上報 / 分析**（刻意不加，私隱優先）。用戶問題靠 Chris 截圖；測試模式下蓋章頁頂部有一行除錯記錄（版本號 + 每一步）。

---

## 14. 外部資源與帳號

- GitHub：`kris000601-cpu/light-up-hk`（Chris 的帳號），Pages 自動部署。
- 設計稿 / 討論畫布（claude.ai Artifacts）：A 風格 https://claude.ai/artifact/3JS8mZ6aUkQ259GyMQt8Es ；印章冊三版 https://claude.ai/artifact/MszASkLYur5qyC1w8ZKfrG ；舊「印台」首頁 https://claude.ai/artifact/SACKvFj29qkqdHtcDnazB2 （已取代）；最初設計稿 https://claude.ai/artifact/RLSbwBJfTpvLqD4hMLspm7 。
- Gemini 網頁版（Chris 的 Google 帳號，在 Claude 內置瀏覽器裏已登入）：全代碼審查對話 https://gemini.google.com/app/efe1908afa46070c ；景點圖案對話 https://gemini.google.com/app/7d1db0edfc8a91bc 。
- 開放數據：DATA.GOV.HK（民政署區界、選管會 2019 選區）、OpenStreetMap（Overpass、Nominatim）。

---

## 15. 與 Chris 合作

- Chris **沒有開發和設計經驗**。每一步要說明做甚麼、為甚麼；要他動手的（裝軟件、開帳號、手機測試）寫清楚步驟；要他檢查時直接附完整網址。
- 跟他溝通用**簡體中文**；App 介面一律港式繁體。
- 他記不住整體進度：每步收尾要說「現在在哪、下一步」，並更新 CLAUDE.md 路線圖看板。
- 他重視：高級感、少文字、iPhone 上的細節（像素、閃爍、手感）。設計類需求先對齊喜好、出多個方案；先質疑問題定義，不要只照字面做。
- 外部模型審查用 Gemini 網頁版（4 Neon、思考「高」），代碼打包成一個文件讓 Chris 上傳；他的 ChatGPT 已過期。

---

## 16. 這份文件怎樣維護

- **每日 23:59**（香港時間）由排程任務「點亮香港 · 每日工程文檔」執行：讀當天的提交和改動 → 更新本文受影響的章節（現狀快照、路線圖、模組表、坑、決策）→ 重新生成 `docs/FILES.md` → 在 `docs/PROGRESS.md` 最上面加當天一條 → 只提交 `docs/` 並推送。當天沒有提交就只記一行「無改動」。
- 改架構、數據格式、存儲 schema 的人，應在同一個提交裏順手更新本文對應章節。
