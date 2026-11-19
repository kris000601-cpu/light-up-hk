// 離線副本（Service Worker）的更新：發現新版本就換上，然後重新載入頁面，免得手機一直跑舊版。
// 正在蓋章時（蓋章頁開着）不重新載入，等蓋章頁關掉才載入，免得按到一半畫面突然刷新。
import { registerSW } from 'virtual:pwa-register'

let busy = 0
let reloadPending = false

const reloadNow = () => window.location.reload()

/** 蓋章頁打開時調用 hold()，關掉時調用它回傳的函數 */
export function holdUpdates(): () => void {
  busy++
  let released = false
  return () => {
    if (released) return
    released = true
    busy--
    if (busy === 0 && reloadPending) reloadNow()
  }
}

export function startUpdates() {
  registerSW({
    immediate: true,
    onNeedReload() {
      if (busy) reloadPending = true
      else reloadNow()
    },
    // 除了打開時檢查，App 從後台回到前台、或一直開着每小時也檢查一次
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
      setInterval(check, 60 * 60 * 1000)
    },
  })
}
