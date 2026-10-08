import { chords, melody, mix, roomy, toOut, voice, type Kit } from './kit'
import { PHRASES } from './material'
import type { Starter } from './types'

/** Self-playing poly chords (see chords()) through a poly voice; each poly
 *  module's rig turns up the part that module plays. */
function polyRig(
  k: Kit,
  o: { vco?: Record<string, number>; vcf?: Record<string, number>; env?: Record<string, number>; wave?: string; sweep?: number; tremolo?: number; bpm?: number } = {},
): string {
  const c = chords(k, { bpm: o.bpm })
  const vco = k.add('pvco', { fine: 0.05, ...o.vco })
  const vcf = k.add('pvcf', { cutoff: 1400, res: 0.2, cv: 0.35, ...o.vcf })
  const vca = k.add('pvca', { gain: 0, cv: 1 })
  const env = k.add('padsr', { a: 0.03, d: 0.6, s: 0.5, r: 0.5, ...o.env })
  const pm = k.add('polymix', { level: 0.7 })
  const plate = k.add('plate', { decay: 0.7, mix: 0.3 })
  k.wire(c.notes, [vco, 'voct'])
  k.wire(c.gate, [env, 'gate'])
  k.wire([vco, o.wave ?? 'saw'], [vcf, 'in'])
  k.wire([vcf, 'lp'], [vca, 'in'])
  k.wire([env, 'env'], [vca, 'cv'])
  // the filter follows the envelope, or a slow sweep
  if (o.sweep) {
    const lfo = k.add('lfo', { rate: o.sweep })
    k.wire([lfo, 'tri'], [vcf, 'cv'])
  } else k.wire([env, 'env'], [vcf, 'cv'])
  k.wire([vca, 'out'], [pm, 'in'])
  if (o.tremolo) {
    const lfo = k.add('lfo', { rate: o.tremolo })
    const trem = k.add('vca', { gain: 0.8, cv: 0.3 })
    k.wire([pm, 'sum'], [trem, 'in'])
    k.wire([lfo, 'sin'], [trem, 'cv'])
    k.wire([trem, 'out'], [plate, 'in'])
  } else k.wire([pm, 'sum'], [plate, 'in'])
  toOut(k, [plate, 'l'], [plate, 'r'])
  return pm
}

