import { SPECS } from '../modules'
import type { ToEngine } from '../engine/protocol'
import type { Patch } from '../patch/types'

/** Changes only when modules are added/removed or cables move (not on knob turns or drags). */
export function topologyKey(p: Patch): string {
  const mods = p.modules.map((m) => `${m.id}:${m.type}`).join('|')
  const cables = p.cables.map((c) => `${c.from.mod}.${c.from.jack}>${c.to.mod}.${c.to.jack}`).join('|')
  return `${mods}#${cables}`
}

export function buildPatchMsg(p: Patch): ToEngine {
  const types = new Map(p.modules.map((m) => [m.id, m.type]))
  return {
    type: 'patch',
    modules: p.modules.map((m) => ({
      id: m.id,
      type: m.type,
      seed: m.seed,
      params: SPECS[m.type].params.map((ps) => m.params[ps.id] ?? ps.def),
    })),
    cables: p.cables.map((c) => ({
      from: c.from.mod,
      fromOut: SPECS[types.get(c.from.mod) ?? '']?.outputs.findIndex((j) => j.id === c.from.jack) ?? -1,
      to: c.to.mod,
      toIn: SPECS[types.get(c.to.mod) ?? '']?.inputs.findIndex((j) => j.id === c.to.jack) ?? -1,
    })),
  }
}
