import { melody, mix, toOut, voice, type Kit } from './kit'
import { heldChords } from './instruments2'
import { buildStrudelRack } from '../../strudel/importer'
import type { Starter } from './types'

/** A short Strudel piece for STRUDEL's rig: a beat, a bass, a lead with a filter pattern. */
const STRUDEL_DEMO = `setcpm(124/4)
stack(
  s("bd*4, [~ cp]*2, hh*8").bank("tr909"),
  note("<c2 c2 eb2 f2>*4").s("sawtooth").decay(0.2).sustain(0.2).lpf("<400 900>*4"),
  n("<0 2 4 7 4 2>*8").scale("c4:minor").s("triangle").sometimes(ply(2)).room(0.4).gain(0.5)
)`

/** The new sequencers', SPACE's and TUNING's ready-to-play rigs. */
export const SEQ2_STARTERS: Record<string, Starter> = {
  strudel: {
    howTo: 'STRUDEL running a short piece on its own jacks: 909-style drums, a saw bass whose lpf pattern rides its filter through MOD, a triangle lead that sometimes doubles up. Edit the code on the panel and it follows as you type. Paste your own from strudel.cc under Explore ▸ From Strudel and a rack is built for it.',
    build(k) {
      buildStrudelRack(k, STRUDEL_DEMO, true)
    },
  },
  strudelcore: {
    howTo: 'STRUDEL CORE running a short piece, its parts on STRUDEL PARTs and its drums on STRUDEL DRUMS over LINK: the modular form, with a part for every sound in the piece. Change a PART’s number to swap what it plays; add more PARTs for pieces with many sounds.',
    build(k) {
      buildStrudelRack(k, STRUDEL_DEMO)
    },
  },
  strudelpart: {
    howTo: 'STRUDEL PARTs on a STRUDEL CORE’s LINK, one per part of the piece: each PART’s screen names the sound it plays. Turn a PART knob to another number and that part’s notes come out of it instead.',
    build(k) {
      buildStrudelRack(k, STRUDEL_DEMO)
    },
  },
  strudeldrums: {
    howTo: 'STRUDEL DRUMS on a STRUDEL CORE’s LINK: the piece’s bd, cp and hh as triggers into KICK, CLAP and HATS. Patch its other triggers to any drum you like.',
    build(k) {
      buildStrudelRack(k, STRUDEL_DEMO)
    },
  },
  drummap: {
    howTo: 'DRUM MAP playing kick, snare and hats. Drag the dot across its map: from a plain backbeat through four-on-the-floor, boom bap, breakbeat, 2-step, jungle, Latin and footwork, blending on the way. Turn each FILL for busier or sparser parts; add CHAOS; patch an LFO to X CV and let it wander.',
    build(k) {
      const d = k.add('drummap', { tempo: 104 })
      const kick = k.add('kick', { decay: 0.5, punch: 0.6 })
      const snare = k.add('snare')
      const hats = k.add('hats', { chd: 0.04 })
      k.wire([d, 'bd'], [kick, 'trig'])
      k.wire([d, 'sd'], [snare, 'trig'])
      k.wire([d, 'hh'], [hats, 'ch'])
      k.wire([d, 'acc'], [kick, 'acc'])
      k.wire([d, 'acc'], [snare, 'acc'])
      toOut(k, mix(k, [[kick, 'out'], [snare, 'out'], [hats, 'mix']], [0.8, 0.65, 0.4]), undefined, 0.6)
    },
  },
  staircase: {
    howTo: 'STAIRCASE climbing its eight stages into a squelchy bass: stages held for several pulses, one ratcheting (EACH), one tied (HOLD) and sliding into the next. Change a stage’s PULSES and GATE and hear the phrase stretch; try PENDULUM; swap the SCALE.',
    build(k) {
      const s = k.add('staircase')
      const v = voice(k, [s, 'pitch'], [s, 'gate'], { osc: { type: 'vco', params: { coarse: -2 }, out: 'saw' }, filter: { type: 'vcf', params: { cutoff: 500, res: 0.7 }, out: 'lp4' }, env: { a: 0.002, d: 0.15, s: 0.3, r: 0.05 } })
      toOut(k, v.out, undefined, 0.5)
    },
  },
  fortune: {
    howTo: 'FORTUNE writing a melody: X1 into a pluck, every tick, notes snapped to a pentatonic scale, DÉJÀ VU halfway so the phrase keeps returning with changes. Turn DÉJÀ VU right to lock it, left for always new; SPREAD and BIAS move its range; T1 and T2 are a coin toss (try them on drums).',
    build(k) {
      const f = k.add('fortune', { rate: 5 })
      const v = voice(k, [f, 'x1'], [f, 't3'], { osc: { type: 'vco', out: 'tri' }, env: { a: 0.002, d: 0.25, s: 0, r: 0.2 } })
      const pp = k.add('pingpong', { div: 3, bpm: 75, mix: 0.3 })
      k.wire(v.out, [pp, 'l'])
      toOut(k, [pp, 'ol'], [pp, 'or'], 0.55)
    },
  },
  midifile: {
    howTo: 'MIDI FILE playing its factory piece, Bach’s Prelude in C, on GRAND. LOAD .MID to play your own file (its tempo comes with it); pick a CHANNEL for one part; patch V/OCT, GATE and VEL into any poly voice.',
    build(k) {
      const m = k.add('midifile')
      const g = k.add('grand', { level: 0.75 })
      k.wire([m, 'voct'], [g, 'voct'])
      k.wire([m, 'gate'], [g, 'gate'])
      k.wire([m, 'vel'], [g, 'vel'])
      toOut(k, [g, 'l'], [g, 'r'], 0.55)
    },
  },
  clips: {
    howTo: 'CLIPS with four tracks (bass, held chords, a lead, an arpeggio) on four simple voices. Launch clips and whole scenes (▶) and hear them come in on the next bar; ■ stops a track. Shift-click a clip to edit it: click notes on the right, right-click a step to tie it.',
    build(k) {
      const c = k.add('clips')
      const shapes = [
        { a: 0.002, d: 0.25, s: 0.3, r: 0.08 },
        { a: 0.3, d: 0.5, s: 0.8, r: 0.6 },
        { a: 0.01, d: 0.3, s: 0.5, r: 0.2 },
        { a: 0.002, d: 0.12, s: 0, r: 0.1 },
      ]
      const outs = shapes.map((env, t) =>
        voice(k, [c, `p${t + 1}`], [c, `g${t + 1}`], { osc: { type: 'vco', out: t === 1 ? 'tri' : 'saw' }, filter: { type: 'vcf', params: { cutoff: [500, 1200, 1800, 2400][t], res: 0.25 }, out: 'lp4' }, env }).out,
      )
      const plate = k.add('plate', { decay: 0.55, mix: 0.2 })
      k.wire(mix(k, outs, [0.7, 0.45, 0.5, 0.35]), [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'], 0.55)
    },
  },
  space: {
    howTo: 'A melody circling your head in SPACE (put headphones on): a slow LFO turns it round, in front, to the right, behind, to the left. Drag the dot on the screen yourself (take the LFO out); move it far away and back fast to hear the Doppler; raise HEIGHT.',
    build(k) {
      const m = melody(k, { bpm: 96 })
      const v = voice(k, m.pitch, m.gate, { env: { a: 0.005, d: 0.3, s: 0.4, r: 0.3 } })
      const s = k.add('space', { dist: 1.5 })
      k.wire(v.out, [s, 'in'])
      const lfo = k.add('lfo', { rate: 0.08 })
      k.wire([lfo, 'saw'], [s, 'azcv'])
      toOut(k, [s, 'l'], [s, 'r'], 0.7)
    },
  },
  tuning: {
    howTo: 'CHORD TRACK’s chords through TUNING into HALCYON, in JUST intonation: the thirds and fifths pure, without the slow beating of equal temperament. Flip between EQUAL and JUST to hear it; try MEANTONE, 24-EDO, PELOG; LOAD .SCL for any tuning from the Scala archive.',
    build(k) {
      const c = heldChords(k, 70)
      const t = k.add('tuning')
      k.wire(c.notes, [t, 'voct'])
      const h = k.add('halcyon', { chorus: 0, pulse: 0, sub: 0, saw: 1, cutoff: 3500, a: 0.1, s: 0.8, r: 0.8 })
      k.wire([t, 'out'], [h, 'voct'])
      k.wire(c.gate, [h, 'gate'])
      toOut(k, [h, 'l'], [h, 'r'], 0.55)
    },
  },
}