export const SOURCE_STARTERS: Record<string, Starter> = {
  mono: {
    howTo: 'An acid line on MONO-1 with its own GLIDE on: every note slides into the next. Turn CUTOFF, RESONANCE and ENV AMT while it plays.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.acid })
      const mono = k.add('mono', { cutoff: 320, res: 0.75, envamt: 0.65, d: 0.18, s: 0.1, glide: 0.06, wave: 0 })
      k.wire(m.pitch, [mono, 'pitch'])
      k.wire(m.gate, [mono, 'gate'])
      toOut(k, [mono, 'vca'], undefined, 0.6)
    },
  },
  studio: {
    howTo: 'STUDIO-3 singing a lead line through its own spring. Try its three VCO levels (detune them), the ring modulator and the filter.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.lead })
      const s = k.add('studio', { vol: 0.3 })
      k.wire(m.pitch, [s, 'pitch'])
      k.wire(m.gate, [s, 'gate'])
      toOut(k, [s, 'out'])
    },
  },
  sketchbook: {
    howTo: 'SKETCHBOOK playing its pattern. Try the four engines (◀ ▶ in SYNTH), then TAPE: pick a track, ● REC a loop, layer the next.',
    build(k) {
      const s = k.add('sketchbook', { run: 1 })
      toOut(k, [s, 'l'], [s, 'r'])
    },
  },
  kin: {
    howTo: 'KIN-8 running its 8 steps. Turn the PITCH and VELOCITY knobs; sweep VCO DECAY, 1→2 FM and the VCF EG.',
    build(k) {
      const d = k.add('kin', { run: 1 })
      toOut(k, [d, 'vca'], undefined, 0.5)
    },
  },
  undertone: {
    howTo: 'UNDERTONE clocking KIN-8 (its CLK into KIN-8 ADV). Light other RHYTHMS squares, try XOR, turn the SUB ÷ knobs.',
    build(k) {
      const u = k.add('undertone', { run: 1 })
      const d = k.add('kin', { vol: 0.45, vcadec: 0.18 })
      k.wire([u, 'clk'], [d, 'adv'])
      k.wire([u, 'rsto'], [d, 'rst'])
      const plate = k.add('plate', { decay: 0.55, mix: 0.25 })
      k.wire(mix(k, [[u, 'vca'], [d, 'vca']], [0.9, 0.75]), [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'], 0.65)
    },
  },
  lockstep: {
    howTo:
      'LOCKSTEP playing four FM tracks. Pick a track, click steps to toggle trigs; right-click a step to select it, then turn a knob to lock it on that step (TRIG page: its note and condition). A–D are patterns: B a busier variation, C a breakdown (hold FILL for the kick), D blank: COPY one, pick D, PASTE. Tap CHAIN to play A A B C in turn (hold it to write your own).',
    build(k) {
      const g = k.add('lockstep', { run: 1 })
      toOut(k, [g, 'l'], [g, 'r'])
    },
  },
  lattice: {
    howTo:
      'LATTICE playing five of its eight layers (5 is a traced line, swung). Pick a layer, click or drag across the lights to draw; MODE switches SCORE / BOUNCE / RANDOM / HOLD / SOLO / DRAW. On 5 (DRAW), hold and trace a new path: it plays as you draw, then loops. Try SOLO on layer 6 and play the lights.',
    build(k) {
      const g = k.add('lattice', { run: 1 })
      const plate = k.add('plate', { decay: 0.6, mix: 0.25 })
      k.wire(mix(k, [[g, 'l'], [g, 'r']], [0.7, 0.7]), [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'])
    },
  },
  groove: {
    howTo: 'GROOVE-1 running its pattern. Edit steps on its grid; try SWING.',
    build(k) {
      const g = k.add('groove', { run: 1, tempo: 112, vol: 0.3 })
      toOut(k, [g, 'mix'])
    },
  },
  polycv: {
    howTo: 'Play chords on your keyboard (keys A–K) or a MIDI keyboard.',
    played: true,
    build(k) {
      const cv = k.add('polycv', { voices: 6 })
      const vco = k.add('pvco', { fine: 0.06 })
      const vcf = k.add('pvcf', { cutoff: 1500, cv: 0.3 })
      const vca = k.add('pvca', { gain: 0, cv: 1 })
      const env = k.add('padsr', { a: 0.05, d: 0.6, s: 0.6, r: 0.8 })
      const pm = k.add('polymix')
      k.wire([cv, 'pitch'], [vco, 'voct'])
      k.wire([cv, 'gate'], [env, 'gate'])
      k.wire([vco, 'saw'], [vcf, 'in'])
      k.wire([vcf, 'lp'], [vca, 'in'])
      k.wire([env, 'env'], [vca, 'cv'])
      k.wire([env, 'env'], [vcf, 'cv'])
      k.wire([vca, 'out'], [pm, 'in'])
      roomy(k, [pm, 'sum'])
    },
  },
  pvco: {
    howTo: 'Brassy chords: every P-VCO voice drifts on its own and FINE pulls them apart, so each chord beats and spreads. Turn FINE; try the PULSE output and WIDTH.',
    build: (k) => void polyRig(k, { vco: { fine: 0.16 }, vcf: { cutoff: 1800 }, env: { a: 0.06, d: 0.4, s: 0.6, r: 0.3 } }),
  },
  pvcf: {
    howTo: 'A ladder on every voice, all swept together by a slow LFO: the chords open and close like a breathing pad. Turn CUTOFF and RESONANCE on P-LADDER.',
    build: (k) => void polyRig(k, { vcf: { cutoff: 1000, res: 0.6, cv: 0.45 }, sweep: 0.1, env: { a: 0.2, s: 0.8, r: 0.8 } }),
  },
  padsr: {
    howTo: 'P-ADSR with a slow ATTACK and long RELEASE: each chord swells in and the last one rings under the next. Turn ATTACK down for plucked chords.',
    build: (k) => void polyRig(k, { env: { a: 1.4, d: 1, s: 0.8, r: 2.2 }, bpm: 72 }),
  },
  pvca: {
    howTo: 'Chords through P-VCA (one VCA per voice, each with its own envelope), then a tremolo on the sum. Turn P-VCA LEVEL up to hold the chords open.',
    build: (k) => void polyRig(k, { tremolo: 4.5, env: { a: 0.02, s: 0.7, r: 0.6 } }),
  },
  polymix: {
    howTo: 'Two POLY MIXes, two jobs: one SUMS the chord’s voices to mono for the reverb; the other SPLITS the chord’s pitch cable, and V1 (the root) plays a bass two octaves down.',
    build(k) {
      const c = chords(k, { bpm: 84 })
      const vco = k.add('pvco', { fine: 0.06 })
      const vca = k.add('pvca', { gain: 0, cv: 1 })
      const env = k.add('padsr', { a: 0.1, d: 0.8, s: 0.7, r: 0.8 })
      const sum = k.add('polymix', { level: 0.55 })
      const split = k.add('polymix')
      k.wire(c.notes, [vco, 'voct'])
      k.wire(c.gate, [env, 'gate'])
      k.wire([vco, 'saw'], [vca, 'in'])
      k.wire([env, 'env'], [vca, 'cv'])
      k.wire([vca, 'out'], [sum, 'in'])
      k.wire(c.notes, [split, 'in'])
      const bass = voice(k, null, c.gate, { osc: { type: 'vco', params: { coarse: -2 }, out: 'saw' }, env: { d: 0.4, s: 0.6, r: 0.3 } })
      k.wire([split, 'c1'], [bass.osc, 'voct'])
      const plate = k.add('plate', { decay: 0.7, mix: 0.3 })
      k.wire([sum, 'sum'], [plate, 'in'])
      toOut(k, mix(k, [[plate, 'l'], bass.out], [0.7, 0.6]))
    },
  },
  vco: {
    howTo: 'Two VCOs a few cents apart, one saw and one pulse whose width an LFO slowly sweeps (PWM): the raw, moving sound of analog. Turn FINE, WIDTH and PWM.',
    build(k) {
      const m = melody(k, { phrase: { ...PHRASES.slow, octave: -1 } })
      const a = k.add('vco', { fine: 0.06 })
      const b = k.add('vco', { pwm: 0.6, pw: 0.4 })
      const lfo = k.add('lfo', { rate: 0.3 })
      k.wire(m.pitch, [a, 'voct'])
      k.wire(m.pitch, [b, 'voct'])
      k.wire([lfo, 'tri'], [b, 'pwm'])
      toOut(k, voice(k, null, m.gate, { audio: mix(k, [[a, 'saw'], [b, 'sqr']], [0.5, 0.5]), env: { a: 0.02, d: 0.5, s: 0.8, r: 0.6 }, filter: { type: 'vcf', params: { cutoff: 1600, res: 0.2, cv: 0.3 }, out: 'lp4' } }).out)
    },
  },
  complex: {
    howTo: 'A Music-Easel patch: COMPLEX’s modulator sweeping its FM INDEX from a slow LFO, notes from a Turing machine, struck through an LPG. Turn INDEX, TIMBRE and MOD FREQ.',
    build(k) {
      const c = k.add('clock', { bpm: 100 })
      const t = k.add('turing', { change: 0.12 })
      const att = k.add('atten', { a: 0.2 })
      const q = k.add('quant', { scale: 3, trans: 2 })
      const osc = k.add('complex', { index: 1.2, timbre: 0.35, mfreq: 330 })
      const lfo = k.add('lfo', { rate: 0.15 })
      const g = k.add('lpg', { dec1: 0.45 })
      k.wire([c, 'x2'], [t, 'clk'])
      k.wire([t, 'cv'], [att, 'a'])
      k.wire([att, 'a'], [q, 'in'])
      k.wire([q, 'out'], [osc, 'voct'])
      k.wire([lfo, 'tri'], [osc, 'idx'])
      k.wire([osc, 'out'], [g, 'in1'])
      k.wire([t, 'gate'], [g, 'strike1'])
      roomy(k, [g, 'out1'], 0.25)
    },
  },
  wave: {
    howTo: 'Long notes slowly morphing through WAVE’s eight tables, an LFO on its WAVE CV: a pad that never sits still. Turn WAVE and CV AMT.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.slow, rate: 'x1' })
      const lfo = k.add('lfo', { rate: 0.08 })
      const v = voice(k, m.pitch, m.gate, { osc: { type: 'wave', params: { wave: 2, wamt: 0.8 }, out: 'out' }, filter: { type: 'vcf', params: { cutoff: 2400, res: 0.15, cv: 0.2 }, out: 'lp2' }, env: { a: 0.4, d: 1, s: 0.8, r: 1.2 } })
      k.wire([lfo, 'tri'], [v.osc, 'wcv'])
      roomy(k, v.out, 0.3)
    },
  },
  sub: {
    howTo: 'A techno bass: a pulse an octave down, SUB adding square waves one and two octaves below it, a kick on the beat. Turn the SUB mix to feel the floor shake.',
    build(k) {
      const m = melody(k, { notes: [0, 0, 0, 0, 0, 0, 3, 0], gates: [0, 1, 1, 0, 1, 1, 0, 1], rate: 'x4', octave: -1, bpm: 126 })
      const vco = k.add('vco', { pw: 0.3 })
      const sub = k.add('sub', { lvl: 0.7 })
      k.wire(m.pitch, [vco, 'voct'])
      k.wire([vco, 'sqr'], [sub, 'in'])
      const bass = voice(k, null, m.gate, { audio: [sub, 'mix'], env: { d: 0.12, s: 0.3, r: 0.06 } })
      const kick = k.add('kick', { decay: 0.4, punch: 0.7 })
      k.wire([m.clock, 'x1'], [kick, 'trig'])
      toOut(k, mix(k, [bass.out, [kick, 'out']], [0.7, 0.75]))
    },
  },
  noise: {
    howTo: 'Surf: pink noise swelling and falling through a filter, one slow LFO opening both the filter and the level, like waves breaking. Turn the LFO RATE.',
    build(k) {
      const n = k.add('noise')
      const lfo = k.add('lfo', { rate: 0.09 })
      const f = k.add('svf', { cutoff: 900, res: 0.15, cv: 0.45 })
      const vca = k.add('vca', { gain: 0.65, cv: 0.4 })
      k.wire([n, 'pink'], [f, 'in'])
      k.wire([lfo, 'sin'], [f, 'cv'])
      k.wire([f, 'lp'], [vca, 'in'])
      k.wire([lfo, 'sin'], [vca, 'cv'])
      roomy(k, [vca, 'out'], 0.35, 0.85)
    },
  },
}
