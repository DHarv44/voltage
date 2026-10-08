import { melody, mix, toOut, voice, type Jack, type Kit } from './kit'
import { PHRASES } from './material'
import { pad } from './effects'
import type { Starter } from './types'

/** Three oscillators holding an A-minor chord (A, C, E), mixed: a drone for
 *  modules that shape a steady sound rather than notes. */
function heldChord(k: Kit, wave = 'saw'): Jack {
  const oscs = [-3, 0, 4].map((semi, i): Jack => {
    const o = k.add('vco', { coarse: semi / 12 - 1, fine: (i - 1) * 0.04 })
    return [o, wave]
  })
  return mix(k, oscs, [0.4, 0.4, 0.4])
}

/** Notes a Turing machine invents in D dorian, with its gate: endless, but looping. */
function wandering(k: Kit, bpm: number, change = 0.15): { pitch: Jack; gate: Jack; clock: string } {
  const c = k.add('clock', { bpm })
  const t = k.add('turing', { change })
  const att = k.add('atten', { a: 0.22 })
  const q = k.add('quant', { scale: 3, trans: 2 })
  k.wire([c, 'x2'], [t, 'clk'])
  k.wire([t, 'cv'], [att, 'a'])
  k.wire([att, 'a'], [q, 'in'])
  return { pitch: [q, 'out'], gate: [t, 'gate'], clock: c }
}

