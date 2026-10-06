import type { Kit } from './kit'

/** A module's ready-to-play rig: the module with everything it needs around
 *  it to make music (something to play it, something for it to play, a way
 *  to the speakers). */
export interface Starter {
  /** One line: what you'll hear, and what to try. */
  howTo: string
  build(k: Kit): void
  /** Played by you (keys, touch, pads, mic, gamepad…): silent until you do. */
  played?: true
}
