import { beat, melody, mix, rollOnFm, toOut, voice } from './kit'
import { GROOVES, PHRASES } from './material'
import type { Starter } from './types'

/** Rigs for the modules that filled the gaps in the range: each shows the
 *  job its module is known for. */
export const GAP_STARTERS: Record<string, Starter> = {
  panner: {
    howTo: 'A bright arpeggio swirling slowly from speaker to speaker (best on headphones). Turn AUTO down to park it with PAN; try SQUARE for hard ping-pong, RANDOM for scattered notes.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.arpeggio })
      const v = voice(k, m.pitch, m.gate, { osc: { type: 'vco', out: 'tri' }, filter: { type: 'vcf', params: { cutoff: 2400, res: 0.2 }, out: 'lp2' }, env: { d: 0.3, s: 0.2, r: 0.3 } })
      const p = k.add('panner', { auto: 0.85, rate: 0.2 })
      k.wire(v.out, [p, 'in'])
      toOut(k, [p, 'l'], [p, 'r'], 0.8)
    },
  },
  widener: {
    howTo: 'A dub bass and a lead, mixed in mono, then opened out by WIDENER. Turn WIDTH right down (mono) and back up; the bass stays centred below BASS MONO while the lead spreads.',
    build(k) {
      const bass = melody(k, { phrase: PHRASES.dub })
      const lead = melody(k, { clock: bass.clock, phrase: PHRASES.lead })
      const b = voice(k, bass.pitch, bass.gate, { env: { d: 0.3, s: 0.6 } })
      const l = voice(k, lead.pitch, lead.gate, { osc: { type: 'vco', out: 'saw' }, filter: { type: 'vcf', params: { cutoff: 1800, res: 0.3 }, out: 'lp2' }, env: { a: 0.01, s: 0.5, r: 0.3 } })
      const w = k.add('widener', { width: 1.6, haas: 0.012 })
      k.wire(mix(k, [b.out, l.out], [0.75, 0.55]), [w, 'l'])
      toOut(k, [w, 'l'], [w, 'r'])
    },
  },
  qlfo: {
    howTo: 'One slow chord drone moved four linked ways by QUAD LFO: 1 opens the filter, 2 circles it round the speakers, 3 moves the pulse width. Try MODE RATIO and DRIFT, and SPREAD.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.slow })
      const q = k.add('qlfo', { rate: 0.15, spread: 1 })
      const v = voice(k, m.pitch, m.gate, { osc: { type: 'vco', params: { pw: 0.5, pwm: 0.6 }, out: 'sqr' }, filter: { type: 'vcf', params: { cutoff: 500, res: 0.35, cv: 0.5 }, out: 'lp4' }, filterCv: [q, 'o1'], env: { a: 0.3, s: 0.9, r: 0.8 } })
      k.wire([q, 'o3'], [v.osc, 'pwm'])
      const p = k.add('panner', { auto: 0 })
      k.wire([q, 'o2'], [p, 'cv'])
      k.wire(v.out, [p, 'in'])
      toOut(k, [p, 'l'], [p, 'r'])
    },
  },
  chance: {
    howTo: 'Sixteenths tossed by CHANCE: tails tick the closed hat, heads open it, so the hats are never the same twice. Channel 2 (the same clock) drops in ghost kicks. Turn the odds.',
    build(k) {
      const b = beat(k, { bpm: 104, tracks: {}, level: 0.8 })
      const c = k.add('chance', { p1: 0.2, p2: 0.12 })
      k.wire([b.clock, 'x4'], [c, 'in1'])
      const hats = k.add('hats', { chd: 0.03 })
      const kick = k.add('kick', { decay: 0.3 })
      k.wire([c, 'a1'], [hats, 'ch'])
      k.wire([c, 'b1'], [hats, 'oh'])
      k.wire([c, 'b2'], [kick, 'trig'])
      toOut(k, mix(k, [b.out, [hats, 'mix'], [kick, 'out']], [0.8, 0.5, 0.45]))
    },
  },
  sswitch: {
    howTo: 'One oscillator’s four waves into SWITCH, stepped each beat: the riff changes colour every note (sine, triangle, saw, pulse). Try ORDER RANDOM, or STEPS 2.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.riff })
      const osc = k.add('vco', { coarse: -1 })
      k.wire(m.pitch, [osc, 'voct'])
      const s = k.add('sswitch')
      for (const [i, w] of ['sin', 'tri', 'saw', 'sqr'].entries()) k.wire([osc, w], [s, `in${i + 1}`])
      k.wire([m.clock, 'x1'], [s, 'clk'])
      toOut(k, voice(k, null, m.gate, { audio: [s, 'out'], filter: { type: 'vcf', params: { cutoff: 2600, res: 0.15 }, out: 'lp2' }, env: { d: 0.3, s: 0.5 } }).out)
    },
  },
  kaleido: {
    howTo: 'KALEIDO is a whole voice: a riff on V/OCT and TRIG, no filter or VCA needed (the low-pass gate plays each note). Step through MODEL, then turn HARMONICS, TIMBRE and MORPH in each; an LFO is already slowly moving TIMBRE.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.berlin })
      const kal = k.add('kaleido', { model: 2, harm: 0.4, timbre: 0.35, morph: 0.2, decay: 0.35 })
      const lfo = k.add('lfo', { rate: 0.08 })
      k.wire(m.pitch, [kal, 'voct'])
      k.wire(m.trig, [kal, 'trig'])
      k.wire([lfo, 'tri'], [kal, 'timbre'])
      const p = k.add('plate', { decay: 0.55, mix: 0.25 })
      k.wire([kal, 'out'], [p, 'in'])
      toOut(k, [p, 'l'], [p, 'r'], 0.5)
    },
  },
  resonator: {
    howTo: 'Sympathetic strings, strummed by a slow tune: each note rings on four strings tuned to a chord, and four voices overlap. Turn STRUCTURE for other chords, DAMPING for how long they ring, MODEL MODAL for bells.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.slow })
      const r = k.add('resonator', { model: 1, poly: 2, structure: 0.5, bright: 0.6, damp: 0.35 })
      k.wire(m.pitch, [r, 'voct'])
      k.wire(m.trig, [r, 'strum'])
      toOut(k, [r, 'odd'], [r, 'even'], 0.75)
    },
  },
  tuner: {
    howTo: 'An oscillator a little sharp: the needle leans right and the strobe drifts. Turn the VCO’s FINE until the note goes green and the strobe stands still. PITCH out follows whatever it hears.',
    build(k) {
      const osc = k.add('vco', { coarse: -1, fine: 0.3 })
      const t = k.add('tuner')
      k.wire([osc, 'saw'], [t, 'in'])
      const vca = k.add('vca', { gain: 0.25 })
      k.wire([osc, 'saw'], [vca, 'in'])
      toOut(k, [vca, 'out'])
    },
  },
  analyser: {
    howTo: 'The band through ANALYSER on its way to OUT: the spectrum, the loudness in LUFS against TARGET, peaks and correlation. Click the screen to start the integrated reading again.',
    build(k) {
      const b = beat(k, { groove: GROOVES.house })
      const bass = melody(k, { clock: b.clock, phrase: PHRASES.dub })
      const a = k.add('analyser')
      k.wire(mix(k, [b.out, voice(k, bass.pitch, bass.gate, { env: { d: 0.3, s: 0.6 } }).out], [0.85, 0.7]), [a, 'l'])
      toOut(k, [a, 'l'], [a, 'r'])
    },
  },
  pianoroll: {
    howTo: 'Four bars drawn on the PIANO ROLL (Am, F, C, G under a melody) played by FM-4’s electric piano through a chorus, each note at its own velocity. Click to add notes, drag them about, drag a note’s end to lengthen it, right-click to delete; scroll for higher or lower. Step FM-4’s VOICE for bells, brass or organ.',
    build: (k) => void rollOnFm(k),
  },
  arranger: {
    howTo: 'A song in six sections: the ARRANGER’s part gates bring the drums, bass, lead and hats in and out through VCA×4. Click a lane cell to change who plays where, drag a block’s edge for its length; PAT is ready for LOCKSTEP’s PAT.',
    build(k) {
      const b = beat(k, { bpm: 116, tracks: {} })
      const bass = melody(k, { clock: b.clock, phrase: PHRASES.dub })
      const lead = melody(k, { clock: b.clock, phrase: PHRASES.lead })
      const ar = k.add('arranger')
      k.wire([b.clock, 'x4'], [ar, 'clk'])
      const vm = k.add('vcamix')
      const hats = k.add('hats', { chd: 0.03 })
      k.wire([b.clock, 'x4'], [hats, 'ch'])
      k.wire(b.out, [vm, 'in1'])
      k.wire(voice(k, bass.pitch, bass.gate, { env: { d: 0.3, s: 0.6 } }).out, [vm, 'in2'])
      k.wire(voice(k, lead.pitch, lead.gate, { osc: { type: 'vco', out: 'tri' }, env: { a: 0.01, s: 0.5, r: 0.3 } }).out, [vm, 'in3'])
      k.wire([hats, 'mix'], [vm, 'in4'])
      for (let g = 1; g <= 4; g++) k.wire([ar, `g${g}`], [vm, `cv${g}`])
      toOut(k, [vm, 'mix'], undefined, 0.45)
    },
  },
  trackhold: {
    howTo: 'T&H follows a slow random wander while each eighth-note gate is high and freezes it when the gate drops; a quantizer keeps it in A minor. Channel 2 (S&H) shows the difference. Try MODE 1 HOLD.',
    build(k) {
      const clock = k.add('clock', { bpm: 96 })
      const t = k.add('trackhold', { m1: 0 })
      k.wire([clock, 'x2'], [t, 'g1'])
      const att = k.add('atten', { a: 0.25 })
      const q = k.add('quant', { scale: 2 })
      k.wire([t, 'out1'], [att, 'a'])
      k.wire([att, 'a'], [q, 'in'])
      toOut(k, voice(k, [q, 'out'], [clock, 'x2'], { osc: { type: 'vco', out: 'saw' }, filter: { type: 'vcf', params: { cutoff: 1200, res: 0.4 }, out: 'lp4' }, env: { d: 0.2, s: 0.3, r: 0.15 } }).out)
    },
  },
}
