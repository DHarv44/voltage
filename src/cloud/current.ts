import { useSyncExternalStore } from 'react'
import { SCRATCH } from '../patch/persist'
import type { CloudMeta } from './api'

/** The cloud rack the rack on screen came from (saved or opened, and yours),
 *  so Save can offer to update it. Remembered for your own rack; a scratch
 *  rack only remembers it while the page is open. */
type Current = Pick<CloudMeta, 'id' | 'title' | 'note' | 'visibility'> | null

const KEY = 'voltage.cloudCurrent.v1'
let state: Current = null
if (!SCRATCH)
  try {
    state = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Current
  } catch {
    state = null
  }
const subs = new Set<() => void>()

export const cloudCurrent = {
  get: (): Current => state,
  set(c: Current): void {
    state = c ? { id: c.id, title: c.title, note: c.note, visibility: c.visibility } : null
    if (!SCRATCH)
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
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

export const useCloudCurrent = () => useSyncExternalStore(cloudCurrent.subscribe, cloudCurrent.get)
