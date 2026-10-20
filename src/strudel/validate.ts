import { Kit } from '../patch/starters/kit'
import { FIXTURE_ARRANGED, FIXTURE_NAMED, FIXTURE_SOUNDS } from './fixtures'
import { buildStrudelRack, type ImportOptions } from './importer'

/** What a fixture must build: these module types, at least this many modules, these report lines. */
const CASES: { name: string; code: string; types: string[]; atLeast: number; lines?: string[]; options?: ImportOptions }[] = [
  {
    name: 'named piece',
    code: FIXTURE_NAMED,
    types: ['strudelcore', 'strudelparts', 'halcyon'],
    atLeast: 7,
    lines: ['Parts: sawtooth + gm_lead_2_sawtooth · square + pulse · gm_pad_2_warm'],
  },
  {
    name: 'named piece, two parts',
    code: FIXTURE_NAMED,
    types: ['strudelcore', 'strudelpart', 'halcyon'],
    atLeast: 7,
    lines: ['Parts: sawtooth + gm_lead_2_sawtooth · square + pulse + gm_pad_2_warm'],
    options: { maxParts: 2 },
  },
  {
    name: 'arranged piece',
    code: FIXTURE_ARRANGED,
    types: ['strudelcore', 'strudeldrums', 'strudelpart', 'kick', 'snare', 'clap', 'hats', 'vco', 'svf', 'console', 'plate', 'output'],
    atLeast: 17,
  },
  {
    name: 'sounds piece',
    code: FIXTURE_SOUNDS,
    types: ['strudelcore', 'strudeldrums', 'strudelparts', 'strudelpart', 'kick', 'snare', 'hats', 'vco', 'vcf', 'swarm', 'stage', 'halcyon', 'formant', 'era', 'pingpong', 'console', 'output'],
    atLeast: 26,
  },
]

/** Dev check: the fixture pieces still import, to the modules they should. */
export function validateStrudel(): string[] {
  const out: string[] = []
  for (const c of CASES) {
    const k = new Kit(104)
    const r = buildStrudelRack(k, c.code, c.options)
    if (r.error) {
      out.push(`strudel ${c.name}: ${r.error}`)
      continue
    }
    const p = k.build()
    const types = new Set(p.modules.map((m) => m.type))
    for (const t of c.types) if (!types.has(t)) out.push(`strudel ${c.name}: no ${t} in the rack it builds (${[...types].join(', ')})`)
    if (p.modules.length < c.atLeast) out.push(`strudel ${c.name}: only ${p.modules.length} modules`)
    for (const l of c.lines ?? []) if (!r.lines.includes(l)) out.push(`strudel ${c.name}: report lacks "${l}" (has: ${r.lines.join(' / ')})`)
  }
  return out
}
