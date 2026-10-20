import { timbreOfSound } from './adapt'
import { drumOf } from './music'
import { hasOnset, type Pattern } from './pattern'
import type { Run } from './run'

/** How a piece is split into parts: by the root stack's layers when it has
 *  them, else by timbre (an `arrange` of sections has no layers of its own,
 *  but its sounds are the parts, and sounds one instrument can play —
 *  `square` and `pulse`, `sawtooth` and `gm_lead_2_sawtooth` — share one).
 *  Past `maxLanes`, the least-played share the last. */
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
  // count each non-drum sound over the piece (or 32 cycles), then group by timbre
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
  const groups = new Map<string, { sounds: string[]; count: number }>()
  for (const [s, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const t = timbreOfSound(s)
    const g = groups.get(t) ?? groups.set(t, { sounds: [], count: 0 }).get(t)!
    g.sounds.push(s)
    g.count += n
  }
  const ranked = [...groups.values()].sort((a, b) => b.count - a.count)
  const label = (g: { sounds: string[] }) => g.sounds.map((s) => s || 'triangle').join(' + ')
  const byName = new Map<string, number>()
  const names: string[] = []
  const own = ranked.length <= maxLanes ? ranked.length : maxLanes - 1
  ranked.slice(0, own).forEach((g, i) => {
    for (const s of g.sounds) byName.set(s, i)
    names.push(label(g))
  })
  let rest = own
  if (ranked.length > maxLanes) {
    for (const g of ranked.slice(own)) for (const s of g.sounds) byName.set(s, own)
    names.push(ranked.slice(own).map(label).join(' + '))
  } else rest = Math.max(0, own - 1)
  return { pats: [root], byName, rest, names }
}

function mergeLayers(ps: Pattern[]): Pattern {
  return new (ps[0].constructor as new (q: Pattern['query']) => Pattern)((b, e) => ps.flatMap((p) => p.query(b, e)))
}
