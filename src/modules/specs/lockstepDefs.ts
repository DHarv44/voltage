/** LOCKSTEP's vocabulary, shared by the spec, the engine and the face. */

export const LS_TRACKS = 4
export const LS_STEPS = 16
export const LS_PAGES = ['FM', 'AMP', 'FX', 'LFO', 'TRIG', 'TRACK', 'TEMPO']
export const FM = 0
export const AMP = 1
export const FX = 2
export const LFO = 3
export const TRIG = 4
export const TRACK = 5
export const TEMPO = 6
/** Pages whose knobs can be locked per step (four knobs each). */
export const LOCK_PAGES = 4
export const LS_KNOBS = [
  ['RATIO', 'DEPTH', 'FEEDBK', 'MOD DEC'],
  ['ATTACK', 'DECAY', 'SWEEP', 'LEVEL'],
  ['CUTOFF', 'RESO', 'PAN', 'DELAY'],
  ['LFO SPD', 'LFO AMT', 'LFO DEST', 'REVERB'],
]
/** Knob indices the engine treats specially. */
export const K = { level: 7, cutoff: 8, pan: 10, delay: 11, lfoSpd: 12, lfoAmt: 13, lfoDest: 14, reverb: 15 } as const
/** Each track's LFO: a triangle locked to the tempo, one cycle per this many 16ths. */
export const LS_LFO_RATES = ['4 BARS', '2 BARS', '1 BAR', '1/2', '1/4', '1/8', '1/16']
export const LS_LFO_SIXTEENTHS = [64, 32, 16, 8, 4, 2, 1]
export const lfoRateIndex = (v: number) => Math.min(LS_LFO_RATES.length - 1, Math.floor(v * LS_LFO_RATES.length))
/** What it moves (a knob index, or −1 for the pitch). */
export const LS_LFO_DESTS = ['PITCH', 'FM DEPTH', 'CUTOFF', 'LEVEL', 'PAN', 'DELAY']
export const LS_LFO_KNOB = [-1, 1, K.cutoff, K.level, K.pan, K.delay]
export const lfoDestIndex = (v: number) => Math.min(LS_LFO_DESTS.length - 1, Math.floor(v * LS_LFO_DESTS.length))
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
/** Ratchets: a step fires this many evenly spaced hits. */
export const LS_RETRIGS = ['×1', '×2', '×3', '×4']
/** Micro-timing: a step can land up to this many 24ths of a step early or late. */
export const LS_MICRO = 12
export const muteId = (t: number) => `mute${t}`

// ---- patterns ----
// Four patterns, A–D. The sound (knobs, algorithm, root, length, speed) is
// shared; a pattern holds the trigs and every step's note, condition,
// ratchet, nudge and locks. Pattern A keeps the plain ids, so patches saved
// before patterns existed load as pattern A; B–D are prefixed `B.` and so on.

export const LS_PATTERNS = ['A', 'B', 'C', 'D']
/** A pattern change waits for the end of the bar: this many master 16ths. */
export const LS_BAR = 16
/** A chain: up to this many patterns played in turn, a bar each. */
export const LS_CHAIN = 8
export const chainId = (i: number) => `ch${i}`
/** PAT in: each pattern's share of 0–10 V. */
export const LS_PAT_VOLTS = 2.5
const pre = (pat: number) => (pat > 0 ? `${LS_PATTERNS[pat]}.` : '')
export const trigsId = (t: number, pat = 0) => `${pre(pat)}tr${t}`
export const noteId = (t: number, s: number, pat = 0) => `${pre(pat)}n${t}_${s}`
export const condId = (t: number, s: number, pat = 0) => `${pre(pat)}c${t}_${s}`
export const retrigId = (t: number, s: number, pat = 0) => `${pre(pat)}rt${t}_${s}`
export const microId = (t: number, s: number, pat = 0) => `${pre(pat)}mt${t}_${s}`
/** A slide: the step glides into its note from the last one (no new attack). */
export const slideId = (t: number, s: number, pat = 0) => `${pre(pat)}sl${t}_${s}`

/** LED layout: each track's step (−1 stopped) and trig flash, the beat, FILL,
 *  the pattern playing (a cued one waits for the bar), the chain slot playing (−1: none). */
export const LSL = { step: 0, flash: LS_TRACKS, beat: LS_TRACKS * 2, fill: LS_TRACKS * 2 + 1, pat: LS_TRACKS * 2 + 2, chain: LS_TRACKS * 2 + 3, end: LS_TRACKS * 2 + 4 } as const

// ---- parameter locks ----
// A step keeps one param per lockable page: four knobs × one byte
// (0 = not locked, 1..255 = the knob at (b − 1) / 254), so 32 bits.

export const lockId = (t: number, s: number, page: number, pat = 0) => `${pre(pat)}lk${t}_${s}_${page}`
export const knobId = (t: number, j: number) => `k${t}_${j}`

/** Everything one step of one track holds in a pattern, bar its trig bit
 *  (that's a bit of trigsId): note, condition, ratchet, nudge, the locks. */
export const stepIds = (t: number, s: number, pat: number): string[] => [
  noteId(t, s, pat),
  condId(t, s, pat),
  retrigId(t, s, pat),
  microId(t, s, pat),
  slideId(t, s, pat),
  ...Array.from({ length: LOCK_PAGES }, (_, page) => lockId(t, s, page, pat)),
]

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
