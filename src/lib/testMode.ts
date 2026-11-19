// 隱藏的測試模式：在「我的」頁連按版本號 5 下開關。只給開發和試用時用，一般用戶不會碰到。
// 測試模式裏可以「假裝在某景點」：按「我在哪」時不讀 GPS，直接用假位置；用假位置蓋的章一律是測試章。
import { useSyncExternalStore } from 'react'

export interface FakeLocation {
  lat: number
  lng: number
  acc: number
  /** 顯示用，例如「太平山頂 · 獅子亭」 */
  label: string
}

interface TestState {
  on: boolean
  fake: FakeLocation | null
}

const KEY = 'test-mode'
const FAKE_KEY = 'test-fake-location'
const listeners = new Set<() => void>()

function read(): TestState {
  try {
    const on = localStorage.getItem(KEY) === '1'
    const raw = localStorage.getItem(FAKE_KEY)
    return { on, fake: on && raw ? (JSON.parse(raw) as FakeLocation) : null }
  } catch {
    return { on: false, fake: null }
  }
}
let state = read()

function save(next: TestState) {
  state = next
  try {
    if (next.on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
    if (next.fake) localStorage.setItem(FAKE_KEY, JSON.stringify(next.fake))
    else localStorage.removeItem(FAKE_KEY)
  } catch {
    /* 存不了就只在這次有效 */
  }
  listeners.forEach((l) => l())
}

/** 關掉測試模式時，假位置也一起取消 */
export const setTestMode = (on: boolean) => save({ on, fake: on ? state.fake : null })
export const setFakeLocation = (fake: FakeLocation | null) => save({ ...state, fake })

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTestMode(): boolean {
  return useSyncExternalStore(subscribe, () => state.on)
}

export function useFakeLocation(): FakeLocation | null {
  return useSyncExternalStore(subscribe, () => state.fake)
}

export const getFakeLocation = () => state.fake
