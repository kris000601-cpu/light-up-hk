import type { ReactNode } from 'react'

export type Tab = 'map' | 'book' | 'me'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
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

export function TabBar({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
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
