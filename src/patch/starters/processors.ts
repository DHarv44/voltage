import { beat, melody, toOut, tune, voice, type Jack, type Kit } from './kit'
import type { Starter } from './types'

/** The tune through one effect: `outs` are its output jacks (two = stereo). */
function through(k: Kit, type: string, params: Record<string, number> = {}, outs: string[] = ['out'], input = 'in'): string {
  const t = tune(k)
  const fx = k.add(type, params)
  k.wire(t.out, [fx, input])
  toOut(k, [fx, outs[0]], outs[1] ? [fx, outs[1]] : undefined)
  return fx
}

/** The voice rig with a different filter in it. */
function filtered(k: Kit, type: string, out: string, params: Record<string, number>): void {
  const m = melody(k)
  toOut(k, voice(k, m.pitch, m.gate, { filter: { type, params, out } }).out)
}

/** A sustained, brighter line (for pedals that want a guitar-ish signal). */
function lead(k: Kit): Jack {
  const m = melody(k, { bpm: 100 })
  return voice(k, m.pitch, m.gate, { osc: { type: 'vco', out: 'sqr' }, filter: { type: 'vcf', params: { cutoff: 1800, res: 0.2 }, out: 'lp2' }, env: { s: 0.7, r: 0.3 } }).out
}

/** A pedal on the lead. Pedals run hot (guitar level, gain stages), so the
 *  output sits lower to land near the other rigs' loudness. */
function pedal(k: Kit, type: string, params: Record<string, number> = {}, vol = 0.4): void {
  const src = lead(k)
  const p = k.add(type, params)
  k.wire(src, [p, 'in'])
  toOut(k, [p, 'out'], undefined, vol)
}

