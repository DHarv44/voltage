import { beat, chords, mix, toOut, voice, type Kit } from './kit'
import type { Starter } from './types'

/** A beat and a bass line on one clock (something with lows, mids and hits). */
function groove(k: Kit, bpm = 104) {
  const b = beat(k, { bpm })
  const seq = k.add('seq8', { s1: 0, s2: 0, s3: 0.25, s4: 0, s5: 7 / 12, s6: 0.5, s7: 0.25, s8: 5 / 12, g1: 1, g2: 1, g3: 1, g4: 0, g5: 1, g6: 1, g7: 1, g8: 1 })
  k.wire([b.clock, 'x2'], [seq, 'clk'])
  const bass = voice(k, [seq, 'cv'], [seq, 'gate'], { osc: { type: 'vco', params: { coarse: -2 }, out: 'saw' }, filter: { type: 'vcf', params: { cutoff: 600, res: 0.3 }, out: 'lp4' }, env: { d: 0.2, s: 0.4, r: 0.1 } })
  return { ...b, mix: mix(k, [b.out, bass.out], [0.85, 0.6]) }
}

/** The mix tools' ready-to-play rigs. */
export const MIXTOOL_STARTERS: Record<string, Starter> = {
  peq: {
    howTo: 'A beat and bass through EQ: lows lifted, a dip in the low mids, a little presence. Drag the dots on the screen (left–right: frequency, up–down: gain); scroll on a bell for its width. Try cutting all the lows away, then bring them back.',
    build(k) {
      const g = groove(k)
      const e = k.add('peq', { lg: 4, m1f: 320, m1g: -4, m2g: 3, hg: 2 })
      k.wire(g.mix, [e, 'l'])
      toOut(k, [e, 'ol'], [e, 'or'], 0.55)
    },
  },
  transient: {
    howTo: 'A beat through TRANSIENT: more attack, less sustain, the drums tight and snappy. Turn ATTACK left to push them back, SUSTAIN right to bring the room and the tails up.',
    build(k) {
      const b = beat(k, { bpm: 96, snare: { decay: 0.3 }, kick: { decay: 0.7 } })
      const plate = k.add('plate', { decay: 0.5, mix: 0.3 })
      k.wire(b.out, [plate, 'in'])
      const t = k.add('transient', { att: 0.6, sus: -0.5 })
      k.wire([plate, 'l'], [t, 'l'])
      k.wire([plate, 'r'], [t, 'r'])
      toOut(k, [t, 'ol'], [t, 'or'], 0.55)
    },
  },
  ngate: {
    howTo: 'The gated-reverb snare: the snare into a big plate, the plate through GATE keyed by the snare’s own trigger, so the reverb is cut off sharply after HOLD. Lengthen HOLD; lower RANGE for a tail that’s only ducked; unpatch KEY to gate on the sound itself.',
    build(k) {
      const b = beat(k, { bpm: 92 })
      const plate = k.add('plate', { decay: 0.9, mix: 1 })
      k.wire([b.snare, 'out'], [plate, 'in'])
      const g = k.add('ngate', { thr: -20, hold: 0.22, rel: 0.05 })
      k.wire([plate, 'l'], [g, 'l'])
      k.wire([plate, 'r'], [g, 'r'])
      k.wire([b.tr, 't2'], [g, 'key'])
      toOut(k, mix(k, [b.out, [g, 'ol']], [0.8, 0.9]), mix(k, [b.out, [g, 'or']], [0.8, 0.9]), 0.55)
    },
  },
  ott: {
    howTo: 'Chords and a beat through OTT at half DEPTH: the tails and quiet details pulled up, the peaks pushed down, everything dense and forward. Sweep DEPTH from 0 to all the way; HIGH down tames the hiss.',
    build(k) {
      const g = groove(k, 120)
      const c = chords(k, { bpm: 120 })
      const h = k.add('halcyon', { chorus: 2, cutoff: 2500, s: 0.5, r: 0.6, level: 0.5 })
      k.wire(c.notes, [h, 'voct'])
      k.wire(c.gate, [h, 'gate'])
      const o = k.add('ott')
      k.wire(mix(k, [g.mix, [h, 'l']], [0.8, 0.5]), [o, 'l'])
      k.wire(mix(k, [g.mix, [h, 'r']], [0.8, 0.5]), [o, 'r'])
      toOut(k, [o, 'ol'], [o, 'or'], 0.75)
    },
  },
}
