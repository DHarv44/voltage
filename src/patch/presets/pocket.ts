import type { Patch } from '../types'
import { RackBuilder, st } from './builder'

/** Pocket sound slots. */
const KICK = 0
const SNARE = 1
const CLAP = 2
const HAT = 3
const OPEN = 4
const BLIP = 6
const ZAP = 7

/** Step numbers (1–16) → the sound's step mask. */
const steps = (...on: number[]) => on.reduce((m, s) => m | (1 << (s - 1)), 0)
/** Every 8th note / every 16th. */
const EIGHTHS = steps(1, 3, 5, 7, 9, 11, 13, 15)
const SIXTEENTHS = 0xffff

/** BLIP's pitch knob covers three octaves up from A2 (110 Hz): semitones → A. */
const blip = (semisAboveA2: number) => semisAboveA2 / 36

/** Parameter locks: a melody (or any per-step A values) for one sound. */
function locks(sound: number, perStep: Record<number, number>, ab: 'a' | 'b' = 'a'): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [stepNo, v] of Object.entries(perStep)) out[`l${ab}${sound}_${Number(stepNo) - 1}`] = v
  return out
}

/** Dusty 90 bpm boom-bap: lazy swung kick, fat snare, through worn tape. */
export function pocketBoomBap(): Patch {
  const b = new RackBuilder()
  const pocket = b.add('pocket', 0, 0, {
    run: 1, tempo: 90, swing: 0.2, vol: 0.85,
    // step 16 is a short ghost kick: its decay is locked down
    [`m${KICK}`]: steps(1, 4, 11, 16), a0: 0.22, b0: 0.65,
    ...locks(KICK, { 16: 0.2 }, 'b'),
    [`m${SNARE}`]: steps(5, 13), a1: 0.3, b1: 0.6,
    [`m${CLAP}`]: 0,
    [`m${HAT}`]: EIGHTHS, a3: 0.45, b3: 0.25,
    [`m${OPEN}`]: steps(15), b4: 0.3,
    [`m${BLIP}`]: 0,
  })
  const tape = b.add('tape', 0, 16, { time: 0.5, fb: 0.2, mix: 0.18, wow: 0.35, age: 0.65 })
  const out = b.add('output', 0, 26, { vol: 0.9 })
  const scope = b.add('scope', 0, 32, { time: 0.05 })
  b.wire(pocket, 'out', tape, 'in')
  b.wire(tape, 'out', out, 'l')
  b.wire(tape, 'out', scope, 'ch1')
  return b.build()
}

/** 128 bpm electro: broken kick, claps, ticking 16th hats, a locked BLIP
 *  riff in A minor and laser ZAPs, into a dotted-eighth bucket-brigade echo. */
export function pocketElectro(): Patch {
  const b = new RackBuilder()
  const riff = { 1: blip(12), 4: blip(12), 7: blip(19), 9: blip(15), 12: blip(22), 15: blip(19) }
  const pocket = b.add('pocket', 0, 0, {
    run: 1, tempo: 128, swing: 0.04, vol: 0.8,
    [`m${KICK}`]: steps(1, 7, 11), a0: 0.35, b0: 0.45,
    [`m${CLAP}`]: steps(5, 13), a2: 0.4, b2: 0.35,
    [`m${SNARE}`]: 0,
    [`m${HAT}`]: SIXTEENTHS, a3: 0.7, b3: 0.08,
    [`m${OPEN}`]: steps(3, 15), b4: 0.25,
    [`m${BLIP}`]: steps(...Object.keys(riff).map(Number)), b6: 0.25,
    ...locks(BLIP, riff),
    [`m${ZAP}`]: steps(8, 16), b7: 0.3,
    ...locks(ZAP, { 8: 0.9, 16: 0.35 }),
  })
  const bbd = b.add('bbd', 0, 16, { time: 0.352, fb: 0.35, mix: 0.25, mod: 0.1 })
  const out = b.add('output', 0, 26, { vol: 0.85 })
  const scope = b.add('scope', 0, 32, { time: 0.02 })
  b.wire(pocket, 'out', bbd, 'in')
  b.wire(bbd, 'out', out, 'l')
  b.wire(bbd, 'out', scope, 'ch1')
  return b.build()
}

