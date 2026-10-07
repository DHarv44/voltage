import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { SPEC_LIST, SPECS } from '../modules'
import { TAGS } from '../modules/catalog'
import { CATEGORIES } from '../modules/types'
import { actions } from '../patch/store'
import { LibraryItem, LibrarySection } from './library/LibrarySection'
import { searchModules } from './library/search'
import { shelf } from './library/shelf'
import { TagChips } from './library/TagChips'
import { settings, useSettings } from './settings'

const HELP = 'help'
/** Favourites and Recent start open; their keys in libOpen mean "closed". */
const FAVS = 'Favourites'
const RECENT = 'Recent'
const closedKey = (name: string) => `~${name}`

/** The module library: search (every word must match; Enter adds the best
 *  match, / jumps here), tag chips, your favourites and recent modules, then
 *  every module in its category. */
export function Library() {
  const { libOpen, favs, recent, libTags } = useSettings()
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const q = query.trim()
  const filtering = q !== '' || libTags.length > 0

  const results = useMemo(() => (filtering ? searchModules(SPEC_LIST, q, libTags) : []), [filtering, q, libTags])
  const counts = useMemo(() => Object.fromEntries(TAGS.map((t) => [t, searchModules(SPEC_LIST, q, [...libTags, t]).length])), [q, libTags])
  const groups = useMemo(
    () => CATEGORIES.map((cat) => ({ cat, specs: SPEC_LIST.filter((s) => s.category === cat) })).filter((g) => g.specs.length > 0),
    [],
  )

  // "/" anywhere (outside a text field) jumps to the search box
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const isOpen = (name: string) => libOpen.includes(name)
  const toggle = (name: string) => settings.set({ libOpen: libOpen.includes(name) ? libOpen.filter((n) => n !== name) : [...libOpen, name] })
  const allOpen = CATEGORIES.every((c) => libOpen.includes(c))
  const toggleTag = (t: string) => settings.set({ libTags: libTags.includes(t) ? libTags.filter((x) => x !== t) : [...libTags, t] })
  const item = (type: string, top = false) => SPECS[type] && <LibraryItem key={type} spec={SPECS[type]} fav={favs.includes(type)} top={top} />

  const keyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('')
      settings.set({ libTags: [] })
    } else if (e.key === 'Enter' && results[0]) {
      actions.addModule(results[0].type)
      shelf.added(results[0].type)
    }
  }

  return (
    <aside className="library">
      <div className="lib-top">
        <h2>Modules</h2>
        <button
          className="lib-all"
          onClick={() => settings.set({ libOpen: allOpen ? libOpen.filter((n) => !CATEGORIES.includes(n as never)) : [...new Set([...libOpen, ...CATEGORIES])] })}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="lib-search">
        <input
          ref={input}
          type="search"
          placeholder="Search: name, sound, gear…  ( / )"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={keyDown}
        />
      </div>
      <TagChips active={libTags} counts={counts} onToggle={toggleTag} onClear={() => settings.set({ libTags: [] })} />

      {filtering ? (
        <>
          <LibrarySection title="Results" count={results.length} open onToggle={() => {}}>
            {results.map((s, i) => item(s.type, i === 0 && q !== ''))}
          </LibrarySection>
          {results.length === 0 && <p className="lib-empty">Nothing matches{q ? ` “${q}”` : ''}{libTags.length ? ` tagged ${libTags.join(' + ')}` : ''}.</p>}
        </>
      ) : (
        <>
          {favs.length > 0 && (
            <LibrarySection title={FAVS} count={favs.length} open={!isOpen(closedKey(FAVS))} onToggle={() => toggle(closedKey(FAVS))}>
              {favs.map((t) => item(t))}
            </LibrarySection>
          )}
          {recent.length > 0 && (
            <LibrarySection title={RECENT} count={recent.length} open={!isOpen(closedKey(RECENT))} onToggle={() => toggle(closedKey(RECENT))}>
              {recent.map((t) => item(t))}
            </LibrarySection>
          )}
          {groups.map(({ cat, specs }) => (
            <LibrarySection key={cat} title={cat} count={specs.length} open={isOpen(cat)} onToggle={() => toggle(cat)}>
              {specs.map((s) => item(s.type))}
            </LibrarySection>
          ))}
        </>
      )}

      <LibrarySection title="How to use" open={libOpen.includes(HELP)} onToggle={() => toggle(HELP)}>
        <div className="lib-help">
          <p>Search by name, by what you want (bass, reverb, beat…) or by the gear you know; every word must match. Enter adds the top result; / jumps to the search box. Tap tags to narrow the list; ☆ stars a module into Favourites.</p>
          <p>Drag a module onto the rack to place it; anything in the way slides aside on drop. Click to drop it in the first free slot.</p>
          <p>Drag a panel to move it. Drop below the last row for a new row. Right-click a panel for more.</p>
          <p>Drag from a jack to patch. Drag a patched input to unplug it. Right-click a jack to pull its cables; Shift+right-click to recolour them.</p>
          <p>Knobs: scroll wheel up/down, or drag up/down with the left or middle button (Shift = fine). Double-click to reset. Click a switch to flip it.</p>
          <p>Keys A–K play notes (Z/X octave). Number keys 1–8 hit drum pads.</p>
        </div>
      </LibrarySection>
    </aside>
  )
}
