// 隱藏的測試模式：在「我的」頁連按版本號 5 下開關。只給開發和試用時用，一般用戶不會碰到。
import { useSyncExternalStore } from 'react'

const KEY = 'test-mode'
const listeners = new Set<() => void>()
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
let on = read()

export function setTestMode(v: boolean) {
  on = v
  try {
    if (v) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* 存不了就只在這次有效 */
  }
  listeners.forEach((l) => l())
}

export function useTestMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => on,
  )
}
