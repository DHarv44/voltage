import { drumOf } from './music'
import { hasOnset, type Pattern } from './pattern'
import type { Run } from './run'

/** How a piece is split across STRUDEL's lanes: by the root stack's layers
 *  when it has them, else by sound name (an `arrange` of sections has no
 *  layers of its own, but its sounds are the parts). */
export interface LanePlan {
  pats: Pattern[]
  /** Sound name → lane, when splitting by sound (unknown sounds go to `rest`). */
  byName: Map<string, number> | null
  rest: number
  /** What each lane is called on the report. */
  names: string[]
}

export const soundKey = (s: unknown): string => (s === undefined ? '' : String(s).split(':')[0])

export function planLanes(run: Run, maxLanes: number): LanePlan {
  const root = run.pattern
  const layers = root.layers
  if (layers && layers.length > 1) {
    const pats = layers.length <= maxLanes ? layers : [...layers.slice(0, maxLanes - 1), mergeLayers(layers.slice(maxLanes - 1))]
    return { pats, byName: null, rest: pats.length - 1, names: pats.map((_, i) => `layer ${i + 1}`) }
  }
  // by sound: count each non-drum sound over the piece (or 32 cycles)
  const cycles = Math.min(64, root.cycles || 32)
  const counts = new Map<string, number>()
  for (let c = 0; c < cycles; c++) {
    let haps
    try {
      haps = root.query(c, c + 1)
    } catch {
      break
    }
    for (const h of haps) {
      if (!hasOnset(h)) continue
      const s = soundKey(h.v.s)
      if (s && drumOf(s) >= 0) continue
      if (h.v.note === undefined && h.v.n === undefined && h.v.freq === undefined) continue
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
  const byName = new Map<string, number>()
  const names: string[] = []
  const own = ranked.length <= maxLanes ? ranked.length : maxLanes - 1
  ranked.slice(0, own).forEach((s, i) => {
    byName.set(s, i)
    names.push(s || 'triangle')
  })
  let rest = own
  if (ranked.length > maxLanes) {
    for (const s of ranked.slice(own)) byName.set(s, own)
    names.push(ranked.slice(own).map((s) => s || 'triangle').join(' + '))
  } else rest = Math.max(0, own - 1)
  return { pats: [root], byName, rest, names }
}

function mergeLayers(ps: Pattern[]): Pattern {
  return new (ps[0].constructor as new (q: Pattern['query']) => Pattern)((b, e) => ps.flatMap((p) => p.query(b, e)))
}
