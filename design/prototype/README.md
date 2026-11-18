# 設計原型備份

畫布線上版：https://claude.ai/artifact/3JS8mZ6aUkQ259GyMQt8Es

- `canvas/`：畫布上每一張稿的源文件（`.dc.html`，Claude Design 格式）。圖片引用的是畫布上的 `/_blob/...`，離開畫布打不開圖片，只作代碼參考。
- `canvas/A-Emboss.dc.html`：**蓋章定稿「鋼印凸紋」**的可按原型。M2 移植到 App 時以它為準。
- `emboss-logic.js`：A-Emboss 的互動邏輯（按壓曲線、越壓越紅、咔嗒、抬手回彈、20 秒不均勻變乾）。
- `gen-emboss.mjs`：生成 A-Emboss 的腳本（八角章圖案、凸紋、濕墨 / 乾墨、紙纖維變乾遮罩）。用法：`node gen-emboss.mjs <輸出目錄> <測試頁目錄>`。
- `gen.mjs`：生成方案 A 地圖和護照底紋的腳本（用簡化區界，M1 要換成官方區界）。
