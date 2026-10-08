import type { Kit } from '../starters/kit'
import { chordPoly, desk, drums, harmony, line, motion, plus, rise, swell } from './parts'
import type { Song } from './types'

export const LATER_SONGS: Song[] = [
  {
    id: 'ambient-78',
    year: 1978,
    name: 'Tape-Loop Ambient',
    era: 'Several loops of different lengths, each with a few notes, left to drift in and out of line with each other: the music arranges itself and never quite repeats. Soft piano, long reverb.',
    howTo: 'Three SEQ-8 loops of 7, 5 and 8 steps at different speeds feed one FM-4. Let it run for minutes; GRAINS and SHIMMER smear it into a haze.',
    build(k: Kit) {
      const clock = k.add('clock', { bpm: 60 })
      const a = line(k, clock, [9, null, null, 5, null, null, null], { rate: 'x1' })
      const b = line(k, clock, [null, 12, null, null, 16], { rate: 'x1' })
      const c = line(k, clock, [null, 19, null, null, 14, null, 10, null], { rate: 'd2' })
      const pitches = k.add('polymix', { level: 0 })
      const gates = k.add('polymix', { level: 0 })
      ;[a, b, c].forEach((l, i) => {
        k.wire(l.pitch, [pitches, `m${i + 1}`])
        k.wire(l.gate, [gates, `m${i + 1}`])
      })
      const fm = k.add('fm4', { voice: 0, decay: 0.8, rel: 0.8, bright: 0.35, detune: 0.3, velo: 0, level: 0.6 })
      k.wire([pitches, 'merged'], [fm, 'voct'])
      k.wire([gates, 'merged'], [fm, 'gate'])
      const gr = k.add('grains', { pos: 0.35, size: 0.3, density: 8, spray: 0.4, spread: 0.9, rev: 0.3, fb: 0.3, mix: 0.4 })
      k.wire([fm, 'out'], [gr, 'in'])
      desk(
        k,
        [
          { src: [gr, 'l'], lvl: 0.7, pan: -0.6, snd: 0.5 },
          { src: [gr, 'r'], lvl: 0.7, pan: 0.6, snd: 0.5 },
        ],
        { fx: { type: 'shimmer', params: { decay: 0.9, shimmer: 0.4, mix: 1 }, stereo: true }, ret: 0.6, vol: 0.78 },
      )
    },
  },
  {
    id: 'dub-94',
    year: 1994,
    name: 'Dub Techno',
    era: 'One minor-seventh chord stab, short and filtered, thrown into a long echo so the repeats become the music; a deep, soft kick; hiss and space. Patience as a style.',
    howTo: 'MOTION opens and closes the stab’s filter over eight bars. Turn the BBD’s REPEATS up for longer trails; move its TIME for the pitch smear.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 118,
        bars: [
          { kick: 'x...x...x...x...', ch: '..x...x...x...x.', rim: '.......x........' },
          { kick: 'x...x...x...x...', ch: '..x...x...x...xx', rim: '...x......x....x' },
        ],
        kick: { tune: 45, decay: 0.7, punch: 0.4 },
        hats: { tone: 6000, chd: 0.03 },
        perc: { rtune: 0.9 },
      })
      const stab = line(k, d.clock, [null, 0, null, null, null, 0, null, -2], { rate: 'x2' })
      const sw = k.add('swarm', { detune: 0.15, mix: 0.3, spread: 0.6, cutoff: 700, res: 0.35, att: 0.003, rel: 0.25, level: 0.6 })
      k.wire(chordPoly(k, stab.pitch, 5), [sw, 'voct'])
      k.wire(stab.gate, [sw, 'gate'])
      motion(k, d.clock, 8, [
        { mod: sw, param: 'cutoff', curve: swell(0.25, 0.55) },
        { mod: sw, param: 'res', curve: swell(0.3, 0.55) },
      ])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.9 },
          { src: d.hats!, lvl: 0.3, pan: 0.3 },
          { src: d.perc!, lvl: 0.35, pan: -0.3, snd: 0.35 },
          { src: [sw, 'l'], lvl: 0.5, pan: -0.5, snd: 0.7, duck: 0.3 },
          { src: [sw, 'r'], lvl: 0.5, pan: 0.5, snd: 0.7, duck: 0.3 },
        ],
        { kick: d.kick, fx: { type: 'bbd', params: { time: 0.76, fb: 0.68, mix: 1, mod: 0.25 } }, ret: 0.6 },
      )
    },
  },
  {
    id: 'french-97',
    year: 1997,
    name: 'Filter House',
    era: 'A disco loop of electric piano and funky bass run through one big low-pass filter that slowly opens, the whole groove pumping against the kick. The filter sweep is the song.',
    howTo: 'MOTION lane A opens the filter on the music over eight bars, then snaps it shut. The kick ducks everything (CONSOLE DUCK). Right-click MOTION’s lane A to clear it, then ride LADDER’s CUTOFF yourself.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 124,
        bars: [
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'x.xxx.xxx.xxx.xx', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', clap: '....x.......x..x', ch: 'x.xxx.xxx.xxx.xx', oh: '..x...x...x...x.' },
        ],
        kick: { tune: 52, decay: 0.45, punch: 0.6, drive: 0.4 },
        hats: { chd: 0.03, ohd: 0.3 },
      })
      const h = harmony(k, d.clock, { key: 7, mood: 0.5 })
      const keys = line(k, d.clock, [null, null, 0, null, null, 0, null, 0])
      const fm = k.add('fm4', { voice: 0, detune: 0.3, bright: 0.65, decay: 0.35, level: 0.6 })
      k.wire(h.notes, [fm, 'voct'])
      k.wire(keys.gate, [fm, 'gate'])
      const funk = line(k, d.clock, [0, null, 12, 0, null, 10, null, 7], { octave: -2 })
      const mono = k.add('mono', { wave: 0.2, cutoff: 600, res: 0.4, envamt: 0.55, d: 0.12, s: 0.1, r: 0.05, vol: 0.6 })
      k.wire(plus(k, funk.pitch, h.root), [mono, 'pitch'])
      k.wire(funk.gate, [mono, 'gate'])
      const music = k.add('mixer', { l1: 0.75, l2: 0.7, l3: 0, l4: 0, master: 0.9 })
      k.wire([fm, 'out'], [music, 'in1'])
      k.wire([mono, 'vca'], [music, 'in2'])
      const filter = k.add('vcf', { cutoff: 600, res: 0.45, drive: 1.3 })
      k.wire([music, 'out'], [filter, 'in'])
      // the sweep: closed, opening over seven bars, snapping shut on the last
      motion(k, d.clock, 8, [{ mod: filter, param: 'cutoff', curve: (t) => (t < 0.9 ? rise(0.3, 0.92, 1.6)(t / 0.9) : 0.3) }])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.9 },
          { src: d.clap!, lvl: 0.5, snd: 0.2 },
          { src: d.hats!, lvl: 0.35, pan: 0.25 },
          { src: [filter, 'lp4'], lvl: 0.8, snd: 0.15, duck: 0.65 },
        ],
        { kick: d.kick, rel: 0.2, fx: { type: 'plate', params: { decay: 0.45, mix: 1 }, stereo: true }, ret: 0.35 },
      )
    },
  },
  {
    id: 'trance-99',
    year: 1999,
    name: 'Trance',
    era: 'Huge detuned supersaw chords chopped into a sixteenth-note rhythm (the trance gate), a rolling offbeat bass, four-on-the-floor, and a filter that keeps building. Euphoria by design.',
    howTo: 'MOTION builds SWARM’s cutoff over eight bars. The gate rhythm is the second SEQ-8: change its gates. The kick pumps the saws and bass.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 138,
        bars: [
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xxxxxxxxxxxxxxxx', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xxxxxxxxxxxxxxxx', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xxxxxxxxxxxxxxxx', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', snare: '..x.x.x.xxxxxxxx', ch: 'xxxxxxxxxxxxxxxx', oh: '..x...x...x...x.' },
        ],
        kick: { tune: 50, decay: 0.4, punch: 0.75, drive: 0.4 },
        snare: { tune: 220, decay: 0.12 },
        hats: { chd: 0.02, ohd: 0.2 },
      })
      const h = harmony(k, d.clock, { key: 9, mood: 0.35, bars: 2 })
      const roll = line(k, d.clock, [null, 0, 0, 0, null, 0, 0, 0], { octave: -2 })
      const mono = k.add('mono', { wave: 0, cutoff: 500, res: 0.3, envamt: 0.45, d: 0.1, s: 0.3, r: 0.04, vol: 0.55 })
      k.wire(plus(k, roll.pitch, h.root), [mono, 'pitch'])
      k.wire(roll.gate, [mono, 'gate'])
      const gate = line(k, d.clock, [0, null, 0, 0, null, 0, 0, null])
      const sw = k.add('swarm', { detune: 0.55, mix: 0.7, spread: 0.9, cutoff: 4000, res: 0.15, att: 0.002, rel: 0.12, level: 0.55 })
      k.wire(h.notes, [sw, 'voct'])
      k.wire(gate.gate, [sw, 'gate'])
      motion(k, d.clock, 8, [{ mod: sw, param: 'cutoff', curve: rise(0.4, 0.92, 1.5) }])
      const drm = k.add('mixer', { l1: 0.55, l2: 0.55, l3: 0.4, l4: 0, master: 0.9 })
      k.wire(d.clap!, [drm, 'in1'])
      k.wire(d.snare!, [drm, 'in2'])
      k.wire(d.hats!, [drm, 'in3'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.9 },
          { src: [drm, 'out'], lvl: 0.55, snd: 0.2 },
          { src: [mono, 'vca'], lvl: 0.6, duck: 0.5 },
          { src: [sw, 'l'], lvl: 0.45, pan: -0.7, snd: 0.3, duck: 0.6 },
          { src: [sw, 'r'], lvl: 0.45, pan: 0.7, snd: 0.3, duck: 0.6 },
        ],
        { kick: d.kick, rel: 0.18, fx: { type: 'shimmer', params: { decay: 0.75, shimmer: 0.25, mix: 1 }, stereo: true }, ret: 0.4 },
      )
    },
  },
  {
    id: 'trap-12',
    year: 2012,
    name: 'Trap',
    era: 'A tuned 808 kick held long enough to be the bassline, sliding between notes; a half-time snare; skittering hi-hats with fast rolls; a sparse, dark bell melody on top.',
    howTo: 'The KICK’s TUNE input plays the 808 notes (a SEQ-8). Turn KICK DECAY for a longer boom; edit TR-16’s hat rolls.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 140,
        bars: [
          { kick: 'x......x..x.....', snare: '........x.......', ch: 'x.x.x.x.x.x.xxx.', acc: 'x.......x.......' },
          { kick: 'x.....x..x.x....', snare: '........x.......', ch: 'x.x.x.xxx.x.xxxx', oh: '..............x.', acc: 'x.......x.......' },
        ],
        kick: { tune: 45, decay: 1.6, punch: 0.5, drive: 0.5 },
        snare: { tune: 200, decay: 0.2, snappy: 0.7 },
        hats: { chd: 0.025 },
      })
      const eight = line(k, d.clock, [0, 0, 0, 3, 0, 0, -2, -2], { rate: 'x2' })
      k.wire(eight.pitch, [d.kick![0], 'tune']) // the 808 trick: the kick plays the bassline
      const bell = line(k, d.clock, [12, null, 15, null, 14, null, 10, 7], { rate: 'x2' })
      const fm = k.add('fm4', { voice: 2, decay: 0.35, bright: 0.4, level: 0.45 })
      k.wire(bell.pitch, [fm, 'voct'])
      k.wire(bell.gate, [fm, 'gate'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.6 },
          { src: d.snare!, lvl: 0.55, snd: 0.25 },
          { src: d.hats!, lvl: 0.35, pan: 0.25 },
          { src: [fm, 'out'], lvl: 0.5, pan: -0.2, snd: 0.45 },
        ],
        { fx: { type: 'plate', params: { decay: 0.6, mix: 1 }, stereo: true }, ret: 0.45, vol: 0.55 },
      )
    },
  },
]
