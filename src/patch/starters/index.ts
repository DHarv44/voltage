import { SPEC_LIST, SPECS } from '../../modules'
import { hpOf } from '../../modules/size'
import { fits } from '../layout'
import { sanitize } from '../persist'
import type { Patch } from '../types'
import { COMBO_STARTERS } from './combo'
import { CONTROL_STARTERS } from './control'
import { EFFECT_STARTERS } from './effects'
import { GAP_STARTERS } from './gaps'
import { INSTRUMENT_STARTERS } from './instruments'
import { SIMULATION_STARTERS } from './simulations'
import { Kit } from './kit'
import { OTHER_STARTERS } from './other'
import { PROCESSOR_STARTERS } from './processors'
import { RHYTHM_STARTERS } from './rhythm'
import { SOURCE_STARTERS } from './sources'
import type { Starter } from './types'
import { VISION_STARTERS } from './vision'
import { VOICE_STARTERS } from './voices'

export type { Starter } from './types'

/** Every module's ready-to-play rig, by module type. */
export const STARTERS: Record<string, Starter> = {
  ...SOURCE_STARTERS,
  ...VOICE_STARTERS,
  ...INSTRUMENT_STARTERS,
  ...PROCESSOR_STARTERS,
  ...EFFECT_STARTERS,
  ...CONTROL_STARTERS,
  ...SIMULATION_STARTERS,
  ...RHYTHM_STARTERS,
  ...OTHER_STARTERS,
  ...GAP_STARTERS,
  ...VISION_STARTERS,
  ...COMBO_STARTERS,
}

/** A module's rig as a patch fragment, laid out for a `rail`-HP case. */
export function buildStarter(type: string, rail: number): Patch | null {
  const s = STARTERS[type]
  if (!s) return null
  const k = new Kit(rail)
  s.build(k)
  return k.build()
}

/** Dev check: every module has a rig; each builds, contains its module, sends
 *  something to the speakers, and every cable, param and placement is valid. */
export function validateStarters(rail = 104): string[] {
  const errors: string[] = []
  for (const spec of SPEC_LIST) {
    const p = buildStarter(spec.type, rail)
    if (!p) {
      errors.push(`${spec.type}: no ready-to-play rig`)
      continue
    }
    const at = `${spec.type} rig`
    if (!p.modules.some((m) => m.type === spec.type)) errors.push(`${at}: doesn't include ${spec.type}`)
    if (!p.modules.some((m) => m.type === 'output' || m.type === 'monitor')) errors.push(`${at}: nothing goes to the speakers`)
    const clean = sanitize(p)
    if (!clean) errors.push(`${at}: invalid patch`)
    else if (clean.cables.length !== p.cables.length) errors.push(`${at}: ${p.cables.length - clean.cables.length} invalid cable(s)`)
    const fed = new Set<string>()
    for (const c of p.cables) {
      const to = `${c.to.mod}.${c.to.jack}`
      if (fed.has(to)) errors.push(`${at}: two cables into ${to}`)
      fed.add(to)
    }
    for (const m of p.modules) {
      if (!fits(p, m.row, m.hp, hpOf(m), m.id)) errors.push(`${at}: ${m.type} overlaps or overflows`)
      for (const key of Object.keys(m.params)) if (!SPECS[m.type].params.some((ps) => ps.id === key)) errors.push(`${at}: ${m.type} has no param ${key}`)
    }
  }
  return errors
}
