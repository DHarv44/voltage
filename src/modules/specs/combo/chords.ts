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
/** What each chord sounds like as pitch classes, overtones and all: every
 *  chord tone, plus its third harmonic (a twelfth up: the fifth's pitch
 *  class) and its fifth (two octaves and a third up). A C chord's E rings a
 *  little B, so without these a plain C reads as Cmaj7. Relative to the root. */
const SHAPES: Float64Array[] = QUALITIES.map((q) => {
  const s = new Float64Array(12)
  q.tones.forEach((t, i) => {
    const w = i === 0 ? 1.15 : 1
    s[t % 12] += w
    s[(t + 7) % 12] += 0.35 * w
    s[(t + 4) % 12] += 0.12 * w
  })
  return s
})
const SHAPE_NORM = SHAPES.map((s) => Math.sqrt(s.reduce((a, x) => a + x * x, 0)))

export function templateScore(chroma: ArrayLike<number>, root: number, quality: number): number {
  // the chroma with its floor taken off (noise lands on every pitch class)
  let min = Infinity
  for (let pc = 0; pc < 12; pc++) min = Math.min(min, chroma[pc])
  let cc = 0
  for (let pc = 0; pc < 12; pc++) cc += (chroma[pc] - min) ** 2
  if (cc <= 0) return 0
  // cosine between it and the chord's sound: a tone the chord claims but
  // isn't sounding costs as much as one sounding that it doesn't explain
  const s = SHAPES[quality]
  let dot = 0
  for (let i = 0; i < 12; i++) dot += (chroma[(root + i) % 12] - min) * s[i]
  // (a three-note chord wins a near tie with its four-note cousin)
  return (dot / (Math.sqrt(cc) * SHAPE_NORM[quality])) * (QUALITIES[quality].tones.length > 3 ? 0.98 : 1)
}
