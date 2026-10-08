import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { buildSong, SONGS, type Song } from '../patch/songs'
import { actions } from '../patch/store'
import { toast } from './Toast'

const LIST_WIDTH = 380

/** Top-bar dropdown: whole tracks in the style of an era (the rack that plays
 *  each one). Loading replaces the rack; Ctrl+Z brings yours back. */
export function SongMenu() {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const toggle = () => {
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

  const load = (s: Song) => {
    actions.load(buildSong(s))
    setOpen(false)
    const power = engine.getStatus().power ? '' : ' Turn the POWER on to hear it.'
    toast.show(`${s.name} (${s.year})`, `${s.howTo}${power} (Ctrl+Z brings your rack back.)`)
  }

  return (
    <div className="preset-menu" ref={root}>
      <button className={open ? 'active' : ''} onClick={toggle} title="Whole tracks in the style of an era: load one, power on, pull it apart">
        Songs ▾
      </button>
      {open && (
        <div className="preset-list song-list" style={alignRight ? { right: 0 } : { left: 0 }}>
          <div className="preset-group">The sound of an era · our own notes</div>
          {SONGS.map((s) => (
            <button key={s.id} className="preset-item" onClick={() => load(s)}>
              <span className="preset-name">
                <span className="song-year">{s.year}</span> {s.name}
              </span>
              <span className="preset-desc">{s.era}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
