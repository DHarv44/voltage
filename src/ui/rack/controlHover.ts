import { useSyncExternalStore } from 'react'
import type { ParamSpec } from '../../modules/types'

/** The knob or switch under the cursor, for the control readout. Panel knobs,
 *  switches and the knobs painted on surfaces all report here. */
export interface ControlHover {
  mod: string
  ps: ParamSpec
  /** The name on the panel, when it differs from the param's. */
  label?: string
  /** The value now (it changes under the cursor as you scroll). */
  read: () => number
  /** How to use it: "Scroll or drag…", "Click for …". */
  how: string
  x: number
  y: number
}

let state: ControlHover | null = null
const subs = new Set<() => void>()

export const controlHover = {
  get: (): ControlHover | null => state,
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
  set(next: ControlHover | null): void {
    if (!next && !state) return
    state = next
    subs.forEach((f) => f())
  },
}

export function useControlHover(): ControlHover | null {
  return useSyncExternalStore(controlHover.subscribe, controlHover.get)
}
