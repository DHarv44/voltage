import type { Patch } from '../../patch/types'
import { SP_DEFAULT_PARTS } from '../../modules/specs/strudelFamily'
import { ST_LANES } from '../../modules/specs/strudel'
import { planLanes } from '../../strudel/lanes'
import { runStrudel } from '../../strudel/run'

/** Part names per piece of code and part count (the interpreter runs once per text). */
const cache = new Map<string, string[]>()
function partNames(code: string, parts: number): string[] {
  const key = `${parts}|${code}`
  let n = cache.get(key)
  if (!n) {
    const r = runStrudel(code)
    n = r.error ? [] : planLanes(r, parts).names
    if (cache.size > 20) cache.clear()
    cache.set(key, n)
  }
  return n
}

/** What a peripheral's LINK leads to: the host's part names, or null when unlinked. */
export function linkedParts(p: Patch, instId: string): string[] | null {
  const c = p.cables.find((k) => k.to.mod === instId && k.to.jack === 'link')
  const host = c && c.from.jack === 'link' ? p.modules.find((m) => m.id === c.from.mod) : undefined
  if (!host) return null
  const parts = host.type === 'strudel' ? ST_LANES : Math.round(host.params.parts ?? SP_DEFAULT_PARTS)
  return partNames(host.text ?? '', parts)
}

/** The label for part `lane` (1-based) given the host's names. */
export function partLabel(names: string[] | null, lane: number): string {
  if (!names) return ''
  return names[lane - 1] ?? (names.length ? `only ${names.length} part${names.length === 1 ? '' : 's'}` : 'no piece')
}
