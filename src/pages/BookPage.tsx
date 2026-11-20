// 印章冊（2026-11-20 Chris 選定「甲 · 翻頁護照」）：
// 打開就是一整頁，左右掃翻頁；每個景點一頁，按第一次來的先後排（跟蓋章頁頂部的「第 N 頁」一致）。
// 章按蓋的時候在紙上的位置和角度重現。右上「目錄」打開完整的一頁，看全部頁的小圖。
// 還差哪些景點，交給地圖和區詳情；印章冊只放「集到了甚麼」。
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCountedStamps } from '../lib/districts'
import { bookPages, type BookPage as Page } from '../lib/book'
import { clearNav, useNavRequest } from '../lib/nav'
import { reloadStamps, useStamps, type Stamp } from '../lib/stamps'
import { BookPaper, EmptyOct, PageBody } from '../components/BookPaper'

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

// 網址參數只用於截圖檢查：?page=s023 打開某景點那一頁，&toc=1 打開目錄
const params = new URLSearchParams(window.location.search)
/** 頁數多過這個就不畫圓點，改寫「3 / 87」 */
const MAX_DOTS = 15
/**
 * 目錄一打開只先畫頭四行（一屏），其餘每一下在下面補四行。
 * 章多了（例如 87 頁、170 個章）一次畫完，手機上要停半秒到一秒才出現；分批畫，一按就有。
 * 新的格子只加在下面，看着的那幾行不會動。
 */
const TILE_BATCH = 12

const toTop = () => document.querySelector('.page')?.scrollTo(0, 0)

export function BookPage() {
  const stamps = useCountedStamps()
  const pages = useMemo(() => bookPages(stamps), [stamps])
  const { ready, error } = useStamps()
  // 還在讀、或讀取出錯時，不要說「還沒有章」（會以為章不見了）
  if (!ready || error) return <EmptyBook loading={!ready} error={error} />
  if (!stamps.length) return <EmptyBook />
  return <Book stamps={stamps} pages={pages} />
}

function EmptyBook({ loading, error }: { loading?: boolean; error?: string | null } = {}) {
  return (
    <>
      <header className="book-head">
        <span className="eyebrow">遊歷護照 · 印章冊</span>
        <h1 className="app-title">印章冊</h1>
      </header>
      <div className="book-empty">
        <EmptyOct width={150} mark="" />
        {error ? (
          <p>
            {error}{' '}
            <button type="button" className="link" onClick={reloadStamps}>
              再試一次
            </button>
          </p>
        ) : loading ? (
          <p>讀取中…</p>
        ) : (
          <p>還沒有章。到了景點，在「蓋章」頁按一下中間的點，就可以蓋第一個章。</p>
        )}
      </div>
    </>
  )
}

function Book({ stamps, pages }: { stamps: Stamp[]; pages: Page[] }) {
  const nav = useNavRequest()
  const target = nav?.tab === 'book' && nav.spotId ? nav : null
  const [i, setI] = useState(() => {
    const want = target?.spotId ?? params.get('page') ?? stamps.at(-1)?.spotId
    return Math.max(0, pages.findIndex((p) => p.spotId === want))
  })
  const [toc, setToc] = useState(params.get('toc') === '1' && !target)
  const [shown, setShown] = useState(TILE_BATCH)
  const openToc = () => {
    setShown(TILE_BATCH)
    setToc(true)
  }
  // 目錄開着、還沒畫完：下一下再補一批
  useEffect(() => {
    if (!toc || shown >= pages.length) return
    const t = setTimeout(() => setShown((n) => n + TILE_BATCH), 16)
    return () => clearTimeout(t)
  }, [toc, shown, pages.length])
  // 頁數可能變少（例如清走了測試章）：一律用夾緊後的 idx
  const idx = Math.min(i, pages.length - 1)
  const p = pages[idx]
  const sx = useRef<{ x: number; y: number } | null>(null)
  const go = (j: number) => setI(Math.max(0, Math.min(pages.length - 1, j)))

  // 從區詳情跳過來：翻到那一頁
  useEffect(() => {
    if (!target) return
    const j = pages.findIndex((x) => x.spotId === target.spotId)
    if (j >= 0) setI(j)
    setToc(false)
    clearNav()
  }, [target, pages])

  // 目錄是完整的一頁：手機的「返回」手勢回到剛才那一頁，不離開 App
  useEffect(() => {
    if (!toc) return
    toTop()
    if (!history.state?.bookToc) history.pushState({ bookToc: true }, '')
    const onPop = () => setToc(false)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [toc])
  // 連按兩下返回不要退過頭
  const leaving = useRef(false)
  const closeToc = () => {
    if (leaving.current) return
    leaving.current = true
    setTimeout(() => (leaving.current = false), 1000)
    if (history.state?.bookToc) history.back()
    else setToc(false)
  }

  if (toc)
    return (
      <>
        <div className="toc-top">
          <button type="button" className="sp-back" onClick={closeToc} aria-label="返回">
            <Chevron dir="left" />
          </button>
          <span className="eyebrow">遊歷護照</span>
        </div>
        <header className="book-head">
          <div className="book-head-row">
            <h1 className="app-title">目錄</h1>
            <span className="book-stats">
              {pages.length} 頁 · {stamps.length} 個章
            </span>
          </div>
        </header>
        <ul className="toc-grid">
          {pages.slice(0, shown).map((x, j) => (
            <li key={x.spotId}>
              <button
                type="button"
                className={j === idx ? 'toc-tile on' : 'toc-tile'}
                aria-current={j === idx ? 'page' : undefined}
                onClick={() => {
                  go(j)
                  closeToc()
                  toTop()
                }}
              >
                <BookPaper stamps={x.stamps} lite className="tile-paper" />
                <span className="tile-no">第 {x.page} 頁</span>
                <span className="tile-name">{x.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </>
    )

  return (
    <>
      <div className="flip-top">
        <span className="flip-count">
          <span className="eyebrow">遊歷護照</span>
          第 {p.page} / {pages.length} 頁
        </span>
        <button type="button" className="flip-toc" onClick={openToc}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          目錄
        </button>
      </div>
      <div
        className="flip-page"
        onTouchStart={(e) => (sx.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!sx.current) return
          const dx = e.changedTouches[0].clientX - sx.current.x
          const dy = e.changedTouches[0].clientY - sx.current.y
          sx.current = null
          // 明顯是橫掃才翻頁（上下捲動不算）
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(idx + (dx < 0 ? 1 : -1))
        }}
      >
        {/* key：換頁時「逐個看」的狀態歸零 */}
        <PageBody key={p.spotId} name={p.name} area={p.spot?.area} district={p.district} stamps={p.stamps} />
      </div>
      <nav className="flip-nav" aria-label="翻頁">
        <button type="button" className="flip-btn" disabled={idx === 0} onClick={() => go(idx - 1)} aria-label="上一頁">
          <Chevron dir="left" />
        </button>
        {pages.length <= MAX_DOTS ? (
          <span className="flip-dots" aria-hidden="true">
            {pages.map((x, j) => (
              <span key={x.spotId} className={j === idx ? 'on' : undefined} />
            ))}
          </span>
        ) : (
          <span className="flip-of">
            {p.page} / {pages.length}
          </span>
        )}
        <button type="button" className="flip-btn" disabled={idx === pages.length - 1} onClick={() => go(idx + 1)} aria-label="下一頁">
          <Chevron dir="right" />
        </button>
      </nav>
      <p className="flip-hint">左右掃，翻到其他頁</p>
    </>
  )
}
