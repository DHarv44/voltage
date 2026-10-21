/** Note names, scales and the drum vocabulary Strudel code uses. */
import { HITS } from '../timbre/request'

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

/** "c4" → 60, "eb2" → 39, "f#3" → 54; a bare letter sits in octave 3 (Strudel's default). Not a note: NaN. */
export function noteToMidi(s: string): number {
  const m = /^([a-gA-G])([#sb]*)(-?\d+)?$/.exec(s.trim())
  if (!m) return NaN
  let n = PC[m[1].toLowerCase()]
  for (const acc of m[2]) n += acc === 'b' ? -1 : 1
  const oct = m[3] !== undefined ? parseInt(m[3], 10) : 3
  return n + (oct + 1) * 12
}

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicminor: [0, 2, 3, 5, 7, 8, 11],
  melodicminor: [0, 2, 3, 5, 7, 9, 11],
  majpent: [0, 2, 4, 7, 9],
  minpent: [0, 3, 5, 7, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  whole: [0, 2, 4, 6, 8, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  ritusen: [0, 2, 5, 7, 9],
  egyptian: [0, 2, 5, 7, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  iwato: [0, 1, 5, 6, 10],
  insen: [0, 1, 5, 7, 10],
  kumoi: [0, 2, 3, 7, 9],
  pelog: [0, 1, 3, 7, 8],
}

/** Scale degree n of "root:name" (e.g. "d4:minor", "C:major:pentatonic") as a MIDI note; negative degrees go down. */
export function scaleNote(n: number, scale: string): number {
  const parts = scale.trim().split(/[:\s]+/)
  const hasRoot = parts.length > 1 && Number.isFinite(noteToMidi(parts[0]))
  const rootS = hasRoot ? parts[0] : 'c3'
  const nameS = (hasRoot ? parts.slice(1) : parts).join('')
  const root = noteToMidi(rootS)
  const steps = SCALES[nameS.toLowerCase().replace(/[\s_-]/g, '')] ?? SCALES.major
  const len = steps.length
  const i = Math.round(n)
  const oct = Math.floor(i / len)
  return (Number.isFinite(root) ? root : 48) + oct * 12 + steps[((i % len) + len) % len]
}

/** Chord qualities as semitones above the root. */
const QUALITIES: [RegExp, number[]][] = [
  [/^(maj7|\^7|M7)$/, [0, 4, 7, 11]],
  [/^(m7|-7|min7)$/, [0, 3, 7, 10]],
  [/^(7)$/, [0, 4, 7, 10]],
  [/^(m9|-9)$/, [0, 3, 7, 10, 14]],
  [/^(9)$/, [0, 4, 7, 10, 14]],
  [/^(maj9|\^9)$/, [0, 4, 7, 11, 14]],
  [/^(dim7|o7)$/, [0, 3, 6, 9]],
  [/^(dim|o)$/, [0, 3, 6]],
  [/^(m7b5|ø|h7)$/, [0, 3, 6, 10]],
  [/^(aug|\+)$/, [0, 4, 8]],
  [/^(sus4|sus)$/, [0, 5, 7]],
  [/^(sus2)$/, [0, 2, 7]],
  [/^(7sus4)$/, [0, 5, 7, 10]],
  [/^(6)$/, [0, 4, 7, 9]],
  [/^(m6|-6)$/, [0, 3, 7, 9]],
  [/^(add9)$/, [0, 4, 7, 14]],
  [/^(m|-|min)$/, [0, 3, 7]],
  [/^(5)$/, [0, 7]],
  [/^(M|maj|)$/, [0, 4, 7]],
]

/** A chord symbol ("Am7", "Bb^7", "F#m") as MIDI notes, voiced close to `anchor`. */
export function chordNotes(symbol: string, octave = 4, anchor = 60): number[] {
  const m = /^([A-Ga-g])([#b]?)(.*)$/.exec(symbol.trim())
  if (!m) return []
  const root = noteToMidi(`${m[1]}${m[2]}${octave}`)
  const q = QUALITIES.find(([re]) => re.test(m[3]))?.[1] ?? [0, 4, 7]
  const notes = q.map((s) => root + s)
  // bring the chord near the anchor: shift whole octaves until its middle sits within a fifth
  const mid = () => notes.reduce((s, n) => s + n, 0) / notes.length
  while (mid() > anchor + 7) for (let i = 0; i < notes.length; i++) notes[i] -= 12
  while (mid() < anchor - 7) for (let i = 0; i < notes.length; i++) notes[i] += 12
  return notes
}

/** The drum sound names, by the trigger output they fire (0 kick … 7 cymbal): our hit vocabulary. */
export const DRUM_OUTS = HITS
const DRUM_NAMES: Record<string, number> = {
  bd: 0,
  kick: 0,
  sd: 1,
  sn: 1,
  snare: 1,
  hh: 2,
  ch: 2,
  hat: 2,
  hihat: 2,
  oh: 3,
  ohh: 3,
  cp: 4,
  clap: 4,
  hc: 4,
  rim: 5,
  rs: 5,
  cb: 5,
  cowbell: 5,
  sh: 5,
  shaker: 5,
  tb: 5,
  perc: 5,
  cl: 5,
  lt: 6,
  mt: 6,
  ht: 6,
  tom: 6,
  lc: 6,
  mc: 6,
  hc2: 6,
  cr: 7,
  rd: 7,
  cy: 7,
  crash: 7,
  ride: 7,
  misc: 7,
}

/** Strudel's noise sources: no note of their own, so they fire at middle C. */
export const isNoise = (sound: string): boolean => /^(white|pink|brown|crackle)$/.test(sound.toLowerCase())

/** Which drum output a sound name is (−1: not a drum). Bank prefixes and sample indices are ignored. */
export function drumOf(sound: string): number {
  const base = sound.split(':')[0].toLowerCase().replace(/^.*[/_](?=[a-z]+$)/, '')
  return DRUM_NAMES[base] ?? -1
}
