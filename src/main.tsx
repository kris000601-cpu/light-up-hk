import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { startUpdates } from './lib/updates'

startUpdates()

// iPhone Safari 不理會 user-scalable=no，要另外擋住它自己的捏合縮放（地圖縮放用的是觸摸事件，不受影響）
document.addEventListener('gesturestart', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
