import { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { MapPage } from './pages/MapPage'
import { MePage } from './pages/MePage'
import { BookPage } from './pages/BookPage'
import { StampPreview } from './pages/StampPreview'
import { mockStamps } from './lib/stamps'
import { MOCK_STAMPS } from './lib/mockData'
import { useBookTarget } from './lib/nav'

const params = new URLSearchParams(window.location.search)
// 內部預覽：網址加 ?stamps=preview 看 8 個章面圖案（App 裏沒有入口）
const PREVIEW = params.get('stamps') === 'preview'
// 設計稿截圖：?mock=1 用假印章；?tab=book 直接打開印章冊
if (params.get('mock') === '1') {
  mockStamps(MOCK_STAMPS)
  document.documentElement.classList.add('mock') // 截圖時不要動畫
}
const TAB0: Tab = params.get('tab') === 'book' ? 'book' : params.get('tab') === 'me' ? 'me' : 'map'

export default function App() {
  const [tab, setTab] = useState<Tab>(TAB0)
  // 區詳情按一個蓋過章的景點 → 切到印章冊（印章冊自己翻到那一頁）
  const target = useBookTarget()
  useEffect(() => {
    if (target) setTab('book')
  }, [target])
  if (PREVIEW) return <StampPreview />

  return (
    <div className="app">
      <main className="page">
        {tab === 'map' && <MapPage />}
        {tab === 'me' && <MePage />}
        {tab === 'book' && <BookPage />}
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  )
}
