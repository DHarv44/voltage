import type { Kit } from '../starters/kit'

/** A whole track in the style of an era: the rack that plays it. */
export interface Song {
  id: string
  year: number
  name: string
  /** What made the era's sound (what this rack recreates). */
  era: string
  /** What to listen for and what to turn. */
  howTo: string
  build: (k: Kit) => void
}
