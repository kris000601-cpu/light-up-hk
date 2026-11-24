// 手機裏的數據庫（IndexedDB）：印章（stamps）和點亮的地方（lit）。不上網。
//
// 版本記錄（只能往上加，每一步都要能從舊版升上來，關係到用戶已經蓋的章）：
// · v1：stamps 表（自增 id，按 spotId 索引）
// · v2：每枚章補上全球唯一的 uid（舊記錄在升級時補）
// · v3（M3，2026-11-24）：lit 表，一個地方一條（keyPath = place）
const DB_NAME = 'light-up-hk'
const DB_VERSION = 3
export const STAMPS = 'stamps'
export const LIT = 'lit'
export type StoreName = typeof STAMPS | typeof LIT

export function uuid(): string {
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
      const store = e.oldVersion < 1 ? d.createObjectStore(STAMPS, { keyPath: 'id', autoIncrement: true }) : req.transaction!.objectStore(STAMPS)
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
      // v3：點亮的地方
      if (e.oldVersion < 3) d.createObjectStore(LIT, { keyPath: 'place' })
    }
    req.onsuccess = () => {
      const d = req.result
      // 另一個分頁要升級數據庫時，讓出來，下次用到再重新打開
      d.onversionchange = () => {
        d.close()
        dbPromise = null
      }
      // iPhone 把 App 放到後台久了，系統可能把數據庫連接關掉：下次用到時重新打開
      d.onclose = () => {
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

type Stores<N extends StoreName[]> = { [K in keyof N]: IDBObjectStore }

/** 在一個交易裏做事（可以同時用幾個表）；交易真正寫進去之後才算成功 */
export function transact<T, N extends StoreName[]>(names: [...N], mode: IDBTransactionMode, run: (stores: Stores<N>, done: (v: T) => void) => void, retried = false): Promise<T> {
  return db().then((d) => {
    let t: IDBTransaction
    try {
      t = d.transaction(names, mode)
    } catch (err) {
      // 連接已經斷了（例如 iPhone 在後台關掉了它）：交易還沒開始、甚麼都沒寫，重新打開再試一次是安全的
      dbPromise = null
      if (retried) throw err
      return transact(names, mode, run, true)
    }
    return new Promise<T>((resolve, reject) => {
      let value: T
      run(names.map((n) => t.objectStore(n)) as Stores<N>, (v) => (value = v))
      t.oncomplete = () => resolve(value)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error ?? new Error('abort'))
    })
  })
}

/** 設計稿截圖用：網址加 ?mock=1 時不讀也不寫數據庫 */
export const MOCK = new URLSearchParams(window.location.search).get('mock') === '1'
