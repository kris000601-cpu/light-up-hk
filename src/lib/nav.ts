// 跨分頁跳轉：例如在區詳情按一個蓋過章的景點，跳到印章冊的那一頁
import { useSyncExternalStore } from 'react'

let target: { spotId: string } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openBook(spotId: string) {
  target = { spotId }
  emit()
}

/** 印章冊翻到那一頁之後清掉，免得下次切回印章冊又跳過去 */
export function clearBookTarget() {
  if (!target) return
  target = null
  emit()
}

export function useBookTarget() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => target,
  )
}
