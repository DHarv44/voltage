import { condId, LOCK_PAGES, lockId, LS_PATTERNS, LS_STEPS, LS_TRACKS, microId, noteId, retrigId, slideId, trigsId } from '../../../modules/specs/lockstepDefs'
import type { Rng } from '../util'

/** One pattern's param indices, per track (steps × fields). */
export interface PatIdx {
  tr: Int32Array
  note: Int32Array[]
  cond: Int32Array[]
  rt: Int32Array[]
  mt: Int32Array[]
  sl: Int32Array[]
  /** step × LOCK_PAGES + page */
  lock: Int32Array[]
}

/** Every pattern's param indices, looked up once (`pi`: a param's index). */
export function patternTables(pi: (id: string) => number): PatIdx[] {
  return LS_PATTERNS.map((_, pat) => {
    const steps = (id: (t: number, s: number, pat: number) => string) =>
      Array.from({ length: LS_TRACKS }, (_, t) => Int32Array.from({ length: LS_STEPS }, (_, s) => pi(id(t, s, pat))))
    return {
      tr: Int32Array.from({ length: LS_TRACKS }, (_, t) => pi(trigsId(t, pat))),
      note: steps(noteId),
      cond: steps(condId),
      rt: steps(retrigId),
      mt: steps(microId),
      sl: steps(slideId),
      lock: Array.from({ length: LS_TRACKS }, (_, t) =>
        Int32Array.from({ length: LS_STEPS * LOCK_PAGES }, (_, i) => pi(lockId(t, Math.floor(i / LOCK_PAGES), i % LOCK_PAGES, pat))),
      ),
    }
  })
}

/** A:B conditions (index 1..9): play on the A-th of every B times round. */
const COND_A = [0, 1, 2, 1, 2, 3, 1, 2, 3, 4]
const COND_B = [0, 2, 2, 3, 3, 3, 4, 4, 4, 4]
const CHANCE = [0.75, 0.5, 0.25, 0.1]

/** Does a step with condition `cond` play on pass `loop` (0 = the first)? */
export function condHolds(cond: number, loop: number, fill: boolean, rng: Rng): boolean {
  if (cond === 0) return true
  if (cond <= 9) return loop % COND_B[cond] === COND_A[cond] - 1
  if (cond <= 13) return rng.next() < CHANCE[cond - 10]
  if (cond === 14) return fill
  if (cond === 15) return !fill
  return cond === 16 ? loop === 0 : loop > 0
}

/** Where a swung clock is, in steps (continuous): in each pair of steps the
 *  first lasts 1 + swing, the second 1 − swing. */
export function swungPos(x: number, swing: number): number {
  const pair = Math.floor(x / 2)
  const r = x - 2 * pair
  return r < 1 + swing ? 2 * pair + r / (1 + swing) : 2 * pair + 1 + (r - 1 - swing) / (1 - swing)
}
