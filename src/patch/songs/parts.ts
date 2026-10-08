import { hasId, MOTION_POINTS, MOTION_RES, pointId } from '../../modules/specs/motion'
import { st } from '../presets/builder'
import { toOut, type Jack, type Kit } from '../starters/kit'

/** Building blocks for the Songs: whole tracks in the style of an era,
 *  written with the same Kit as the ready-to-play rigs (modules lay
 *  themselves out in the order they're added). */

/** A 16-step pattern from a string: x = hit, anything else = rest. */
export function hits(s: string): number {
  let m = 0
  for (let i = 0; i < 16 && i < s.length; i++) if (s[i] === 'x' || s[i] === 'X') m |= 1 << i
  return m
}

/** TR-16's tracks, as the songs use them. */
export const TRACK = { kick: 0, snare: 1, clap: 2, ch: 3, oh: 4, rim: 5, bell: 6, tom: 7, acc: 8 } as const
export type Part = keyof typeof TRACK
export type Bar = Partial<Record<Part, string>>

export interface DrumOpts {
  bpm: number
  /** One bar per pattern; two or four bars make an A→B or A→D arrangement. */
  bars: Bar[]
  swing?: number
  kick?: Record<string, number>
  snare?: Record<string, number>
  clap?: Record<string, number>
  hats?: Record<string, number>
  perc?: Record<string, number>
  tom?: Record<string, number>
}

/** CLOCK → TR-16 → only the drums the bars use. Returns the clock and each
 *  drum's output (unmixed: the desk mixes them, the kick also ducks). */
export function drums(k: Kit, o: DrumOpts) {
  const clock = k.add('clock', { bpm: o.bpm })
  const p: Record<string, number> = { swing: o.swing ?? 0, pat: o.bars.length >= 4 ? 5 : o.bars.length === 2 ? 2 : 0 }
  const uses = new Set<Part>()
  o.bars.forEach((bar, b) => {
    const prefix = 'abcd'[b]
    for (const part of Object.keys(TRACK) as Part[]) {
      p[`${prefix}${TRACK[part]}`] = bar[part] ? hits(bar[part]!) : 0
      if (bar[part] && part !== 'acc') uses.add(part)
    }
  })
  const tr = k.add('tr16', p)
  k.wire([clock, 'x4'], [tr, 'clk'])
  k.wire([clock, 'rst'], [tr, 'rst'])
  const out: Partial<Record<'kick' | 'snare' | 'clap' | 'hats' | 'perc' | 'tom', Jack>> = {}
  if (uses.has('kick')) {
    const d = k.add('kick', o.kick)
    k.wire([tr, 't1'], [d, 'trig'])
    k.wire([tr, 'acc'], [d, 'acc'])
    out.kick = [d, 'out']
  }
  if (uses.has('snare')) {
    const d = k.add('snare', o.snare)
    k.wire([tr, 't2'], [d, 'trig'])
    k.wire([tr, 'acc'], [d, 'acc'])
    out.snare = [d, 'out']
  }
  if (uses.has('clap')) {
    const d = k.add('clap', o.clap)
    k.wire([tr, 't3'], [d, 'trig'])
    out.clap = [d, 'out']
  }
  if (uses.has('ch') || uses.has('oh')) {
    const d = k.add('hats', { chd: 0.04, ...o.hats })
    if (uses.has('ch')) k.wire([tr, 't4'], [d, 'ch'])
    if (uses.has('oh')) k.wire([tr, 't5'], [d, 'oh'])
    k.wire([tr, 'acc'], [d, 'acc'])
    out.hats = [d, 'mix']
  }
  if (uses.has('rim') || uses.has('bell')) {
    const d = k.add('perc', o.perc)
    if (uses.has('rim')) k.wire([tr, 't6'], [d, 'rim'])
    if (uses.has('bell')) k.wire([tr, 't7'], [d, 'bell'])
    out.perc = [d, 'mix']
  }
  if (uses.has('tom')) {
    const d = k.add('tom', o.tom)
    k.wire([tr, 't8'], [d, 'trig'])
    out.tom = [d, 'out']
  }
  return { clock, tr, ...out }
}

/** SEQ-8 step params: semitones (null = rest) at `octave`. */
export function seqSteps(notes: (number | null)[], octave = 0): Record<string, number> {
  const p: Record<string, number> = { len: notes.length, quant: 1 }
  notes.forEach((n, i) => {
    p[`s${i + 1}`] = st((n ?? 0) + 12 * octave)
    p[`g${i + 1}`] = n === null ? 0 : 1
  })
  return p
}

/** A SEQ-8 line stepped by `rate` of the clock. */
export function line(k: Kit, clock: string, notes: (number | null)[], o: { rate?: 'x4' | 'x2' | 'x1' | 'd2'; octave?: number } = {}) {
  const seq = k.add('seq8', seqSteps(notes, o.octave ?? 0))
  k.wire([clock, o.rate ?? 'x4'], [seq, 'clk'])
  k.wire([clock, 'rst'], [seq, 'reset'])
  return { seq, pitch: [seq, 'cv'] as Jack, gate: [seq, 'gate'] as Jack, trig: [seq, 'trig'] as Jack }
}

