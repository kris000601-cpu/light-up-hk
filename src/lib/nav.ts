// 跨分頁跳轉：例如在區詳情按一個蓋過章的景點，跳到印章冊的那一頁；首頁的備份提示跳到「我的」頁的備份
import { useSyncExternalStore } from 'react'
import type { Tab } from '../components/TabBar'

export interface NavRequest {
  tab: Tab
  /** 印章冊要翻到的景點 */
  spotId?: string
  /** 頁面裏要捲到的位置（元素 id） */
  anchor?: string
}

let req: NavRequest | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function navigate(r: NavRequest) {
  req = r
  emit()
}
export const openBook = (spotId: string) => navigate({ tab: 'book', spotId })

/** 處理完就清掉，免得下次切回那一頁又跳一次 */
export function clearNav() {
  if (!req) return
  req = null
  emit()
}

export function useNavRequest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => req,
  )
}
