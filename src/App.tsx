import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { MapPage } from './pages/MapPage'

const PLACEHOLDER: Record<Exclude<Tab, 'map'>, { title: string; body: string }> = {
  book: { title: '印章冊', body: '你蓋過的景點章會收在這裏。' },
  me: { title: '我的', body: '個人資料和設定。' },
}

export default function App() {
  const [tab, setTab] = useState<Tab>('map')

  return (
    <div className="app">
      <main className="page">
        {tab === 'map' ? (
          <MapPage />
        ) : (
          <>
            <h1 className="app-title">{PLACEHOLDER[tab].title}</h1>
            <p className="placeholder">{PLACEHOLDER[tab].body}</p>
          </>
        )}
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  )
}
