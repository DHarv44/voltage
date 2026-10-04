import type { ReactNode } from 'react'
import type { ModuleSpec } from '../../modules/types'
import { actions } from '../../patch/store'
import { startItemDrag } from './itemDrag'

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
    <section className={open ? 'lib-section open' : 'lib-section'}>
      <button className="lib-header" onClick={onToggle} aria-expanded={open}>
        <span className="chevron">{open ? '▾' : '▸'}</span>
        <span className="lib-cat">{title}</span>
        {count !== undefined && <span className="lib-count">{count}</span>}
      </button>
      {open && <div className="lib-body">{children}</div>}
    </section>
  )
}

/** One draggable module row: colour swatch, name, width, one-line description. */
export function LibraryItem({ spec }: { spec: ModuleSpec }) {
  return (
    <button
      className="lib-item"
      onPointerDown={(e) => startItemDrag(spec.type, e)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && actions.addModule(spec.type)}
      title={`${spec.name} (${spec.hp} HP)\n${spec.tagline}\n\nDrag onto the rack, or click to add.`}
    >
      <span className="swatch" style={{ background: spec.panel.bg, borderColor: spec.panel.accent }} />
      <span className="lib-text">
        <span className="lib-name">
          {spec.name} <em>{spec.hp} HP</em>
        </span>
        <span className="lib-tag">{spec.tagline}</span>
      </span>
    </button>
  )
}
