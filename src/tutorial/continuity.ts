import type { Patch } from '../patch/types'
import type { Rack } from './lessons/racks'

/** Can the next lesson carry on with the rack you built? It needs every
 *  module it expects (same name, same type) and every cable between them.
 *  Extra modules, extra cables and knob settings are yours to keep. */
export function rackMatches(p: Patch, mods: Record<string, string>, expected: Rack): boolean {
  const names = new Map(Object.entries(expected.mods).map(([name, id]) => [id, name]))
  for (const [name, id] of Object.entries(expected.mods)) {
    const want = expected.patch.modules.find((m) => m.id === id)
    const have = p.modules.find((m) => m.id === mods[name])
    if (!want || !have || have.type !== want.type) return false
  }
  return expected.patch.cables.every((c) => {
    const from = mods[names.get(c.from.mod) ?? '']
    const to = mods[names.get(c.to.mod) ?? '']
    return p.cables.some((x) => x.from.mod === from && x.from.jack === c.from.jack && x.to.mod === to && x.to.jack === c.to.jack)
  })
}
