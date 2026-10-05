import { SPECS } from '.'
import type { ModuleInst } from '../patch/types'
import type { Control } from './types'

type Sized = Pick<ModuleInst, 'type' | 'width'>

/** A module's width in HP: its chosen size (resizable panels) or the spec's. */
export function hpOf(m: Sized): number {
  return m.width ?? SPECS[m.type]?.hp ?? 0
}

const laidOut = new Map<string, Control[]>()

/** A module's panel controls, laid out for its width (each layout is built once). */
export function controlsOf(m: Sized): Control[] {
  const s = SPECS[m.type]
  if (!s) return []
  if (!s.layout || !m.width || m.width === s.hp) return s.controls
  const key = `${m.type}@${m.width}`
  let c = laidOut.get(key)
  if (!c) laidOut.set(key, (c = s.layout(m.width)))
  return c
}
