import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ModuleSpec } from '../../modules/types'
import { STARTERS } from '../../patch/starters'
import { actions } from '../../patch/store'
import { useMenuBox } from '../rack/useMenuBox'
import { startItemDrag } from './itemDrag'
import { loadStarter } from './loadStarter'

interface SectionProps {
  title: string
  count?: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/** Collapsible library section with a chevron and item count. */
export function LibrarySection({ title, count, open, onToggle, children }: SectionProps) {
  return (
    <section className={open ? 'lib-section open' : 'lib-section'} data-lib-cat={title}>
      <button className="lib-header" onClick={onToggle} aria-expanded={open}>
        <span className="chevron">{open ? '▾' : '▸'}</span>
        <span className="lib-cat">{title}</span>
        {count !== undefined && <span className="lib-count">{count}</span>}
      </button>
      {open && <div className="lib-body">{children}</div>}
    </section>
  )
}

/** One draggable module row: colour swatch, name, width, one-line description.
 *  Right-click for a ready-to-play version (the module wired up with
 *  everything it needs to make music). */
export function LibraryItem({ spec }: { spec: ModuleSpec }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const close = useCallback(() => setMenu(null), [])
  return (
    <>
      <button
        className="lib-item"
        data-lib-type={spec.type}
        onPointerDown={(e) => startItemDrag(spec.type, e)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && actions.addModule(spec.type)}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        title={`${spec.name} (${spec.sizes ? `${spec.sizes[0]}–${spec.sizes[spec.sizes.length - 1]} HP, right-click a panel to resize` : `${spec.hp} HP`})\n${spec.tagline}\n\nDrag onto the rack, or click to add. Right-click for a ready-to-play version.`}
      >
        <LibraryItemFace spec={spec} />
      </button>
      {menu && <StarterMenu spec={spec} x={menu.x} y={menu.y} onClose={close} />}
    </>
  )
}

/** Right-click on a library module: the ready-to-play rig, or just the module. */
function StarterMenu({ spec, x, y, onClose }: { spec: ModuleSpec; x: number; y: number; onClose: () => void }) {
  const box = useMenuBox(x, y, onClose)
  const played = STARTERS[spec.type]?.played
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  return createPortal(
    <div ref={box} className="ctx-menu" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ctx-title">{spec.name}</div>
      {STARTERS[spec.type] && (
        <button onClick={run(() => loadStarter(spec.type))}>
          Add ready-to-play {spec.title}
          <span className="ctx-sub">{played ? 'wired up for you to play' : 'wired up with everything it needs to make music'}</span>
        </button>
      )}
      <button onClick={run(() => actions.addModule(spec.type))}>Add {spec.title} on its own</button>
    </div>,
    document.body,
  )
}

function LibraryItemFace({ spec }: { spec: ModuleSpec }) {
  return (
    <>
      <span className="swatch" style={{ background: spec.panel.bg, borderColor: spec.panel.accent }} />
      <span className="lib-text">
        <span className="lib-name">
          {spec.name} <em>{spec.hp} HP</em>
        </span>
        <span className="lib-tag">{spec.tagline}</span>
      </span>
    </>
  )
}
