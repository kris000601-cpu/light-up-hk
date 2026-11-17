import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'

const PAGES: Record<Tab, { title: string; body: string }> = {
  map: {
    title: '點亮香港',
    body: '十八區地圖即將在這裏出現。',
  },
  book: {
    title: '我的印章冊',
    body: '你蓋過的區章和景點章會收在這裏。',
  },
  me: {
    title: '我的',
    body: '個人資料和設定。',
  },
}

export default function App() {
  const [tab, setTab] = useState<Tab>('map')
  const page = PAGES[tab]

  return (
    <div className="app">
      <main className="page">
        <h1 className="page-title">{page.title}</h1>
        <p className="placeholder">{page.body}</p>
        {tab === 'map' && (
          <div className="progress" aria-label="已點亮 0 / 18 區">
            <div className="progress-count">
              <span className="big-number">0</span>
              <span className="muted">/ 18 區已點亮</span>
            </div>
            <div className="progress-bar" aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          </div>
        )}
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  )
}
