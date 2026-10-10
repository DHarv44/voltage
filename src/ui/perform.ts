import { useSyncExternalStore } from 'react'

/** Performance mode: the rack alone, filling the window (the top bar, the
 *  library and the Inspector put away), for playing live or watching VISION.
 *  ` toggles it, Esc leaves; a small strip keeps POWER within reach. */
let on = false
const subs = new Set<() => void>()

export const perform = {
  get: () => on,
  set(v: boolean): void {
    if (v === on) return
    on = v
    subs.forEach((f) => f())
  },
  toggle: () => perform.set(!on),
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

export const usePerform = () => useSyncExternalStore(perform.subscribe, perform.get)
