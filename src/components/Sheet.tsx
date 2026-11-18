import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  label: string
  onClose: () => void
  children: ReactNode
}

/** 從底部彈出的面板：點背景或按 Esc 關閉 */
export function Sheet({ open, label, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panel}>
        <span className="sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}
