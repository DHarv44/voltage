import type { Timbre } from './taxonomy'

/** What is known about how a sound should be treated, in neutral units:
 *  Hz, seconds, amounts 0–1, pan −1..1. Anything that imports music fills
 *  this in from its own names; the builder reads only this. */
export interface Controls {
  /** Low-pass cutoff, and whether it moves from note to note (then a CV drives it). */
  cutoff?: number
  cutoffMoves?: boolean
  resonance?: number
  hpf?: number
  hpfMoves?: boolean
  attack?: number
  decay?: number
  sustain?: number
  release?: number
  gain?: number
  pan?: number
  reverb?: number
  delay?: number
  delayTime?: number
  delayFeedback?: number
  distortion?: number
  /** Bit depth (16 = clean) and sample-rate division (1 = clean). */
  crush?: number
  coarse?: number
  /** 0 a · 1 e · 2 i · 3 o · 4 u */
  vowel?: number
  /** Phaser rate in Hz, and its depth. */
  phaser?: number
  phaserDepth?: number
}

/** A sound someone wants: what it is and how many notes at once. */
export interface VoiceRequest {
  /** For the report. */
  name: string
  timbre: Timbre
  poly: number
  c: Controls
}

/** The drum hits anything can ask for, by name. */
export const HITS = ['bd', 'sd', 'ch', 'oh', 'cp', 'rim', 'tom', 'cym'] as const
export type Hit = (typeof HITS)[number]

export interface DrumRequest {
  hit: Hit
  gain: number
  /** Seconds, when the music says. */
  decay?: number
}
