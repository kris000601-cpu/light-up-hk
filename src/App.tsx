import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { MapPage } from './pages/MapPage'
import { MePage } from './pages/MePage'
import { BookPage } from './pages/BookPage'
import { HOME_MOCK_REVEALED, HerePage } from './pages/HerePage'
import { StampPreview } from './pages/StampPreview'
import { mockStamps } from './lib/stamps'
import { MOCK_STAMPS } from './lib/mockData'
import { clearNav, useNavRequest } from './lib/nav'

const params = new URLSearchParams(window.location.search)
// 內部預覽：網址加 ?stamps=preview 看 8 個章面圖案（App 裏沒有入口）
const PREVIEW = params.get('stamps') === 'preview'
// 設計稿截圖：?mock=1 用假印章；?tab=book 直接打開印章冊
if (params.get('mock') === '1') {
  mockStamps(MOCK_STAMPS)
  document.documentElement.classList.add('mock') // 截圖時不要動畫
}
// 新首頁原型：?home=a。底部四格「蓋章 · 地圖 · 印章冊 · 我的」（導航方案二，Chris 2026-11-20 選定）
const HOME_A = params.get('home') === 'a'
const wantTab = params.get('tab')
const TAB0: Tab = wantTab === 'book' || wantTab === 'me' || wantTab === 'map' ? wantTab : HOME_A ? 'here' : 'map'

export default function App() {
  const [tab, setTab] = useState<Tab>(TAB0)
  // 新首頁：一打開只有正中一點，按了讀位置之後（成功或失敗）抬頭和底部導航才浮現；浮現過就不再藏
  const [revealed, setRevealed] = useState(!HOME_A || TAB0 !== 'here' || HOME_MOCK_REVEALED)
  const reveal = useCallback(() => setRevealed(true), [])
  // 跨分頁跳轉（區詳情 → 印章冊那一頁、首頁備份提示 → 我的）：切分頁，翻頁 / 捲動由那一頁自己處理
  const nav = useNavRequest()
  useEffect(() => {
    if (!nav) return
    setTab(nav.tab)
    // 只有「翻到某一頁」「捲到某處」要那一頁自己處理完再清
    if (!nav.spotId && !nav.anchor) clearNav()
  }, [nav])
  if (PREVIEW) return <StampPreview />

  return (
    <div className="app">
      <main className="page">
        {/* 首頁一直掛着（切到別的分頁時只是藏起來），回來時剛才的結果還在 */}
        {HOME_A && (
          <div className="home-slot" hidden={tab !== 'here'}>
            <HerePage active={tab === 'here'} revealed={revealed} onReveal={reveal} />
          </div>
        )}
        {tab === 'map' && <MapPage hideWhere={HOME_A} />}
        {tab === 'me' && <MePage />}
        {tab === 'book' && <BookPage />}
      </main>
      <TabBar current={tab} onChange={setTab} items={HOME_A ? ['here', 'map', 'book', 'me'] : undefined} hidden={!revealed} />
    </div>
  )
}
