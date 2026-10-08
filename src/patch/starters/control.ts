import { beat, bits, chords, melody, mix, toOut, voice, type Jack, type Kit } from './kit'
import { GROOVES, PHRASES } from './material'
import type { Starter } from './types'

/** Random notes in a key: a CV (0..~1 V) quantised to D dorian (minor with a
 *  bright sixth: never the pentatonic "pop hook"). */
export function inKey(k: Kit, cv: Jack, depth = 0.25): Jack {
  const att = k.add('atten', { a: depth })
  const q = k.add('quant', { scale: 3, trans: 2 })
  k.wire(cv, [att, 'a'])
  k.wire([att, 'a'], [q, 'in'])
  return [q, 'out']
}

/** Drums for gate outputs: up to three triggers onto kick, snare, hats → mix. */
export function drums(k: Kit, kick?: Jack, snare?: Jack, hat?: Jack): Jack {
  const ins: Jack[] = []
  if (kick) {
    const d = k.add('kick', { decay: 0.5 })
    k.wire(kick, [d, 'trig'])
    ins.push([d, 'out'])
  }
  if (snare) {
    const d = k.add('snare')
    k.wire(snare, [d, 'trig'])
    ins.push([d, 'out'])
  }
  if (hat) {
    const d = k.add('hats')
    k.wire(hat, [d, 'ch'])
    ins.push([d, 'mix'])
  }
  return mix(k, ins, [0.8, 0.6, 0.45])
}

