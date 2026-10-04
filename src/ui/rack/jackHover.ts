import { useSyncExternalStore } from 'react'
import { engine } from '../../audio/engine'

/** The jack under the cursor, for the live voltage readout. */
export interface JackHover {
  mod: string
  jack: string
  dir: 'in' | 'out'
  x: number
  y: number
}

let state: JackHover | null = null
const subs = new Set<() => void>()

export const jackHover = {
  get: (): JackHover | null => state,
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
  set(next: JackHover | null): void {
    if (next?.mod !== state?.mod) engine.probe(next?.mod ?? null)
    state = next
    subs.forEach((f) => f())
  },
}

export function useJackHover(): JackHover | null {
  return useSyncExternalStore(jackHover.subscribe, jackHover.get)
}
