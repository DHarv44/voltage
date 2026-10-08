import { beat, chords, melody, mix, toOut, voice, type Jack, type Kit } from './kit'
import { GROOVES, PHRASES, type Phrase } from './material'
import type { Starter } from './types'

/** A "guitar" for the pedals: HARP's plucked strings (key of G, so riffs in E
 *  minor sit on its strings) playing a riff. Plucked strings are what
 *  stompboxes were built for. */
function guitar(k: Kit, phrase: Phrase, params: Record<string, number> = {}): { out: Jack; clock: string } {
  const m = melody(k, { phrase })
  const h = k.add('harp', { key: 1, sustain: 0.8, bright: 0.65, ...params })
  k.wire(m.pitch, [h, 'voct'])
  k.wire(m.trig, [h, 'trig'])
  return { out: [h, 'out'], clock: m.clock }
}

/** A pedal on a riff; pedals run hot, so the output sits lower. */
function pedal(k: Kit, type: string, phrase: Phrase, params: Record<string, number> = {}, vol = 0.4, harp: Record<string, number> = {}): void {
  const g = guitar(k, phrase, harp)
  const p = k.add(type, params)
  k.wire(g.out, [p, 'in'])
  toOut(k, [p, 'out'], undefined, vol)
}

/** Short minor-seventh chord stabs on the off-beats (dub techno, reggae
 *  skank): CHORD spreads each root to three oscillators, a snappy envelope cuts them short. */
function stabs(k: Kit, o: { bpm: number; wave?: string; decay?: number; cutoff?: number; clock?: string }) {
  const m = melody(k, { bpm: o.bpm, clock: o.clock, notes: [0, 0, 0, 0, -2, -2, -4, -4], gates: [0, 1, 0, 1, 0, 1, 0, 1], rate: 'x2', octave: -1 })
  const ch = k.add('chord', { qual: 5 })
  k.wire(m.pitch, [ch, 'root'])
  const oscs = ['v1', 'v2', 'v3'].map((v): Jack => {
    const o2 = k.add('vco')
    k.wire([ch, v], [o2, 'voct'])
    return [o2, o.wave ?? 'saw']
  })
  const v = voice(k, null, m.gate, {
    audio: mix(k, oscs, [0.45, 0.45, 0.45]),
    filter: { type: 'vcf', params: { cutoff: o.cutoff ?? 1300, res: 0.3, cv: 0.3 }, out: 'lp4' },
    env: { a: 0.002, d: o.decay ?? 0.14, s: 0, r: 0.1 },
  })
  return { out: v.out, clock: m.clock }
}

/** A sustained poly pad on a chord progression (P-VCO → P-VCA ← P-ADSR → sum). */
export function pad(k: Kit, o: { bpm?: number; a?: number; r?: number; wave?: string; fine?: number } = {}): Jack {
  const c = chords(k, { bpm: o.bpm ?? 80 })
  const vco = k.add('pvco', { fine: o.fine ?? 0.08 })
  const vca = k.add('pvca', { gain: 0, cv: 1 })
  const env = k.add('padsr', { a: o.a ?? 0.3, d: 1, s: 0.8, r: o.r ?? 1 })
  const pm = k.add('polymix', { level: 0.6 })
  k.wire(c.notes, [vco, 'voct'])
  k.wire(c.gate, [env, 'gate'])
  k.wire([vco, o.wave ?? 'saw'], [vca, 'in'])
  k.wire([env, 'env'], [vca, 'cv'])
  k.wire([vca, 'out'], [pm, 'in'])
  return [pm, 'sum']
}

