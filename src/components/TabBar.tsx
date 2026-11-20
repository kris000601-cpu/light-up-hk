import type { ReactNode } from 'react'

export type Tab = 'here' | 'map' | 'book' | 'me'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'here',
    label: '蓋章',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: '地圖',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    ),
  },
  {
    id: 'book',
    label: '印章冊',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4z" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    id: 'me',
    label: '我的',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
]

/** items：顯示哪幾格（預設地圖 / 印章冊 / 我的）；hidden：新首頁剛打開時先藏起來（仍然佔位，浮現時版面不跳） */
export function TabBar({ current, onChange, items = ['map', 'book', 'me'], hidden }: { current: Tab; onChange: (tab: Tab) => void; items?: Tab[]; hidden?: boolean }) {
  return (
    <nav className={hidden ? 'tabbar off' : 'tabbar'} inert={hidden} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {TABS.filter((t) => items.includes(t.id)).map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.id === current ? 'tab active' : 'tab'}
          aria-current={t.id === current ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  )
}
