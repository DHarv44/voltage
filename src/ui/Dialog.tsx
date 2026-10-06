import { useEffect, type ReactNode } from 'react'

export interface DialogAction {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  /** Why it's disabled (or a word about what it does), under the buttons. */
  note?: string
}

/** A small centred question: a title, a message, the choices, and Cancel
 *  (also Escape, or a click outside). Choosing anything closes it. */
export function Dialog({ title, children, actions, onCancel }: { title: string; children?: ReactNode; actions: DialogAction[]; onCancel: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])
  const notes = actions.filter((a) => a.note)
  return (
    <div className="dialog-backdrop" onPointerDown={onCancel}>
      <div className="dialog" role="dialog" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        {children && <div className="dialog-body">{children}</div>}
        {notes.map((a) => (
          <div key={a.label} className="dialog-note">
            {a.note}
          </div>
        ))}
        <div className="dialog-actions">
          {actions.map((a) => (
            <button
              key={a.label}
              className={a.danger ? 'danger' : ''}
              disabled={a.disabled}
              onClick={() => {
                a.onClick()
                onCancel()
              }}
            >
              {a.label}
            </button>
          ))}
          <button onClick={onCancel} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
