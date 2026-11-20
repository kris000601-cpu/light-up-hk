// 「加到主畫面」：判斷現在是不是從主畫面打開、是甚麼手機，安卓 Chrome 還可以直接彈出安裝框。
import { useSyncExternalStore } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type Platform =
  | 'installed' // 已經從主畫面打開
  | 'ios' // iPhone / iPad 的瀏覽器
  | 'android'
  | 'inapp' // WhatsApp 以外的 App 內置瀏覽器（微信、Instagram、Facebook…），加不了主畫面
  | 'desktop'

const ua = navigator.userAgent
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
const isInApp = /MicroMessenger|Instagram|FBAN|FBAV|Line\//.test(ua)
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const platform = (): Platform =>
  standalone() ? 'installed' : isInApp ? 'inapp' : isIOS ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop'

// 安卓 Chrome 準備好可以安裝時會發這個事件；要先存起來，等用戶按按鈕才用
let deferred: InstallPromptEvent | null = null
let installedNow = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallPromptEvent
  notify()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  installedNow = true
  notify()
})

/** 安卓可以一鍵安裝時才有值；按下後回傳是否裝了 */
export function useInstallPrompt(): { canPrompt: boolean; installedNow: boolean; prompt: () => Promise<boolean> } {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => (deferred ? 1 : 0) + (installedNow ? 2 : 0),
  )
  return {
    canPrompt: (snap & 1) === 1,
    installedNow: (snap & 2) === 2,
    prompt: async () => {
      if (!deferred) return false
      const e = deferred
      deferred = null
      notify()
      await e.prompt()
      return (await e.userChoice).outcome === 'accepted'
    },
  }
}

// 首頁的提示按「稍後」之後，三天內不再出現
const KEY = 'install-hint-hidden-until'
export function hintHidden(): boolean {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}
export function hideHint(days = 3) {
  try {
    localStorage.setItem(KEY, String(Date.now() + days * 864e5))
  } catch {
    /* 存不了就算 */
  }
}
