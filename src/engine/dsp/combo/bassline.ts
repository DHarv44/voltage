import { chordQuality, chordRoot } from '../../../modules/specs/combo/chords'

/** The lowest bass root (MIDI E1): roots sit between E1 and E♭2, the line
 *  climbs from there. */
const LOW = 28

/** A root as a bass note: its pitch class in the E1–E♭2 octave. */
export const rootMidi = (root: number): number => LOW + ((root - (LOW % 12) + 24) % 12)

/** The octave a walking line takes for a new chord: up one when the line is
 *  already high (so it carries on from the approach note, not a leap down). */
export const walkShift = (chord: number, prev: number): number => {
  const r = rootMidi(chordRoot(chord))
  return prev - r > 6 && r + 12 <= 45 ? 12 : 0
}

/** The note a bass-line token asks for over `chord`, heading for `next` (the
 *  chord on the coming beat, the same chord when it doesn't change). `walk`
 *  is how many walking quarters into this chord we are; `prev` the last note
 *  (for stepping toward the next root from the nearer side); `shift` the
 *  octave a walking line has taken for this chord. −1: no note. */
export function bassNote(token: string, chord: number, next: number, walk: number, prev: number, shift = 0): number {
  if (chord < 0) return -1
  const r = rootMidi(chordRoot(chord))
  const q = chordQuality(chord)
  switch (token) {
    case 'R':
      return r
    case '3':
      return r + q.third
    case '5':
      return r + q.fifth
    case '6':
      return r + 9
    case '7':
      return r + q.seventh
    case '8':
      return r + 12
    case '4':
      return r + 5
    case 'a':
      return approach(chord, next, prev)
    case 'W':
      return walking(chord, next, walk, prev, shift)
    default:
      return -1
  }
}

/** A step into the next chord's root (a semitone from whichever side is
 *  nearer the last note), or the fifth when the chord stays. */
function approach(chord: number, next: number, prev: number): number {
  if (next < 0 || next === chord) return rootMidi(chordRoot(chord)) + chordQuality(chord).fifth
  const target = rootMidi(chordRoot(next))
  const t = prev > target + 6 && target + 12 <= 45 ? target + 12 : target
  return prev >= t ? t + 1 : t - 1
}

/** A walking line: the root on the chord's first beat, then up through its
 *  tones, and a chromatic step into the next root on the beat before it
 *  changes. */
function walking(chord: number, next: number, walk: number, prev: number, shift: number): number {
  if (next >= 0 && next !== chord) return approach(chord, next, prev)
  const r = rootMidi(chordRoot(chord)) + shift
  const q = chordQuality(chord)
  // from a low root, up through the chord (root, third, fifth, sixth); from a
  // high one, down (root, the fifth below, the third below, a step above the root)
  const steps = shift ? [0, q.fifth - 12, q.third - 12, 2 - 12] : [0, q.third, q.fifth, 9]
  return r + steps[walk % 4]
}

/** For each step of a bass line: how many steps until the next note starts
 *  (round the bar), so a note rings that long times the style's gate: the
 *  gate is the articulation (0.5 staccato funk, 1 tied). */
export function noteSpans(line: string): Int16Array {
  const n = line.length
  const span = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    let d = 1
    while (d < n && (line[(i + d) % n] === '-' || line[(i + d) % n] === '.')) d++
    span[i] = d
  }
  return span
}
