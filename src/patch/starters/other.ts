import { band, beat, melody, mix, toOut, tune, voice, type Kit } from './kit'
import type { Starter } from './types'

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
  mixer: { howTo: 'A beat and a tune mixed together. Turn the channel levels.', build: (k) => toOut(k, band(k)) },
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
  djmix: {
    howTo: 'A beat on deck A and a tune on deck B. Slide the CROSSFADER; try the FILTER knobs.',
    build(k) {
      const b = beat(k)
      const m = melody(k, { clock: b.clock })
      const v = voice(k, m.pitch, m.gate)
      const dj = k.add('djmix')
      k.wire(b.out, [dj, 'a'])
      k.wire(v.out, [dj, 'b'])
      toOut(k, [dj, 'l'], [dj, 'r'])
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
  scope: {
    howTo: 'The tune’s audio (CH1) and its envelope (CH2) on the scope.',
    build(k) {
      const t = tune(k)
      const s = k.add('scope', { time: 0.02 })
      k.wire(t.out, [s, 'ch1'])
      k.wire([t.voice.env, 'env'], [s, 'ch2'])
      toOut(k, t.out)
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
    howTo: 'The band’s spectrum scrolling down the WATERFALL.',
    build(k) {
      const b = band(k)
      const w = k.add('waterfall')
      k.wire(b, [w, 'in'])
      toOut(k, b)
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
