import { SPECS } from '../../modules'
import { RackBuilder, st } from '../presets/builder'
import type { Patch } from '../types'
import type { Groove, Phrase } from './material'

/** A jack on a module in the rig: [module id, jack id]. */
export type Jack = readonly [string, string]

/** Builds a starter rig: modules are laid out left to right in the order
 *  they're added, wrapping onto a new row when the rail is full, so a rig
 *  is written as a signal chain, never as coordinates. */
export class Kit {
  private readonly b = new RackBuilder()
  private row = 0
  private hp = 0

  constructor(private readonly rail: number) {}

  /** Mount the next module (its own width; params override its defaults). */
  add(type: string, params: Record<string, number> = {}): string {
    const w = SPECS[type].hp
    if (this.hp + w > this.rail && this.hp > 0) {
      this.row++
      this.hp = 0
    }
    const id = this.b.add(type, this.row, this.hp, params)
    this.hp += w
    return id
  }

  wire(from: Jack, to: Jack): void {
    this.b.wire(from[0], from[1], to[0], to[1])
  }

  /** Point a module's slot at another module's knob (MOTION lanes, …). */
  target(id: string, slot: number, mod: string, param: string): void {
    this.b.setMorph(id, slot, { [`${mod}/${param}`]: 1 })
  }

  build(): Patch {
    return this.b.build(1)
  }
}

/** The default phrase: a natural-minor line that walks (semitones), and
 *  which steps play. Rigs with a job of their own pick from material.ts. */
export const PHRASE = [0, 2, 3, 5, 7, 5, 3, 2]
export const PHRASE_GATES = [1, 1, 1, 0, 1, 1, 1, 0]

export interface Melody {
  clock: string
  seq: string
  pitch: Jack
  gate: Jack
  trig: Jack
}

/** A tune to play: CLOCK stepping SEQ-8 through a phrase (quantised to
 *  semitones). `rate`: which clock output steps it (x2 = eighths). */
export function melody(
  k: Kit,
  opts: { bpm?: number; notes?: number[]; gates?: number[]; rate?: 'x1' | 'x2' | 'x4'; octave?: number; clock?: string; phrase?: Phrase } = {},
): Melody {
  const o = { ...opts.phrase, ...opts }
  const clock = o.clock ?? k.add('clock', { bpm: o.bpm ?? 110 })
  const notes = o.notes ?? PHRASE
  const gates = o.gates ?? PHRASE_GATES
  const p: Record<string, number> = { len: notes.length, quant: 1 }
  notes.forEach((n, i) => {
    p[`s${i + 1}`] = st(n + 12 * (o.octave ?? 0))
    p[`g${i + 1}`] = gates[i] ?? 1
  })
  const seq = k.add('seq8', p)
  k.wire([clock, o.rate ?? 'x2'], [seq, 'clk'])
  return { clock, seq, pitch: [seq, 'cv'], gate: [seq, 'gate'], trig: [seq, 'trig'] }
}

/** SEQ-8 step params for a list of semitones (every step's gate on). */
export function steps(notes: number[], octave = 0): Record<string, number> {
  const p: Record<string, number> = {}
  notes.forEach((n, i) => {
    p[`s${i + 1}`] = st(n + 12 * octave)
    p[`g${i + 1}`] = 1
  })
  return p
}

export interface VoiceOpts {
  /** The oscillator (or anything with a 1V/oct input and an audio output). */
  osc?: { type: string; params?: Record<string, number>; voct?: string; out: string }
  /** The filter, its params and the output to take. */
  filter?: { type: string; params?: Record<string, number>; out: string }
  /** A modulation for the filter's CV instead of the envelope. */
  filterCv?: Jack
  env?: { a?: number; d?: number; s?: number; r?: number }
  /** Skip the oscillator: filter this audio instead. */
  audio?: Jack
}

/** A classic voice: oscillator → filter → VCA, one envelope opening both.
 *  Returns its audio out (and the parts, for rigs that patch into them). */
export function voice(k: Kit, pitch: Jack | null, gate: Jack, o: VoiceOpts = {}) {
  let src = o.audio
  let osc = ''
  if (!src) {
    const spec = o.osc ?? { type: 'vco', out: 'saw' }
    osc = k.add(spec.type, spec.params)
    if (pitch) k.wire(pitch, [osc, spec.voct ?? 'voct'])
    src = [osc, spec.out]
  }
  const f = o.filter ?? { type: 'vcf', params: { cutoff: 600, res: 0.4 }, out: 'lp4' }
  const filter = k.add(f.type, { cv: 0.45, ...f.params })
  const vca = k.add('vca', { gain: 0, cv: 1 })
  const env = k.add('adsr', { a: 0.005, d: 0.25, s: 0.35, r: 0.25, ...o.env })
  k.wire(src, [filter, 'in'])
  k.wire([filter, f.out], [vca, 'in'])
  k.wire(gate, [env, 'gate'])
  k.wire([env, 'env'], [vca, 'cv'])
  k.wire(o.filterCv ?? [env, 'env'], [filter, 'cv'])
  return { out: [vca, 'out'] as Jack, osc, filter, vca, env }
}

