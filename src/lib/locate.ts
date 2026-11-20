// 讀一次位置：只在用戶按首頁正中那一點時開始，最多 10 秒，拿到夠準的位置就停，不在背景追蹤。
//
// 為甚麼不是只讀一下：手機剛開始定位時，第一個結果常常只靠 Wi-Fi / 基站，誤差幾百米；
// 多等幾秒 GPS 對準了才準。所以留下最準的一個：
// · 夠準（≤ 30 米）→ 馬上停；
// · 過了 4 秒，已經有可以蓋章的位置（≤ 100 米）→ 停。在室內收不到衛星，誤差會一直停在 60 米左右，
//   iPhone 位置不變時也不再報新的位置，以前會白等滿 10 秒（Chris 2026-11-20 在家裏試，按了十幾秒才出來）；
// · 都沒有 → 最多等 10 秒。

export interface Fix {
  lat: number
  lng: number
  /** 誤差（米） */
  acc: number
  /** 讀到的時間（毫秒） */
  at: number
  /** 測試模式假裝的位置：用它蓋的章一律算測試章 */
  fake?: boolean
}

export type LocateError = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

/** 誤差超過這個就不給蓋章（請用戶再試） */
export const ACC_LIMIT = 100
/** 位置的有效期：超過就要再按一次 */
export const FIX_TTL = 5 * 60 * 1000

const GOOD_ENOUGH = 30
/** 過了這麼久，有可以蓋章的位置就不再等 */
export const SETTLE = 4_000
const MAX_WAIT = 10_000

export function locate(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('unsupported' satisfies LocateError)
    const started = Date.now()
    let best: Fix | null = null
    let done = false
    const finish = (err?: LocateError) => {
      if (done) return
      done = true
      navigator.geolocation.clearWatch(id)
      clearTimeout(settle)
      clearTimeout(timer)
      if (best) resolve(best)
      else reject(err ?? 'timeout')
    }
    const enough = () => !!best && (best.acc <= GOOD_ENOUGH || (Date.now() - started >= SETTLE && best.acc <= ACC_LIMIT))
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() }
        if (!best || fix.acc <= best.acc) best = fix
        if (enough()) finish()
      },
      (e) => {
        // 拒絕權限要馬上停；其他錯誤如果已經有位置就用它
        if (e.code === e.PERMISSION_DENIED) finish('denied')
        else if (e.code === e.POSITION_UNAVAILABLE) finish('unavailable')
        else finish('timeout')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT },
    )
    const settle = setTimeout(() => {
      if (enough()) finish()
    }, SETTLE)
    const timer = setTimeout(() => finish('timeout'), MAX_WAIT + 500)
  })
}

/** 「120 米」「3.2 公里」 */
export function formatDistance(m: number): { num: string; unit: string } {
  if (m < 1000) return { num: String(Math.max(10, Math.round(m / 10) * 10)), unit: '米' }
  return { num: (m / 1000).toFixed(m < 10_000 ? 1 : 0), unit: '公里' }
}
