import type { Patch } from '../types'
import { RackBuilder } from './builder'

/** Six-voice poly synth: POLY·CV → P-VCO → P-LADDER (poly filter env) → P-VCA
 *  (poly amp env) → sum → ensemble chorus → plate reverb, in stereo. */
export function polyStrings(): Patch {
  const b = new RackBuilder()
  const cv = b.add('polycv', 0, 0, { voices: 6 })
  const osc = b.add('pvco', 0, 8)
  const vcf = b.add('pvcf', 0, 18, { cutoff: 900, res: 0.3, cv: 0.5 })
  const envF = b.add('padsr', 0, 28, { a: 0.4, d: 1.2, s: 0.4, r: 1.5 })
  const envA = b.add('padsr', 0, 36, { a: 0.25, d: 0.5, s: 0.85, r: 1.8 })
  const vca = b.add('pvca', 0, 44)
  const sum = b.add('polymix', 0, 50, { level: 0.5 })
  const ens = b.add('ensemble', 0, 60, { mix: 0.6 })
  const plate = b.add('plate', 0, 68, { decay: 0.75, mix: 0.35 })
  const out = b.add('output', 0, 78, { vol: 0.8 })
  const scope = b.add('scope', 0, 84, { time: 0.02 })
  b.wire(cv, 'pitch', osc, 'voct')
  b.wire(cv, 'gate', envF, 'gate')
  b.wire(cv, 'gate', envA, 'gate')
  b.wire(osc, 'saw', vcf, 'in')
  b.wire(envF, 'env', vcf, 'cv')
  b.wire(vcf, 'lp', vca, 'in')
  b.wire(envA, 'env', vca, 'cv')
  b.wire(vca, 'out', sum, 'in')
  b.wire(sum, 'sum', ens, 'in')
  b.wire(ens, 'l', plate, 'in')
  b.wire(plate, 'l', out, 'l')
  b.wire(plate, 'r', out, 'r')
  b.wire(sum, 'sum', scope, 'ch1')
  return b.build()
}

/** Interlocking Euclidean rhythms (16- and 12-step cycles) on analog drums,
 *  with a Turing machine playing the tom's pitch. */
export function euclidPolyrhythm(): Patch {
  const b = new RackBuilder()
  const clock = b.add('clock', 0, 0, { bpm: 112 })
  const e1 = b.add('euclid', 0, 8, { stepsA: 16, fillsA: 5, stepsB: 16, fillsB: 7, rotB: 2 })
  const e2 = b.add('euclid', 0, 16, { stepsA: 8, fillsA: 3, stepsB: 12, fillsB: 4, rotB: 1 })
  const tur = b.add('turing', 0, 24, { change: 0.08, len: 8, range: 1 })
  const kick = b.add('kick', 0, 32, { decay: 0.5, punch: 0.6 })
  const tom = b.add('tom', 0, 38, { tune: 110, decay: 0.35 })
  const hats = b.add('hats', 0, 44)
  const perc = b.add('perc', 0, 52)
  const mix = b.add('mixer', 0, 60, { l1: 0.9, l2: 0.7, l3: 0.5, l4: 0.55, master: 0.8 })
  const plate = b.add('plate', 0, 68, { decay: 0.45, mix: 0.2 })
  const out = b.add('output', 0, 78, { vol: 0.75 })
  const scope = b.add('scope', 0, 84, { time: 0.5 })
  b.wire(clock, 'x4', e1, 'clk')
  b.wire(clock, 'x4', e2, 'clk')
  b.wire(clock, 'x4', tur, 'clk')
  b.wire(e2, 'a', kick, 'trig')
  b.wire(e1, 'a', tom, 'trig')
  b.wire(tur, 'cv', tom, 'tune')
  b.wire(e1, 'b', hats, 'ch')
  b.wire(e2, 'b', perc, 'rim')
  b.wire(kick, 'out', mix, 'in1')
  b.wire(tom, 'out', mix, 'in2')
  b.wire(hats, 'mix', mix, 'in3')
  b.wire(perc, 'mix', mix, 'in4')
  b.wire(mix, 'out', plate, 'in')
  b.wire(plate, 'l', out, 'l')
  b.wire(plate, 'r', out, 'r')
  b.wire(e1, 'a', scope, 'ch1')
  b.wire(e2, 'a', scope, 'ch2')
  return b.build()
}

