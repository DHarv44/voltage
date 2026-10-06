import { LS_STEPS } from '../../../modules/specs/lockstepDefs'

/** LOCKSTEP's face, as fractions of its canvas: the screen top left, four
 *  encoders and the page buttons beside it, tracks and transport on the
 *  right, the sixteen step keys along the bottom. */
export const SCREEN = { x: 0.012, y: 0.04, w: 0.32, h: 0.57 }
export const ENC_X = [0.395, 0.48, 0.565, 0.65]
export const ENC_Y = 0.2
export const ENC_R = 0.085
export const LABEL_Y = 0.355
export const PAGE_Y = 0.5
export const PAGE_X = [0.385, 0.442, 0.499, 0.556, 0.613, 0.67]
export const CLUSTER_X = [0.745, 0.805, 0.865, 0.925]
export const ROW_Y = [0.2, 0.5]
export const BTN = { w: 0.05, h: 0.13 }
export const KEYS = { x0: 0.012, x1: 0.988, y: 0.68, h: 0.28 }

/** Step key s's rectangle (fractions), with a wider gap between beats. */
export function keyRect(s: number): { x: number; y: number; w: number; h: number } {
  const beatGap = 0.008
  const gap = 0.004
  const kw = (KEYS.x1 - KEYS.x0 - beatGap * 3 - gap * (LS_STEPS - 4)) / LS_STEPS
  const x = KEYS.x0 + s * kw + Math.floor(s / 4) * beatGap + (s - Math.floor(s / 4)) * gap
  return { x, y: KEYS.y, w: kw, h: KEYS.h }
}

/** The step key under a point (fractions), or −1. */
export function keyAt(fx: number, fy: number): number {
  if (fy < KEYS.y || fy > KEYS.y + KEYS.h) return -1
  for (let s = 0; s < LS_STEPS; s++) {
    const r = keyRect(s)
    if (fx >= r.x && fx <= r.x + r.w) return s
  }
  return -1
}

/** The selected step per module (−1 = none): the step whose locks, note and
 *  condition the encoders edit. UI state only; the steps are params. */
const selected = new Map<string, number>()
export const lockstepSel = {
  get: (mod: string): number => selected.get(mod) ?? -1,
  set: (mod: string, s: number): void => {
    selected.set(mod, s)
  },
}
