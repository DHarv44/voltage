import { bits } from './kit'

/** Musical material for the ready-to-play rigs: each rig picks the phrase or
 *  groove that suits what its module is for, instead of every rig playing
 *  the same tune. Phrases are 8 steps for SEQ-8 (semitones from C, and which
 *  steps sound); grooves are TR-16 step masks (bit n = step n). */
export interface Phrase {
  notes: number[]
  gates?: number[]
  octave?: number
  rate?: 'x1' | 'x2' | 'x4'
  bpm?: number
}

const ALL = [1, 1, 1, 1, 1, 1, 1, 1]

export const PHRASES = {
  /** A natural-minor line that walks rather than leaps: the generic "a tune". */
  walk: { notes: [0, 2, 3, 5, 7, 5, 3, 2], gates: [1, 1, 1, 0, 1, 1, 1, 0], bpm: 104 },
  /** Acid: root pumping, octave jumps, a flat seventh: made for a squelchy resonant filter. */
  acid: { notes: [0, 0, 12, 0, 15, 0, 10, 12], gates: ALL, octave: -1, rate: 'x4', bpm: 124 },
  /** Berlin school: a running 16th sequence that loops hypnotically. */
  berlin: { notes: [0, 7, 12, 7, 3, 7, 12, 15], gates: ALL, octave: -1, rate: 'x4', bpm: 112 },
  /** Dub / sub bass: roots and fourths with space between. */
  dub: { notes: [0, 0, -2, 0, 5, 0, 3, -2], gates: [1, 0, 1, 1, 0, 1, 1, 0], octave: -2, rate: 'x2', bpm: 96 },
  /** A rock riff in E (palm-muted roots, a lift to G and A). */
  riff: { notes: [4, 4, 7, 4, 9, 7, 4, 2], gates: [1, 1, 1, 0, 1, 1, 1, 1], octave: -1, rate: 'x2', bpm: 116 },
  /** Funk: a 16th single-note line, octave pops and a flat seventh. */
  funk: { notes: [4, 16, 4, 14, 4, 11, 14, 16], gates: [1, 0, 1, 1, 0, 1, 1, 1], octave: -1, rate: 'x4', bpm: 102 },
  /** A singing lead: wide leaps that a glide or a pitch-corrector shows off. */
  lead: { notes: [0, 12, 10, 7, 8, 7, 3, 5], gates: ALL, rate: 'x2', bpm: 92 },
  /** A slow line for long tails (echoes, rooms, strings): one note a beat. */
  slow: { notes: [7, 3, 5, 2, 3, 0, 2, -2], gates: ALL, rate: 'x1', bpm: 84 },
  /** Dorian broken chords for plucked strings. */
  arpeggio: { notes: [2, 9, 14, 17, 21, 17, 14, 9], gates: ALL, rate: 'x4', bpm: 96 },
} satisfies Record<string, Phrase>

/** Drum patterns: tracks as TR-16 masks (a0 kick, a1 snare, a2 closed hat, a8 accent; more in `extra`). */
export interface Groove {
  kick: number
  snare: number
  hat: number
  accent?: number
  bpm: number
}

export const GROOVES = {
  house: { kick: bits(0, 4, 8, 12), snare: bits(4, 12), hat: bits(2, 6, 10, 14), accent: bits(0, 8), bpm: 122 },
  breakbeat: { kick: bits(0, 2, 10, 11), snare: bits(4, 7, 9, 12, 15), hat: bits(0, 2, 4, 6, 8, 10, 12, 14), accent: bits(4, 12), bpm: 96 },
  /** One drop: kick and rim together on beat three, nothing on one. */
  onedrop: { kick: bits(8), snare: bits(8), hat: bits(2, 6, 10, 14), bpm: 76 },
  trap: { kick: bits(0, 7, 10), snare: bits(8), hat: bits(0, 2, 4, 6, 8, 9, 10, 12, 14, 15), accent: bits(8), bpm: 70 },
  techno: { kick: bits(0, 4, 8, 12), snare: 0, hat: bits(2, 6, 10, 14), accent: bits(0, 4, 8, 12), bpm: 128 },
  funk: { kick: bits(0, 3, 6, 10), snare: bits(4, 12), hat: bits(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15), accent: bits(0, 4, 8, 12), bpm: 100 },
} satisfies Record<string, Groove>
