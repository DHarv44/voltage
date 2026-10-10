import { usePopover } from '../usePopover'
import { TagChips } from './TagChips'

/** The library's tag filter, out of the way until wanted: Filter ▾ opens the
 *  tags; the ones in use stay visible under the search as small chips you
 *  can take off one by one. */
export function TagFilter({ active, counts, onToggle, onClear }: { active: string[]; counts: Record<string, number>; onToggle: (t: string) => void; onClear: () => void }) {
  const pop = usePopover()
  return (
    <div className="lib-filter" ref={pop.root}>
      <button className={pop.open || active.length ? 'lib-filter-btn on' : 'lib-filter-btn'} onClick={pop.toggle} title="Narrow the list by what modules are for">
        Filter{active.length ? ` · ${active.length}` : ''} ▾
      </button>
      {pop.open && (
        <div className="lib-filter-panel">
          <p>Show modules that are all of these:</p>
          <TagChips active={active} counts={counts} onToggle={onToggle} onClear={onClear} />
        </div>
      )}
    </div>
  )
}

/** The tags in use, under the search box (✕ takes one off). */
export function ActiveTags({ active, onToggle }: { active: string[]; onToggle: (t: string) => void }) {
  if (!active.length) return null
  return (
    <div className="lib-active-tags">
      {active.map((t) => (
        <button key={t} className="lib-chip on" onClick={() => onToggle(t)} title={`Stop filtering by “${t}”`}>
          {t} ✕
        </button>
      ))}
    </div>
  )
}
