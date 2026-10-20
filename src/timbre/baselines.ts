import type { Timbre } from './taxonomy'

/** How a sampled instrument of each kind behaves when the music says
 *  nothing: the envelope a player would expect (plucked things ring and
 *  stop, bowed and blown things swell and hold) and how bright it sits.
 *  Only read for controls the music leaves unset. */
export interface Baseline {
  a?: number
  d?: number
  s?: number
  r?: number
  /** A low-pass that stands in for the sample's own dullness, Hz. */
  cutoff?: number
}

const PLUCKED: Baseline = { a: 0.002, d: 0.8, s: 0, r: 0.3 }
const BOWED: Baseline = { a: 0.12, d: 0.3, s: 0.9, r: 0.35, cutoff: 3500 }

export const BASELINES: Partial<Record<Timbre, Baseline>> = {
  guitar: PLUCKED,
  pluck: PLUCKED,
  harp: PLUCKED,
  sitar: { ...PLUCKED, d: 1.2 },
  kalimba: { ...PLUCKED, d: 0.6 },
  steelpan: { ...PLUCKED, d: 1 },
  handpan: { ...PLUCKED, d: 2 },
  bass: { a: 0.002, d: 0.5, s: 0.2, r: 0.1, cutoff: 1200 },
  strings: BOWED,
  choir: { a: 0.15, d: 0.3, s: 0.9, r: 0.4 },
  brass: { a: 0.04, d: 0.2, s: 0.8, r: 0.15, cutoff: 4000 },
  lead: { a: 0.01, d: 0.1, s: 0.8, r: 0.1 },
  pad: { a: 0.3, d: 0.5, s: 0.9, r: 0.6, cutoff: 2000 },
  drone: { a: 0.5, d: 0.5, s: 1, r: 1, cutoff: 1500 },
  sfx: { a: 0.01, d: 1, s: 0, r: 0.5 },
  drum: { a: 0.002, d: 0.3, s: 0, r: 0.1 },
}

export const baseline = (t: Timbre): Baseline => BASELINES[t] ?? {}
