import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// GitHub Pages 的網址是 https://<用戶名>.github.io/<倉庫名>/
// 部署時由 GitHub Actions 傳入 BASE_PATH=/<倉庫名>/；本機開發用 /
const base = process.env.BASE_PATH ?? '/'

// 版本標記：提交編號 + 打包時間（香港時間），顯示在「我的」頁底部，方便確認手機跑的是哪一版
let sha = process.env.GITHUB_SHA ?? ''
try {
  sha ||= execSync('git rev-parse HEAD').toString()
} catch {
  sha = 'local'
}
const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  .format(new Date())
  .replace(/(\d+)\/(\d+), /, '$2.$1 ')
const BUILD = `${sha.trim().slice(0, 7)} · ${when}`

export default defineConfig({
  base,
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '點亮香港',
        short_name: '點亮香港',
        description: '在香港十八區現場蓋章，把地圖一塊塊點亮。',
        lang: 'zh-Hant-HK',
        theme_color: '#F3EDDF',
        background_color: '#F3EDDF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // public/check/ 是內部的景點核對頁，不屬於 App：不預先緩存，也不要被 App 的離線頁面接管
        globIgnores: ['check/**'],
        navigateFallbackDenylist: [/\/check\//],
        // Google Fonts 的字體檔：第一次載入後存起來，之後離線也能用
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
