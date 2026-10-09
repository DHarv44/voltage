import { useEffect, useRef, useState } from 'react'
import { patchLibrary, useLibrary } from '../patch/library'
import { HistoryList } from './HistoryList'
import { PRESETS } from '../patch/presets'
import { actions, patchStore } from '../patch/store'
import type { Patch } from '../patch/types'

const LIST_WIDTH = 360

/** Top-bar dropdown: your saved patches (save / load / delete) and the factory
 *  presets. Loading replaces the rack; Ctrl+Z brings the old one back. */
export function PresetMenu() {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const mine = useLibrary()

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

  const load = (p: Patch) => {
    actions.load(structuredClone(p))
    setOpen(false)
  }

  const saveCurrent = () => {
    const name = prompt('Save this rack as:')?.trim()
    if (!name) return
    if (patchLibrary.has(name) && !confirm(`Overwrite "${name}"?`)) return
    if (!patchLibrary.save(name, structuredClone(patchStore.get()))) alert('Could not save: browser storage is full or blocked.')
  }

  return (
    <div className="preset-menu" ref={root}>
      <button className={open ? 'active' : ''} onClick={toggle}>
        Patches ▾
      </button>
      {open && (
        <div className="preset-list" style={alignRight ? { right: 0 } : { left: 0 }}>
          <div className="preset-group">My patches</div>
          <button className="preset-item save" onClick={saveCurrent}>
            <span className="preset-name">＋ Save current rack…</span>
          </button>
          {mine.map((e) => (
            <div key={e.name} className="preset-row">
              <button className="preset-item" onClick={() => load(e.patch)}>
                <span className="preset-name">{e.name}</span>
                <span className="preset-desc">
                  {e.patch.modules.length} modules · saved {new Date(e.savedAt).toLocaleString()}
                </span>
              </button>
              <button
                className="preset-del"
                title={`Delete "${e.name}"`}
                onClick={() => confirm(`Delete "${e.name}"?`) && patchLibrary.remove(e.name)}
              >
                ✕
              </button>
            </div>
          ))}
          <HistoryList onLoad={(v) => load(v.patch)} />
          <div className="preset-group">Factory presets</div>
          {PRESETS.map((p) => (
            <button key={p.id} className="preset-item" onClick={() => load(p.build())}>
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
