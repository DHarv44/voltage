import { useMemo, useState } from 'react'
import { SPEC_LIST } from '../modules'
import type { Category, ModuleSpec } from '../modules/types'
import { LibraryItem, LibrarySection } from './library/LibrarySection'
import { settings, useSettings } from './settings'

const ORDER: Category[] = [
  'Systems',
  'Polyphonic',
  'Sources',
  'Filters',
  'Amplifiers',
  'Modulation',
  'Shapers',
  'Drums',
  'Sequencing',
  'Effects',
  'Sampling',
  'Utilities',
  'Visuals',
  'I/O',
]
const HELP = 'help'

const matches = (s: ModuleSpec, q: string) =>
  `${s.name} ${s.title} ${s.tagline} ${s.category}`.toLowerCase().includes(q)

export function Library() {
  const { libOpen } = useSettings()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const groups = useMemo(
    () =>
      ORDER.map((cat) => ({ cat, specs: SPEC_LIST.filter((s) => s.category === cat && (!q || matches(s, q))) })).filter(
        (g) => g.specs.length > 0,
      ),
    [q],
  )

  const isOpen = (name: string) => (q ? true : libOpen.includes(name)) // searching opens every match
  const toggle = (name: string) =>
    settings.set({ libOpen: libOpen.includes(name) ? libOpen.filter((n) => n !== name) : [...libOpen, name] })
  const allOpen = ORDER.every((c) => libOpen.includes(c))

  return (
    <aside className="library">
      <div className="lib-top">
        <h2>Modules</h2>
        <button
          className="lib-all"
          onClick={() => settings.set({ libOpen: allOpen ? libOpen.filter((n) => n === HELP) : [...ORDER, ...libOpen.filter((n) => n === HELP)] })}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="lib-search">
        <input
          type="search"
          placeholder="Search modules…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        />
      </div>

      {groups.map(({ cat, specs }) => (
        <LibrarySection key={cat} title={cat} count={specs.length} open={isOpen(cat)} onToggle={() => toggle(cat)}>
          {specs.map((s) => (
            <LibraryItem key={s.type} spec={s} />
          ))}
        </LibrarySection>
      ))}
      {q && groups.length === 0 && <p className="lib-empty">No modules match “{query}”.</p>}

      <LibrarySection title="How to use" open={libOpen.includes(HELP)} onToggle={() => toggle(HELP)}>
        <div className="lib-help">
          <p>Drag a module onto the rack to place it; anything in the way slides aside on drop. Click to drop it in the first free slot.</p>
          <p>Drag a panel to move it. Drop below the last row for a new row. Right-click a panel for more.</p>
          <p>Drag from a jack to patch. Drag a patched input to unplug it. Right-click a jack to pull its cables.</p>
          <p>Knobs: scroll wheel up/down, or middle-button drag (Shift = fine). Double-click to reset. Click a switch to flip it.</p>
          <p>Keys A–K play notes (Z/X octave). Number keys 1–8 hit drum pads.</p>
        </div>
      </LibrarySection>
    </aside>
  )
}
