import { useSyncExternalStore } from 'react'
import { SCRATCH } from './persist'

/** What the rack on screen is called, shown (and renamed) in the top bar.
 *  Your own rack keeps its name across visits; a sandbox is called after
 *  what it was opened from. */
const KEY = 'voltage.rackName.v1'
const DEFAULT = SCRATCH ? 'Sandbox' : 'My rack'

let name = DEFAULT
if (!SCRATCH)
  try {
    name = localStorage.getItem(KEY) || DEFAULT
  } catch {
    name = DEFAULT
  }
const subs = new Set<() => void>()

export const rackName = {
  get: () => name,
  set(next: string): void {
    name = next.trim().slice(0, 60) || DEFAULT
    if (!SCRATCH)
      try {
        localStorage.setItem(KEY, name)
      } catch {
        /* not kept */
      }
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

export const useRackName = () => useSyncExternalStore(rackName.subscribe, rackName.get)