/** The default sound for rigs that need something to listen to: a plucky
 *  sequenced synth line. */
export function tune(k: Kit, o: { bpm?: number; octave?: number } = {}) {
  const m = melody(k, { bpm: o.bpm, octave: o.octave })
  const v = voice(k, m.pitch, m.gate)
  return { ...m, out: v.out, voice: v }
}

/** Mix up to four sources (levels per input). */
export function mix(k: Kit, ins: Jack[], levels: number[] = []): Jack {
  const p: Record<string, number> = { master: 0.8 }
  for (let i = 0; i < 4; i++) p[`l${i + 1}`] = i < ins.length ? (levels[i] ?? 0.7) : 0
  const m = k.add('mixer', p)
  ins.forEach((j, i) => k.wire(j, [m, `in${i + 1}`]))
  return [m, 'out']
}

/** A source into a plate and out (stereo): for anything that sounds better
 *  in a room. */
export function roomy(k: Kit, src: Jack, plate = 0.3, vol?: number): void {
  const p = k.add('plate', { decay: 0.6, mix: plate })
  k.wire(src, [p, 'in'])
  toOut(k, [p, 'l'], [p, 'r'], vol)
}

/** To the speakers (stereo if given a right channel). */
export function toOut(k: Kit, l: Jack, r?: Jack, vol = 0.55): string {
  const out = k.add('output', { vol })
  k.wire(l, [out, 'l'])
  if (r) k.wire(r, [out, 'r'])
  return out
}

/** A TR-16 track pattern from its steps (0–15; step n = bit n). */
export const bits = (...steps: number[]) => steps.reduce((m, s) => m | (1 << s), 0)
/** Four on the floor, backbeat, offbeat hats. */
export const FOUR = bits(0, 4, 8, 12)
export const BACKBEAT = bits(4, 12)
export const EIGHTHS = bits(2, 6, 10, 14)

/** A beat: CLOCK (16ths) → TR-16 → kick, snare, hats → mixer. Tracks 4–8 are
 *  silent unless `tracks` gives them a pattern (a3…a7 → T4…T8), for extra
 *  drums patched from `tr`. Pass a clock to share one. */
export function beat(
  k: Kit,
  o: {
    bpm?: number
    clock?: string
    level?: number
    tracks?: Record<string, number>
    groove?: Groove
    swing?: number
    kick?: Record<string, number>
    snare?: Record<string, number>
    hats?: Record<string, number>
  } = {},
) {
  const g = o.groove
  const clock = o.clock ?? k.add('clock', { bpm: o.bpm ?? g?.bpm ?? 110 })
  const tr = k.add('tr16', {
    a0: g?.kick ?? FOUR,
    a1: g?.snare ?? BACKBEAT,
    a2: g?.hat ?? EIGHTHS,
    a3: 0,
    a4: 0,
    a5: 0,
    a6: 0,
    a7: 0,
    a8: g?.accent ?? FOUR,
    swing: o.swing ?? 0,
    ...o.tracks,
  })
  const kick = k.add('kick', { decay: 0.55, punch: 0.6, ...o.kick })
  const snare = k.add('snare', o.snare)
  const hats = k.add('hats', { chd: 0.04, ...o.hats })
  k.wire([clock, 'x4'], [tr, 'clk'])
  k.wire([tr, 't1'], [kick, 'trig'])
  k.wire([tr, 't2'], [snare, 'trig'])
  k.wire([tr, 't3'], [hats, 'ch'])
  k.wire([tr, 'acc'], [kick, 'acc'])
  k.wire([tr, 'acc'], [snare, 'acc'])
  const l = o.level ?? 0.7
  return { clock, tr, kick, snare, hats, out: mix(k, [[kick, 'out'], [snare, 'out'], [hats, 'mix']], [l, l * 0.8, l * 0.5]) }
}

/** Chords that play themselves: PROGRESSION moves to a new chord every bar
 *  of the CLOCK (its own GATE is only a blip on each change), and SEQ-8 with
 *  every step on gives a held gate on each beat to articulate them. `notes`
 *  is a poly cable. */
export function chords(k: Kit, o: { bpm?: number; mood?: number } = {}) {
  const clock = k.add('clock', { bpm: o.bpm ?? 88 })
  const prog = k.add('progression', { mood: o.mood ?? 0.4 })
  const p: Record<string, number> = { len: 8 }
  for (let i = 1; i <= 8; i++) {
    p[`s${i}`] = 0
    p[`g${i}`] = 1
  }
  const seq = k.add('seq8', p)
  k.wire([clock, 'bar'], [prog, 'clk'])
  k.wire([clock, 'x1'], [seq, 'clk'])
  return { clock, prog, notes: [prog, 'notes'] as Jack, gate: [seq, 'gate'] as Jack }
}

/** A band: the beat with the tune over it, on one clock, mixed. */
export function band(k: Kit, bpm = 110): Jack {
  const b = beat(k, { bpm })
  const m = melody(k, { clock: b.clock })
  return mix(k, [b.out, voice(k, m.pitch, m.gate).out], [0.8, 0.6])
}