/** Slow generative ambience: a nearly-locked Turing melody quantised to Dorian
 *  on a slowly morphing wavetable, swelled by FUNC, into worn tape and a plate. */
export function tapeAmbient(): Patch {
  const b = new RackBuilder()
  const clock = b.add('clock', 0, 0, { bpm: 30 })
  const tur = b.add('turing', 0, 8, { change: 0.05, len: 8, range: 1.5 })
  const quant = b.add('quant', 0, 16, { scale: 3 })
  const wave = b.add('wave', 0, 24, { coarse: -1, wave: 1, wamt: 0.8 })
  const lfo = b.add('lfo', 0, 34, { rate: 0.05 })
  const func = b.add('func', 0, 42, { rise: 1.5, fall: 3 })
  const vca = b.add('vca', 0, 50)
  const tape = b.add('tape', 0, 56, { time: 1.2, fb: 0.7, mix: 0.5, wow: 0.5, age: 0.5 })
  const plate = b.add('plate', 0, 66, { decay: 0.85, mix: 0.45 })
  const out = b.add('output', 0, 76, { vol: 0.85 })
  const scope = b.add('scope', 0, 82, { time: 0.05 })
  b.wire(clock, 'x1', tur, 'clk')
  b.wire(clock, 'x1', func, 'trig')
  b.wire(tur, 'cv', quant, 'in')
  b.wire(quant, 'out', wave, 'voct')
  b.wire(lfo, 'tri', wave, 'wcv')
  b.wire(wave, 'out', vca, 'in')
  b.wire(func, 'out', vca, 'cv')
  b.wire(vca, 'out', tape, 'in')
  b.wire(tape, 'out', plate, 'in')
  b.wire(plate, 'l', out, 'l')
  b.wire(plate, 'r', out, 'r')
  b.wire(vca, 'out', scope, 'ch1')
  return b.build()
}

/** STUDIO-3 as a classic lead: VCO2 gently FMs VCO1, VCO3 an octave down,
 *  envelope-swept resonant filter, a touch of S&H on the cutoff and spring. */
export function studioClassic(): Patch {
  const b = new RackBuilder()
  const st = b.add('studio', 0, 0, {
    fm1: 0.12, m1: 0.7, m2: 0.5, m3: 0.35, res: 0.45, env: 0.55, shm: 0.12, rate: 6, rev: 0.3,
  })
  const scope = b.add('scope', 0, 64, { time: 0.01 })
  b.wire(st, 'vca', scope, 'ch1')
  b.wire(st, 'adsr', scope, 'ch2')
  return b.build()
}

/** The classic 2600 self-patch: the LFO triggers the envelopes (LFO → GATE)
 *  and S&H of noise picks random pitches (S&H → ATTN → PITCH). */
export function studioBleeps(): Patch {
  const b = new RackBuilder()
  const st = b.add('studio', 0, 0, {
    rate: 6, m1: 0.6, m2: 0.4, m3: 0, res: 0.55, env: 0.5, a: 0.002, d: 0.12, s: 0, r: 0.1, ara: 0.002, arr: 0.15, rev: 0.4,
  })
  const att = b.add('atten', 0, 64, { a: 0.15 })
  const scope = b.add('scope', 0, 70, { time: 0.5 })
  b.wire(st, 'lfo', st, 'gate')
  b.wire(st, 'sh', att, 'a')
  b.wire(att, 'a', st, 'pitch')
  b.wire(st, 'vca', scope, 'ch1')
  b.wire(st, 'sh', scope, 'ch2')
  return b.build()
}
