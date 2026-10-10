import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { SPECS } from '../../modules'
import { catalogOf } from '../../modules/catalog'
import { STARTERS } from '../../patch/starters'
import { actions } from '../../patch/store'
import { loadStarter } from './loadStarter'
import { PanelThumb } from './PanelThumb'
import { shelf } from './shelf'

/** Which library module the pointer rests on, and where its row is. Shown
 *  after a short pause so sweeping down the list doesn't flash cards. */
type Hover = { type: string; top: number; left: number } | null
let state: Hover = null
let showTimer = 0
let hideTimer = 0
const subs = new Set<() => void>()
const set = (h: Hover) => {
  state = h
  subs.forEach((f) => f())
}

export const libHover = {
  get: () => state,
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
  enter(type: string, row: DOMRect, aside: DOMRect | undefined): void {
    clearTimeout(hideTimer)
    clearTimeout(showTimer)
    const next = { type, top: row.top, left: (aside?.right ?? row.right) + 8 }
    if (state) set(next) // already showing one: follow at once
    else showTimer = window.setTimeout(() => set(next), 380)
  },
  leave(): void {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => set(null), 220)
  },
  keep(): void {
    clearTimeout(hideTimer)
  },
  close(): void {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
    set(null)
  },
}

/** The library's hover card: the module's panel, what it's for, and the two
 *  ways to add it (alone, or as a ready-to-play rig that shows what it does). */
export function LibraryCard() {
  const h = useSyncExternalStore(libHover.subscribe, libHover.get)
  const box = useRef<HTMLDivElement>(null)
  // beside its row, but always whole on screen (it knows its height once drawn)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || !h) return
    el.style.top = `${Math.max(8, Math.min(h.top - 30, window.innerHeight - el.offsetHeight - 8))}px`
  }, [h])
  if (!h) return null
  const spec = SPECS[h.type]
  if (!spec) return null
  const tags = catalogOf(spec.type).tags
  const top = Math.max(8, h.top - 30)
  const add = (rig: boolean) => {
    if (rig) loadStarter(spec.type)
    else actions.addModule(spec.type)
    shelf.added(spec.type)
    libHover.close()
  }
  return createPortal(
    <div ref={box} className="lib-card" style={{ top, left: h.left }} onPointerEnter={libHover.keep} onPointerLeave={libHover.leave}>
      <div className="lib-card-pic">
        <PanelThumb spec={spec} height={Math.min(150, (230 * 128.5) / (spec.hp * 5.08))} />
      </div>
      <div className="lib-card-text">
        <b>{spec.name}</b>
        <span className="lib-card-meta">
          {spec.category} · {spec.hp} HP{tags.length ? ` · ${tags.join(', ')}` : ''}
        </span>
        <p>{spec.tagline}</p>
      </div>
      <div className="lib-card-actions">
        {STARTERS[spec.type] && (
          <button className="primary" onClick={() => add(true)} title="The module wired up with everything it needs to make music, below your rack">
            ▶ Add ready-to-play rig
          </button>
        )}
        <button onClick={() => add(false)}>Add on its own</button>
      </div>
      <p className="lib-card-fine">Or drag it onto the rack.</p>
    </div>,
    document.body,
  )
}
