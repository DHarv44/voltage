import { band, beat, melody, mix, toOut, tune, voice, type Kit } from './kit'
import { GROOVES, PHRASES } from './material'
import type { Starter } from './types'
import { MOTION_POINTS, MOTION_RES, pointId } from '../../modules/specs/motion'

/** The tune, plus a module that does its job beside it (no audio of its own). */
function beside(k: Kit, type: string, params: Record<string, number> = {}): string {
  const t = tune(k)
  const m = k.add(type, params)
  toOut(k, t.out)
  return m
}

/** A VISION tank that the tune plays: each note strikes it, the pitch colours it. */
function visionRig(k: Kit, type: 'vision' | 'visioncore'): string {
  const t = tune(k)
  const v = k.add(type)
  k.wire(t.gate, [v, 'trig'])
  k.wire(t.pitch, [v, 'hue'])
  toOut(k, t.out)
  return v
}

export const OTHER_STARTERS: Record<string, Starter> = {
  mixer: {
    howTo: 'Three parts on MIX: drums on 1, a dub bass on 2, a slow lead on 3. Balance them with the channel levels; INV is the whole mix upside down.',
    build(k) {
      const b = beat(k, { groove: GROOVES.onedrop, level: 0.9 })
      const bass = melody(k, { clock: b.clock, phrase: PHRASES.dub })
      const lead = melody(k, { clock: b.clock, phrase: PHRASES.slow, rate: 'x2' })
      const m = k.add('mixer', { l1: 0.75, l2: 0.7, l3: 0.45, l4: 0 })
      k.wire(b.out, [m, 'in1'])
      k.wire(voice(k, bass.pitch, bass.gate, { env: { d: 0.3, s: 0.6 } }).out, [m, 'in2'])
      k.wire(voice(k, lead.pitch, lead.gate, { osc: { type: 'vco', out: 'tri' }, env: { a: 0.02, s: 0.6, r: 0.4 } }).out, [m, 'in3'])
      toOut(k, [m, 'out'])
    },
  },
  smix: {
    howTo: 'A beat and a tune on the stereo mixer, with a plate on the send. Pan them; turn SEND.',
    build(k) {
      const b = beat(k)
      const m = melody(k, { clock: b.clock })
      const v = voice(k, m.pitch, m.gate)
      const sm = k.add('smix', { pan1: -0.3, pan2: 0.35, snd2: 0.5, ret: 0.6 })
      const plate = k.add('plate', { mix: 1, decay: 0.7 })
      k.wire(b.out, [sm, 'in1'])
      k.wire(v.out, [sm, 'in2'])
      k.wire([sm, 'send'], [plate, 'in'])
      k.wire([plate, 'l'], [sm, 'retL'])
      k.wire([plate, 'r'], [sm, 'retR'])
      toOut(k, [sm, 'l'], [sm, 'r'])
    },
  },
  console: {
    howTo: 'Drums, bass and a held pad on CONSOLE, the kick trigger on DUCK: the bass and pad pump. Turn their DUCK knobs and DUCK REL; try TONE.',
    build(k) {
      const b = beat(k, { bpm: 122 })
      const bass = melody(k, { clock: b.clock, notes: [0, 0, 12, 0, 0, 10, 0, 7], gates: [1, 1, 1, 1, 1, 1, 1, 1], octave: -2 })
      const pad = melody(k, { clock: b.clock, notes: [0, 3, 7, 5], gates: [1, 1, 1, 1], rate: 'x1' })
      const bv = voice(k, bass.pitch, bass.gate, { env: { d: 0.2, s: 0.5, r: 0.1 } })
      const pv = voice(k, pad.pitch, pad.gate, { osc: { type: 'vco', out: 'saw' }, env: { a: 0.02, d: 0.6, s: 0.85, r: 0.5 } })
      const c = k.add('console', { lvl1: 0.8, lvl2: 0.75, duck2: 0.85, pan2: 0, lvl3: 0.6, duck3: 0.75, snd3: 0.4, pan3: 0.25, tone3: 0.3, rel: 0.22, ret: 0.5 })
      const plate = k.add('plate', { mix: 1, decay: 0.7 })
      k.wire(b.out, [c, 'in1'])
      k.wire(bv.out, [c, 'in2'])
      k.wire(pv.out, [c, 'in3'])
      k.wire([b.tr, 't1'], [c, 'sc'])
      k.wire([c, 'send'], [plate, 'in'])
      k.wire([plate, 'l'], [c, 'retL'])
      k.wire([plate, 'r'], [c, 'retR'])
      toOut(k, [c, 'l'], [c, 'r'])
    },
  },
  glue: {
    howTo: 'GLUE on the drum bus: a breakbeat squeezed so the kit hits as one. Lower THRESHOLD and watch the meter; slow ATTACK lets the transients punch through; MIX blends it in parallel.',
    build(k) {
      const g = k.add('glue', { thresh: -20, ratio: 1, att: 3, rel: 4, makeup: 6 })
      k.wire(beat(k, { groove: GROOVES.breakbeat, level: 0.85 }).out, [g, 'l'])
      toOut(k, [g, 'l'], [g, 'r'])
    },
  },
  master: {
    howTo: 'A beat and a tune through MASTER. Push DRIVE into the limiter (the LEDs show it working); shape it with LOW / MID / HIGH.',
    build(k) {
      const m = k.add('master', { drive: 6, low: 2, high: 1.5 })
      k.wire(band(k, 118), [m, 'l'])
      toOut(k, [m, 'l'], [m, 'r'])
    },
  },
  djmix: {
    howTo: 'Two tracks in sync: a house groove with a dub bass on deck A, an acid breakbeat on deck B. Slide the CROSSFADER to mix from one to the other; kill the LOW on one while you bring the other in.',
    build(k) {
      const a = beat(k, { groove: GROOVES.house })
      const dub = melody(k, { clock: a.clock, phrase: PHRASES.dub, octave: -1 })
      const deckA = mix(k, [a.out, voice(k, dub.pitch, dub.gate, { env: { d: 0.3, s: 0.5 } }).out], [0.8, 0.6])
      const b = beat(k, { clock: a.clock, groove: GROOVES.breakbeat })
      const acid = melody(k, { clock: a.clock, phrase: PHRASES.acid })
      const deckB = mix(k, [b.out, voice(k, acid.pitch, acid.gate, { filter: { type: 'vcf', params: { cutoff: 300, res: 0.8, cv: 0.7 }, out: 'lp4' }, env: { d: 0.15, s: 0.05 } }).out], [0.8, 0.6])
      const dj = k.add('djmix')
      k.wire(deckA, [dj, 'a'])
      k.wire(deckB, [dj, 'b'])
      toOut(k, [dj, 'l'], [dj, 'r'], 0.75)
    },
  },
  mult: {
    howTo: 'MULT copies the melody to two oscillators an octave apart.',
    build(k) {
      const m = melody(k)
      const mu = k.add('mult')
      const a = k.add('vco')
      const b = k.add('vco', { coarse: 1, fine: 0.05 })
      k.wire(m.pitch, [mu, 'a'])
      k.wire([mu, 'a1'], [a, 'voct'])
      k.wire([mu, 'a2'], [b, 'voct'])
      toOut(k, voice(k, null, m.gate, { audio: mix(k, [[a, 'saw'], [b, 'sqr']], [0.6, 0.4]) }).out)
    },
  },
  logic: {
    howTo: 'Two clock divisions combined by LOGIC: AND on the kick, XOR on the hats.',
    build(k) {
      const c = k.add('clock', { bpm: 118 })
      const d = k.add('div')
      const l = k.add('logic')
      k.wire([c, 'x2'], [d, 'clk'])
      k.wire([d, 'd2'], [l, 'a'])
      k.wire([d, 'd3'], [l, 'b'])
      const kick = k.add('kick')
      const hats = k.add('hats')
      k.wire([l, 'or'], [kick, 'trig'])
      k.wire([l, 'xor'], [hats, 'ch'])
      toOut(k, mix(k, [[kick, 'out'], [hats, 'mix']], [0.8, 0.5]))
    },
  },
  atten: {
    howTo: 'An LFO through ATTN into the filter: turn ATTN for more or less sweep (left inverts it).',
    build(k) {
      const m = melody(k)
      const lfo = k.add('lfo', { rate: 0.4 })
      const a = k.add('atten', { a: 0.6 })
      k.wire([lfo, 'tri'], [a, 'a'])
      toOut(k, voice(k, m.pitch, m.gate, { filterCv: [a, 'a'], env: { s: 0.6 } }).out)
    },
  },
  scenes: { howTo: 'Turn some knobs, STORE into a slot; turn more, store another; tap the slots to glide between.', build: (k) => void beside(k, 'scenes') },
  macro: { howTo: 'Press LEARN on a macro, turn some knobs on the tune, LEARN again: now one knob moves them all.', build: (k) => void beside(k, 'macro') },
  accident: { howTo: 'Press ROLL for a happy accident on the tune’s knobs (Ctrl+Z if you hate it). Try EVOLVE.', build: (k) => void beside(k, 'accident', { evolve: 0.2 }) },
  tap: {
    howTo:
      'A funk groove and bass play; TAP hands what you hear to CHOP. Press REC on CHOP, let a bar or two go by, press REC again: the mix is chopped across the pads. Turn the groove down and play them.',
    build(k) {
      const b = beat(k, { groove: GROOVES.funk })
      const bass = melody(k, { clock: b.clock, phrase: PHRASES.funk })
      const v = voice(k, bass.pitch, bass.gate, { filter: { type: 'vcf', params: { cutoff: 500, res: 0.5 }, out: 'lp4' } })
      const chop = k.add('chop', { tempo: GROOVES.funk.bpm })
      const t = k.add('tap')
      k.wire([t, 'l'], [chop, 'in'])
      toOut(k, mix(k, [b.out, v.out, [chop, 'out']], [0.8, 0.6, 0.8]))
    },
  },
  motion: {
    howTo:
      'An acid line whose CUTOFF is turned by lane A: a two-bar swell recorded on MOTION. Click lane B, then turn RESONANCE (or any knob) for a bar or two: it loops from then on. Right-click a lane to clear it.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.acid, bpm: 124 })
      const mono = k.add('mono', { cutoff: 320, res: 0.7, envamt: 0.55, d: 0.18, s: 0.1, glide: 0.05, wave: 0 })
      k.wire(m.pitch, [mono, 'pitch'])
      k.wire(m.gate, [mono, 'gate'])
      // lane A: CUTOFF dips low, swells open over the second bar, falls back
      const pts: Record<string, number> = { bars: 1, smooth: 0.4, has0: 1 }
      for (let i = 0; i < MOTION_POINTS; i++) {
        const t = i / MOTION_POINTS
        pts[pointId(0, i)] = Math.round(MOTION_RES * (0.22 + 0.4 * Math.pow(Math.sin(Math.PI * t), 3)))
      }
      const mo = k.add('motion', pts)
      k.target(mo, 0, mono, 'cutoff')
      k.wire([m.clock, 'x4'], [mo, 'clk'])
      toOut(k, [mono, 'vca'], undefined, 0.6)
    },
  },
  scope: {
    howTo: 'A pulse wave on CH1 whose width an LFO sweeps (watch the high part grow and shrink), and the LFO itself on CH2. Change TIME to zoom; turn the LFO RATE.',
    build(k) {
      const osc = k.add('vco', { coarse: -1, pw: 0.5, pwm: 0.8 })
      const lfo = k.add('lfo', { rate: 0.25 })
      k.wire([lfo, 'tri'], [osc, 'pwm'])
      const s = k.add('scope', { time: 0.02 })
      k.wire([osc, 'sqr'], [s, 'ch1'])
      k.wire([lfo, 'tri'], [s, 'ch2'])
      const vca = k.add('vca', { gain: 0.35 })
      k.wire([osc, 'sqr'], [vca, 'in'])
      toOut(k, [vca, 'out'])
    },
  },
  vision: { howTo: 'The tune plays the jellyfish: every note is a bell stroke, the pitch is its colour.', build: (k) => void visionRig(k, 'vision') },
  visioncore: {
    howTo: 'VISION CORE played by the tune, shown on a VISION VIEW.',
    build(k) {
      const core = visionRig(k, 'visioncore')
      const view = k.add('visionview')
      k.wire([core, 'link'], [view, 'link'])
    },
  },
  visionview: {
    howTo: 'A VISION VIEW showing a VISION CORE the tune plays. Change the VIEW’s SCENE.',
    build(k) {
      const core = visionRig(k, 'visioncore')
      const view = k.add('visionview')
      k.wire([core, 'link'], [view, 'link'])
    },
  },
  vector: {
    howTo: 'Two oscillators an octave apart drawn as X and Y: a slowly turning Lissajous figure.',
    build(k) {
      const m = melody(k)
      const a = k.add('vco')
      const b = k.add('vco', { coarse: 1, fine: 0.02 })
      k.wire(m.pitch, [a, 'voct'])
      k.wire(m.pitch, [b, 'voct'])
      const scope = k.add('vector')
      k.wire([a, 'sin'], [scope, 'x'])
      k.wire([b, 'sin'], [scope, 'y'])
      toOut(k, voice(k, null, m.gate, { audio: mix(k, [[a, 'sin'], [b, 'sin']], [0.6, 0.6]) }).out)
    },
  },
  waterfall: {
    howTo: 'A held saw through a resonant filter that a slow LFO sweeps up and down: each harmonic lights up in turn as the peak passes it, in the WATERFALL.',
    build(k) {
      const osc = k.add('vco', { coarse: -2 })
      const f = k.add('vcf', { cutoff: 400, res: 0.9, cv: 0.7 })
      const lfo = k.add('lfo', { rate: 0.06 })
      k.wire([osc, 'saw'], [f, 'in'])
      k.wire([lfo, 'tri'], [f, 'cv'])
      const w = k.add('waterfall')
      k.wire([f, 'lp4'], [w, 'in'])
      toOut(k, [f, 'lp4'])
    },
  },
  lightshow: {
    howTo: 'The rack’s lights pulse with the band. Turn LEVEL.',
    build(k) {
      const b = band(k)
      const l = k.add('lightshow')
      k.wire(b, [l, 'in'])
      toOut(k, b)
    },
  },
  midi: {
    howTo: 'Play your keyboard (keys A–K) or a MIDI keyboard.',
    played: true,
    build(k) {
      const m = k.add('midi')
      toOut(k, voice(k, [m, 'pitch'], [m, 'gate'], { env: { s: 0.6, r: 0.4 } }).out)
    },
  },
  audioin: {
    howTo: 'Sing or whistle into the mic (click ENABLE): the synth follows your pitch.',
    played: true,
    build(k) {
      const a = k.add('audioin')
      toOut(k, voice(k, [a, 'pitch'], [a, 'gate'], { env: { a: 0.02, s: 0.8, r: 0.3 } }).out)
    },
  },
  camera: {
    howTo: 'Click ENABLE and wave at the camera: movement opens the filter on the tune.',
    build(k) {
      const m = melody(k)
      const c = k.add('camera')
      toOut(k, voice(k, m.pitch, m.gate, { filterCv: [c, 'motion'], env: { s: 0.6 } }).out)
    },
  },
  gamepad: {
    howTo: 'Plug in a gamepad: the left stick plays notes, A plays the gate.',
    played: true,
    build(k) {
      const g = k.add('gamepad')
      const att = k.add('atten', { a: 0.2 })
      const q = k.add('quant', { scale: 4 })
      k.wire([g, 'lx'], [att, 'a'])
      k.wire([att, 'a'], [q, 'in'])
      toOut(k, voice(k, [q, 'out'], [g, 'a'], { env: { s: 0.7 } }).out)
    },
  },
  output: { howTo: 'The tune into the OUTPUT. Turn VOLUME.', build: (k) => void toOut(k, tune(k).out) },
  monitor: {
    howTo: 'The tune into the MONITOR (headphones). Try MONO, DIM and MUTE.',
    build(k) {
      const t = tune(k)
      const m = k.add('monitor')
      k.wire(t.out, [m, 'l'])
    },
  },
}
