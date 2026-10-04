import { jellyDream } from './presets/more'
import type { Patch } from './types'

/** First-run rack: Jellyfish Dream, a VISION jellyfish playing its own melody. */
export function defaultPatch(): Patch {
  return jellyDream()
}
