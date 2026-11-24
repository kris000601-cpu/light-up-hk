// 點亮的地方（M3，2026-11-20 Chris 定「選 B」）：
// 按首頁正中那一點讀位置時，人在哪一個「地方」就順手點亮那一塊——不加按鈕、不加字，地圖上悄悄變色。
// 蓋章仍是唯一的儀式；蓋了章，景點所在的地方也算亮（那部分由章推出來，見 districts.ts，不另外存）。
//
// 一個地方只存一條：第一次亮的時間。不存位置（私隱：以後朋友只看得到亮了哪些地方）。
// 測試模式用假位置點亮的帶 test 標記：只在測試模式開着時算，可以跟測試章一起清走。
import { useSyncExternalStore } from 'react'
import { LIT, MOCK, transact } from './db'

export interface Lit {
  /** 地方編號 p001… */
  place: string
  /** 第一次點亮的時間（毫秒） */
  at: number
  test?: boolean
}

interface State {
  ready: boolean
  lit: Lit[]
}

let state: State = { ready: MOCK, lit: [] }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

/**
 * 合併同一個地方的兩條記錄（導入備份、再次點亮時用）：回傳要寫進去的那條，不用改就回傳 null。
 * 真的去過的蓋過測試的；同是真的（或同是測試）留較早那次。
 */
export function mergeLit(mine: Lit | undefined, incoming: Lit): Lit | null {
  if (!mine) return incoming
  if (mine.test && !incoming.test) return { place: incoming.place, at: incoming.at }
  if (!mine.test && incoming.test) return null
  return incoming.at < mine.at ? { ...mine, at: incoming.at } : null
}

/** 從數據庫重新讀一次。截圖模式（?mock=1）不讀數據庫；dropTest：截圖模式下清走測試的 */
export async function reloadLit(opt: { dropTest?: boolean } = {}) {
  if (MOCK) {
    if (opt.dropTest) set({ lit: state.lit.filter((x) => !x.test) })
    return
  }
  try {
    const all = await transact<Lit[], [typeof LIT]>([LIT], 'readonly', ([s], done) => {
      s.getAll().onsuccess = (e) => done((e.target as IDBRequest<Lit[]>).result)
    })
    set({ ready: true, lit: all })
  } catch {
    // 讀不到就當沒有（印章那邊會提示讀取失敗、可以重試）
    set({ ready: true })
  }
}
if (!MOCK) reloadLit()
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reloadLit()
})

/** 截圖用的一套假記錄 */
export function mockLit(list: Lit[]) {
  set({ ready: true, lit: list })
}

/** 點亮一個地方（已經亮了就不動）。寫不進去不要緊：下次按再亮 */
export async function lightPlace(place: string, test: boolean): Promise<void> {
  const rec: Lit = test ? { place, at: Date.now(), test: true } : { place, at: Date.now() }
  if (MOCK) {
    const old = state.lit.find((x) => x.place === place)
    const next = mergeLit(old, rec)
    if (next) set({ lit: [...state.lit.filter((x) => x.place !== place), next] })
    return
  }
  try {
    await transact<void, [typeof LIT]>([LIT], 'readwrite', ([s], done) => {
      done()
      s.get(place).onsuccess = (e) => {
        const next = mergeLit((e.target as IDBRequest<Lit | undefined>).result, rec)
        if (next) s.put(next)
      }
    })
    await reloadLit()
  } catch {
    /* 寫不進去：這次不亮，下次按中間的點再試 */
  }
}

export function useLit(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
