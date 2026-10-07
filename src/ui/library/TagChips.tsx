import { TAGS } from '../../modules/catalog'

interface Props {
  active: string[]
  /** How many modules each tag would leave (with the search as it stands). */
  counts: Record<string, number>
  onToggle: (tag: string) => void
  onClear: () => void
}

/** The tag filter: tap tags to narrow the library (all of them must match).
 *  Tags that would leave nothing are dimmed. */
export function TagChips({ active, counts, onToggle, onClear }: Props) {
  return (
    <div className="lib-tags" role="group" aria-label="Filter by tag">
      {TAGS.map((t) => {
        const on = active.includes(t)
        const empty = !on && counts[t] === 0
        return (
          <button
            key={t}
            className={on ? 'lib-chip on' : empty ? 'lib-chip empty' : 'lib-chip'}
            aria-pressed={on}
            disabled={empty}
            title={empty ? 'Nothing else matches' : `${counts[t]} module${counts[t] === 1 ? '' : 's'}`}
            onClick={() => onToggle(t)}
          >
            {t}
          </button>
        )
      })}
      {active.length > 0 && (
        <button className="lib-chip clear" onClick={onClear}>
          ✕ clear
        </button>
      )}
    </div>
  )
}
