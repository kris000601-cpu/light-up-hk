// 讀位置：只在用戶按首頁正中那一點時開始，一次最多 10 秒，不在背景追蹤。
//
// 「先出結果，再悄悄變準」（Chris 2026-11-20 定，跟 Google 地圖、Uber 一樣）：
// · 手機一按，大約 1 秒就有第一個位置（靠 Wi-Fi / 基站），誤差幾十到幾百米。只要 ≤ 100 米（夠判斷能不能蓋）
//   就馬上交出去，畫面立刻出結果；訊號差時，1.5 秒有 ≤ 300 米的也先交（夠看附近有甚麼，畫面寫「誤差太大」），
//   4 秒還是沒有就交目前最好的那個。
// · 同一次按壓裏繼續讀，每變準一次再交一次，畫面在原地更新；夠準（≤ 30 米）或者 10 秒到就停。
// 以前要等到夠準才出結果：在室內收不到衛星，誤差一直停在 60 米左右，iPhone 位置不變時也不再報新位置，
// 要白等 4～10 秒，Chris 在家裏試以為卡住了。

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
/** 訊號差：這麼久之後，誤差 ≤ ROUGH_ACC 米的位置也先交（夠看附近有甚麼，還不能蓋） */
const ROUGH_AFTER = 1_500
const ROUGH_ACC = 300
/** 這麼久還沒有交出位置，就交目前最好的 */
export const SETTLE = 4_000
const MAX_WAIT = 10_000

export interface LocateHandlers {
  /** 第一個可以用的位置，和之後每一次變準（一次比一次準） */
  onFix: (fix: Fix) => void
  /** 讀完了（夠準 / 10 秒到 / 中途出錯但已經有位置）：傳回最準的那個 */
  onDone: (best: Fix) => void
  /** 一個位置都讀不到 */
  onError: (err: LocateError) => void
}

/** 開始讀位置。傳回「取消」：再按一次、或者離開時用，取消後不會再叫任何 handler */
export function startLocate(h: LocateHandlers): () => void {
  if (!navigator.geolocation) {
    h.onError('unsupported')
    return () => {}
  }
  const started = Date.now()
  let best: Fix | null = null
  let shown = false
  let done = false
  /** 現在交得出去嗎：夠判斷蓋章的馬上交；粗一點的等一下才交 */
  const showable = () => {
    if (!best) return false
    const t = Date.now() - started
    return best.acc <= ACC_LIMIT || (t >= ROUGH_AFTER && best.acc <= ROUGH_ACC) || t >= SETTLE
  }
  const show = () => {
    if (!best) return
    shown = true
    h.onFix(best)
  }
  const end = () => {
    done = true
    navigator.geolocation.clearWatch(id)
    clearTimeout(rough)
    clearTimeout(settle)
    clearTimeout(timer)
  }
  const finish = (err?: LocateError) => {
    if (done) return
    end()
    if (best) {
      if (!shown) show()
      h.onDone(best)
    } else h.onError(err ?? 'timeout')
  }
  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (done) return
      const fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() }
      if (best && fix.acc >= best.acc) return
      best = fix
      if (shown || showable()) show()
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
  const rough = setTimeout(() => {
    if (!done && !shown && showable()) show()
  }, ROUGH_AFTER)
  const settle = setTimeout(() => {
    if (!done && !shown) show()
  }, SETTLE)
  const timer = setTimeout(() => finish('timeout'), MAX_WAIT + 500)
  return () => {
    if (!done) end()
  }
}

/** 「120 米」「3.2 公里」 */
export function formatDistance(m: number): { num: string; unit: string } {
  if (m < 1000) return { num: String(Math.max(10, Math.round(m / 10) * 10)), unit: '米' }
  return { num: (m / 1000).toFixed(m < 10_000 ? 1 : 0), unit: '公里' }
}
