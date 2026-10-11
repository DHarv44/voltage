import { beat, chords, melody, mix, toOut, voice, type Kit } from './kit'
import type { Starter } from './types'

/** A short, plucky line (room for echoes between the notes). */
function pluck(k: Kit, bpm: number) {
  const m = melody(k, { bpm, gates: [1, 0, 1, 0, 1, 1, 0, 0] })
  const v = voice(k, m.pitch, m.gate, { filter: { type: 'vcf', params: { cutoff: 1200, res: 0.3 }, out: 'lp4' }, env: { a: 0.002, d: 0.18, s: 0, r: 0.1 } })
  return { ...m, out: v.out }
}

/** The new effects' ready-to-play rigs. */
export const FX2_STARTERS: Record<string, Starter> = {
  pingpong: {
    howTo: 'A plucked line through PING-PONG at a dotted eighth, locked to the clock: each echo answers from the other side. Try 1/8T and 1/4; turn REPEATS up and TONE down for a dub tail; DUCK keeps the echoes out of the notes’ way.',
    build(k) {
      const p = pluck(k, 110)
      const pp = k.add('pingpong', { div: 3 })
      k.wire(p.out, [pp, 'l'])
      k.wire([p.clock, 'x4'], [pp, 'clk'])
      toOut(k, [pp, 'ol'], [pp, 'or'], 0.55)
    },
  },
  flanger: {
    howTo: 'A drum loop through FLANGER: the slow jet sweep over the hats and snare. Push FEEDBACK both ways (ringing / hollow), move MANUAL with the RATE right down to set the colour by hand.',
    build(k) {
      const b = beat(k, { bpm: 98 })
      const f = k.add('flanger')
      k.wire(b.out, [f, 'in'])
      toOut(k, [f, 'l'], [f, 'r'], 0.6)
    },
  },
  rotary: {
    howTo: 'Organ-ish chords through ROTARY, a slow square wave flipping it between SLOW and FAST every few bars: listen to the horn and drum ramp up and down. Turn DRIVE for the growl, HORN · DRUM for the balance.',
    build(k) {
      const c = chords(k, { bpm: 92 })
      const h = k.add('halcyon', { vcamode: 1, pulse: 0, sub: 0.5, cutoff: 5000, chorus: 0, saw: 1, pwm: 0.2 })
      k.wire(c.notes, [h, 'voct'])
      k.wire(c.gate, [h, 'gate'])
      const r = k.add('rotary')
      k.wire(mix(k, [[h, 'l'], [h, 'r']], [0.6, 0.6]), [r, 'in'])
      const lfo = k.add('lfo', { rate: 0.08 })
      k.wire([lfo, 'sqr'], [r, 'fast'])
      toOut(k, [r, 'l'], [r, 'r'], 0.55)
    },
  },
  fshift: {
    howTo: 'A soft melody through FREQ SHIFT a little upward: the notes turn to bells, no longer in tune with themselves. Bring SHIFT near the middle on ±10 Hz for slow phasing; add FEEDBACK for the spiral.',
    build(k) {
      const m = melody(k, { bpm: 90 })
      const v = voice(k, m.pitch, m.gate, { osc: { type: 'vco', out: 'tri' }, env: { a: 0.005, d: 0.6, s: 0.3, r: 0.6 } })
      const f = k.add('fshift', { shift: 0.35, mix: 0.8 })
      k.wire(v.out, [f, 'in'])
      const plate = k.add('plate', { decay: 0.6, mix: 0.25 })
      k.wire([f, 'out'], [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'], 0.8)
    },
  },
  comb: {
    howTo: 'A beat through COMB, its note played by a SEQ-8: the drums ring at a bass line’s pitches. Turn FEEDBACK left for hollow, DAMP up for wooden; take V/OCT out and tune FREQ by hand.',
    build(k) {
      const b = beat(k, { bpm: 100 })
      const m = melody(k, { clock: b.clock, rate: 'x1', octave: -1 })
      const c = k.add('comb', { fb: 0.9, mix: 0.75 })
      k.wire(b.out, [c, 'in'])
      k.wire(m.pitch, [c, 'voct'])
      toOut(k, [c, 'out'], undefined, 0.5)
    },
  },
  formant: {
    howTo: 'A buzzy saw melody through FORMANT, a slow LFO walking it through the vowels: the synth talks. Turn VOWEL by hand with the LFO out; SIZE from giant to child; RESONANCE for whistle.',
    build(k) {
      const m = melody(k, { bpm: 96 })
      const v = voice(k, m.pitch, m.gate, { filter: { type: 'vcf', params: { cutoff: 6000, res: 0 }, out: 'lp4' }, env: { a: 0.02, d: 0.4, s: 0.7, r: 0.3 } })
      const f = k.add('formant', { res: 0.65 })
      k.wire(v.out, [f, 'in'])
      const lfo = k.add('lfo', { rate: 0.3 })
      const at = k.add('atten', { a: 1 })
      k.wire([lfo, 'tri'], [at, 'a'])
      k.wire([at, 'a'], [f, 'cv'])
      toOut(k, [f, 'out'], undefined, 0.5)
    },
  },
}
