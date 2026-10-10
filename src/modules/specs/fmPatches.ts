/** FM-4's algorithms and factory voices. Operators are numbered 1–4 (index
 *  0–3); a higher operator only ever modulates a lower one, so a voice is
 *  computed 4 → 1. Operator 4 can feed back on itself. */

/** Per algorithm: for operators 1–3, a bitmask of the operators modulating
 *  it (bit k = operator k+1); then a bitmask of carriers (the ones heard). */
export interface Algo {
  mods: [number, number, number]
  carriers: number
}
const B2 = 0b0010
const B3 = 0b0100
const B4 = 0b1000

export const FM_ALGOS: Algo[] = [
  { mods: [B2, B3, B4], carriers: 0b0001 }, // STACK: 4→3→2→1
  { mods: [B2, B3 | B4, 0], carriers: 0b0001 }, // Y: (3+4)→2→1
  { mods: [B2 | B3, 0, B4], carriers: 0b0001 }, // FORK: 4→3→1, 2→1
  { mods: [B2, 0, B4], carriers: 0b0101 }, // PAIRS: 2→1, 4→3
  { mods: [B4, B4, B4], carriers: 0b0111 }, // FAN: 4→1, 2, 3
  { mods: [B2, B3, 0], carriers: 0b1001 }, // 3+1: 3→2→1, 4 heard
  { mods: [B2, 0, 0], carriers: 0b1101 }, // 2+1+1: 2→1, 3 and 4 heard
  { mods: [0, 0, 0], carriers: 0b1111 }, // ORGAN: all four heard
]
export const FM_ALGO_NAMES = ['STACK', 'Y', 'FORK', 'PAIRS', 'FAN', '3+1', '2+1+1', 'ORGAN']

/** One operator: frequency ratio, level (a carrier's loudness 0–1, or a
 *  modulator's index in radians), envelope (attack, decay to sustain, sustain
 *  level, release; seconds), and detune in cents. */
export interface Op {
  ratio: number
  level: number
  a: number
  d: number
  s: number
  r: number
  cents?: number
}
export interface FmPatch {
  name: string
  algo: number
  /** Operator 4's self-feedback (0–1). */
  fb: number
  /** How much velocity scales the modulators (brightness), 0–1. */
  velBright: number
  ops: [Op, Op, Op, Op]
  /** Keyboard level scaling, per octave above C4: how much the modulators
   *  (the brightness) and the carriers (the loudness) fall away up the keys,
   *  as on a real piano (0 = none; 0.3 ≈ a quarter less per octave). */
  keyMod?: number
  keyAmp?: number
  /** A soft thump when a key is let go (the damper landing), 0–1. */
  thump?: number
}

const op = (ratio: number, level: number, a: number, d: number, s: number, r: number, cents = 0): Op => ({ ratio, level, a, d, s, r, cents })

export const FM_PATCHES: FmPatch[] = [
  {
    // two pairs: a body (1:1) and the tine (a 14:1 modulator that dies fast)
    name: 'E.PIANO',
    algo: 3,
    fb: 0,
    velBright: 0.85,
    ops: [op(1, 0.8, 0.001, 3.2, 0, 0.35), op(1, 1.5, 0.001, 1.6, 0.05, 0.3), op(1, 0.35, 0.001, 1.2, 0, 0.3, 4), op(14, 1.6, 0.001, 0.12, 0, 0.1)],
    // the tine's bark thins out up the keys, the top end is quieter, and the
    // damper lands with a soft thump
    keyMod: 0.35,
    keyAmp: 0.18,
    thump: 0.5,
  },
  {
    name: 'BASS',
    algo: 2,
    fb: 0.45,
    velBright: 0.6,
    ops: [op(1, 1, 0.001, 1.5, 0.55, 0.12), op(1, 2.2, 0.001, 0.35, 0.18, 0.1), op(2, 1.1, 0.001, 0.1, 0, 0.08), op(1, 0.7, 0.001, 0.12, 0, 0.08)],
  },
  {
    // inharmonic ratios: the partials of a struck bell
    name: 'BELL',
    algo: 3,
    fb: 0,
    velBright: 0.5,
    ops: [op(1, 0.7, 0.001, 6, 0, 2.5), op(3.5, 2, 0.001, 4.5, 0, 2), op(2.0, 0.3, 0.001, 3.5, 0, 2, 3), op(7.07, 1.4, 0.001, 1.6, 0, 1)],
  },
  {
    // brightness swells in after the note: the brass "blat"
    name: 'BRASS',
    algo: 1,
    fb: 0.35,
    velBright: 0.7,
    ops: [op(1, 0.9, 0.04, 0.5, 0.85, 0.2), op(1, 2.4, 0.09, 0.6, 0.62, 0.2), op(1, 0.6, 0.06, 0.4, 0.5, 0.2, 5), op(1, 0.5, 0.05, 0.3, 0.4, 0.2)],
  },
  {
    // four sine drawbars: 16', 8', 4' and 2⅔'
    name: 'ORGAN',
    algo: 7,
    fb: 0.25,
    velBright: 0,
    ops: [op(0.5, 0.55, 0.004, 0.1, 1, 0.05), op(1, 0.7, 0.004, 0.1, 1, 0.05), op(2, 0.45, 0.004, 0.1, 1, 0.05), op(3, 0.3, 0.003, 0.08, 0.85, 0.05)],
  },
  {
    name: 'MARIMBA',
    algo: 6,
    fb: 0,
    velBright: 0.6,
    ops: [op(1, 0.9, 0.001, 0.55, 0, 0.3), op(3.5, 1.4, 0.001, 0.05, 0, 0.05), op(4, 0.12, 0.001, 0.16, 0, 0.1), op(10, 0.05, 0.001, 0.03, 0, 0.03)],
  },
  {
    name: 'CLAV',
    algo: 0,
    fb: 0.6,
    velBright: 0.75,
    ops: [op(1, 0.85, 0.001, 0.9, 0.25, 0.04), op(3, 2.3, 0.001, 0.35, 0.3, 0.04), op(1, 1, 0.001, 0.12, 0.1, 0.04), op(1, 0.5, 0.001, 0.06, 0, 0.04)],
  },
  {
    // slow and wide: two detuned pairs breathing in
    name: 'PAD',
    algo: 3,
    fb: 0.2,
    velBright: 0.3,
    ops: [op(1, 0.6, 0.7, 2.5, 0.8, 1.6, -6), op(2, 1, 1.1, 3, 0.55, 1.6), op(1, 0.6, 0.9, 2.5, 0.8, 1.6, 7), op(1, 0.8, 1.4, 3, 0.5, 1.6)],
  },
  {
    // a feedback stack: a saw-like lead
    name: 'LEAD',
    algo: 0,
    fb: 0.75,
    velBright: 0.4,
    ops: [op(1, 0.9, 0.006, 0.4, 0.9, 0.2), op(1, 1.5, 0.006, 0.5, 0.8, 0.2), op(1, 0.7, 0.006, 0.4, 0.7, 0.2, 3), op(1, 0.8, 0.006, 0.3, 0.8, 0.2)],
  },
]
export const FM_VOICE_NAMES = FM_PATCHES.map((p) => p.name)
