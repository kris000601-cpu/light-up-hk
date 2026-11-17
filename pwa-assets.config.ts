import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// 執行 npm run icons，由 public/favicon.svg 生成手機需要的各種尺寸圖示
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#F6F2E9' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#F6F2E9' } },
  },
  images: ['public/favicon.svg'],
})
