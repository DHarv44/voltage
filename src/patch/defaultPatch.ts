import { classicMono } from './presets/synths'
import type { Patch } from './types'

/** First-run rack: the classic two-oscillator voice, playable from the keyboard. */
export function defaultPatch(): Patch {
  return classicMono()
}
