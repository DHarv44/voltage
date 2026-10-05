import type { Patch } from '../patch/types'

/** Where a step points: a knob/switch, a jack, or the power button. */
export type Target =
  | { mod: string; param: string }
  | { mod: string; jack: string; dir: 'in' | 'out' }
  | { ui: 'power' }

/** What a step does. In WALKTHROUGH mode the tutorial performs it; in GUIDED
 *  mode you do it and the tutorial notices. */
export type Action =
  | { kind: 'power' }
  | { kind: 'connect'; from: [string, string]; to: [string, string] }
  | { kind: 'set'; mod: string; param: string; value: number }
  /** Notes in semitones from C4 (played for you, or: play any key yourself). */
  | { kind: 'play'; notes: number[]; spacing?: number; hold?: number }

export interface Step {
  /** The explanation (a few short sentences). */
  text: string
  /** What you should do (guided) / what is being done (walkthrough). */
  task?: string
  /** What to listen for once it's done. */
  listen?: string
  target?: Target
  action?: Action
  /** Done automatically once the step's action is complete (in both modes),
   *  e.g. moving the scope to follow, or playing a note to hear the change. */
  then?: Action[]
}

export interface Lesson {
  id: string
  title: string
  summary: string
  /** The starting rack, and the names the steps use for its modules. */
  build(): { patch: Patch; mods: Record<string, string> }
  steps: Step[]
}

export type TutorialMode = 'guided' | 'walkthrough'
