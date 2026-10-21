import { timbreOfSound } from './adapt'
import { drumOf, isNoise } from './music'
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

/** What a part is keyed by: the sound name plus which treatments it carries
 *  (a low-pass, a high-pass, dirt), so one name used two ways — a `pulse`
 *  bass with lpf and distort, and a `pulse` 16th line with hpf — is two
 *  parts. Only presence counts, so a patterned filter stays one part. */
export function laneKey(v: Record<string, unknown>): string {
  const s = soundKey(v.s)
  let sig = ''
  // a wide-open low-pass or a rumble-cut high-pass isn't a treatment
  if (typeof v.lpf === 'number' && v.lpf < 8000) sig += 'l'
  if (typeof v.hpf === 'number' && v.hpf >= 150) sig += 'h'
  if ((typeof v.shape === 'number' && v.shape > 0.05) || (typeof v.distort === 'number' && v.distort > 0.2)) sig += 'd'
  return sig ? `${s}|${sig}` : s
}

/** A key's name for the report: the sound, with its treatments when the same sound has others. */
export function laneLabel(key: string, keys: Iterable<string>): string {
  const [s, sig] = key.split('|')
  const name = s || 'triangle'
  let twins = 0
  for (const k of keys) if (k.split('|')[0] === s) twins++
  if (twins < 2 || !sig) return name
  const words = [sig.includes('l') && 'lpf', sig.includes('h') && 'hpf', sig.includes('d') && 'dirt'].filter(Boolean)
  return `${name} (${words.join(' ')})`
}

export function planLanes(run: Run, maxLanes: number): LanePlan {
  const root = run.pattern
  const layers = root.layers
  if (layers && layers.length > 1) {
    const pats = layers.length <= maxLanes ? layers : [...layers.slice(0, maxLanes - 1), mergeLayers(layers.slice(maxLanes - 1))]
    return { pats, byName: null, rest: pats.length - 1, names: pats.map((_, i) => `layer ${i + 1}`) }
  }
  // count each non-drum sound over the piece (or 32 cycles), with the filter
  // and dirt it typically asks for, then group what one instrument can play:
  // the same timbre with a filter within half an octave and the same dirt
  const cycles = Math.min(64, root.cycles || 32)
  const stats = new Map<string, SoundStat>()
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
      if (h.v.note === undefined && h.v.n === undefined && h.v.freq === undefined && !isNoise(s)) continue
      const key = laneKey(h.v)
      const st = stats.get(key) ?? stats.set(key, { count: 0, lpf: [], hpf: [], dirt: [] }).get(key)!
      st.count++
      if (typeof h.v.lpf === 'number') st.lpf.push(h.v.lpf)
      if (typeof h.v.hpf === 'number') st.hpf.push(h.v.hpf)
      if (typeof h.v.shape === 'number') st.dirt.push(h.v.shape)
      else if (typeof h.v.distort === 'number') st.dirt.push(h.v.distort / 4)
    }
  }
  const groups: { sounds: string[]; count: number; sig: Signature }[] = []
  for (const [s, st] of [...stats.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const sig = signatureOf(s, st)
    const g = groups.find((x) => compatible(x.sig, sig))
    if (g) {
      g.sounds.push(s)
      g.count += st.count
    } else groups.push({ sounds: [s], count: st.count, sig })
  }
  const ranked = groups.sort((a, b) => b.count - a.count)
  const label = (g: { sounds: string[] }) => g.sounds.map((s) => laneLabel(s, stats.keys())).join(' + ')
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

interface SoundStat {
  count: number
  lpf: number[]
  hpf: number[]
  dirt: number[]
}

/** What one instrument would have to be set to for a sound. */
interface Signature {
  timbre: string
  lpf: number
  hpf: number
  dirty: boolean
}

const median = (xs: number[], none: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : none)

function signatureOf(key: string, st: SoundStat): Signature {
  return { timbre: timbreOfSound(key.split('|')[0]), lpf: median(st.lpf, 20000), hpf: Math.max(50, median(st.hpf, 0)), dirty: median(st.dirt, 0) > 0.05 }
}

const within = (a: number, b: number, octaves: number) => Math.abs(Math.log2(a / b)) <= octaves

function compatible(a: Signature, b: Signature): boolean {
  return a.timbre === b.timbre && a.dirty === b.dirty && within(a.lpf, b.lpf, 0.6) && within(a.hpf, b.hpf, 0.6)
}

function mergeLayers(ps: Pattern[]): Pattern {
  return new (ps[0].constructor as new (q: Pattern['query']) => Pattern)((b, e) => ps.flatMap((p) => p.query(b, e)))
}
