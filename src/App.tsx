import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { MapPage } from './pages/MapPage'
import { MePage } from './pages/MePage'

export default function App() {
  const [tab, setTab] = useState<Tab>('map')

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
