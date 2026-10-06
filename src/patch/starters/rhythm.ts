import { beat, bits, melody, mix, toOut, tune, voice, type Jack, type Kit } from './kit'
import type { Starter } from './types'

/** The kit beat with one more drum: `tracks` are its TR-16 patterns (a3…a7 =
 *  T4…T8), `inputs` the drum's trigger inputs fed from those tracks in order. */
function kitWith(k: Kit, type: string, tracks: Record<string, number>, inputs: string[], out = 'out', params: Record<string, number> = {}): void {
  const b = beat(k, { tracks })
  const d = k.add(type, params)
  Object.keys(tracks).forEach((a, i) => k.wire([b.tr, `t${Number(a.slice(1)) + 1}`], [d, inputs[i]]))
  toOut(k, mix(k, [b.out, [d, out]], [0.8, 0.6]))
}

/** A POCKET drum machine running; the others follow its CLK. */
function pocketBand(k: Kit, with_?: 'pocketbass' | 'pocketmelody'): void {
  const p = k.add('pocket', { run: 1, write: 0, tempo: 104 })
  if (!with_) return void toOut(k, [p, 'out'])
  const other = k.add(with_, { write: 0 })
  k.wire([p, 'clko'], [other, 'clk'])
  toOut(k, mix(k, [[p, 'out'], [other, 'out']], [0.75, 0.75]))
}

export const RHYTHM_STARTERS: Record<string, Starter> = {
  kick: { howTo: 'A kick on the beat with snare and hats. Turn TUNE, DECAY and PUNCH.', build: (k) => toOut(k, beat(k).out) },
  snare: { howTo: 'A backbeat snare with kick and hats. Turn TONE and SNAPPY.', build: (k) => toOut(k, beat(k).out) },
  hats: { howTo: 'Offbeat hats with kick and snare. Turn CLOSED and OPEN decay.', build: (k) => toOut(k, beat(k).out) },
  clap: { howTo: 'A clap on the backbeat over the kit. Turn SPREAD.', build: (k) => kitWith(k, 'clap', { a3: bits(4, 12) }, ['trig']) },
  // a fill on the last beat of the bar
  tom: { howTo: 'A tom fill at the end of each bar. Switch to CONGA.', build: (k) => kitWith(k, 'tom', { a3: bits(12, 14, 15) }, ['trig'], 'out', { decay: 0.35 }) },
  perc: {
    howTo: 'Rimshots and cowbell over the kit. Turn the tunings.',
    build: (k) => kitWith(k, 'perc', { a3: bits(3, 7, 11), a4: bits(6, 14) }, ['rim', 'bell'], 'mix'),
  },
  pads: {
    howTo: 'Click (or tap) the pads to play kick, snare, clap and hats.',
    played: true,
    build(k) {
      const p = k.add('pads')
      const ins: Jack[] = []
      ;(['kick', 'snare', 'clap'] as const).forEach((t, i) => {
        const d = k.add(t)
        k.wire([p, `g${i + 1}`], [d, 'trig'])
        ins.push([d, 'out'])
      })
      const h = k.add('hats')
      k.wire([p, 'g4'], [h, 'ch'])
      ins.push([h, 'mix'])
      toOut(k, mix(k, ins, [0.8, 0.65, 0.6, 0.45]))
    },
  },
  pocket: { howTo: 'POCKET playing its beat. WRITE on: pick a sound, toggle its steps.', build: (k) => pocketBand(k) },
  pocketbass: { howTo: 'POCKET BASS following POCKET’s clock. Drag a step up or down to change its note.', build: (k) => pocketBand(k, 'pocketbass') },
  pocketmelody: { howTo: 'POCKET MELODY following POCKET’s clock. Drag steps to change notes; right-click for chords.', build: (k) => pocketBand(k, 'pocketmelody') },
  touch: {
    howTo: 'Touch the strips to play: position is the note, pressure opens the filter.',
    played: true,
    build(k) {
      const t = k.add('touch')
      toOut(k, voice(k, [t, 'pitch'], [t, 'gate'], { env: { s: 0.7, r: 0.4 } }).out)
    },
  },
  loop: {
    howTo: 'A tune into LOOP: press REC to record a bar, REC again to loop it, then overdub.',
    build(k) {
      const t = tune(k)
      const l = k.add('loop')
      k.wire(t.out, [l, 'in'])
      k.wire([t.clock, 'bar'], [l, 'clk'])
      toOut(k, [l, 'out'])
    },
  },
  sample: {
    howTo: 'Press SAMPLE’s REC, let the tune play, press REC again: it plays back on every beat.',
    build(k) {
      const t = tune(k)
      const s = k.add('sample')
      k.wire(t.out, [s, 'in'])
      k.wire([t.clock, 'x1'], [s, 'trig'])
      toOut(k, mix(k, [t.out, [s, 'out']], [0.6, 0.8]))
    },
  },
  turntable: {
    howTo: 'The battle record is spinning. Grab the platter to scratch; CUT for the crossfader.',
    build(k) {
      const t = k.add('turntable')
      toOut(k, [t, 'out'])
    },
  },
  chop: {
    howTo: 'Play CHOP’s pads: the factory break is chopped across them. Hold REPEAT for rolls.',
    played: true,
    build(k) {
      const c = k.add('chop')
      toOut(k, [c, 'out'])
    },
  },
  fourtrack: {
    howTo: 'A beat and a tune play, patched to tracks 1 and 2. Arm a track and hit REC to put them on tape, then play it back.',
    build(k) {
      const b = beat(k)
      const m = melody(k, { clock: b.clock })
      const v = voice(k, m.pitch, m.gate)
      const ft = k.add('fourtrack')
      k.wire(b.out, [ft, 'in1'])
      k.wire(v.out, [ft, 'in2'])
      // the tape only plays what's on it, so the band goes to the speakers too
      toOut(k, mix(k, [b.out, v.out, [ft, 'mix']], [0.7, 0.55, 0.8]))
    },
  },
}