export const CONTROL_STARTERS: Record<string, Starter> = {
  adsr: {
    howTo: 'Long notes with a slow ATTACK and a long RELEASE, so you hear the ADSR’s whole shape. Turn A, D, S and R and listen to each part change.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.slow, gates: [1, 1, 0, 1, 1, 0, 1, 0] })
      toOut(k, voice(k, m.pitch, m.gate, { env: { a: 0.35, d: 0.6, s: 0.55, r: 1.2 }, filter: { type: 'vcf', params: { cutoff: 900, res: 0.25, cv: 0.4 }, out: 'lp4' } }).out)
    },
  },
  func: {
    howTo: 'FUNCTION as the envelope: each note rises and falls. Turn RISE, FALL and SHAPE.',
    build(k) {
      const m = melody(k)
      const fn = k.add('func', { rise: 0.01, fall: 0.35, shape: 0.6 })
      k.wire(m.trig, [fn, 'trig'])
      toOut(k, voice(k, m.pitch, [fn, 'eor'], { filterCv: [fn, 'out'], env: { a: 0.002, d: 0.4, s: 0.6, r: 0.2 } }).out)
    },
  },
  follow: {
    howTo: 'The beat’s loudness (FOLLOW) opens a pad’s filter: it pumps with the drums.',
    build(k) {
      const b = beat(k, { bpm: 112 })
      const f = k.add('follow', { gain: 3, rel: 0.2 })
      k.wire(b.out, [f, 'in'])
      const m = melody(k, { clock: b.clock, rate: 'x1', notes: [0, 0, 5, 5, 3, 3, 7, 7] })
      const v = voice(k, m.pitch, m.gate, { filterCv: [f, 'env'], env: { a: 0.05, s: 0.8, r: 0.6 } })
      toOut(k, mix(k, [b.out, v.out], [0.7, 0.6]))
    },
  },
  lfo: {
    howTo: 'An LFO sweeping the filter: a wobble bass. Turn RATE.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.dub, gates: [1, 1, 1, 1, 1, 1, 1, 1], rate: 'x1' })
      const lfo = k.add('lfo', { rate: 3 })
      toOut(k, voice(k, m.pitch, m.gate, { filterCv: [lfo, 'sin'], filter: { type: 'vcf', params: { cutoff: 500, res: 0.6, cv: 0.5 }, out: 'lp4' }, env: { s: 0.8 } }).out)
    },
  },
  xy: {
    howTo: 'Drag on the XY pad: across plays notes in a scale, the gate follows your finger.',
    played: true,
    build(k) {
      const xy = k.add('xy')
      toOut(k, voice(k, [xy, 'pitch'], [xy, 'gate'], { env: { s: 0.7 } }).out)
    },
  },
  sh: {
    howTo: 'SAMPLE & HOLD sets the filter to a new random cutoff on every 16th: the bubbling seventies "computer" sound. Turn the filter’s RESONANCE and the CLOCK.',
    build(k) {
      const c = k.add('clock', { bpm: 112 })
      const n = k.add('noise')
      const sh = k.add('sh')
      k.wire([n, 'white'], [sh, 'in'])
      k.wire([c, 'x4'], [sh, 'trig'])
      const v = voice(k, null, [c, 'x4'], {
        osc: { type: 'vco', params: { coarse: -1 }, out: 'saw' },
        filter: { type: 'vcf', params: { cutoff: 700, res: 0.78, cv: 0.55 }, out: 'lp4' },
        filterCv: [sh, 'out'],
        env: { d: 0.12, s: 0.35, r: 0.08 },
      })
      const d = k.add('bbd', { time: 0.4, fb: 0.35, mix: 0.25 })
      k.wire(v.out, [d, 'in'])
      toOut(k, [d, 'out'], undefined, 0.75)
    },
  },
  clock: {
    howTo: 'Each CLOCK output drives a part: 1/4 the kick, 1/16 the hats, 1/8 the bassline, 1/2 a half-time snare, BAR an open hat. Turn TEMPO; everything follows.',
    build(k) {
      const c = k.add('clock', { bpm: 118 })
      const kick = k.add('kick', { decay: 0.45 })
      const snare = k.add('snare')
      const hats = k.add('hats', { chd: 0.03, ohd: 0.6 })
      k.wire([c, 'x1'], [kick, 'trig'])
      k.wire([c, 'd2'], [snare, 'trig'])
      k.wire([c, 'x4'], [hats, 'ch'])
      k.wire([c, 'bar'], [hats, 'oh'])
      const m = melody(k, { clock: c, phrase: PHRASES.dub, rate: 'x2' })
      const bass = voice(k, m.pitch, m.gate, { env: { d: 0.2, s: 0.4 } })
      toOut(k, mix(k, [[kick, 'out'], [snare, 'out'], [hats, 'mix'], bass.out], [0.8, 0.5, 0.35, 0.6]))
    },
  },
  metronome: {
    howTo:
      'METRONOME clicking along with a bassline: it follows CLOCK at its CLK, so turn CLOCK’s TEMPO and the click follows. Unpatch CLK and it keeps its own TEMPO: tap the screen in time to set it. Try SUBDIV for 8ths or triplets.',
    build(k) {
      const c = k.add('clock', { bpm: 100 })
      const m = melody(k, { clock: c, phrase: PHRASES.dub, rate: 'x2' })
      const bass = voice(k, m.pitch, m.gate, { env: { d: 0.25, s: 0.5 } })
      const met = k.add('metronome', { sound: 1 })
      k.wire([c, 'x4'], [met, 'clk'])
      k.wire([c, 'rst'], [met, 'rst'])
      toOut(k, mix(k, [bass.out, [met, 'out']], [0.55, 0.8]))
    },
  },
  maelzel: {
    howTo:
      'Two clockwork metronomes on one plank (left and right), set going at different moments: each one’s SWING sways the other’s PLANK, and over half a minute they fall into step. Turn PLANK down on both and they drift apart. Drag a weight to retune one; tilt one for a lopsided tick-tock.',
    build(k) {
      const a = k.add('maelzel', { bpm: 96, couple: 0.6, bell: 3 })
      const b = k.add('maelzel', { bpm: 96, couple: 0.6 })
      k.wire([a, 'swing'], [b, 'plank'])
      k.wire([b, 'swing'], [a, 'plank'])
      toOut(k, [a, 'out'], [b, 'out'], 0.6)
    },
  },
  coach: {
    howTo:
      'A practice session: COACH starts at 92 and climbs 4 bpm every 2 bars to 124, and a drum machine follows its 1/16 out. Every fourth bar the click drops out (GAP): keep time and see if you land with it. Turn POLY for 3 over 4.',
    build(k) {
      const c = k.add('coach', { start: 92, target: 124, step: 4, every: 2, play: 3, gap: 1 })
      const d = beat(k, { clock: c, level: 0.45 })
      toOut(k, mix(k, [d.out, [c, 'out']], [0.6, 0.8]))
    },
  },
  div: {
    howTo: 'One clock divided into polyrhythms: ÷2 kicks, ÷3 snares, every beat on the hats.',
    build(k) {
      const c = k.add('clock', { bpm: 120 })
      const d = k.add('div')
      k.wire([c, 'x2'], [d, 'clk'])
      toOut(k, drums(k, [d, 'd2'], [d, 'd3'], [c, 'x2']))
    },
  },
  seq8: {
    howTo: 'SEQ-8 running a Berlin-school sequence in 16ths, a slow LFO opening the filter, a dotted echo behind it. Turn a step knob while it plays; flip the gate switches; shorten LENGTH.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.berlin })
      const lfo = k.add('lfo', { rate: 0.07 })
      const v = voice(k, m.pitch, m.gate, { filter: { type: 'vcf', params: { cutoff: 1100, res: 0.55, cv: 0.3 }, out: 'lp4' }, filterCv: [lfo, 'tri'], env: { d: 0.15, s: 0.45, r: 0.1 } })
      const d = k.add('bbd', { time: 0.4, fb: 0.45, mix: 0.3 })
      k.wire(v.out, [d, 'in'])
      toOut(k, [d, 'out'], undefined, 0.8)
    },
  },
  arp: {
    howTo: 'Hold a chord on your keyboard (keys A–K): the ARP plays it up and down. Try LATCH.',
    played: true,
    build(k) {
      const c = k.add('clock', { bpm: 120 })
      const a = k.add('arp', { oct: 2 })
      k.wire([c, 'x4'], [a, 'clk'])
      toOut(k, voice(k, [a, 'pitch'], [a, 'gate']).out)
    },
  },
  chord: {
    howTo: 'CHORD turns each note of the sequence into a chord. Change QUALITY.',
    build(k) {
      const m = melody(k, { rate: 'x1', notes: [0, 0, 5, 5, 7, 7, 3, 3], gates: [1, 1, 1, 1, 1, 1, 1, 1] })
      const ch = k.add('chord', { qual: 1 })
      k.wire(m.pitch, [ch, 'root'])
      const oscs = ['v1', 'v2', 'v3'].map((v) => {
        const o = k.add('vco')
        k.wire([ch, v], [o, 'voct'])
        return [o, 'saw'] as Jack
      })
      toOut(k, voice(k, null, m.gate, { audio: mix(k, oscs, [0.5, 0.5, 0.5]), env: { a: 0.02, s: 0.7 } }).out)
    },
  },
  ghost: {
    howTo: 'A phrase plays; after a pause GHOST answers it in its own words. Turn TEMPER.',
    build(k) {
      const m = melody(k, { bpm: 100, gates: [1, 1, 1, 1, 0, 0, 0, 0] })
      const g = k.add('ghost')
      k.wire(m.pitch, [g, 'voct'])
      k.wire(m.gate, [g, 'gate'])
      const a = voice(k, m.pitch, m.gate)
      const b = voice(k, [g, 'voct'], [g, 'gate'], { osc: { type: 'vco', out: 'tri' }, env: { s: 0.5 } })
      toOut(k, mix(k, [a.out, b.out], [0.6, 0.6]))
    },
  },
  progression: {
    howTo: 'PROGRESSION writes chords that move the way songs do. Change KEY, MODE and MOOD.',
    build(k) {
      const c = chords(k, { bpm: 90 })
      const vco = k.add('pvco')
      const vca = k.add('pvca', { gain: 0, cv: 1 })
      const env = k.add('padsr', { a: 0.05, d: 0.7, s: 0.5, r: 0.6 })
      const pm = k.add('polymix')
      k.wire(c.notes, [vco, 'voct'])
      k.wire(c.gate, [env, 'gate'])
      k.wire([vco, 'saw'], [vca, 'in'])
      k.wire([env, 'env'], [vca, 'cv'])
      k.wire([vca, 'out'], [pm, 'in'])
      const f = k.add('vcf', { cutoff: 1500, res: 0.2 })
      k.wire([pm, 'sum'], [f, 'in'])
      toOut(k, [f, 'lp4'])
    },
  },
  bandmate: {
    howTo: 'BANDMATE plays the drums like a drummer would. Try STYLE and ENERGY.',
    build(k) {
      const bm = k.add('bandmate', { run: 1 })
      const kick = k.add('kick')
      const snare = k.add('snare')
      const hats = k.add('hats')
      const tom = k.add('tom')
      k.wire([bm, 'kick'], [kick, 'trig'])
      k.wire([bm, 'snare'], [snare, 'trig'])
      k.wire([bm, 'hat'], [hats, 'ch'])
      k.wire([bm, 'open'], [hats, 'oh'])
      k.wire([bm, 'tom'], [tom, 'trig'])
      toOut(k, mix(k, [[kick, 'out'], [snare, 'out'], [hats, 'mix'], [tom, 'out']], [0.8, 0.6, 0.45, 0.6]))
    },
  },
  tr16: {
    howTo: 'TR-16 chaining two patterns (A→B): a house groove, then its fill. Click steps to edit; switch PATTERN; try SWING and the ACC row.',
    build(k) {
      const g = GROOVES.house
      const b = beat(k, {
        groove: g,
        swing: 0.15,
        // pattern B: the same groove, the last beat broken into a snare roll
        tracks: { pat: 2, b0: bits(0, 4, 8, 11), b1: bits(4, 12, 13, 14, 15), b2: bits(2, 6, 10), b8: bits(0, 15) },
      })
      toOut(k, b.out)
    },
  },
  euclid: {
    howTo: 'Two Euclidean rhythms on kick and hats. Turn the HITS knobs.',
    build(k) {
      const c = k.add('clock', { bpm: 116 })
      const e = k.add('euclid', { fillsA: 4, fillsB: 7 })
      k.wire([c, 'x4'], [e, 'clk'])
      toOut(k, drums(k, [e, 'a'], undefined, [e, 'b']))
    },
  },
  turing: {
    howTo: 'TURING invents a looping melody that slowly changes. Turn CHANGE; full right locks it.',
    build(k) {
      const c = k.add('clock', { bpm: 110 })
      const t = k.add('turing', { change: 0.2 })
      k.wire([c, 'x2'], [t, 'clk'])
      toOut(k, voice(k, inKey(k, [t, 'cv'], 0.25), [t, 'gate']).out)
    },
  },
}