export const EFFECT_STARTERS: Record<string, Starter> = {
  shimmer: {
    howTo:
      'Slow harp notes into SHIMMER: each one blooms into a tail that climbs an octave as it rings. Turn SHIMMER and DECAY up for a glowing wash; flip FREEZE to hold it as a pad.',
    build(k) {
      const g = guitar(k, PHRASES.slow, { sustain: 1.4, bright: 0.5 })
      const s = k.add('shimmer', { decay: 0.88, shimmer: 0.55, mix: 0.55 })
      k.wire(g.out, [s, 'in'])
      toOut(k, [s, 'l'], [s, 'r'], 0.68)
    },
  },
  grains: {
    howTo:
      'A harp arpeggio into GRAINS, a slow LFO drifting POSITION: the notes come back scattered, layered and sometimes reversed. Try SIZE and DENSITY, PITCH +12, then FREEZE and keep turning.',
    build(k) {
      const g = guitar(k, PHRASES.arpeggio, { sustain: 1 })
      const gr = k.add('grains', { pos: 0.3, size: 0.2, density: 16, spray: 0.3, spread: 0.85, rev: 0.25, fb: 0.3, mix: 0.75 })
      const lfo = k.add('lfo', { rate: 0.05 })
      k.wire(g.out, [gr, 'in'])
      k.wire([lfo, 'tri'], [gr, 'pos'])
      toOut(k, [gr, 'l'], [gr, 'r'], 0.55)
    },
  },
  shift: {
    howTo:
      'A riff harmonised by SHIFT: voice A an octave up on the left, B a fifth up on the right. Try SHIFT A at −12; set both to 0 and turn FINE for a doubled riff; raise FEEDBACK for the endless spiral.',
    build(k) {
      const g = guitar(k, PHRASES.riff)
      const s = k.add('shift', { a: 12, b: 7, la: 0.6, lb: 0.5, mix: 0.5 })
      k.wire(g.out, [s, 'in'])
      toOut(k, [s, 'l'], [s, 'r'], 0.62)
    },
  },
  bbd: {
    howTo: 'Dub-techno chord stabs into the BBD, a kick underneath: every repeat comes back darker. Push REPEATS past noon for runaway feedback; move TIME while it echoes.',
    build(k) {
      const s = stabs(k, { bpm: 118, cutoff: 1000 })
      const kick = k.add('kick', { decay: 0.35 })
      k.wire([s.clock, 'x1'], [kick, 'trig'])
      const d = k.add('bbd', { time: 0.38, fb: 0.68, mix: 0.45, mod: 0.3 })
      k.wire(s.out, [d, 'in'])
      toOut(k, mix(k, [[d, 'out'], [kick, 'out']], [0.8, 0.6]), undefined, 0.8)
    },
  },
  tape: {
    howTo: 'Soft chords through a worn tape echo: AGE dulls and hisses, WOW bends the pitch. The lo-fi sound; try REPEATS.',
    build(k) {
      const p = pad(k, { bpm: 72, a: 0.05, r: 0.8, wave: 'sin', fine: 0.03 })
      const t = k.add('tape', { time: 0.42, fb: 0.35, mix: 0.3, wow: 0.6, age: 0.75 })
      k.wire(p, [t, 'in'])
      toOut(k, [t, 'out'])
    },
  },
  spring: {
    howTo: 'One-drop reggae: organ skank on the off-beats and the rimshot on three, both through the spring. Turn DRIVE and click the tank to crash it.',
    build(k) {
      const b = beat(k, { groove: GROOVES.onedrop })
      const s = stabs(k, { bpm: 76, clock: b.clock, wave: 'sqr', decay: 0.13, cutoff: 1800 })
      const sp = k.add('spring', { decay: 0.6, mix: 0.45, drive: 1.6 })
      k.wire(mix(k, [s.out, b.out], [0.9, 0.8]), [sp, 'in'])
      toOut(k, [sp, 'out'], undefined, 0.95)
    },
  },
  plate: {
    howTo: 'A kalimba playing a slow line with space between the notes, so you hear the plate bloom. Turn DECAY and PREDELAY.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.slow, gates: [1, 0, 1, 1, 0, 1, 0, 1] })
      const s = k.add('strike', { inst: 2, decay: 1.2 })
      k.wire(m.pitch, [s, 'voct'])
      k.wire(m.trig, [s, 'trig'])
      const p = k.add('plate', { decay: 0.85, mix: 0.45, pre: 0.04 })
      k.wire([s, 'out'], [p, 'in'])
      toOut(k, [p, 'l'], [p, 'r'])
    },
  },
  phaser: {
    howTo: 'A seventies string pad swirling through the phaser. Turn RATE slow and FEEDBACK up for the full sweep.',
    build(k) {
      const ph = k.add('phaser', { rate: 0.15, depth: 0.9, fb: 0.7, mix: 0.55 })
      k.wire(pad(k, { a: 0.4, r: 1.2 }), [ph, 'in'])
      toOut(k, [ph, 'out'])
    },
  },
  ensemble: {
    howTo: 'A string machine: a sustained saw pad through ENSEMBLE’s three modulated lines, in stereo. Turn DEPTH; switch it out to hear the difference.',
    build(k) {
      const e = k.add('ensemble', { mix: 0.75 })
      k.wire(pad(k, { a: 0.5, r: 1.5, fine: 0 }), [e, 'in'])
      toOut(k, [e, 'l'], [e, 'r'])
    },
  },
  chamber: {
    howTo: 'A breakbeat played in the echo chamber: drag the speaker and the mics around the room; SIZE and WALLS change the room.',
    build(k) {
      const b = beat(k, { groove: GROOVES.breakbeat })
      const c = k.add('chamber', { size: 1.4, tail: 0.5, mix: 0.55 })
      k.wire(b.out, [c, 'in'])
      toOut(k, [c, 'l'], [c, 'r'], 0.8)
    },
  },
  tune: {
    howTo: 'A wobbly, gliding voice snapped into A minor by TUNE at SPEED 0: the hard robotic tune. Turn SPEED up for a natural correction.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.lead })
      const glide = k.add('slew', { rise: 0.18, fall: 0.18 })
      const lfo = k.add('lfo', { rate: 5.5 })
      const osc = k.add('vco', { fm: 0.1 })
      k.wire(m.pitch, [glide, 'in'])
      k.wire([glide, 'out'], [osc, 'voct'])
      k.wire([lfo, 'sin'], [osc, 'fm'])
      const v = voice(k, null, m.gate, { audio: [osc, 'saw'], env: { s: 0.7 } })
      const t = k.add('tune', { key: 9, scale: 2, speed: 0 })
      k.wire(v.out, [t, 'in'])
      toOut(k, [t, 'out'])
    },
  },
  vocoder: {
    howTo: 'A beat vocoded onto the built-in carrier, which follows a bassline: the drums sing it. Turn SHIFT and Q; patch AUDIO IN to MOD to make it talk.',
    build(k) {
      const b = beat(k, { groove: GROOVES.breakbeat })
      const m = melody(k, { clock: b.clock, notes: [0, 0, 3, 3, 7, 7, 5, 5], rate: 'x1', octave: -1 })
      const v = k.add('vocoder', { tune: 0, rel: 0.09, mix: 0.25, noise: 0.15 })
      k.wire(b.out, [v, 'mod'])
      k.wire(m.pitch, [v, 'voct'])
      toOut(k, [v, 'out'])
    },
  },
  fuzz: { howTo: 'A rock riff on plucked strings through the FUZZ. Stomp to hear it clean; turn FUZZ, and BIAS to starve it.', build: (k) => pedal(k, 'fuzz', PHRASES.riff, {}, 0.4, { sustain: 0.6 }) },
  wah: { howTo: 'A funky 16th line through the WAH in AUTO: it opens as you play harder. Switch to FOOT and rock the treadle.', build: (k) => pedal(k, 'wah', PHRASES.funk, { mode: 1, sens: 0.7 }, 0.65, { sustain: 0.5 }) },
  octave: { howTo: 'A high lead line through OCTAVE: UP adds the octave above (Octavia), DOWN the one below.', build: (k) => pedal(k, 'octave', { ...PHRASES.lead, octave: 0 }, {}, 0.55) },
  chorus: { howTo: 'Clean broken chords through the CHORUS: the eighties clean-guitar shimmer. Turn RATE and DEPTH.', build: (k) => pedal(k, 'chorus', PHRASES.arpeggio, {}, 0.4, { key: 0, sustain: 1.2 }) },
  echo: {
    howTo: 'Sparse notes with room between them through the TAPE ECHO: the repeats fill the gaps. Turn RATE, FEEDBACK and the head MODE.',
    build: (k) => pedal(k, 'echo', { ...PHRASES.slow, rate: 'x2', gates: [1, 0, 0, 1, 0, 0, 1, 0] }, {}, 0.55, { sustain: 1.4 }),
  },
  lpedal: { howTo: 'Broken chords into the LOOPER: stomp to record a bar, stomp to loop it, stomp again to overdub.', build: (k) => pedal(k, 'lpedal', PHRASES.arpeggio, {}, 0.4, { key: 0 }) },
  amp: { howTo: 'The riff through the VALVE AMP, cranked: crunch from the preamp, sag from the power amp. Turn GAIN; switch the cabinet.', build: (k) => pedal(k, 'amp', PHRASES.riff, { gain: 0.65 }, 0.32, { bright: 0.8 }) },
  talkbox: {
    howTo: 'A square-wave lead through the TALK BOX, its mouth opening and closing with the phrase. Drag the mouth yourself.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.lead })
      const src = voice(k, m.pitch, m.gate, { osc: { type: 'vco', out: 'sqr' }, filter: { type: 'vcf', params: { cutoff: 2400, res: 0.1 }, out: 'lp2' }, env: { s: 0.8 } })
      const lfo = k.add('lfo', { rate: 1.15 })
      const tb = k.add('talkbox')
      k.wire(src.out, [tb, 'in'])
      k.wire([lfo, 'tri'], [tb, 'vowel'])
      toOut(k, [tb, 'out'])
    },
  },
}
