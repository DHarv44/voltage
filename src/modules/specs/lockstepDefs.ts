/** LOCKSTEP's vocabulary, shared by the spec, the engine and the face. */

export const LS_TRACKS = 4
export const LS_STEPS = 16
export const LS_PAGES = ['FM', 'AMP', 'FX', 'TRIG', 'TRACK', 'TEMPO']
export const FM = 0
export const AMP = 1
export const FX = 2
export const TRIG = 3
export const TRACK = 4
export const TEMPO = 5
/** Pages whose knobs can be locked per step (four knobs each). */
export const LOCK_PAGES = 3
export const LS_KNOBS = [
  ['RATIO', 'DEPTH', 'FEEDBK', 'MOD DEC'],
  ['ATTACK', 'DECAY', 'SWEEP', 'LEVEL'],
  ['CUTOFF', 'RESO', 'PAN', 'DELAY'],
]
export const LS_ALGOS = ['PARALLEL', 'STACK', 'TWO', 'SPLIT', 'ORGAN', 'BRANCH']
/** Operator ratios C : A : B, picked by the RATIO knob. */
export const LS_RATIOS = [
  [1, 1, 1],
  [1, 1, 2],
  [1, 2, 3],
  [1, 0.5, 1],
  [1, 3, 7],
  [2, 1, 5],
  [1, 1.41, 3.5],
  [1, 2.76, 5.4],
]
export const ratioIndex = (v: number) => Math.min(LS_RATIOS.length - 1, Math.floor(v * LS_RATIOS.length))
export const LS_SPEEDS = ['1/4', '1/2', '3/4', '1', '3/2', '2']
export const LS_SPEED_X = [0.25, 0.5, 0.75, 1, 1.5, 2]
/** Conditional trigs: always, A:B (the A-th of every B times round), chance,
 *  only with / without FILL, only the first time round / not. */
export const LS_CONDS = ['ALWAYS', '1:2', '2:2', '1:3', '2:3', '3:3', '1:4', '2:4', '3:4', '4:4', '75%', '50%', '25%', '10%', 'FILL', '!FILL', 'FIRST', '!FIRST']
export const LS_TRACK_COLORS = ['#ff6b5b', '#ffbe3d', '#3ddc97', '#4aa8ff']

/** LED layout: each track's step (−1 stopped) and trig flash, the beat, FILL. */
export const LSL = { step: 0, flash: LS_TRACKS, beat: LS_TRACKS * 2, fill: LS_TRACKS * 2 + 1, end: LS_TRACKS * 2 + 2 } as const

// ---- parameter locks ----
// A step keeps one param per lockable page: four knobs × one byte
// (0 = not locked, 1..255 = the knob at (b − 1) / 254), so 32 bits.

export const lockId = (t: number, s: number, page: number) => `lk${t}_${s}_${page}`
export const knobId = (t: number, j: number) => `k${t}_${j}`

/** Knob k's byte in a packed lock word. */
export const lockByte = (word: number, k: number) => (word >>> (8 * k)) & 255
/** Its value 0..1, or −1 when the knob isn't locked. */
export const lockValue = (word: number, k: number) => {
  const b = lockByte(word, k)
  return b === 0 ? -1 : (b - 1) / 254
}
/** The word with knob k locked to v (0..1), or unlocked (v < 0). */
export function withLock(word: number, k: number, v: number): number {
  const b = v < 0 ? 0 : 1 + Math.round(Math.max(0, Math.min(1, v)) * 254)
  const shift = 2 ** (8 * k)
  return (word >>> 0) - lockByte(word, k) * shift + b * shift
}