export const PROCESSOR_STARTERS: Record<string, Starter> = {
  vcf: { howTo: 'A sequenced voice through the LADDER filter. Turn CUTOFF and RESONANCE.', build: (k) => filtered(k, 'vcf', 'lp4', { cutoff: 600, res: 0.5 }) },
  svf: { howTo: 'A sequenced voice through the SVF. Try its LP, BP and HP outputs.', build: (k) => filtered(k, 'svf', 'lp', { cutoff: 700, res: 0.5 }) },
  ms: { howTo: 'A sequenced voice through the MS-12 filter. Push PEAK.', build: (k) => filtered(k, 'ms', 'lp', { cutoff: 900, peak: 0.5 }) },
  lpg: {
    howTo: 'A triangle wave struck through the LPG on every note: the west-coast "bongo". Turn DECAY; try the MODE switch.',
    build(k) {
      const m = melody(k, { notes: [0, 7, 3, 10, 12, 5, 7, 15], gates: [1, 1, 1, 1, 1, 1, 1, 1] })
      const osc = k.add('vco', { coarse: 1 })
      const g = k.add('lpg', { off1: 0, amt1: 0, dec1: 0.3 })
      const plate = k.add('plate', { decay: 0.6, mix: 0.3 })
      k.wire(m.pitch, [osc, 'voct'])
      k.wire([osc, 'tri'], [g, 'in1'])
      k.wire(m.trig, [g, 'strike1'])
      k.wire([g, 'out1'], [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'])
    },
  },
  vocoder: {
    howTo: 'A beat vocoded onto the built-in carrier, which follows a bassline: the drums sing it. Turn SHIFT and Q; patch AUDIO IN to MOD to make it talk.',
    build(k) {
      const b = beat(k, { bpm: 108 })
      const m = melody(k, { clock: b.clock, notes: [0, 0, 3, 3, 7, 7, 5, 5], rate: 'x1', octave: -1 })
      const v = k.add('vocoder', { tune: 0, rel: 0.09, mix: 0.25, noise: 0.15 })
      k.wire(b.out, [v, 'mod'])
      k.wire(m.pitch, [v, 'voct'])
      toOut(k, [v, 'out'])
    },
  },
  vca: { howTo: 'The VCA shapes each note with the envelope. Try GAIN for a drone.', build: (k) => toOut(k, tune(k).out) },
  vcamix: {
    howTo: 'Two voices, each through its own VCA in VCA×4, mixed. Turn the levels.',
    build(k) {
      const m = melody(k)
      const lo = melody(k, { clock: m.clock, notes: [0, 0, 7, 7, 5, 5, 3, 3], gates: [1, 0, 1, 0, 1, 0, 1, 0], rate: 'x1', octave: -1 })
      const a = k.add('vco')
      const b = k.add('vco')
      const ea = k.add('adsr', { d: 0.25, s: 0.2 })
      const eb = k.add('adsr', { d: 0.5, s: 0.5 })
      const vm = k.add('vcamix', { lvl1: 0.35, lvl2: 0.4 })
      k.wire(m.pitch, [a, 'voct'])
      k.wire(lo.pitch, [b, 'voct'])
      k.wire(m.gate, [ea, 'gate'])
      k.wire(lo.gate, [eb, 'gate'])
      k.wire([a, 'saw'], [vm, 'in1'])
      k.wire([ea, 'env'], [vm, 'cv1'])
      k.wire([b, 'sqr'], [vm, 'in2'])
      k.wire([eb, 'env'], [vm, 'cv2'])
      const f = k.add('vcf', { cutoff: 1200, res: 0.3 })
      k.wire([vm, 'mix'], [f, 'in'])
      toOut(k, [f, 'lp4'])
    },
  },
  fold: {
    howTo: 'A sine folded by its own envelope: west-coast plucks. Turn FOLD.',
    build(k) {
      const m = melody(k)
      const osc = k.add('vco')
      const fold = k.add('fold', { fold: 2, cv: 0.5 })
      const vca = k.add('vca', { gain: 0, cv: 1 })
      const env = k.add('adsr', { d: 0.3, s: 0.1, r: 0.3 })
      k.wire(m.pitch, [osc, 'voct'])
      k.wire(m.gate, [env, 'gate'])
      k.wire([osc, 'sin'], [fold, 'in'])
      k.wire([env, 'env'], [fold, 'cv'])
      k.wire([fold, 'out'], [vca, 'in'])
      k.wire([env, 'env'], [vca, 'cv'])
      toOut(k, [vca, 'out'])
    },
  },
  ring: {
    howTo: 'A voice ring-modulated by RING’s own oscillator, which follows the melody. Turn FREQ.',
    build(k) {
      const m = melody(k)
      const osc = k.add('vco')
      const ring = k.add('ring', { freq: 330 })
      k.wire(m.pitch, [osc, 'voct'])
      k.wire(m.pitch, [ring, 'voct'])
      k.wire([osc, 'tri'], [ring, 'x'])
      toOut(k, voice(k, null, m.gate, { audio: [ring, 'out'] }).out)
    },
  },
  slew: {
    howTo: 'SLEW glides between the notes (portamento). Turn RISE and FALL.',
    build(k) {
      const m = melody(k)
      const s = k.add('slew', { rise: 0.12, fall: 0.12 })
      k.wire(m.pitch, [s, 'in'])
      toOut(k, voice(k, [s, 'out'], m.gate, { env: { s: 0.6 } }).out)
    },
  },
  quant: {
    howTo: 'Random voltages snapped to a scale by QUANT. Change SCALE.',
    build(k) {
      const c = k.add('clock', { bpm: 110 })
      const n = k.add('noise')
      const sh = k.add('sh')
      const att = k.add('atten', { a: 0.15 })
      const q = k.add('quant', { scale: 4 })
      k.wire([n, 'white'], [sh, 'in'])
      k.wire([c, 'x2'], [sh, 'trig'])
      k.wire([sh, 'out'], [att, 'a'])
      k.wire([att, 'a'], [q, 'in'])
      toOut(k, voice(k, [q, 'out'], [c, 'x2']).out)
    },
  },
  bbd: { howTo: 'The tune through the BBD echo. Turn TIME and FEEDBACK.', build: (k) => void through(k, 'bbd', { time: 0.36, fb: 0.5, mix: 0.4 }) },
  tape: { howTo: 'The tune through the tape echo. Turn AGE and WOW.', build: (k) => void through(k, 'tape', { time: 0.36, fb: 0.5, mix: 0.4 }) },
  spring: { howTo: 'The tune through the spring tank. Turn DECAY.', build: (k) => void through(k, 'spring', { decay: 0.6, mix: 0.4 }) },
  plate: { howTo: 'The tune through the plate reverb, in stereo. Turn DECAY.', build: (k) => void through(k, 'plate', { decay: 0.7, mix: 0.4 }, ['l', 'r']) },
  phaser: { howTo: 'The tune through the phaser. Turn RATE and FEEDBACK.', build: (k) => void through(k, 'phaser', { rate: 0.3, fb: 0.6 }) },
  ensemble: { howTo: 'The tune through the string ensemble chorus, in stereo.', build: (k) => void through(k, 'ensemble', {}, ['l', 'r']) },
  tune: {
    howTo: 'A wobbly, out-of-tune voice pulled into key by TUNE. Turn SPEED: slow is natural, fast is robotic.',
    build(k) {
      const m = melody(k)
      const lfo = k.add('lfo', { rate: 5 })
      const osc = k.add('vco', { fm: 0.08 })
      k.wire(m.pitch, [osc, 'voct'])
      k.wire([lfo, 'sin'], [osc, 'fm'])
      const v = voice(k, null, m.gate, { audio: [osc, 'saw'], env: { s: 0.6 } })
      const t = k.add('tune', { scale: 4, speed: 0.05 })
      k.wire(v.out, [t, 'in'])
      toOut(k, [t, 'out'])
    },
  },
  chamber: { howTo: 'The tune in the echo chamber. Drag the speaker and mic around the room.', build: (k) => void through(k, 'chamber', {}, ['l', 'r']) },
  fuzz: { howTo: 'A lead through the FUZZ pedal. Stomp to bypass; turn FUZZ.', build: (k) => pedal(k, 'fuzz') },
  wah: { howTo: 'A lead through the WAH in AUTO mode. Switch to FOOT and rock the treadle.', build: (k) => pedal(k, 'wah', { mode: 1, sens: 0.7 }, 0.28) },
  octave: { howTo: 'A lead through the OCTAVE pedal. Turn UP and DOWN.', build: (k) => pedal(k, 'octave') },
  chorus: { howTo: 'A lead through the CHORUS pedal.', build: (k) => pedal(k, 'chorus') },
  echo: { howTo: 'A lead through the TAPE ECHO pedal. Turn RATE and FEEDBACK.', build: (k) => pedal(k, 'echo') },
  lpedal: { howTo: 'A lead through the LOOPER pedal: stomp to record, stomp to loop, overdub.', build: (k) => pedal(k, 'lpedal') },
  amp: { howTo: 'A lead through the VALVE AMP. Turn GAIN up for crunch.', build: (k) => pedal(k, 'amp', { gain: 0.6 }, 0.32) },
  talkbox: {
    howTo: 'A lead through the TALK BOX, its vowel swept by an LFO. Drag the mouth.',
    build(k) {
      const src = lead(k)
      const lfo = k.add('lfo', { rate: 0.6 })
      const tb = k.add('talkbox')
      k.wire(src, [tb, 'in'])
      k.wire([lfo, 'tri'], [tb, 'vowel'])
      toOut(k, [tb, 'out'])
    },
  },
}
