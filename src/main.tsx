import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// 離線副本（Service Worker）：發現新版本就換上並自動重新載入，免得手機一直跑舊版。
// 除了打開時檢查，App 從後台回到前台、或一直開着每小時也檢查一次。
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => {
      if (navigator.onLine) reg.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    setInterval(check, 60 * 60 * 1000)
  },
})

// iPhone Safari 不理會 user-scalable=no，要另外擋住它自己的捏合縮放（地圖縮放用的是觸摸事件，不受影響）
document.addEventListener('gesturestart', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
