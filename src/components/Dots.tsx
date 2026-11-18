import type { Level } from '../lib/districts'

/** 一排小格：每格一個景點，蓋過的塗上該區的進度色 */
export function Dots({ visited, total, level }: { visited: number; total: number; level: Level }) {
  return (
    <span className="dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < visited ? `dot on level-${level}` : 'dot'} />
      ))}
    </span>
  )
}