export const PROCESSOR_STARTERS: Record<string, Starter> = {
  vcf: {
    howTo: 'An acid bassline through the LADDER: high resonance, a big envelope sweep and a touch of glide. Turn CUTOFF and RESONANCE while it plays.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.acid })
      const glide = k.add('slew', { rise: 0.035, fall: 0.035 })
      k.wire(m.pitch, [glide, 'in'])
      const v = voice(k, [glide, 'out'], m.gate, { filter: { type: 'vcf', params: { cutoff: 260, res: 0.82, cv: 0.75, drive: 1.6 }, out: 'lp4' }, env: { d: 0.18, s: 0.05, r: 0.08 } })
      const kick = k.add('kick', { decay: 0.4 })
      k.wire([m.clock, 'x1'], [kick, 'trig'])
      toOut(k, mix(k, [v.out, [kick, 'out']], [0.75, 0.7]))
    },
  },
  svf: {
    howTo: 'A chord pad through the SVF’s BAND-PASS, a slow LFO sweeping it: almost a vowel. Try the LP, HP and NOTCH outputs, and RESONANCE.',
    build(k) {
      const f = k.add('svf', { cutoff: 700, res: 0.75, cv: 0.6 })
      const lfo = k.add('lfo', { rate: 0.12 })
      k.wire(pad(k, { a: 0.2 }), [f, 'in'])
      k.wire([lfo, 'tri'], [f, 'cv'])
      toOut(k, [f, 'bp'])
    },
  },
  ms: {
    howTo: 'A growling bass through the MS-12 with PEAK near self-oscillation: it screams on every note. Push PEAK further; try the HP output.',
    build(k) {
      const m = melody(k, { phrase: { ...PHRASES.dub, octave: -1 } })
      toOut(k, voice(k, m.pitch, m.gate, { filter: { type: 'ms', params: { cutoff: 420, peak: 1.05, cv: 0.65 }, out: 'lp' }, env: { d: 0.3, s: 0.2, r: 0.15 } }).out)
    },
  },
  lpg: {
    howTo: 'A Turing machine invents notes in D dorian and strikes the LPG on each: the woody west-coast "bongo". Turn DECAY; try the MODE switch.',
    build(k) {
      const w = wandering(k, 108)
      const osc = k.add('vco', { coarse: 1 })
      const g = k.add('lpg', { off1: 0, amt1: 0, dec1: 0.3 })
      const plate = k.add('plate', { decay: 0.6, mix: 0.3 })
      k.wire(w.pitch, [osc, 'voct'])
      k.wire([osc, 'tri'], [g, 'in1'])
      k.wire(w.gate, [g, 'strike1'])
      k.wire([g, 'out1'], [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'])
    },
  },
  vca: {
    howTo: 'A held chord through the VCA, an LFO on its CV: tremolo. Turn the LFO RATE; LEVEL sets how far it closes; RESPONSE changes the throb.',
    build(k) {
      const vca = k.add('vca', { gain: 0.5, cv: 0.5 })
      const lfo = k.add('lfo', { rate: 5 })
      k.wire(heldChord(k, 'tri'), [vca, 'in'])
      k.wire([lfo, 'sin'], [vca, 'cv'])
      toOut(k, [vca, 'out'])
    },
  },
  vcamix: {
    howTo: 'A lead and a bass, each through its own VCA in VCA×4 with its own envelope, mixed. Turn the levels; unplug a CV to hold one open.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.lead })
      const lo = melody(k, { clock: m.clock, phrase: PHRASES.dub, rate: 'x1' })
      const a = k.add('vco')
      const b = k.add('vco')
      const ea = k.add('adsr', { d: 0.25, s: 0.4 })
      const eb = k.add('adsr', { d: 0.5, s: 0.5 })
      const vm = k.add('vcamix', { lvl1: 0.12, lvl2: 0.16 })
      k.wire(m.pitch, [a, 'voct'])
      k.wire(lo.pitch, [b, 'voct'])
      k.wire(m.gate, [ea, 'gate'])
      k.wire(lo.gate, [eb, 'gate'])
      k.wire([a, 'saw'], [vm, 'in1'])
      k.wire([ea, 'env'], [vm, 'cv1'])
      k.wire([b, 'sqr'], [vm, 'in2'])
      k.wire([eb, 'env'], [vm, 'cv2'])
      const f = k.add('vcf', { cutoff: 1400, res: 0.3 })
      k.wire([vm, 'mix'], [f, 'in'])
      toOut(k, [f, 'lp4'])
    },
  },
  fold: {
    howTo: 'A sine bass folded harder by a slow LFO: the west-coast way to make harmonics without a filter. Turn FOLDS and SYMMETRY.',
    build(k) {
      const m = melody(k, { phrase: { ...PHRASES.dub, octave: -1 } })
      const osc = k.add('vco')
      const lfo = k.add('lfo', { rate: 0.2 })
      const fold = k.add('fold', { fold: 1.8, cv: 0.6 })
      const vca = k.add('vca', { gain: 0, cv: 1 })
      const env = k.add('adsr', { d: 0.5, s: 0.4, r: 0.3 })
      k.wire(m.pitch, [osc, 'voct'])
      k.wire(m.gate, [env, 'gate'])
      k.wire([osc, 'sin'], [fold, 'in'])
      k.wire([lfo, 'tri'], [fold, 'cv'])
      k.wire([fold, 'out'], [vca, 'in'])
      k.wire([env, 'env'], [vca, 'cv'])
      toOut(k, [vca, 'out'])
    },
  },
  ring: {
    howTo: 'Sine notes ring-modulated against RING’s own oscillator at an unrelated ratio: bells and gongs. Turn FREQ for different metals.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.slow })
      const osc = k.add('vco')
      const ring = k.add('ring', { freq: 615 })
      k.wire(m.pitch, [osc, 'voct'])
      k.wire(m.pitch, [ring, 'voct'])
      k.wire([osc, 'sin'], [ring, 'x'])
      const v = voice(k, null, m.trig, { audio: [ring, 'out'], filter: { type: 'vcf', params: { cutoff: 6000, res: 0 }, out: 'lp2' }, env: { a: 0.001, d: 1.6, s: 0, r: 1.6 } })
      const p = k.add('plate', { decay: 0.7, mix: 0.3 })
      k.wire(v.out, [p, 'in'])
      toOut(k, [p, 'l'], [p, 'r'])
    },
  },
  slew: {
    howTo: 'A lead with wide leaps, SLEW gliding between the notes (portamento). Turn RISE and FALL separately: slow up, quick down.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.lead })
      const s = k.add('slew', { rise: 0.15, fall: 0.15 })
      k.wire(m.pitch, [s, 'in'])
      toOut(k, voice(k, [s, 'out'], m.gate, { filter: { type: 'vcf', params: { cutoff: 1800, res: 0.3 }, out: 'lp2' }, env: { s: 0.7 } }).out)
    },
  },
  quant: {
    howTo: 'Random voltages on every 16th, snapped into D dorian by QUANT: bleeps that always fit. Change SCALE; TRANSPOSE moves the key.',
    build(k) {
      const c = k.add('clock', { bpm: 116 })
      const n = k.add('noise')
      const sh = k.add('sh')
      const att = k.add('atten', { a: 0.18 })
      const q = k.add('quant', { scale: 3, trans: 2 })
      k.wire([n, 'white'], [sh, 'in'])
      k.wire([c, 'x4'], [sh, 'trig'])
      k.wire([sh, 'out'], [att, 'a'])
      k.wire([att, 'a'], [q, 'in'])
      const v = voice(k, [q, 'out'], [c, 'x4'], { env: { d: 0.09, s: 0, r: 0.06 } })
      const d = k.add('bbd', { time: 0.39, fb: 0.4, mix: 0.3 })
      k.wire(v.out, [d, 'in'])
      toOut(k, [d, 'out'], undefined, 0.85)
    },
  },
}
