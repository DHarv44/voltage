import { useEffect, type ReactNode } from 'react'

/** A centred panel for things bigger than a menu (My racks, Share, devices):
 *  a title, its content, ✕ / Escape / a click outside to close. */
export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="dialog-backdrop" onPointerDown={onClose}>
      <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
