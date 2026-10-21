import { planLanes, soundKey, type LanePlan } from './lanes'
import { DRUM_OUTS, drumOf, isNoise } from './music'
import { hasOnset, type Hap } from './pattern'
import type { Run } from './run'

/** What the importer learns about one lane. */
export interface LaneInfo {
  /** The lane's name on the report (its sound, or "layer n"). */
  name: string
  /** The sound most of its notes name ('' when none: Strudel's triangle). */
  sound: string
  /** Other sounds played at the same moments as the main one (a layered patch). */
  doubled: string[]
  notes: number
  maxPoly: number
  /** Typical values of the numeric controls it uses. */
  p: Record<string, number>
  /** Controls whose value changes from note to note. */
  patterned: Set<string>
  /** The vowel it mostly asks for, when it does. */
  vowel?: string
}

export interface Analysis {
  plan: LanePlan
  lanes: LaneInfo[]
  drums: { count: number; gain: number; decay?: number; bank?: string }[]
  drumRoom: number
  warnings: string[]
}

const PARAMS = ['gain', 'pan', 'room', 'delay', 'delaytime', 'delayfb', 'lpf', 'hpf', 'lpq', 'attack', 'decay', 'sustain', 'release', 'shape', 'distort', 'crush', 'coarse', 'phaser', 'phaserdepth']

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Query the piece (or 32 cycles of an endless one) lane by lane and sum each up. */
export function analyseLanes(run: Run, maxLanes: number): Analysis {
  const plan = planLanes(run, maxLanes)
  const cycles = Math.min(64, run.pattern.cycles || 32)
  const drums = DRUM_OUTS.map(() => ({ count: 0, gains: [] as number[], decays: [] as number[], banks: new Map<string, number>() }))
  const drumRooms: number[] = []
  const warnings: string[] = []
  const laneCount = plan.byName ? plan.names.length : plan.pats.length
  const acc = Array.from({ length: laneCount }, () => ({
    sounds: new Map<string, number>(),
    vals: new Map<string, number[]>(),
    vowels: new Map<string, number>(),
    notes: 0,
    maxPoly: 0,
    together: new Map<string, Set<string>>(),
  }))
  const takeIn = (l: number, h: Hap, c: number, at: Map<string, Set<number>>) => {
    const a = acc[l]
    const s = soundKey(h.v.s)
    a.notes++
    a.sounds.set(s, (a.sounds.get(s) ?? 0) + 1)
    for (const k of PARAMS) if (typeof h.v[k] === 'number') (a.vals.get(k) ?? a.vals.set(k, []).get(k)!).push(h.v[k] as number)
    if (typeof h.v.vowel === 'string') a.vowels.set(h.v.vowel, (a.vowels.get(h.v.vowel) ?? 0) + 1)
    const key = `${l}:${c}:${h.b.toFixed(4)}`
    const set = at.get(key) ?? at.set(key, new Set()).get(key)!
    set.add(Number(h.v.note ?? h.v.n ?? h.v.freq))
    ;(a.together.get(key) ?? a.together.set(key, new Set()).get(key)!).add(s)
  }
  for (let c = 0; c < cycles; c++) {
    const at = new Map<string, Set<number>>()
    plan.pats.forEach((pat, pi) => {
      let haps
      try {
        haps = pat.query(c, c + 1).filter(hasOnset)
      } catch (err) {
        warnings.push(`Cycle ${c} failed: ${(err as Error).message}`)
        return
      }
      for (const h of haps) {
        const s = soundKey(h.v.s)
        const d = s ? drumOf(s) : -1
        if (d >= 0) {
          drums[d].count++
          if (h.v.gain !== undefined) drums[d].gains.push(Number(h.v.gain))
          if (h.v.decay !== undefined) drums[d].decays.push(Number(h.v.decay))
          if (typeof h.v.bank === 'string') drums[d].banks.set(h.v.bank, (drums[d].banks.get(h.v.bank) ?? 0) + 1)
          if (h.v.room !== undefined) drumRooms.push(Number(h.v.room))
          continue
        }
        if (h.v.note === undefined && h.v.n === undefined && h.v.freq === undefined && !isNoise(s)) continue
        takeIn(plan.byName ? (plan.byName.get(s) ?? plan.rest) : pi, h, c, at)
      }
    })
    for (const [key, set] of at) {
      const l = Number(key.split(':')[0])
      acc[l].maxPoly = Math.max(acc[l].maxPoly, set.size)
    }
  }
  const lanes = acc.map((a, i): LaneInfo => {
    const ranked = [...a.sounds.entries()].sort((x, y) => y[1] - x[1]).map(([s]) => s)
    const main = ranked[0] ?? ''
    const doubled = ranked.slice(1).filter((s) => [...a.together.values()].some((set) => set.has(main) && set.has(s)))
    const p: Record<string, number> = {}
    const patterned = new Set<string>()
    for (const [k, xs] of a.vals) {
      p[k] = median(xs)
      // a filter that moves: values at least 1.5× apart (5000 vs 6000 is one setting, near enough)
      if ((k === 'lpf' || k === 'hpf') && Math.max(...xs) >= Math.min(...xs) * 1.5) patterned.add(k)
    }
    const vowel = [...a.vowels.entries()].sort((x, y) => y[1] - x[1])[0]?.[0]
    return { name: plan.names[i] ?? `lane ${i + 1}`, sound: main, doubled, notes: a.notes, maxPoly: a.maxPoly, p, patterned, vowel }
  })
  return {
    plan,
    lanes,
    drums: drums.map((d) => ({
      count: d.count,
      gain: d.gains.length ? median(d.gains) : 1,
      decay: d.decays.length ? median(d.decays) : undefined,
      bank: [...d.banks.entries()].sort((x, y) => y[1] - x[1])[0]?.[0],
    })),
    drumRoom: drumRooms.length ? median(drumRooms) : 0,
    warnings,
  }
}
