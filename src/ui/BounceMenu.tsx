import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { bouncer, songOf, useBounce } from '../audio/bounce'
import { patchStore } from '../patch/store'

const LENGTHS: [string, number][] = [
  ['30 seconds', 30],
  ['1 minute', 60],
  ['2 minutes', 120],
  ['5 minutes', 300],
]

/** Beside REC: bounce the rack to a WAV without playing it, faster than real
 *  time: the song once through (when an arranger leads the rack) or a set
 *  length. While it renders the button shows how far it has got; click it to
 *  stop. */
export function BounceMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const b = useBounce()
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const song = songOf(patch.modules)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const go = (s: number | null) => {
    setOpen(false)
    void bouncer.start(s)
  }

  return (
    <div className="preset-menu" ref={root}>
      <button
        className={b.busy ? 'bounce-btn on' : open ? 'bounce-btn active' : 'bounce-btn'}
        onClick={() => (b.busy ? bouncer.cancel() : setOpen((o) => !o))}
        title={b.busy ? 'Rendering to a WAV: click to stop' : 'Bounce: render to a WAV without playing it, faster than real time'}
      >
        {b.busy ? `${Math.round(b.progress * 100)}%` : 'BOUNCE ▾'}
      </button>
      {open && (
        <div className="preset-list" style={{ right: 0, width: 300 }}>
          <div className="preset-group">Bounce to WAV (silent, faster than real time)</div>
          {song && (
            <button className="preset-item" onClick={() => go(null)}>
              <span className="preset-name">The whole song</span>
              <span className="preset-desc">Once through, as {song.type === 'arrangerxl' ? 'ARRANGER XL' : 'ARRANGER'} plays it, with its reverb tail.</span>
            </button>
          )}
          {LENGTHS.map(([label, s]) => (
            <button key={s} className="preset-item" onClick={() => go(s)}>
              <span className="preset-name">{label}</span>
            </button>
          ))}
          <div className="learn-note">
            It starts from the top, as if POWER had just come on. Loops, samples and takes are heard, and knobs moved by MOTION, MACRO, SCENES and AUTOMATION; keys, live inputs and XY aren’t.
          </div>
        </div>
      )}
    </div>
  )
}