/** Chords that change with the bar: PROGRESSION on the clock's BAR. `key`
 *  is a semitone (0 = C), `bars` how long each chord lasts. */
export function harmony(k: Kit, clock: string, o: { key: number; minor?: boolean; mood?: number; bars?: number }) {
  const prog = k.add('progression', { key: o.key, mode: o.minor === false ? 0 : 1, mood: o.mood ?? 0.35, bars: o.bars ?? 1 })
  k.wire([clock, 'bar'], [prog, 'clk'])
  k.wire([clock, 'rst'], [prog, 'home'])
  return { prog, notes: [prog, 'notes'] as Jack, root: [prog, 'root'] as Jack }
}

/** Two pitch voltages added (MIX at unity is an exact sum): a riff that
 *  follows the chord root. */
export function plus(k: Kit, a: Jack, b: Jack): Jack {
  const m = k.add('mixer', { l1: 1, l2: 1, l3: 0, l4: 0, master: 1 })
  k.wire(a, [m, 'in1'])
  k.wire(b, [m, 'in2'])
  return [m, 'out']
}

/** A chord on four mono pitches merged onto one poly cable. */
export function chordPoly(k: Kit, root: Jack, qual: number): Jack {
  const ch = k.add('chord', { qual })
  const pm = k.add('polymix', { level: 0 })
  k.wire(root, [ch, 'root'])
  for (let i = 1; i <= 4; i++) k.wire([ch, `v${i}`], [pm, `m${i}`])
  return [pm, 'merged']
}

export interface Channel {
  src: Jack
  lvl?: number
  pan?: number
  /** Send to the desk's effect. */
  snd?: number
  /** How far the kick ducks it (the pump). */
  duck?: number
}

/** The mix: up to six channels on CONSOLE (level, pan, send, duck from the
 *  kick), an effect on the send/return, then OUT. */
export function desk(
  k: Kit,
  chans: Channel[],
  o: { kick?: Jack; fx?: { type: string; params?: Record<string, number>; stereo?: boolean }; ret?: number; rel?: number; vol?: number },
): string {
  const p: Record<string, number> = { ret: o.ret ?? 0.5, rel: o.rel ?? 0.25, master: 0.8 }
  chans.forEach((c, i) => {
    const n = i + 1
    p[`lvl${n}`] = c.lvl ?? 0.7
    p[`pan${n}`] = c.pan ?? 0
    p[`snd${n}`] = c.snd ?? 0
    p[`duck${n}`] = c.duck ?? 0
  })
  for (let n = chans.length + 1; n <= 6; n++) p[`lvl${n}`] = 0
  const con = k.add('console', p)
  chans.forEach((c, i) => k.wire(c.src, [con, `in${i + 1}`]))
  if (o.kick) k.wire(o.kick, [con, 'sc'])
  if (o.fx) {
    const fx = k.add(o.fx.type, o.fx.params)
    k.wire([con, 'send'], [fx, 'in'])
    if (o.fx.stereo) {
      k.wire([fx, 'l'], [con, 'retL'])
      k.wire([fx, 'r'], [con, 'retR'])
    } else {
      k.wire([fx, 'wet'], [con, 'retL'])
      k.wire([fx, 'wet'], [con, 'retR'])
    }
  }
  return toOut(k, [con, 'l'], [con, 'r'], o.vol ?? 0.6)
}

/** A MOTION lane already recorded: `curve(t)` (t = 0..1 round the loop)
 *  gives the knob's position 0..1. Up to four lanes; `bars` 1, 2, 4 or 8. */
export function motion(k: Kit, clock: string, bars: 1 | 2 | 4 | 8, lanes: { mod: string; param: string; curve: (t: number) => number }[]): string {
  const p: Record<string, number> = { bars: [1, 2, 4, 8].indexOf(bars), smooth: 0.45 }
  lanes.forEach((ln, l) => {
    p[hasId(l)] = 1
    for (let i = 0; i < MOTION_POINTS; i++) p[pointId(l, i)] = Math.round(MOTION_RES * Math.min(1, Math.max(0, ln.curve(i / MOTION_POINTS))))
  })
  const m = k.add('motion', p)
  lanes.forEach((ln, l) => k.target(m, l, ln.mod, ln.param))
  k.wire([clock, 'x4'], [m, 'clk'])
  k.wire([clock, 'rst'], [m, 'rst'])
  return m
}

/** Curves for MOTION lanes: a rise over the loop and a drop back (the build). */
export const rise = (lo: number, hi: number, shape = 2) => (t: number) => lo + (hi - lo) * Math.pow(t, shape)
/** Open up and close again, once round the loop. */
export const swell = (lo: number, hi: number) => (t: number) => lo + (hi - lo) * Math.pow(Math.sin(Math.PI * t), 2)
