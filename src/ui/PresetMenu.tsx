import { useEffect, useRef, useState } from 'react'
import { PRESETS, type Preset } from '../patch/presets'
import { actions, patchStore } from '../patch/store'

const LIST_WIDTH = 360

/** Top-bar dropdown of preset racks. Loading one replaces the rack (asks first
 *  unless the rack is empty). */
export function PresetMenu() {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const toggle = () => {
    // Open towards whichever side has room for the list.
    const r = root.current?.getBoundingClientRect()
    if (r) setAlignRight(r.left + LIST_WIDTH > window.innerWidth - 8)
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const load = (p: Preset) => {
    const empty = patchStore.get().modules.length === 0
    if (empty || confirm(`Load "${p.name}"? This replaces the current rack.`)) {
      actions.load(p.build())
      setOpen(false)
    }
  }

  return (
    <div className="preset-menu" ref={root}>
      <button className={open ? 'active' : ''} onClick={toggle}>
        Presets ▾
      </button>
      {open && (
        <div className="preset-list" style={alignRight ? { right: 0 } : { left: 0 }}>
          {PRESETS.map((p) => (
            <button key={p.id} className="preset-item" onClick={() => load(p)}>
              <span className="preset-name">{p.name}</span>
              <span className="preset-desc">{p.description}</span>
              <span className="preset-how">{p.howTo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
