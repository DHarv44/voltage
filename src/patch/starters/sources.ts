import { chords, melody, toOut, tune, voice, type Jack, type Kit } from './kit'
import type { Starter } from './types'

/** Self-playing poly chords (see chords()) through a poly voice. */
function polyRig(k: Kit) {
  const c = chords(k)
  const vco = k.add('pvco', { fine: 0.05 })
  const vcf = k.add('pvcf', { cutoff: 1400, res: 0.2, cv: 0.35 })
  const vca = k.add('pvca', { gain: 0, cv: 1 })
  const env = k.add('padsr', { a: 0.03, d: 0.6, s: 0.5, r: 0.5 })
  const pm = k.add('polymix', { level: 0.7 })
  const plate = k.add('plate', { decay: 0.7, mix: 0.3 })
  k.wire(c.notes, [vco, 'voct'])
  k.wire(c.gate, [env, 'gate'])
  k.wire([vco, 'saw'], [vcf, 'in'])
  k.wire([vcf, 'lp'], [vca, 'in'])
  k.wire([env, 'env'], [vca, 'cv'])
  k.wire([env, 'env'], [vcf, 'cv'])
  k.wire([vca, 'out'], [pm, 'in'])
  k.wire([pm, 'sum'], [plate, 'in'])
  toOut(k, [plate, 'l'], [plate, 'r'])
}

/** A source that makes its own notes (or is played), into a plate and out. */
function roomy(k: Kit, src: Jack, plate = 0.3) {
  const p = k.add('plate', { decay: 0.6, mix: plate })
  k.wire(src, [p, 'in'])
  toOut(k, [p, 'l'], [p, 'r'])
}

/** A free-running oscillator gated by a sequenced envelope through a VCA. */
function gatedOsc(k: Kit, type: string, out: string, params: Record<string, number> = {}, voct = 'voct') {
  const m = melody(k)
  return voice(k, m.pitch, m.gate, { osc: { type, params, voct, out }, env: { d: 0.4, s: 0.3 } }).out
}

