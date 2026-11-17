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

## 開發
- Vite 8 + React 19 + TypeScript，PWA 用 vite-plugin-pwa。`npm run dev` 本機開發，`npm run build` 打包，`npm run icons` 由 `public/favicon.svg` 重新生成圖示。
- 推送到 GitHub `main` 分支就會自動部署（`.github/workflows/deploy.yml`）。倉庫：github.com/kris000601-cpu/light-up-hk
- Chris 的電腦開了 Windows「智能應用控制」，會擋沒簽名的原生 `.node` 文件，所以 `package.json` 用 `overrides` 把 rollup 換成 `@rollup/wasm-node`。不要刪，也不要叫 Chris 關掉這個安全功能。
- 跟 Chris 溝通一律用簡體中文。

## 當前進度
- M0 完成（2026-11-17）：空殼已上線 https://kris000601-cpu.github.io/light-up-hk/
- 下一步：M1 全港地圖。開工前要 Chris 決定首頁用第 1 屏（現代風）還是第 6 屏（和風金雲）。
