import type { ModuleSpec } from '../modules/types'
import { BANK_ALIASES, BANKS } from './banks'
import { DRUM_VOICES, INSTRUMENTS } from './instruments'
import { pickInstrument } from './pick'
import { HITS } from './request'
import type { Timbre } from './taxonomy'
import { TREATMENTS } from './treatments'

/** Picks that must hold: what each timbre lands on (the taxonomy's promise). */
const EXPECT: [Timbre, number, string][] = [
  ['piano', 4, 'grand'],
  ['epiano', 3, 'stage'],
  ['bell', 2, 'fm4'],
  ['supersaw', 4, 'swarm'],
  ['pad', 4, 'halcyon'],
  ['strings', 3, 'tapekeys'],
  ['choir', 3, 'choir'],
  ['organ', 3, 'organ'],
  ['flute', 1, 'wind'],
  ['saw', 1, 'chain:mono'],
  ['sine', 1, 'chain:mono'],
  ['square', 3, 'halcyon'],
  ['handpan', 1, 'strike'],
  ['sfx', 2, 'halcyon'],
]

/** Modules shaped like instruments that aren't general ones, and why. */
const NOT_INSTRUMENTS: Record<string, string> = {
  tally: 'a toy calculator: its sounds are the joke',
  unison: 'a utility: spreads notes, makes no sound',
}

/** Dev check: every instrument, drum and effect declaration names a real
 *  module and real jacks; every module that is plainly an instrument (a
 *  V/OCT with a gate or trigger, in the instrument categories) or a drum
 *  declares itself; the promised picks hold. */
export function validateTimbre(specs: ModuleSpec[]): string[] {
  const out: string[] = []
  const byType = new Map(specs.map((s) => [s.type, s]))
  const jack = (type: string, dir: 'inputs' | 'outputs', id: string) => {
    const s = byType.get(type)
    if (!s) return out.push(`timbre: "${type}" is not a module`)
    if (!s[dir].some((j) => j.id === id)) out.push(`timbre: ${type} has no ${dir === 'inputs' ? 'input' : 'output'} "${id}"`)
  }
  for (const [type, ins] of Object.entries(INSTRUMENTS)) {
    jack(type, 'inputs', ins.voct)
    jack(type, 'inputs', ins.gate)
    if (ins.vel) jack(type, 'inputs', ins.vel)
    if (ins.cutoffCv) jack(type, 'inputs', ins.cutoffCv)
    for (const o of ins.out) jack(type, 'outputs', o)
    if (!ins.plays.length) out.push(`timbre: ${type} plays nothing`)
  }
  for (const [type, d] of Object.entries(DRUM_VOICES)) {
    for (const [h, j] of Object.entries(d.hits)) {
      if (!HITS.includes(h as (typeof HITS)[number])) out.push(`timbre: ${type} names an unknown hit "${h}"`)
      jack(type, 'inputs', j)
    }
    jack(type, 'outputs', d.out)
  }
  for (const [type, t] of Object.entries(TREATMENTS)) {
    for (const i of t.in) jack(type, 'inputs', i)
    for (const o of t.out) jack(type, 'outputs', o)
  }
  const covered = new Set<string>()
  for (const d of Object.values(DRUM_VOICES)) for (const h of Object.keys(d.hits)) covered.add(h)
  for (const h of HITS) if (!covered.has(h)) out.push(`timbre: no drum module makes "${h}"`)
  // the fitted drum machines: every alias names a bank, every setting a real param of the hit's module
  for (const [alias, bank] of Object.entries(BANK_ALIASES)) if (!BANKS[bank]) out.push(`timbre: bank alias "${alias}" → unknown bank "${bank}"`)
  for (const [bank, preset] of Object.entries(BANKS))
    for (const [hit, params] of Object.entries(preset)) {
      const entry = Object.entries(DRUM_VOICES).find(([, d]) => d.hits[hit as (typeof HITS)[number]])
      if (!entry) {
        out.push(`timbre: bank ${bank} sets unknown hit "${hit}"`)
        continue
      }
      const spec = byType.get(entry[0])
      for (const p of Object.keys(params ?? {})) if (!spec?.params.some((ps) => ps.id === p)) out.push(`timbre: bank ${bank} ${hit} sets ${entry[0]} param "${p}" that doesn't exist`)
    }
  for (const s of specs) {
    const has = (dir: 'inputs' | 'outputs', id: string) => s[dir].some((j) => j.id === id)
    const instrument = (s.category === 'Instruments' || s.category === 'Polyphonic') && has('inputs', 'voct') && (has('inputs', 'gate') || has('inputs', 'trig'))
    if (instrument && !INSTRUMENTS[s.type] && !NOT_INSTRUMENTS[s.type]) out.push(`timbre: ${s.type} is an instrument with no declaration (timbre/instruments.ts)`)
    if (s.category === 'Drums' && !DRUM_VOICES[s.type]) out.push(`timbre: ${s.type} is a drum with no declaration (timbre/instruments.ts)`)
  }
  for (const [timbre, poly, want] of EXPECT) {
    const got = pickInstrument({ name: timbre, timbre, poly, c: {} }).type
    if (got !== want) out.push(`timbre: ${timbre} (${poly} notes) picks ${got}, expected ${want}`)
  }
  return out
}