export const SOURCE_STARTERS: Record<string, Starter> = {
  mono: {
    howTo: 'A sequenced bassline on MONO-1. Turn CUTOFF and RESONANCE.',
    build(k) {
      const m = melody(k, { octave: -1 })
      const mono = k.add('mono', { cutoff: 600, res: 0.6, envamt: 0.5, d: 0.25, s: 0.2 })
      k.wire(m.pitch, [mono, 'pitch'])
      k.wire(m.gate, [mono, 'gate'])
      toOut(k, [mono, 'vca'])
    },
  },
  studio: {
    howTo: 'STUDIO-3 playing a sequenced line. Try its three VCO levels and the filter.',
    build(k) {
      const m = melody(k)
      const s = k.add('studio', { vol: 0.3 })
      k.wire(m.pitch, [s, 'pitch'])
      k.wire(m.gate, [s, 'gate'])
      toOut(k, [s, 'out'])
    },
  },
  sketchbook: {
    howTo: 'SKETCHBOOK playing its pattern. Try the four engines (◀ ▶ in SYNTH), then TAPE: pick a track, ● REC a loop, layer the next.',
    build(k) {
      const s = k.add('sketchbook', { run: 1 })
      toOut(k, [s, 'l'], [s, 'r'])
    },
  },
  groove: {
    howTo: 'GROOVE-1 running its pattern. Edit steps on its grid; try SWING.',
    build(k) {
      const g = k.add('groove', { run: 1, tempo: 112, vol: 0.3 })
      toOut(k, [g, 'mix'])
    },
  },
  polycv: {
    howTo: 'Play chords on your keyboard (keys A–K) or a MIDI keyboard.',
    played: true,
    build(k) {
      const cv = k.add('polycv', { voices: 6 })
      const vco = k.add('pvco', { fine: 0.06 })
      const vcf = k.add('pvcf', { cutoff: 1500, cv: 0.3 })
      const vca = k.add('pvca', { gain: 0, cv: 1 })
      const env = k.add('padsr', { a: 0.05, d: 0.6, s: 0.6, r: 0.8 })
      const pm = k.add('polymix')
      k.wire([cv, 'pitch'], [vco, 'voct'])
      k.wire([cv, 'gate'], [env, 'gate'])
      k.wire([vco, 'saw'], [vcf, 'in'])
      k.wire([vcf, 'lp'], [vca, 'in'])
      k.wire([env, 'env'], [vca, 'cv'])
      k.wire([env, 'env'], [vcf, 'cv'])
      k.wire([vca, 'out'], [pm, 'in'])
      roomy(k, [pm, 'sum'])
    },
  },
  pvco: { howTo: 'Chords that play themselves on a poly voice. Try P-VCO FINE for detune.', build: (k) => polyRig(k) },
  pvcf: { howTo: 'Self-playing poly chords. Sweep P-LADDER CUTOFF.', build: (k) => polyRig(k) },
  padsr: { howTo: 'Self-playing poly chords. Shape them with P-ADSR (try a slow ATTACK).', build: (k) => polyRig(k) },
  pvca: { howTo: 'Self-playing poly chords through P-VCA.', build: (k) => polyRig(k) },
  polymix: { howTo: 'Self-playing poly chords summed to mono by POLY MIX.', build: (k) => polyRig(k) },
  tapekeys: {
    howTo: 'Tape strings playing a chord progression. Try FLUTE and CHOIR, and WOW.',
    build(k) {
      const c = chords(k, { bpm: 80 })
      const keys = k.add('tapekeys')
      k.wire(c.notes, [keys, 'voct'])
      k.wire(c.gate, [keys, 'gate'])
      roomy(k, [keys, 'out'])
    },
  },
  vco: { howTo: 'A sequenced VCO through a filter and VCA. Try its SAW, SQUARE and PWM.', build: (k) => toOut(k, tune(k).out) },
  theremin: {
    howTo: 'Move the pointer over the THEREMIN: across for pitch, up for volume.',
    played: true,
    build(k) {
      const t = k.add('theremin')
      const echo = k.add('bbd', { time: 0.35, fb: 0.35, mix: 0.3 })
      k.wire([t, 'out'], [echo, 'in'])
      roomy(k, [echo, 'out'], 0.25)
    },
  },
  omnichord: { howTo: 'Click a chord button, then strum the plate.', played: true, build: (k) => roomy(k, [k.add('omnichord'), 'out']) },
  chordwheel: { howTo: 'Click a chord on the wheel to play it.', played: true, build: (k) => roomy(k, [k.add('chordwheel'), 'out']) },
  musicbox: { howTo: 'The music box plays its tune. Click the drum to change the notes.', build: (k) => roomy(k, [k.add('musicbox'), 'out'], 0.35) },
  strike: {
    howTo: 'A handpan playing a sequenced phrase. Try STEEL PAN and KALIMBA.',
    build(k) {
      const m = melody(k, { bpm: 96 })
      const s = k.add('strike')
      k.wire(m.pitch, [s, 'voct'])
      k.wire(m.trig, [s, 'trig'])
      roomy(k, [s, 'out'])
    },
  },
  tanpura: { howTo: 'The tanpura drones on its own. Try SA (the key) and JAWARI.', build: (k) => roomy(k, [k.add('tanpura'), 'out'], 0.2) },
  gamelan: {
    howTo: 'A saron playing a sequenced phrase. Try BONANG and GONG.',
    build(k) {
      const m = melody(k, { bpm: 90 })
      const g = k.add('gamelan')
      k.wire(m.pitch, [g, 'voct'])
      k.wire(m.trig, [g, 'trig'])
      roomy(k, [g, 'out'])
    },
  },
  bowl: {
    howTo: 'A singing bowl struck once a bar. Click it to strike, drag round the rim to sing.',
    build(k) {
      const c = k.add('clock', { bpm: 60 })
      const b = k.add('bowl')
      k.wire([c, 'bar'], [b, 'strike'])
      roomy(k, [b, 'out'], 0.35)
    },
  },
  harp: {
    howTo: 'A harp playing a sequenced phrase. Strum the strings too.',
    build(k) {
      const m = melody(k, { bpm: 100 })
      const h = k.add('harp')
      k.wire(m.pitch, [h, 'voct'])
      k.wire(m.trig, [h, 'trig'])
      roomy(k, [h, 'out'])
    },
  },
  stylophone: {
    howTo: 'Touch the metal keyboard with the stylus (drag along it).',
    played: true,
    build(k) {
      const s = k.add('stylophone')
      const sp = k.add('spring', { mix: 0.25 })
      k.wire([s, 'out'], [sp, 'in'])
      toOut(k, [sp, 'out'])
    },
  },
  complex: { howTo: 'A west-coast complex oscillator under an envelope. Turn INDEX and TIMBRE.', build: (k) => toOut(k, gatedOsc(k, 'complex', 'out', { index: 0.4 })) },
  wave: { howTo: 'A wavetable oscillator under an envelope. Turn WAVE to morph.', build: (k) => toOut(k, gatedOsc(k, 'wave', 'out', { wamt: 0.6 })) },
  sub: {
    howTo: 'A VCO with SUB adding octaves below. Turn SUB LEVEL.',
    build(k) {
      const m = melody(k, { octave: -1 })
      const vco = k.add('vco')
      const sub = k.add('sub', { lvl: 0.7 })
      k.wire(m.pitch, [vco, 'voct'])
      k.wire([vco, 'sqr'], [sub, 'in'])
      toOut(k, voice(k, null, m.gate, { audio: [sub, 'mix'] }).out)
    },
  },
  noise: {
    howTo: 'Noise through a resonant band-pass that follows the melody: pitched wind.',
    build(k) {
      const m = melody(k, { bpm: 90 })
      const n = k.add('noise')
      const v = voice(k, null, m.gate, {
        audio: [n, 'white'],
        filter: { type: 'svf', params: { cutoff: 400, res: 0.9, cv: 0.2 }, out: 'bp' },
        env: { a: 0.02, d: 0.4, s: 0.4, r: 0.4 },
      })
      k.wire(m.pitch, [v.filter, 'voct'])
      toOut(k, v.out)
    },
  },
}
