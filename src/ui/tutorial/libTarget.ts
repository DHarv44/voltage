import { SPECS } from '../../modules'

/** The library row for a module type, or — if its section is closed (or the
 *  search hides it) — the section's header, which is what to click first. */
export function libTarget(type: string): { el: Element; open: boolean; category: string } | null {
  const category = SPECS[type]?.category ?? ''
  const item = document.querySelector(`[data-lib-type="${type}"]`)
  if (item) return { el: item, open: true, category }
  const header = document.querySelector(`[data-lib-cat="${category}"] .lib-header`)
  return header ? { el: header, open: false, category } : null
}
