import type { Kit } from '../starters/kit'
import { chordPoly, desk, drums, harmony, line, motion, plus, swell } from './parts'
import type { Song } from './types'

/** The 70s and 80s. Every note here is our own; what's borrowed is how the
 *  era made its sound. */
export const EARLY_SONGS: Song[] = [
  {
    id: 'berlin-75',
    year: 1975,
    name: 'Berlin School',
    era: 'Long sequencer patterns cycling under slowly opening filters, a second line of a different length drifting against them, a drone, deep echo. No drums: the sequencer is the rhythm.',
    howTo: 'Lane A of MOTION opens the bass filter over eight bars. Turn the BELL line’s SEQ-8 knobs: 7 steps against 8 keeps shifting.',
    build(k: Kit) {
      const clock = k.add('clock', { bpm: 112 })
      const bass = line(k, clock, [0, 12, 7, 3, 10, 7, 3, 12], { octave: -1 })
      const mono = k.add('mono', { wave: 0, cutoff: 500, res: 0.65, envamt: 0.5, d: 0.2, s: 0.1, r: 0.15, vol: 0.55 })
      k.wire(bass.pitch, [mono, 'pitch'])
      k.wire(bass.gate, [mono, 'gate'])
      const bell = line(k, clock, [24, null, 19, null, 22, 15, null], { rate: 'x2', octave: -1 })
      const fm = k.add('fm4', { voice: 2, decay: 0.45, level: 0.5 })
      k.wire(bell.pitch, [fm, 'voct'])
      k.wire(bell.gate, [fm, 'gate'])
      const off = k.add('atten', { a: -0.4 })
      const drone = k.add('swarm', { detune: 0.25, mix: 0.5, spread: 0.8, cutoff: 900, att: 2, level: 0.35 })
      k.wire([off, 'a'], [drone, 'voct'])
      motion(k, clock, 8, [{ mod: mono, param: 'cutoff', curve: swell(0.18, 0.55) }])
      desk(
        k,
        [
          { src: [mono, 'vca'], lvl: 0.75, snd: 0.4 },
          { src: [fm, 'out'], lvl: 0.5, pan: 0.4, snd: 0.55 },
          { src: [drone, 'l'], lvl: 0.4, pan: -0.7, snd: 0.2 },
          { src: [drone, 'r'], lvl: 0.4, pan: 0.7, snd: 0.2 },
        ],
        { fx: { type: 'bbd', params: { time: 0.4, fb: 0.55, mix: 1, mod: 0.2 } }, ret: 0.55, vol: 0.82 },
      )
    },
  },
  {
    id: 'electro-82',
    year: 1982,
    name: 'Electro',
    era: 'A drum machine’s booming kick on a broken, syncopated pattern, handclaps, a cowbell, tight hats; a short square-wave bass; brassy minor-seventh stabs. Robots doing funk.',
    howTo: 'Four bars: A, B, A, then a snare-roll fill. Edit TR-16’s steps; turn KICK DECAY for more boom.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 112,
        bars: [
          { kick: 'x.....x...x.....', snare: '....x.......x...', clap: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', bell: '......x.......x.', acc: 'x...x...x...x...' },
          { kick: 'x.....x...x..x..', snare: '....x.......x...', clap: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', oh: '..............x.', bell: '......x...x...x.' },
          { kick: 'x.....x...x.....', snare: '....x.......x...', clap: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', bell: '......x.......x.', acc: 'x...x...x...x...' },
          { kick: 'x.....x...x.....', snare: '....x.......xxxx', clap: '....x...........', ch: 'x.x.x.x.x.x.....', tom: '........x.x.....' },
        ],
        kick: { tune: 48, decay: 0.9, punch: 0.4, drive: 0.3 },
        snare: { tune: 210, snappy: 0.7 },
        perc: { btune: 1, bdecay: 0.18 },
        tom: { tune: 110 },
      })
      const bass = line(k, d.clock, [4, null, 4, 16, null, 4, 14, 11], { octave: -2 })
      const mono = k.add('mono', { wave: 0.85, cutoff: 900, res: 0.4, envamt: 0.45, a: 0.002, d: 0.15, s: 0.2, r: 0.05, vol: 0.6 })
      k.wire(bass.pitch, [mono, 'pitch'])
      k.wire(bass.gate, [mono, 'gate'])
      const stab = line(k, d.clock, [null, null, null, 4, null, null, 4, null], { rate: 'x2' })
      const fm = k.add('fm4', { voice: 3, decay: 0.3, bright: 0.6, rel: 0.3, level: 0.55 })
      k.wire(chordPoly(k, stab.pitch, 5), [fm, 'voct'])
      k.wire(stab.gate, [fm, 'gate'])
      const snares = k.add('mixer', { l1: 0.7, l2: 0.6, l3: 0.5, l4: 0, master: 0.9 })
      k.wire(d.snare!, [snares, 'in1'])
      k.wire(d.clap!, [snares, 'in2'])
      k.wire(d.tom!, [snares, 'in3'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: [snares, 'out'], lvl: 0.6, snd: 0.3 },
          { src: d.hats!, lvl: 0.4, pan: 0.25 },
          { src: d.perc!, lvl: 0.35, pan: -0.3, snd: 0.2 },
          { src: [mono, 'vca'], lvl: 0.7 },
          { src: [fm, 'out'], lvl: 0.45, snd: 0.4, duck: 0.2 },
        ],
        { kick: d.kick, fx: { type: 'plate', params: { decay: 0.55, mix: 1 }, stereo: true }, ret: 0.4 },
      )
    },
  },
  {
    id: 'synthpop-83',
    year: 1983,
    name: 'Synth-Pop',
    era: 'Straight eighth-note bass pumping the root of each chord, brassy FM stabs, a big drum machine snare drowned in reverb, steady hats. Bright, driving, built for the radio.',
    howTo: 'The bass and stabs follow PROGRESSION’s chords: turn its MOOD for bolder changes. Two bars: the second adds a kick and an open hat.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 118,
        bars: [
          { kick: 'x.......x.x.....', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', acc: '....x.......x...' },
          { kick: 'x.......x.x...x.', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x...', oh: '..............x.', acc: '....x.......x...' },
        ],
        kick: { tune: 55, decay: 0.45, punch: 0.6 },
        snare: { tune: 180, decay: 0.3, snappy: 0.8 },
      })
      const h = harmony(k, d.clock, { key: 2, mood: 0.35 })
      const pump = line(k, d.clock, [0, 0, 0, 0, 0, 0, 0, 0], { rate: 'x2', octave: -2 })
      const mono = k.add('mono', { wave: 0.9, cutoff: 1200, res: 0.3, envamt: 0.4, d: 0.12, s: 0.3, r: 0.05, vol: 0.6 })
      k.wire(plus(k, pump.pitch, h.root), [mono, 'pitch'])
      k.wire(pump.gate, [mono, 'gate'])
      const hits = line(k, d.clock, [null, null, 0, null, null, 0, 0, null], { rate: 'x2' })
      const fm = k.add('fm4', { voice: 3, decay: 0.4, bright: 0.55, level: 0.5 })
      k.wire(h.notes, [fm, 'voct'])
      k.wire(hits.gate, [fm, 'gate'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: d.snare!, lvl: 0.6, snd: 0.75 },
          { src: d.hats!, lvl: 0.35, pan: 0.3 },
          { src: [mono, 'vca'], lvl: 0.65 },
          { src: [fm, 'out'], lvl: 0.5, pan: -0.15, snd: 0.3 },
        ],
        { fx: { type: 'plate', params: { decay: 0.5, damp: 0.2, mix: 1 }, stereo: true }, ret: 0.55 },
      )
    },
  },
  {
    id: 'italo-84',
    year: 1984,
    name: 'Italo Disco',
    era: 'The octave-jumping sixteenth-note bass (root, octave, root, octave) under four-on-the-floor, offbeat open hats, a lush supersaw pad and a bright lead. Pure synthetic glamour.',
    howTo: 'The bass jumps octaves while following the chords. Four bars, the last with a tom fill. Try MONO-1 CUTOFF and the LEAD’s BRIGHT.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 120,
        bars: [
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', clap: '....x...........', ch: 'x.x.x.x.x.......', tom: '..........x.x.xx' },
        ],
        kick: { tune: 52, decay: 0.5, punch: 0.6 },
        clap: { decay: 0.35 },
        tom: { tune: 140, sweep: 0.5 },
      })
      const h = harmony(k, d.clock, { key: 9, mood: 0.3 })
      const oct = line(k, d.clock, [0, 12, 0, 12, 0, 12, 0, 12], { octave: -2 })
      const mono = k.add('mono', { wave: 0.5, cutoff: 1100, res: 0.35, envamt: 0.4, d: 0.1, s: 0.2, r: 0.05, vol: 0.55 })
      k.wire(plus(k, oct.pitch, h.root), [mono, 'pitch'])
      k.wire(oct.gate, [mono, 'gate'])
      const pad = k.add('swarm', { detune: 0.4, mix: 0.6, spread: 0.85, cutoff: 2500, att: 0.6, level: 0.4 })
      k.wire(h.notes, [pad, 'voct'])
      const lead = line(k, d.clock, [21, null, 24, 23, null, 19, 21, null], { rate: 'x2' })
      const fm = k.add('fm4', { voice: 8, bright: 0.6, decay: 0.5, level: 0.45 })
      k.wire(lead.pitch, [fm, 'voct'])
      k.wire(lead.gate, [fm, 'gate'])
      const drm = k.add('mixer', { l1: 0.6, l2: 0.45, l3: 0.55, l4: 0, master: 0.9 })
      k.wire(d.clap!, [drm, 'in1'])
      k.wire(d.hats!, [drm, 'in2'])
      k.wire(d.tom!, [drm, 'in3'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: [drm, 'out'], lvl: 0.6, snd: 0.2 },
          { src: [mono, 'vca'], lvl: 0.65, duck: 0.3 },
          { src: [pad, 'l'], lvl: 0.4, pan: -0.7, duck: 0.4 },
          { src: [pad, 'r'], lvl: 0.4, pan: 0.7, duck: 0.4 },
          { src: [fm, 'out'], lvl: 0.45, snd: 0.45 },
        ],
        { kick: d.kick, fx: { type: 'plate', params: { decay: 0.6, mix: 1 }, stereo: true }, ret: 0.45 },
      )
    },
  },
  {
    id: 'acid-87',
    year: 1987,
    name: 'Acid House',
    era: 'A little bass synth pushed somewhere it was never meant to go: resonance high, the cutoff ridden by hand so the line squelches and screams, over a drum machine’s 4/4 and open hats.',
    howTo: 'MOTION is riding the cutoff (lane A) and the envelope (lane B) over four bars. Click lane C and turn RESONANCE to record your own move.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 124,
        bars: [
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'x.xxx.xxx.xxx.xx', oh: '..x...x...x...x.', acc: 'x...x...x...x...' },
          { kick: 'x...x...x...x...', clap: '....x.......x.xx', ch: 'x.xxx.xxx.xxx.xx', oh: '..x...x...x...x.', acc: 'x...x...x...x...' },
        ],
        kick: { tune: 50, decay: 0.45, punch: 0.65, drive: 0.4 },
        hats: { chd: 0.03, ohd: 0.25 },
      })
      const acid = line(k, d.clock, [9, 9, 21, 9, 12, null, 19, 21], { octave: -2 })
      const mono = k.add('mono', { wave: 0, cutoff: 320, res: 0.9, envamt: 0.6, drive: 2, a: 0.002, d: 0.16, s: 0, r: 0.08, glide: 0.05, vol: 0.55 })
      k.wire(acid.pitch, [mono, 'pitch'])
      k.wire(acid.gate, [mono, 'gate'])
      motion(k, d.clock, 4, [
        { mod: mono, param: 'cutoff', curve: swell(0.1, 0.5) },
        { mod: mono, param: 'envamt', curve: (t) => 0.4 + 0.35 * Math.pow(Math.sin(2 * Math.PI * t), 2) },
      ])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: d.clap!, lvl: 0.55, snd: 0.15 },
          { src: d.hats!, lvl: 0.4, pan: 0.2 },
          { src: [mono, 'vca'], lvl: 0.7, snd: 0.35, duck: 0.2 },
        ],
        { kick: d.kick, fx: { type: 'bbd', params: { time: 0.363, fb: 0.45, mix: 1, mod: 0.1 } }, ret: 0.45 },
      )
    },
  },
  {
    id: 'detroit-88',
    year: 1988,
    name: 'Detroit Techno',
    era: 'Machine drums with a human swing, sustained minor string chords drifting over them, a syncopated synth riff and an offbeat bass that follow the chords. Futuristic and melancholy at once.',
    howTo: 'The strings are SWARM droning on PROGRESSION’s chords (two bars each). Turn SWARM DETUNE and CUTOFF; edit the riff on its SEQ-8.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 126,
        swing: 0.1,
        bars: [
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xxxxxxxxxxxxxxxx', rim: '...x..x....x..x.', acc: 'x.x.x.x.x.x.x.x.' },
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xxxxxxxxxxxxxxxx', oh: '..x...x...x...x.', rim: '...x..x....x..x.', acc: 'x.x.x.x.x.x.x.x.' },
        ],
        kick: { tune: 50, decay: 0.5, punch: 0.6 },
        hats: { chd: 0.025 },
        perc: { rtune: 1.1 },
      })
      const h = harmony(k, d.clock, { key: 5, mood: 0.5, bars: 2 })
      const strings = k.add('swarm', { detune: 0.3, mix: 0.5, spread: 0.9, cutoff: 1800, res: 0.1, att: 0.4, level: 0.45 })
      k.wire(h.notes, [strings, 'voct'])
      const riff = line(k, d.clock, [12, null, null, 19, null, null, 22, null])
      const fm = k.add('fm4', { voice: 5, decay: 0.5, bright: 0.55, level: 0.5 })
      k.wire(plus(k, riff.pitch, h.root), [fm, 'voct'])
      k.wire(riff.gate, [fm, 'gate'])
      const off = line(k, d.clock, [null, 0, null, 0, null, 0, null, 0], { rate: 'x2', octave: -2 })
      const mono = k.add('mono', { wave: 0.3, cutoff: 700, res: 0.3, envamt: 0.4, d: 0.12, s: 0.2, r: 0.05, vol: 0.55 })
      k.wire(plus(k, off.pitch, h.root), [mono, 'pitch'])
      k.wire(off.gate, [mono, 'gate'])
      const drm = k.add('mixer', { l1: 0.6, l2: 0.4, l3: 0.5, l4: 0.7, master: 0.9 })
      k.wire(d.clap!, [drm, 'in1'])
      k.wire(d.hats!, [drm, 'in2'])
      k.wire(d.perc!, [drm, 'in3'])
      k.wire([mono, 'vca'], [drm, 'in4'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: [drm, 'out'], lvl: 0.6, snd: 0.15, duck: 0.15 },
          { src: [strings, 'l'], lvl: 0.45, pan: -0.7, snd: 0.25, duck: 0.4 },
          { src: [strings, 'r'], lvl: 0.45, pan: 0.7, snd: 0.25, duck: 0.4 },
          { src: [fm, 'out'], lvl: 0.45, snd: 0.35 },
        ],
        { kick: d.kick, fx: { type: 'plate', params: { decay: 0.65, mix: 1 }, stereo: true }, ret: 0.45 },
      )
    },
  },
]
