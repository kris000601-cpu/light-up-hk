// 印章存在手機裏（IndexedDB），不上網。
//
// 每蓋一次存一條記錄；同一景點再去可以再蓋（疊蓋），所以一個景點可以有多條。
// 記錄裏另存一份景點名和區名：以後景點清單改了，舊章仍然知道自己是甚麼。
import { useSyncExternalStore } from 'react'

export interface Stamp {
  /** 數據庫自動編的號 */
  id: number
  /** 第幾枚（章面上的 No.），蓋的時候定下，以後不變 */
  no: number
  spotId: string
  spotName: string
  district: string
  /** 蓋章時間（毫秒） */
  at: number
  /** 蓋章時的位置和定位誤差（米）；測試章沒有 */
  lat?: number
  lng?: number
  acc?: number
  /** 測試模式蓋的章，可以一鍵清走 */
  test?: boolean
}

export type NewStamp = Omit<Stamp, 'id' | 'no' | 'at'>

const DB_NAME = 'light-up-hk'
const STORE = 'stamps'

interface State {
  ready: boolean
  stamps: Stamp[]
  /** 存不了（例如無痕模式）時的原因 */
  error: string | null
}

let state: State = { ready: false, stamps: [], error: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      s.createIndex('spotId', 'spotId')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('blocked'))
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        t.oncomplete = () => resolve(req.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

const byTime = (a: Stamp, b: Stamp) => a.at - b.at || a.id - b.id

async function load() {
  try {
    const all = await tx<Stamp[]>('readonly', (s) => s.getAll())
    set({ ready: true, stamps: all.sort(byTime), error: null })
    // 之前沒批的，這次可能會批（例如剛加到主畫面）
    if (all.length) requestPersist()
  } catch {
    set({ ready: true, error: '這個瀏覽器存不了印章（可能開了無痕模式）。請用一般模式打開。' })
  }
}
load()

/** 蓋一個章，回傳存好的記錄 */
export async function addStamp(s: NewStamp): Promise<Stamp> {
  const rec = { ...s, no: state.stamps.length + 1, at: Date.now() }
  const id = await tx<IDBValidKey>('readwrite', (st) => st.add(rec))
  const stamp = { ...rec, id: Number(id) }
  set({ stamps: [...state.stamps, stamp].sort(byTime) })
  // 有章了才申請「持久儲存」：瀏覽器空間不夠時不要清走印章
  requestPersist()
  return stamp
}

/** 清走所有測試章 */
export async function clearTestStamps() {
  const tests = state.stamps.filter((s) => s.test)
  await db().then(
    (d) =>
      new Promise<void>((resolve, reject) => {
        const t = d.transaction(STORE, 'readwrite')
        for (const s of tests) t.objectStore(STORE).delete(s.id)
        t.oncomplete = () => resolve()
        t.onerror = () => reject(t.error)
      }),
  )
  set({ stamps: state.stamps.filter((s) => !s.test) })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStamps(): State {
  return useSyncExternalStore(subscribe, () => state)
}

// ---------- 持久儲存 ----------
// 瀏覽器預設的儲存是「盡量保留」：手機空間不夠、或 iPhone 上很久沒打開，可能被清走。
// 申請成「持久」之後，除非用戶自己清，否則不會被刪。
// 不是每個瀏覽器都會批：安卓 Chrome 通常加到主畫面或常用就批；iPhone 要加到主畫面。

export type Persist = 'yes' | 'no' | 'unsupported'
let persist: Persist = 'no'
const persistListeners = new Set<() => void>()
const setPersist = (p: Persist) => {
  persist = p
  persistListeners.forEach((l) => l())
}

async function checkPersist() {
  if (!navigator.storage?.persisted) return setPersist('unsupported')
  try {
    setPersist((await navigator.storage.persisted()) ? 'yes' : 'no')
  } catch {
    setPersist('unsupported')
  }
}
checkPersist()

export async function requestPersist() {
  if (persist === 'yes' || !navigator.storage?.persist) return
  try {
    setPersist((await navigator.storage.persist()) ? 'yes' : 'no')
  } catch {
    /* 不批就算了，下次蓋章再試 */
  }
}

export function usePersist(): Persist {
  return useSyncExternalStore(
    (l) => {
      persistListeners.add(l)
      return () => persistListeners.delete(l)
    },
    () => persist,
  )
}
