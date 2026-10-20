import { Kit } from '../patch/starters/kit'
import { FIXTURE_ARRANGED, FIXTURE_SOUNDS } from './fixtures'
import { buildStrudelRack } from './importer'

/** What a fixture must build: these module types, at least this many modules. */
const CASES: { name: string; code: string; types: string[]; atLeast: number }[] = [
  {
    name: 'arranged piece',
    code: FIXTURE_ARRANGED,
    types: ['strudelcore', 'strudeldrums', 'strudelpart', 'kick', 'snare', 'clap', 'hats', 'vco', 'svf', 'console', 'plate', 'output'],
    atLeast: 17,
  },
  {
    name: 'sounds piece',
    code: FIXTURE_SOUNDS,
    types: ['strudelcore', 'strudeldrums', 'kick', 'snare', 'hats', 'vco', 'vcf', 'swarm', 'stage', 'halcyon', 'formant', 'era', 'pingpong', 'console', 'output'],
    atLeast: 26,
  },
]

/** Dev check: the fixture pieces still import, to the modules they should. */
export function validateStrudel(): string[] {
  const out: string[] = []
  for (const c of CASES) {
    const k = new Kit(104)
    const r = buildStrudelRack(k, c.code)
    if (r.error) {
      out.push(`strudel ${c.name}: ${r.error}`)
      continue
    }
    const p = k.build()
    const types = new Set(p.modules.map((m) => m.type))
    for (const t of c.types) if (!types.has(t)) out.push(`strudel ${c.name}: no ${t} in the rack it builds (${[...types].join(', ')})`)
    if (p.modules.length < c.atLeast) out.push(`strudel ${c.name}: only ${p.modules.length} modules`)
  }
  return out
}
