// 讀一次位置：只在用戶按「我在哪」時開始，最多 10 秒，拿到夠準的位置就停，不在背景追蹤。
//
// 為甚麼不是只讀一下：手機剛開始定位時，第一個結果常常只靠 Wi-Fi / 基站，誤差幾百米；
// 多等幾秒 GPS 對準了才準。所以在這 10 秒內留下最準的一個，夠準（≤ 30 米）就提早結束。

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
/** 位置的有效期：超過就要再按一次「我在哪」 */
export const FIX_TTL = 5 * 60 * 1000

const GOOD_ENOUGH = 30
const MAX_WAIT = 10_000

/** onProgress：每讀到一次（越來越準）就報告目前最好的誤差，給畫面畫「越縮越小的圈」 */
export function locate(onProgress?: (acc: number) => void): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('unsupported' satisfies LocateError)
    let best: Fix | null = null
    let done = false
    const finish = (err?: LocateError) => {
      if (done) return
      done = true
      navigator.geolocation.clearWatch(id)
      clearTimeout(timer)
      if (best) resolve(best)
      else reject(err ?? 'timeout')
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() }
        if (!best || fix.acc <= best.acc) best = fix
        onProgress?.(best.acc)
        if (fix.acc <= GOOD_ENOUGH) finish()
      },
      (e) => {
        // 拒絕權限要馬上停；其他錯誤如果已經有位置就用它
        if (e.code === e.PERMISSION_DENIED) finish('denied')
        else if (e.code === e.POSITION_UNAVAILABLE) finish('unavailable')
        else finish('timeout')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT },
    )
    const timer = setTimeout(() => finish('timeout'), MAX_WAIT + 500)
  })
}

/** 「120 米」「3.2 公里」 */
export function formatDistance(m: number): { num: string; unit: string } {
  if (m < 1000) return { num: String(Math.max(10, Math.round(m / 10) * 10)), unit: '米' }
  return { num: (m / 1000).toFixed(m < 10_000 ? 1 : 0), unit: '公里' }
}
