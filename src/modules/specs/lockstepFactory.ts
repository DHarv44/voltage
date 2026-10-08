/** LOCKSTEP's factory content: the four track sounds, and patterns A–D
 *  written for them (C minor; the bass counts from C1, the bell from C3). */

/** A track's sound: its twelve knobs, algorithm, root and length. */
export interface SoundDef {
  name: string
  knobs: number[]
  algo: number
  root: number
  len: number
}

/** One track's part of a pattern: trigs (step → note, cond), locks
 *  ([step, knob 0..11, value]), ratchets (step → 1..3 extra hits) and nudges
 *  (step → 24ths of a step). */
export interface PartDef {
  trigs: Record<number, [note: number, cond?: number]>
  locks?: [number, number, number][]
  ratchets?: Record<number, number>
  nudges?: Record<number, number>
}

export const SOUNDS: SoundDef[] = [
  { name: 'KICK', knobs: [0, 0.15, 0, 0.05, 0, 0.35, 0.6, 0.9, 0.4, 0, 0.5, 0], algo: 1, root: -24, len: 16 },
  { name: 'BASS', knobs: [0.19, 0.35, 0.15, 0.3, 0, 0.3, 0, 0.75, 0.5, 0.35, 0.5, 0], algo: 1, root: -24, len: 16 },
  { name: 'HATS', knobs: [0.56, 0.9, 0.85, 0.1, 0, 0.05, 0, 0.35, 0.95, 0, 0.65, 0], algo: 1, root: 24, len: 16 },
  { name: 'BELL', knobs: [0.94, 0.45, 0, 0.25, 0, 0.45, 0, 0.5, 0.8, 0.1, 0.35, 0.4], algo: 0, root: 0, len: 12 },
]

// conditions by name (indices into LS_CONDS)
const HALF = 1 // 1:2
const OTHER = 2 // 2:2
const C3OF4 = 8 // 3:4
const P75 = 10
const P50 = 11
const P25 = 12
const P10 = 13
const FILL = 14
const DECAY = 5 // knob index: AMP page's DECAY

/** Patterns, each a part per track (KICK, BASS, HATS, BELL). */
export const PATTERNS: PartDef[][] = [
  // A: the groove
  [
    { trigs: { 0: [0], 4: [0], 8: [0], 12: [0], 14: [0, P10] } },
    // the octave and the fourth land a touch late: a lazier bass
    { trigs: { 2: [0], 3: [12], 6: [0], 10: [3], 11: [5, P50], 14: [7, HALF] }, nudges: { 3: 5, 11: 4 } },
    // an open hat on 15 (DECAY locked longer), the last hat a quick triple roll
    { trigs: { 2: [0], 6: [0], 10: [0], 14: [0], 15: [0, P25] }, locks: [[14, DECAY, 0.42]], ratchets: { 15: 2 } },
    { trigs: { 2: [7], 7: [10, P50], 10: [3] } },
  ],
  // B: the variation, busier everywhere
  [
    { trigs: { 0: [0], 4: [0], 8: [0], 10: [0, HALF], 12: [0] } },
    { trigs: { 0: [0], 2: [12], 3: [10], 6: [0], 8: [3], 10: [5], 11: [7, P75], 14: [10] }, nudges: { 3: 4 } },
    {
      trigs: { 2: [0], 5: [0, P25], 6: [0], 10: [0], 13: [0, C3OF4], 14: [0] },
      locks: [
        [6, DECAY, 0.42],
        [14, DECAY, 0.42],
      ],
      ratchets: { 13: 1 },
    },
    { trigs: { 0: [3], 3: [7], 6: [10], 9: [14, HALF] } },
  ],
  // C: the breakdown — no kick until you hold FILL; long bass, a bell arpeggio
  [
    { trigs: { 0: [0, FILL], 4: [0, FILL], 8: [0, FILL], 12: [0, FILL], 14: [0, FILL] }, ratchets: { 14: 1 } },
    {
      trigs: { 0: [0], 7: [3], 12: [-2] },
      locks: [
        [0, DECAY, 0.7],
        [7, DECAY, 0.7],
        [12, DECAY, 0.7],
      ],
    },
    { trigs: { 4: [0, P75], 12: [0] } },
    { trigs: { 0: [0], 2: [3], 4: [7], 6: [10], 8: [7, HALF], 10: [3, OTHER] } },
  ],
  // D: blank, for your own (COPY a pattern, PASTE it here)
  [{ trigs: {} }, { trigs: {} }, { trigs: {} }, { trigs: {} }],
]
