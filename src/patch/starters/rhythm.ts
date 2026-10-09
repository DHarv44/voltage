import { beat, bits, melody, mix, steps, toOut, tune, voice, type Jack, type Kit } from './kit'
import { GROOVES, type Groove } from './material'
import type { Starter } from './types'

/** A groove with one more drum: `tracks` are its TR-16 patterns (a3…a7 =
 *  T4…T8), `inputs` the drum's trigger inputs fed from those tracks in order. */
function kitWith(
  k: Kit,
  type: string,
  groove: Groove,
  tracks: Record<string, number>,
  inputs: string[],
  o: { out?: string; params?: Record<string, number>; level?: number; mute?: Record<string, number> } = {},
): void {
  const b = beat(k, { groove, tracks: { ...tracks, ...o.mute } })
  const d = k.add(type, o.params)
  Object.keys(tracks).forEach((a, i) => k.wire([b.tr, `t${Number(a.slice(1)) + 1}`], [d, inputs[i]]))
  toOut(k, mix(k, [b.out, [d, o.out ?? 'out']], [0.8, o.level ?? 0.65]))
}

/** A POCKET drum machine running; the others follow its CLK. */
function pocketBand(k: Kit, with_?: 'pocketbass' | 'pocketmelody' | 'pocketrobot' | 'pocketspeak'): void {
  const p = k.add('pocket', { run: 1, write: 0, tempo: 104 })
  if (!with_) return void toOut(k, [p, 'out'])
  // followers only step on the clock while their own PLAY is on
  const other = k.add(with_, { run: 1, write: 0 })
  k.wire([p, 'clko'], [other, 'clk'])
  k.wire([p, 'rsto'], [other, 'rst'])
  toOut(k, mix(k, [[p, 'out'], [other, 'out']], [0.75, 0.75]))
}

export const RHYTHM_STARTERS: Record<string, Starter> = {
  kick: {
    howTo: 'A trap 808: a long, booming KICK whose TUNE input walks a bassline, one note per hit, under rattling hats. Turn DECAY and DRIVE.',
    build(k) {
      const b = beat(k, { groove: GROOVES.trap, kick: { decay: 1.4, punch: 0.3, drive: 0.35, tune: 44 }, hats: { chd: 0.03 } })
      // each kick steps the next note of the 808 line
      const notes = k.add('seq8', { len: 8, quant: 1, ...steps([0, 0, 3, -2, 0, 0, 5, 3]) })
      k.wire([b.tr, 't1'], [notes, 'clk'])
      k.wire([notes, 'cv'], [b.kick, 'tune'])
      toOut(k, b.out)
    },
  },
  snare: {
    howTo: 'A breakbeat where the SNARE carries the groove: accented backbeats, quieter ghost notes between. Turn TONE and SNAPPY.',
    build: (k) => toOut(k, beat(k, { groove: GROOVES.breakbeat, swing: 0.12, snare: { snappy: 0.75, tone: 0.5, decay: 0.2 }, level: 0.8 }).out),
  },
  hats: {
    howTo: 'Disco hats: closed 16ths, an OPEN hat on every off-beat, each closed hit choking the open one. Turn CH and OH DECAY and METAL.',
    build(k) {
      const b = beat(k, { groove: { ...GROOVES.house, hat: bits(0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15) }, tracks: { a3: bits(2, 6, 10, 14) }, hats: { ohd: 0.32, chd: 0.035 } })
      k.wire([b.tr, 't4'], [b.hats, 'oh'])
      toOut(k, b.out)
    },
  },
  clap: {
    howTo: 'A house groove with the CLAP on two and four instead of a snare. Turn SPREAD (how ragged the hands are) and DECAY.',
    build: (k) => kitWith(k, 'clap', GROOVES.house, { a3: bits(4, 12) }, ['trig'], { mute: { a1: 0 }, params: { spread: 0.011 } }),
  },
  tom: {
    howTo: 'The TOM in CONGA mode playing a tumbao over a four-to-the-floor: afro-house. Switch to TOM; turn TUNE and SWEEP.',
    build: (k) => kitWith(k, 'tom', GROOVES.techno, { a3: bits(3, 6, 7, 11, 14, 15) }, ['trig'], { params: { mode: 1, tune: 210, decay: 0.3 } }),
  },
  perc: {
    howTo: 'Latin percussion: the RIM plays a son clave, the COWBELL the off-beats. Turn the tunings and BELL DECAY.',
    build: (k) => kitWith(k, 'perc', { ...GROOVES.house, bpm: 112 }, { a3: bits(0, 3, 6, 10, 12), a4: bits(2, 6, 10, 14) }, ['rim', 'bell'], { out: 'mix', mute: { a1: 0 } }),
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
  pocketspeak: {
    howTo:
      'POCKET SPEAK singing over POCKET’s beat: da da ti la, bo ma, ah. Drag a step up or down for its note, right-click it to change its syllable. Try VOICE (CHOIR, WHISPER) and A (the throat’s size).',
    build: (k) => pocketBand(k, 'pocketspeak'),
  },
  pocketoffice: {
    howTo:
      'POCKET OFFICE: a typist at work as a beat. Keys between the beats, the space bar on them, a staple on 2 and 4, the bell at the end of the line, the carriage return. WRITE on: pick a sound, toggle its steps; right-click a step to lock A / B there.',
    build(k) {
      const o = k.add('pocketoffice', { run: 1, tempo: 96, swing: 0.15 })
      toOut(k, [o, 'out'], undefined, 0.6)
    },
  },
  pocketrobot: {
    howTo:
      'POCKET ROBOT playing its electro riff over POCKET’s beat. Press its buttons to play live (held notes glide into each other); flip REC and play along to write what you play into the steps. Try VOICE (BUZZ) and FX (CRUSH), with B for how much.',
    build: (k) => pocketBand(k, 'pocketrobot'),
  },
  pocketarcade: {
    howTo:
      'POCKET ARCADE playing a little level theme on its own: pulse lead, triangle bass, noise drums. Drag steps to change notes; right-click a step for a chip ARP or a SLIDE. Try VOICE (the pulse width) and BASS / DRUMS.',
    build(k) {
      const a = k.add('pocketarcade', { run: 1, write: 1, tempo: 140, swing: 0 })
      toOut(k, [a, 'out'], undefined, 0.5)
    },
  },
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
