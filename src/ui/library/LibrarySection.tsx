import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ModuleSpec } from '../../modules/types'
import { STARTERS } from '../../patch/starters'
import { actions } from '../../patch/store'
import { useMenuBox } from '../rack/useMenuBox'
import { startItemDrag } from './itemDrag'
import { loadStarter } from './loadStarter'
import { shelf } from './shelf'
import { catalogOf } from '../../modules/catalog'
import { libHover } from './LibraryCard'
import { PanelThumb } from './PanelThumb'

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

/** One draggable module row: colour swatch, name, width, one-line description,
 *  and a star for favourites. Right-click for a ready-to-play version (the
 *  module wired up with everything it needs to make music). `top` marks the
 *  best search match (Enter in the search box adds it). */
export function LibraryItem({ spec, fav, top }: { spec: ModuleSpec; fav: boolean; top?: boolean }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const close = useCallback(() => setMenu(null), [])
  const tags = catalogOf(spec.type).tags
  return (
    <div className={top ? 'lib-row top' : 'lib-row'}>
      <button
        className="lib-item"
        data-lib-type={spec.type}
        onPointerEnter={(e) => e.pointerType === 'mouse' && libHover.enter(spec.type, e.currentTarget.getBoundingClientRect(), e.currentTarget.closest('.library')?.getBoundingClientRect())}
        onPointerLeave={libHover.leave}
        onPointerDown={(e) => {
          libHover.close()
          startItemDrag(spec.type, e)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          actions.addModule(spec.type)
          shelf.added(spec.type)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        aria-label={`${spec.name}: ${spec.tagline}`}
        aria-description={`${spec.category} · ${tags.join(', ')}. Drag onto the rack, or click to add. Right-click for a ready-to-play version.`}
      >
        <LibraryItemFace spec={spec} />
      </button>
      <button
        className={fav ? 'lib-star on' : 'lib-star'}
        title={fav ? 'Remove from favourites' : 'Add to favourites'}
        aria-pressed={fav}
        onClick={() => shelf.toggleFav(spec.type)}
      >
        {fav ? '★' : '☆'}
      </button>
      {menu && <StarterMenu spec={spec} x={menu.x} y={menu.y} onClose={close} />}
    </div>
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
        <button
          onClick={run(() => {
            loadStarter(spec.type)
            shelf.added(spec.type)
          })}
        >
          Add ready-to-play {spec.title}
          <span className="ctx-sub">{played ? 'wired up for you to play' : 'wired up with everything it needs to make music'}</span>
        </button>
      )}
      <button
        onClick={run(() => {
          actions.addModule(spec.type)
          shelf.added(spec.type)
        })}
      >
        Add {spec.title} on its own
      </button>
      <button onClick={run(() => shelf.toggleFav(spec.type))}>{shelf.isFav(spec.type) ? '★ Remove from favourites' : '☆ Add to favourites'}</button>
    </div>,
    document.body,
  )
}

function LibraryItemFace({ spec }: { spec: ModuleSpec }) {
  return (
    <>
      <span className="lib-thumb">
        <PanelThumb spec={spec} height={Math.min(34, (46 * 128.5) / (spec.hp * 5.08))} />
      </span>
      <span className="lib-text">
        <span className="lib-name">
          {spec.name} <em>{spec.hp} HP</em>
        </span>
        <span className="lib-tag">{spec.tagline}</span>
      </span>
    </>
  )
}