/** 78 bpm lo-fi: soft kick, rim-like snare, a slow BLIP melody on long
 *  decays, through warbly old tape and a dark plate (stereo). */
export function pocketLofi(): Patch {
  const b = new RackBuilder()
  // A minor pentatonic, a note on each beat-ish
  const melody = { 1: blip(24), 4: blip(19), 7: blip(22), 9: blip(17), 11: blip(15), 14: blip(19) }
  const pocket = b.add('pocket', 0, 0, {
    run: 1, tempo: 78, swing: 0.24, vol: 0.8,
    [`m${KICK}`]: steps(1, 8, 11), a0: 0.15, b0: 0.75,
    [`m${SNARE}`]: steps(5, 13), a1: 0.75, b1: 0.12,
    [`m${CLAP}`]: 0,
    [`m${HAT}`]: EIGHTHS, a3: 0.3, b3: 0.12,
    [`m${OPEN}`]: 0,
    [`m${BLIP}`]: steps(...Object.keys(melody).map(Number)), b6: 0.7,
    ...locks(BLIP, melody),
  })
  const tape = b.add('tape', 0, 16, { time: 0.577, fb: 0.3, mix: 0.3, wow: 0.55, age: 0.85 })
  const plate = b.add('plate', 0, 26, { decay: 0.75, damp: 0.65, pre: 0.03, mix: 0.3 })
  const out = b.add('output', 0, 36, { vol: 0.95 })
  const scope = b.add('scope', 0, 42, { time: 0.05 })
  b.wire(pocket, 'out', tape, 'in')
  b.wire(tape, 'out', plate, 'in')
  b.wire(plate, 'l', out, 'l')
  b.wire(plate, 'r', out, 'r')
  b.wire(tape, 'out', scope, 'ch1')
  return b.build()
}

/** The Pocket as the band's clock: its CLK out steps SEQ-8 through a
 *  bassline on MONO-1, mixed with the beat. */
export function pocketBass(): Patch {
  const b = new RackBuilder()
  const pocket = b.add('pocket', 0, 0, {
    run: 1, tempo: 118, swing: 0.1, vol: 0.8,
    [`m${KICK}`]: steps(1, 5, 9, 13), a0: 0.3, b0: 0.55,
    [`m${SNARE}`]: 0,
    [`m${CLAP}`]: steps(5, 13),
    [`m${HAT}`]: 0,
    [`m${OPEN}`]: steps(3, 7, 11, 15), b4: 0.2,
    [`m${BLIP}`]: 0,
  })
  const mono = b.add('mono', 0, 16, {
    tune: -2, wave: 0.6, cutoff: 450, res: 0.55, envamt: 0.45, drive: 1.8, a: 0.002, d: 0.16, s: 0, r: 0.08, pwm: 0, vol: 0.55,
  })
  const notes = [0, 0, 7, 0, 10, 0, 12, 7]
  const gates = [1, 0, 1, 1, 1, 0, 1, 1]
  const seqParams: Record<string, number> = { len: 8, quant: 1 }
  notes.forEach((n, i) => {
    seqParams[`s${i + 1}`] = st(n)
    seqParams[`g${i + 1}`] = gates[i]
  })
  const seq = b.add('seq8', 0, 56, seqParams)
  const mix = b.add('mixer', 0, 74, { l1: 0.8, l2: 0.7, l3: 0, l4: 0, master: 0.8 })
  const out = b.add('output', 0, 82, { vol: 0.7 })
  const scope = b.add('scope', 0, 88, { time: 0.02 })
  b.wire(pocket, 'clko', seq, 'clk')
  b.wire(seq, 'cv', mono, 'pitch')
  b.wire(seq, 'gate', mono, 'gate')
  b.wire(pocket, 'out', mix, 'in1')
  b.wire(mono, 'vca', mix, 'in2')
  b.wire(mix, 'out', out, 'l')
  b.wire(mono, 'vcf', scope, 'ch1')
  return b.build()
}
