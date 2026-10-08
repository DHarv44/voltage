import type { Kit } from '../starters/kit'
import { desk, drums, harmony, line, motion, plus, swell } from './parts'
import type { Song } from './types'

/** Five more eras. Original notes, the era's tricks. */
export const MORE_SONGS: Song[] = [
  {
    id: 'rave-92',
    year: 1992,
    name: 'Rave',
    era: 'A hoover: a massively detuned, pitch-gliding synth that sounds like a jet engine singing; short organ chord stabs; a breakbeat snare running over a four-to-the-floor kick. Loud and joyful.',
    howTo: 'The hoover is SWARM at heavy DETUNE, its notes gliding through SLEW: turn SLEW RISE/FALL for longer swoops. Four bars, the last a snare roll.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 134,
        bars: [
          { kick: 'x...x...x...x...', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', snare: '....x..x.x..x..x', ch: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
          { kick: 'x...x...x...x...', snare: '....x...x.x.xxxx', ch: 'x.x.x.x.x.x.x.x.' },
        ],
        kick: { tune: 52, decay: 0.45, punch: 0.7, drive: 0.5 },
        snare: { tune: 230, decay: 0.16, snappy: 0.6 },
      })
      const h = harmony(k, d.clock, { key: 2, mood: 0.4, bars: 2 })
      const riff = line(k, d.clock, [2, null, null, null, 0, null, 5, 3], { rate: 'x2', octave: -1 })
      const glide = k.add('slew', { rise: 0.07, fall: 0.07 })
      k.wire(riff.pitch, [glide, 'in'])
      const hoover = k.add('swarm', { detune: 0.85, mix: 0.9, spread: 0.7, sub: 0.4, cutoff: 2600, res: 0.2, att: 0.01, rel: 0.3, level: 0.5 })
      k.wire([glide, 'out'], [hoover, 'voct'])
      k.wire(riff.gate, [hoover, 'gate'])
      const stabs = line(k, d.clock, [null, null, 0, null, null, 0, null, null])
      const organ = k.add('fm4', { voice: 4, rel: 0.2, level: 0.45 })
      k.wire(h.notes, [organ, 'voct'])
      k.wire(stabs.gate, [organ, 'gate'])
      const drm = k.add('mixer', { l1: 0.65, l2: 0.45, l3: 0, l4: 0, master: 0.9 })
      k.wire(d.snare!, [drm, 'in1'])
      k.wire(d.hats!, [drm, 'in2'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: [drm, 'out'], lvl: 0.6, snd: 0.2 },
          { src: [hoover, 'l'], lvl: 0.45, pan: -0.6, snd: 0.25, duck: 0.35 },
          { src: [hoover, 'r'], lvl: 0.45, pan: 0.6, snd: 0.25, duck: 0.35 },
          { src: [organ, 'out'], lvl: 0.45, snd: 0.3, duck: 0.2 },
        ],
        { kick: d.kick, fx: { type: 'plate', params: { decay: 0.55, mix: 1 }, stereo: true }, ret: 0.4 },
      )
    },
  },
  {
    id: 'jungle-94',
    year: 1994,
    name: 'Jungle',
    era: 'Breakbeats played fast and chopped up (kick and snare skipping around, ghost notes, rolls), a deep growling Reese bass of detuned saws moving slowly underneath, a dark pad floating over it all.',
    howTo: 'The Reese is SWARM droning on a slow bassline, its filter breathing (MOTION lane A). Edit the break on TR-16: four bars, chopped differently each time.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 165,
        bars: [
          { kick: 'x.x.......x.....', snare: '....x.......x..x', ch: 'x.xxx.xxx.xxx.xx', acc: '....x.......x...' },
          { kick: 'x.........xx....', snare: '....x..x.x..x.x.', ch: 'x.xxx.xxx.xxx.xx', acc: '....x.......x...' },
          { kick: 'x.x.......x.....', snare: '....x.......x..x', ch: 'x.xxx.xxx.xxx.xx', acc: '....x.......x...' },
          { kick: 'x.x.......x.....', snare: '....x.x.x.xxxxxx', ch: 'x.xxx.xxx.......' },
        ],
        kick: { tune: 55, decay: 0.3, punch: 0.7 },
        snare: { tune: 240, decay: 0.13, snappy: 0.5 },
        hats: { chd: 0.02 },
      })
      const reeseLine = line(k, d.clock, [5, 5, 5, 5, 8, 8, 3, 3], { rate: 'x1', octave: -2 })
      const reese = k.add('swarm', { detune: 0.5, mix: 0.5, spread: 0.25, sub: 0.6, cutoff: 380, res: 0.3, att: 0.02, level: 0.6 })
      k.wire(reeseLine.pitch, [reese, 'voct'])
      motion(k, d.clock, 4, [{ mod: reese, param: 'cutoff', curve: swell(0.28, 0.46) }])
      const h = harmony(k, d.clock, { key: 5, mood: 0.5, bars: 4 })
      const pad = k.add('swarm', { detune: 0.3, mix: 0.5, spread: 0.9, cutoff: 1500, att: 1, level: 0.3 })
      k.wire(h.notes, [pad, 'voct'])
      const drm = k.add('mixer', { l1: 0.65, l2: 0.45, l3: 0, l4: 0, master: 0.9 })
      k.wire(d.snare!, [drm, 'in1'])
      k.wire(d.hats!, [drm, 'in2'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.8 },
          { src: [drm, 'out'], lvl: 0.65, snd: 0.15 },
          { src: [reese, 'l'], lvl: 0.5, pan: -0.2 },
          { src: [reese, 'r'], lvl: 0.5, pan: 0.2 },
          { src: [pad, 'l'], lvl: 0.35, pan: -0.8, snd: 0.4 },
          { src: [pad, 'r'], lvl: 0.35, pan: 0.8, snd: 0.4 },
        ],
        { fx: { type: 'plate', params: { decay: 0.7, mix: 1 }, stereo: true }, ret: 0.45, vol: 0.66 },
      )
    },
  },
  {
    id: 'garage-98',
    year: 1998,
    name: 'UK Garage',
    era: 'The two-step: a kick that skips beats, heavily swung shuffling hats, a deep organ bass bouncing between octaves, and jazzy chord stabs cut short. Smooth, bouncy, made for dancing.',
    howTo: 'TR-16’s SWING gives the shuffle: turn it down to hear the groove go stiff. The bass is FM-4’s ORGAN voice following the chords.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 132,
        swing: 0.22,
        bars: [
          { kick: 'x.........x.....', snare: '....x.......x...', ch: 'x.x.xxx.x.x.xxx.', rim: '.......x......x.' },
          { kick: 'x......x..x.....', snare: '....x.......x...', ch: 'x.x.xxx.x.x.xxx.', rim: '...x...x......x.' },
        ],
        kick: { tune: 50, decay: 0.4, punch: 0.6 },
        snare: { tune: 200, decay: 0.15, snappy: 0.55 },
        hats: { chd: 0.025 },
      })
      const h = harmony(k, d.clock, { key: 7, mood: 0.6 })
      const bounce = line(k, d.clock, [0, null, null, 0, null, 12, null, 10], { octave: -2 })
      const bass = k.add('fm4', { voice: 4, rel: 0.25, level: 0.6 })
      k.wire(plus(k, bounce.pitch, h.root), [bass, 'voct'])
      k.wire(bounce.gate, [bass, 'gate'])
      const chops = line(k, d.clock, [null, 0, null, null, 0, null, 0, null])
      const keys = k.add('fm4', { voice: 0, bright: 0.6, decay: 0.25, detune: 0.25, level: 0.5 })
      k.wire(h.notes, [keys, 'voct'])
      k.wire(chops.gate, [keys, 'gate'])
      const drm = k.add('mixer', { l1: 0.6, l2: 0.45, l3: 0, l4: 0, master: 0.9 })
      k.wire(d.snare!, [drm, 'in1'])
      k.wire(d.perc!, [drm, 'in2'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: [drm, 'out'], lvl: 0.6, snd: 0.2 },
          { src: d.hats!, lvl: 0.4, pan: 0.3 },
          { src: [bass, 'out'], lvl: 0.7, duck: 0.3 },
          { src: [keys, 'out'], lvl: 0.45, pan: -0.2, snd: 0.3, duck: 0.3 },
        ],
        { kick: d.kick, fx: { type: 'plate', params: { decay: 0.45, mix: 1 }, stereo: true }, ret: 0.35, vol: 0.72 },
      )
    },
  },
  {
    id: 'synthwave-15',
    year: 2015,
    name: 'Synthwave',
    era: 'The 80s remembered through neon: a huge reverb-drenched snare, an arpeggiated bass running sixteenths through the chords, a wide supersaw pad and a singing lead. Night driving.',
    howTo: 'The bass arpeggio follows PROGRESSION (two bars a chord). Turn the snare channel’s SEND on CONSOLE for more or less of the giant room.',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 100,
        bars: [
          { kick: 'x.......x.......', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.' },
          { kick: 'x.......x.x.....', snare: '....x.......x...', ch: 'x.x.x.x.x.x.....', tom: '............x.xx' },
        ],
        kick: { tune: 55, decay: 0.5, punch: 0.6 },
        snare: { tune: 180, decay: 0.35, snappy: 0.8 },
        tom: { tune: 130, sweep: 0.4 },
      })
      const h = harmony(k, d.clock, { key: 4, mood: 0.4, bars: 2 })
      const arp = line(k, d.clock, [0, 0, 12, 0, 0, 12, 0, 7], { octave: -2 })
      const mono = k.add('mono', { wave: 0.1, cutoff: 900, res: 0.45, envamt: 0.5, d: 0.12, s: 0.1, r: 0.05, vol: 0.55 })
      k.wire(plus(k, arp.pitch, h.root), [mono, 'pitch'])
      k.wire(arp.gate, [mono, 'gate'])
      const pad = k.add('swarm', { detune: 0.5, mix: 0.6, spread: 0.9, cutoff: 2200, att: 1.2, level: 0.4 })
      k.wire(h.notes, [pad, 'voct'])
      const lead = line(k, d.clock, [16, null, 19, 21, null, 19, 16, 14], { rate: 'x2' })
      const fm = k.add('fm4', { voice: 8, bright: 0.55, detune: 0.4, level: 0.45 })
      k.wire(lead.pitch, [fm, 'voct'])
      k.wire(lead.gate, [fm, 'gate'])
      const drm = k.add('mixer', { l1: 0.75, l2: 0.4, l3: 0.6, l4: 0, master: 0.9 })
      k.wire(d.snare!, [drm, 'in1'])
      k.wire(d.hats!, [drm, 'in2'])
      k.wire(d.tom!, [drm, 'in3'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.85 },
          { src: [drm, 'out'], lvl: 0.6, snd: 0.6 },
          { src: [mono, 'vca'], lvl: 0.6, duck: 0.25 },
          { src: [pad, 'l'], lvl: 0.4, pan: -0.8, snd: 0.2, duck: 0.35 },
          { src: [pad, 'r'], lvl: 0.4, pan: 0.8, snd: 0.2, duck: 0.35 },
          { src: [fm, 'out'], lvl: 0.45, snd: 0.5 },
        ],
        { kick: d.kick, fx: { type: 'plate', params: { decay: 0.75, damp: 0.25, mix: 1 }, stereo: true }, ret: 0.5, vol: 0.7 },
      )
    },
  },
  {
    id: 'lofi-17',
    year: 2017,
    name: 'Lo-fi Hip-Hop',
    era: 'Lazy, heavily swung drums, a soft round bass and jazzy electric-piano chords, all played through worn-out tape that wobbles, hisses and dulls the top. Music for studying.',
    howTo: 'Everything but the kick runs through TAPE (fully wet, no repeats): turn its WOW and AGE. The chords are adventurous (PROGRESSION MOOD high).',
    build(k: Kit) {
      const d = drums(k, {
        bpm: 82,
        swing: 0.32,
        bars: [
          { kick: 'x......x..x.....', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', acc: 'x.......x.......' },
          { kick: 'x.....x...x..x..', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x.xx', acc: 'x.......x.......' },
        ],
        kick: { tune: 50, decay: 0.45, punch: 0.4 },
        snare: { tune: 170, decay: 0.2, tone: 0.3, snappy: 0.4 },
        hats: { tone: 5500, chd: 0.04 },
      })
      const h = harmony(k, d.clock, { key: 2, mood: 0.75 })
      const hits = line(k, d.clock, [0, null, null, 0, null, null, 0, null], { rate: 'x2' })
      const keys = k.add('fm4', { voice: 0, bright: 0.35, decay: 0.7, detune: 0.35, velo: 0.3, level: 0.55 })
      k.wire(h.notes, [keys, 'voct'])
      k.wire(hits.gate, [keys, 'gate'])
      const walk = line(k, d.clock, [0, null, null, 0, null, 7, null, null], { rate: 'x2', octave: -2 })
      const bass = k.add('mono', { wave: 0.1, cutoff: 350, res: 0.1, envamt: 0.2, d: 0.3, s: 0.4, r: 0.15, vol: 0.6 })
      k.wire(plus(k, walk.pitch, h.root), [bass, 'pitch'])
      k.wire(walk.gate, [bass, 'gate'])
      // the music bus through worn tape: wet only, no repeats, just wow, hiss and dull highs
      const bus = k.add('mixer', { l1: 0.7, l2: 0.7, l3: 0.6, l4: 0.4, master: 0.9 })
      k.wire([keys, 'out'], [bus, 'in1'])
      k.wire([bass, 'vca'], [bus, 'in2'])
      k.wire(d.snare!, [bus, 'in3'])
      k.wire(d.hats!, [bus, 'in4'])
      const tape = k.add('tape', { time: 0.06, fb: 0, mix: 1, wow: 0.6, age: 0.7 })
      k.wire([bus, 'out'], [tape, 'in'])
      desk(
        k,
        [
          { src: d.kick!, lvl: 0.75 },
          { src: [tape, 'out'], lvl: 0.8, snd: 0.2, duck: 0.15 },
        ],
        { kick: d.kick, fx: { type: 'plate', params: { decay: 0.5, damp: 0.5, mix: 1 }, stereo: true }, ret: 0.35, vol: 0.7 },
      )
    },
  },
]
