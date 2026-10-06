import { band, beat, chords, melody, mix, toOut, tune, voice, type Jack, type Kit } from './kit'
import type { Starter } from './types'

/** Random notes in a scale: a CV (0..~1 V) quantised to a pentatonic. */
function inKey(k: Kit, cv: Jack, scale = 4, depth = 0.25): Jack {
  const att = k.add('atten', { a: depth })
  const q = k.add('quant', { scale })
  k.wire(cv, [att, 'a'])
  k.wire([att, 'a'], [q, 'in'])
  return [q, 'out']
}

/** Drums for gate outputs: up to three triggers onto kick, snare, hats → mix. */
function drums(k: Kit, kick?: Jack, snare?: Jack, hat?: Jack): Jack {
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

/** A sound that a simulation's x / gate plays: notes in key on a pluck. */
function played(k: Kit, pitch: Jack, gate: Jack) {
  const h = k.add('harp', { sustain: 1.2 })
  k.wire(inKey(k, pitch, 4, 0.12), [h, 'voct'])
  k.wire(gate, [h, 'trig'])
  const p = k.add('plate', { mix: 0.3 })
  k.wire([h, 'out'], [p, 'in'])
  toOut(k, [p, 'l'], [p, 'r'])
}

export const CONTROL_STARTERS: Record<string, Starter> = {
  adsr: { howTo: 'The ADSR shapes every note. Try a slow ATTACK and long RELEASE.', build: (k) => toOut(k, tune(k).out) },
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
      const m = melody(k, { octave: -1, gates: [1, 1, 1, 1, 1, 1, 1, 1] })
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
    howTo: 'SAMPLE & HOLD picks a random note on every clock: the classic computer bleeps.',
    build(k) {
      const c = k.add('clock', { bpm: 120 })
      const n = k.add('noise')
      const sh = k.add('sh')
      k.wire([n, 'white'], [sh, 'in'])
      k.wire([c, 'x2'], [sh, 'trig'])
      toOut(k, voice(k, inKey(k, [sh, 'out'], 4, 0.2), [c, 'x2']).out)
    },
  },
  clock: { howTo: 'CLOCK drives a sequence and a beat. Turn BPM.', build: (k) => toOut(k, band(k)) },
  div: {
    howTo: 'One clock divided into polyrhythms: ÷2 kicks, ÷3 snares, every beat on the hats.',
    build(k) {
      const c = k.add('clock', { bpm: 120 })
      const d = k.add('div')
      k.wire([c, 'x2'], [d, 'clk'])
      toOut(k, drums(k, [d, 'd2'], [d, 'd3'], [c, 'x2']))
    },
  },
  seq8: { howTo: 'SEQ-8 plays the melody. Turn the step knobs and gate switches.', build: (k) => toOut(k, tune(k).out) },
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
  tr16: { howTo: 'TR-16 sequencing a kit. Click steps to edit; try SWING.', build: (k) => toOut(k, beat(k).out) },
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
      toOut(k, voice(k, inKey(k, [t, 'cv'], 4, 0.25), [t, 'gate']).out)
    },
  },
  bounce: {
    howTo: 'Balls bouncing in a box play the drums. Turn GRAVITY; kick the box.',
    build(k) {
      const b = k.add('bounce')
      toOut(k, drums(k, [b, 'g1'], [b, 'g2'], [b, 'g3']))
    },
  },
  orbit: {
    howTo: 'Planets crossing a line play notes; where they cross picks the note. Turn SPEED.',
    build(k) {
      const o = k.add('orbit')
      played(k, [o, 'y'], [o, 'g1'])
    },
  },
  life: {
    howTo: 'The Game of Life plays a melody from its living cells. Reseed it by clicking.',
    build(k) {
      const c = k.add('clock', { bpm: 100 })
      const l = k.add('life', { scale: 4 })
      k.wire([c, 'x2'], [l, 'clk'])
      const h = k.add('harp')
      k.wire([l, 'pitch'], [h, 'voct'])
      k.wire([c, 'x2'], [h, 'trig'])
      toOut(k, [h, 'out'])
    },
  },
  flock: {
    howTo: 'A flock of birds steers the notes (X) and the filter (SPREAD). Drag to lead them.',
    build(k) {
      const c = k.add('clock', { bpm: 104 })
      const f = k.add('flock')
      toOut(k, voice(k, inKey(k, [f, 'x'], 4, 0.15), [c, 'x2'], { filterCv: [f, 'spread'] }).out)
    },
  },
  chaos: {
    howTo: 'A double pendulum plays: its swing picks notes, its crossings trigger them. Kick it.',
    build(k) {
      const c = k.add('chaos', { energy: 0.8 })
      played(k, [c, 'x'], [c, 'gate'])
    },
  },
  ecosystem: {
    howTo: 'Foxes and rabbits: the rabbit count picks notes, booms and crashes hit the drums.',
    build(k) {
      const c = k.add('clock', { bpm: 96 })
      const e = k.add('ecosystem', { rate: 1 })
      const h = k.add('harp')
      k.wire(inKey(k, [e, 'prey'], 4, 0.1), [h, 'voct'])
      k.wire([c, 'x2'], [h, 'trig'])
      const d = drums(k, [e, 'boom'], [e, 'crash'])
      toOut(k, mix(k, [[h, 'out'], d], [0.7, 0.7]))
    },
  },
}
