import { chords, melody, mix, roomy, toOut } from './kit'
import { PHRASES } from './material'
import type { Starter } from './types'
import { MELODY_OFFSET } from '../../modules/specs/tallyDefs'

/** The instruments: played ones wait for you, the rest play the music they
 *  come from (a handpan groove, a gamelan cycle, harp arpeggios…). */
export const INSTRUMENT_STARTERS: Record<string, Starter> = {
  tally: {
    howTo:
      'TALLY playing a remembered tune: a CLOCK presses ONE KEY PLAY every eighth, the rhythm box runs with it. Switch MODE to CAL and type a number, then ♪ to hear it; try the sounds, or type 8 digits and press ADSR.',
    build(k) {
      const clock = k.add('clock', { bpm: 116 })
      // a D dorian tune, remembered as if played in REC
      const tune = [2, 5, 9, 7, 5, 4, 2, 0, 2, 5, 7, 9, 12, 11, 9, 7]
      const p: Record<string, number> = { mode: 1, sound: 1, rhythm: 4, run: 1, tempo: 116, balance: 0.45, mlen: tune.length }
      tune.forEach((n, i) => (p[`m${i}`] = n + MELODY_OFFSET))
      const t = k.add('tally', p)
      k.wire([clock, 'x2'], [t, 'trig'])
      k.wire([clock, 'x4'], [t, 'clk'])
      k.wire([clock, 'rst'], [t, 'rst'])
      roomy(k, [t, 'out'], 0.2)
    },
  },
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
    howTo: 'A handpan groove in D Kurd: low ding, the ring of notes around it, space between. Click the face to join in; try STEEL PAN and KALIMBA.',
    build(k) {
      const m = melody(k, { notes: [2, 9, 10, 2, 12, 9, 7, 5], gates: [1, 0, 1, 1, 0, 1, 1, 0], rate: 'x2', bpm: 92 })
      const s = k.add('strike')
      k.wire(m.pitch, [s, 'voct'])
      k.wire(m.trig, [s, 'trig'])
      roomy(k, [s, 'out'])
    },
  },
  tanpura: { howTo: 'The tanpura drones on its own. Try SA (the key) and JAWARI.', build: (k) => roomy(k, [k.add('tanpura'), 'out'], 0.2) },
  gamelan: {
    howTo: 'A small gamelan: a saron plays the balungan (the core melody, one note a beat) and the big gong closes every phrase. Switch LARAS between slendro and pelog; feel the OMBAK beating.',
    build(k) {
      const m = melody(k, { notes: [0, 2, 4, 7, 9, 7, 4, 2], rate: 'x1', bpm: 80 })
      const saron = k.add('gamelan', { inst: 0 })
      const gong = k.add('gamelan', { inst: 2, level: 0.9 })
      k.wire(m.pitch, [saron, 'voct'])
      k.wire(m.trig, [saron, 'trig'])
      k.wire([m.clock, 'bar'], [gong, 'trig'])
      roomy(k, mix(k, [[saron, 'out'], [gong, 'out']], [0.7, 0.8]))
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
    howTo: 'Broken chords running up and down the HARP in 16ths. Drag across the strings for a glissando; change KEY with the pedals.',
    build(k) {
      const m = melody(k, { phrase: PHRASES.arpeggio })
      const h = k.add('harp', { sustain: 1.4 })
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
}
