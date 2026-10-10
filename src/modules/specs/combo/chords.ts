/** The chords COMBO hears and plays over: a root (0 = C … 11 = B) and a
 *  quality. A chord is stored as one number, root * 16 + quality (−1 none). */

export interface Quality {
  name: string
  /** Chord tones above the root (semitones), root first. */
  tones: number[]
  /** For the bass: the third, fifth, sixth and seventh this chord implies. */
  third: number
  fifth: number
  seventh: number
}

export const QUALITIES: Quality[] = [
  { name: '', tones: [0, 4, 7], third: 4, fifth: 7, seventh: 10 },
  { name: 'm', tones: [0, 3, 7], third: 3, fifth: 7, seventh: 10 },
  { name: '7', tones: [0, 4, 7, 10], third: 4, fifth: 7, seventh: 10 },
  { name: 'maj7', tones: [0, 4, 7, 11], third: 4, fifth: 7, seventh: 11 },
  { name: 'm7', tones: [0, 3, 7, 10], third: 3, fifth: 7, seventh: 10 },
  { name: 'dim', tones: [0, 3, 6], third: 3, fifth: 6, seventh: 9 },
  { name: 'sus4', tones: [0, 5, 7], third: 5, fifth: 7, seventh: 10 },
  { name: 'sus2', tones: [0, 2, 7], third: 2, fifth: 7, seventh: 10 },
  { name: '5', tones: [0, 7], third: 7, fifth: 7, seventh: 12 },
  { name: 'm7♭5', tones: [0, 3, 6, 10], third: 3, fifth: 6, seventh: 10 },
  { name: 'aug', tones: [0, 4, 8], third: 4, fifth: 8, seventh: 10 },
  { name: '6', tones: [0, 4, 7, 9], third: 4, fifth: 7, seventh: 9 },
]

export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

export const chordCode = (root: number, quality: number): number => (((root % 12) + 12) % 12) * 16 + quality
export const chordRoot = (code: number): number => Math.floor(code / 16)
export const chordQuality = (code: number): Quality => QUALITIES[code % 16] ?? QUALITIES[0]
export const chordName = (code: number): string => (code < 0 ? '–' : NOTE_NAMES[chordRoot(code)] + chordQuality(code).name)

/** Chord templates for recognising a chord from 12 pitch-class weights: the
 *  qualities we listen for (a power chord and a 6th sound like their bigger
 *  cousins, so they're left to what's played on cables). The root weighs a
 *  little extra, the fifth a little less. */
export const LISTEN_QUALITIES = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]
export function templateScore(chroma: ArrayLike<number>, root: number, quality: number): number {
  const q = QUALITIES[quality]
  let inside = 0
  let total = 0
  for (let pc = 0; pc < 12; pc++) total += chroma[pc]
  if (total <= 0) return 0
  for (let i = 0; i < q.tones.length; i++) {
    const w = i === 0 ? 1.25 : q.tones[i] === 7 ? 0.85 : 1
    inside += chroma[(root + q.tones[i]) % 12] * w
  }
  // what the chord explains, less a little for each tone it asks for (simpler chords win ties)
  return inside / total - 0.05 * q.tones.length
}
