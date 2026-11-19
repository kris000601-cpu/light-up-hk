import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { MapPage } from './pages/MapPage'
import { MePage } from './pages/MePage'
import { StampPreview } from './pages/StampPreview'

// 內部預覽：網址加 ?stamps=preview 看 8 個章面圖案（App 裏沒有入口）
const PREVIEW = new URLSearchParams(window.location.search).get('stamps') === 'preview'

export default function App() {
  const [tab, setTab] = useState<Tab>('map')
  if (PREVIEW) return <StampPreview />

  return (
    <div className="app">
      <main className="page">
        {tab === 'map' && <MapPage />}
        {tab === 'me' && <MePage />}
        {tab === 'book' && (
          <>
            <h1 className="app-title">印章冊</h1>
            <p className="placeholder">你蓋過的景點章會收在這裏。</p>
          </>
        )}
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  )
}
