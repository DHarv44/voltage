import { useSyncExternalStore } from 'react'

/** The module the Inspector is showing: chosen by clicking a panel (a press
 *  that doesn't move it). Null when nothing is selected. */
let selected: string | null = null
const subs = new Set<() => void>()

export const selection = {
  get: () => selected,
  set(id: string | null): void {
    if (id === selected) return
    selected = id
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

export const useSelection = () => useSyncExternalStore(selection.subscribe, selection.get)
