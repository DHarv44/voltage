/** A COMBO style: one bar of drums and bass, written as step strings so a
 *  groove reads like a drum chart. A bar is `beats` beats of `sub` steps
 *  (16ths when sub = 4; triplet 8ths, a 12/8 feel, when sub = 3).
 *
 *  Drum lines: X accent, x hit, g ghost, . rest.
 *  Bass line (chord-aware, so it follows whatever chord is playing):
 *    R root · 3 third · 5 fifth · 6 sixth · 7 seventh · 8 octave up ·
 *    4 fourth · a approach (a step into the next chord, or the fifth) ·
 *    W a walking quarter (root, chord tones, then a step into the next
 *    chord) · - hold · . rest */

/** The drum voices a style plays (COMBO's kit, and COMBO CORE's gates). */
export const DRUMS = ['k', 's', 'h', 'o', 'r', 't', 'p'] as const
export type DrumKey = (typeof DRUMS)[number]
export const DRUM_NAMES: Record<DrumKey, string> = { k: 'KICK', s: 'SNARE', h: 'HAT', o: 'OPEN', r: 'RIDE', t: 'TOM', p: 'PERC' }

/** How the drummer leads into a new part (and dresses the turnarounds). */
export type Fill = 'toms' | 'snare' | 'roll' | 'jazz' | 'latin' | 'hiphop' | 'none'

export interface Style {
  name: string
  beats: 3 | 4
  sub: 3 | 4
  /** Swing: how late the off-8th lands (a fraction of an 8th; 1/3 is a full
   *  triplet shuffle), and how late the odd 16ths land (of a 16th). */
  swing: number
  swing16: number
  drums: Partial<Record<DrumKey, string>>
  bass: string
  /** How long each bass note sounds, of the time to the next one. */
  gate: number
  fill: Fill
}

interface Opts {
  swing?: number
  swing16?: number
  /** Twelve steps as four beats of triplets (12/8) rather than 3/4. */
  tri?: boolean
  gate?: number
  fill?: Fill
  o?: string
  r?: string
  t?: string
  p?: string
}

/** A style: name, 'kick | snare | hat' (any may be empty), the bass line, options. */
export function st(name: string, lines: string, bass: string, o: Opts = {}): Style {
  const [k, s, h] = lines.split('|').map((x) => x.trim())
  const n = (k || s || h || bass).length
  const tri = n === 12 && !!o.tri
  const drums: Partial<Record<DrumKey, string>> = {}
  if (k) drums.k = k
  if (s) drums.s = s
  if (h) drums.h = h
  if (o.o) drums.o = o.o
  if (o.r) drums.r = o.r
  if (o.t) drums.t = o.t
  if (o.p) drums.p = o.p
  return {
    name,
    beats: n === 12 && !tri ? 3 : 4,
    sub: tri ? 3 : 4,
    swing: o.swing ?? 0,
    swing16: o.swing16 ?? 0,
    drums,
    bass,
    gate: o.gate ?? 0.8,
    fill: o.fill ?? 'toms',
  }
}

/** Steps in a bar of this style. */
export const stepsOf = (s: Style): number => s.beats * s.sub

/** Hit strength for a drum step character (0 = none). */
export const hitOf = (c: string | undefined): number => (c === 'X' ? 1 : c === 'x' ? 0.72 : c === 'g' ? 0.32 : 0)

/** A shuffled or swung style (for matching the feel it learned). */
export const swung = (s: Style): boolean => s.swing > 0.15 || s.swing16 > 0.15 || s.sub === 3

/** Check a style's strings (lengths, characters): the startup validator. */
export function checkStyle(g: string, s: Style): string[] {
  const n = stepsOf(s)
  const errs: string[] = []
  for (const [k, line] of Object.entries(s.drums)) {
    if (line.length !== n) errs.push(`${g}/${s.name}: ${k} has ${line.length} steps, not ${n}`)
    if (/[^Xxg.]/.test(line)) errs.push(`${g}/${s.name}: ${k} has a stray character`)
  }
  if (s.bass.length !== n) errs.push(`${g}/${s.name}: bass has ${s.bass.length} steps, not ${n}`)
  if (/[^R345678aW.\-]/.test(s.bass)) errs.push(`${g}/${s.name}: bass has a stray character`)
  return errs
}
