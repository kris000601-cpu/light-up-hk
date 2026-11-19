// 印章存在手機裏（IndexedDB），不上網。
//
// 每蓋一次存一條記錄；同一景點再去可以再蓋（疊蓋），所以一個景點可以有多條。
// 記錄裏另存一份景點名和區名：以後景點清單改了，舊章仍然知道自己是甚麼。
// 每條記錄有全球唯一的 uid：以後導入備份、同步到網上時，靠它認出「這個章已經有了」。
import { useSyncExternalStore } from 'react'

export interface Stamp {
  /** 這部手機裏的自動編號（只在本機有意義） */
  id: number
  /** 全球唯一身份碼，跨手機 / 備份 / 同步都不變 */
  uid: string
  /** 第幾枚（章面上的 No.）：蓋的時候定下，以後不變；測試章不佔號 */
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
  /** 測試模式蓋的章：只在測試模式開着時才算進進度，可以一鍵清走 */
  test?: boolean
}

export type NewStamp = Omit<Stamp, 'id' | 'uid' | 'no' | 'at'>

const DB_NAME = 'light-up-hk'
const DB_VERSION = 2
const STORE = 'stamps'

interface State {
  ready: boolean
  stamps: Stamp[]
  /** 讀不到 / 存不了時的原因 */
  error: string | null
}

let state: State = { ready: false, stamps: [], error: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const d = req.result
      const store = e.oldVersion < 1 ? d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }) : req.transaction!.objectStore(STORE)
      if (e.oldVersion < 1) store.createIndex('spotId', 'spotId')
      if (e.oldVersion < 2) {
        // v2：舊記錄補上 uid
        store.openCursor().onsuccess = (ev) => {
          const cur = (ev.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!cur) return
          if (!cur.value.uid) cur.update({ ...cur.value, uid: uuid() })
          cur.continue()
        }
        store.createIndex('uid', 'uid', { unique: true })
      }
    }
    req.onsuccess = () => {
      const d = req.result
      // 另一個分頁要升級數據庫時，讓出來，下次用到再重新打開
      d.onversionchange = () => {
        d.close()
        dbPromise = null
      }
      resolve(d)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('blocked'))
  }).catch((err) => {
    dbPromise = null // 打不開不要記住失敗，下次再試
    throw err
  })
  return dbPromise
}

/** 在一個交易裏做事；交易真正寫進去之後才算成功 */
function transact<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore, done: (v: T) => void) => void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        let value: T
        run(t.objectStore(STORE), (v) => (value = v))
        t.oncomplete = () => resolve(value)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error ?? new Error('abort'))
      }),
  )
}

const byTime = (a: Stamp, b: Stamp) => a.at - b.at || a.id - b.id
const READ_ERROR = '讀取不到印章。如果開了無痕模式，請改用一般模式打開；否則按「再試一次」。'

/** 從數據庫重新讀一次（打開 App、回到前台、出錯重試時） */
export async function reloadStamps() {
  try {
    const all = await transact<Stamp[]>('readonly', (s, done) => {
      s.getAll().onsuccess = (e) => done((e.target as IDBRequest<Stamp[]>).result)
    })
    set({ ready: true, stamps: all.sort(byTime), error: null })
    // 之前沒批的，這次可能會批（例如剛加到主畫面）
    if (all.length) requestPersist()
  } catch {
    set({ ready: true, error: READ_ERROR })
  }
}
reloadStamps()
// 在另一個分頁蓋了章、或 App 在後台放了很久：回來時重讀，免得各看各的
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reloadStamps()
})

/** 蓋一個章；寫進手機成功才回傳，失敗會拋出錯誤（由蓋章頁提示重試） */
export async function addStamp(s: NewStamp): Promise<Stamp> {
  const stamp = await transact<Stamp>('readwrite', (store, done) => {
    // 編號在同一個交易裏數：兩個分頁同時蓋也不會撞號；清走測試章也不會影響
    store.getAll().onsuccess = (e) => {
      const all = (e.target as IDBRequest<Stamp[]>).result
      const no = all.reduce((m, x) => (x.test ? m : Math.max(m, x.no)), 0) + 1
      const rec = { ...s, uid: uuid(), no, at: Date.now() }
      store.add(rec).onsuccess = (ev) => done({ ...rec, id: Number((ev.target as IDBRequest).result) })
    }
  })
  await reloadStamps()
  // 有章了才申請「持久儲存」：瀏覽器空間不夠時不要清走印章
  requestPersist()
  return stamp
}

/** 清走所有測試章 */
export async function clearTestStamps() {
  await transact<void>('readwrite', (store, done) => {
    store.openCursor().onsuccess = (e) => {
      const cur = (e.target as IDBRequest<IDBCursorWithValue | null>).result
      if (!cur) return done()
      if (cur.value.test) cur.delete()
      cur.continue()
    }
  })
  await reloadStamps()
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
