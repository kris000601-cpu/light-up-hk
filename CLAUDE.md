# 點亮香港（暫定名）

竪屏網頁 App（PWA）：在香港各區現場「蓋章」，把 18 區地圖一塊塊點亮。詳細背景、決定和路線圖見 `docs/HANDOFF.md`，開工前先讀。

## 關於用戶
- Chris 沒有開發和設計經驗。每一步都要說明要做什麼、為什麼這樣做；要他動手的地方（裝軟件、開帳號、在手機上測試）要寫清楚步驟。
- 跟他溝通用簡體或繁體中文都可以；**App 介面一律港式繁體**。

## 硬性規則
- 介面文字只用港式繁體中文。地名用香港官方寫法：鰂魚涌、東涌、啟德、筲箕灣。不要出現簡體字。
- 只用免費方案：GitHub Pages / Cloudflare Pages、瀏覽器定位、自繪 SVG 地圖、IndexedDB；之後加 Supabase 免費額度。
- 定位只在用戶按按鈕時讀一次，不做後台追蹤。
- 不做排行榜、積分。
- 字體：Noto Sans TC（正文）、Noto Serif TC（標題、印章）。
- 介面以 `design/screens/` 的截圖為準。顏色見 HANDOFF.md 第 4 節。

## 文件
- `data/spots.csv`：景點清單，以這份為準，Chris 會用 Excel 改。`data/spots.json` 由 CSV 生成。座標還沒核對（`verified=false`）。
- `data/hk18-simplified.geojson`：低精度的 18 區邊界，只用來畫總覽圖。要換成 DATA.GOV.HK 的官方數據（見 HANDOFF 第 5.2 節）。
- `design/`：設計稿（截圖、可以直接打開的 HTML、原始設計文件）。
- `tools/`：數據處理腳本。

## 當前進度
還沒開始寫代碼。下一步：HANDOFF.md 第 7 節的 M0。
