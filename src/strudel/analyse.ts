import { DRUM_OUTS, drumOf } from './music'
import { hasOnset } from './pattern'
import type { Run } from './run'

/** What the importer learns about one lane. */
export interface LaneInfo {
  /** The sound most of its notes name ('' when none). */
  sound: string
  /** Other sounds played at the same moments as the main one (a layered patch). */
  doubled: string[]
  notes: number
  maxPoly: number
  /** Typical values of the numeric controls it uses. */
  p: Record<string, number>
  /** Controls whose value changes from note to note. */
  patterned: Set<string>
}

export interface Analysis {
  lanes: LaneInfo[]
  drums: { count: number; gain: number }[]
  drumRoom: number
  warnings: string[]
}

const PARAMS = ['gain', 'pan', 'room', 'delay', 'delaytime', 'delayfb', 'lpf', 'hpf', 'lpq', 'attack', 'decay', 'sustain', 'release', 'shape']

/** The middle value of a list. */
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Query each lane over the piece (or 32 cycles of an endless one) and sum it up. */
export function analyseLanes(run: Run): Analysis {
  const layers = run.pattern.layers ?? [run.pattern]
  const cycles = Math.min(64, run.pattern.cycles || 32)
  const drums = DRUM_OUTS.map(() => ({ count: 0, gains: [] as number[] }))
  const drumRooms: number[] = []
  const warnings: string[] = []
  const lanes = layers.map((lane): LaneInfo => {
    const sounds = new Map<string, number>()
    const vals = new Map<string, number[]>()
    let notes = 0
    let maxPoly = 0
    const together = new Map<string, Set<string>>()
    for (let c = 0; c < cycles; c++) {
      let haps
      try {
        haps = lane.query(c, c + 1).filter(hasOnset)
      } catch (err) {
        warnings.push(`A lane failed at cycle ${c}: ${(err as Error).message}`)
        break
      }
      const at = new Map<string, Set<number>>()
      for (const h of haps) {
        const s = h.v.s === undefined ? '' : String(h.v.s)
        const d = s ? drumOf(s) : -1
        if (d >= 0) {
          drums[d].count++
          if (h.v.gain !== undefined) drums[d].gains.push(Number(h.v.gain))
          if (h.v.room !== undefined) drumRooms.push(Number(h.v.room))
          continue
        }
        if (h.v.note === undefined && h.v.n === undefined) continue
        notes++
        if (s) sounds.set(s, (sounds.get(s) ?? 0) + 1)
        for (const k of PARAMS) if (typeof h.v[k] === 'number') (vals.get(k) ?? vals.set(k, []).get(k)!).push(h.v[k] as number)
        const key = `${c}:${h.b.toFixed(4)}`
        const set = at.get(key) ?? at.set(key, new Set()).get(key)!
        set.add(Number(h.v.note ?? h.v.n))
        if (s) (together.get(key) ?? together.set(key, new Set()).get(key)!).add(s)
      }
      for (const set of at.values()) maxPoly = Math.max(maxPoly, set.size)
    }
    const ranked = [...sounds.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
    const main = ranked[0] ?? ''
    const doubled = ranked.slice(1).filter((s) => [...together.values()].some((set) => set.has(main) && set.has(s)))
    const p: Record<string, number> = {}
    const patterned = new Set<string>()
    for (const [k, xs] of vals) {
      p[k] = median(xs)
      if (new Set(xs.map((x) => x.toFixed(3))).size > 1 && (k === 'lpf' || k === 'hpf')) patterned.add(k)
    }
    return { sound: main, doubled, notes, maxPoly, p, patterned }
  })
  return {
    lanes,
    drums: drums.map((d) => ({ count: d.count, gain: d.gains.length ? median(d.gains) : 1 })),
    drumRoom: drumRooms.length ? median(drumRooms) : 0,
    warnings,
  }
}
