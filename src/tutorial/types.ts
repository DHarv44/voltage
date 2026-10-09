import type { Patch } from '../patch/types'

/** Where a step points: a knob/switch, a jack, or the power button. */
export type Target =
  | { mod: string; param: string }
  | { mod: string; jack: string; dir: 'in' | 'out' }
  | { ui: 'power' }
  /** A module in the library list (by type). */
  | { lib: string }
  /** A module's played surface (strings, plate, antennas…). */
  | { mod: string; surface: true }
  /** One key of a step grid: bit `bit` of the bitmask param `param`. */
  | { mod: string; param: string; bit: number }

/** One gesture of a demo on a played surface, `at` seconds in. */
export interface SurfaceDemo {
  name: string
  x: number
  y: number
  down: boolean
  at: number
}

/** What a step does. In WALKTHROUGH mode the tutorial performs it; in GUIDED
 *  mode you do it and the tutorial notices. */
export type Action =
  | { kind: 'power' }
  /** Add a module from the library; later steps call it by `as`. */
  | { kind: 'add'; type: string; as: string }
  | { kind: 'connect'; from: [string, string]; to: [string, string] }
  /** Pull the cable out of an input (right-click the jack). */
  | { kind: 'disconnect'; to: [string, string] }
  | { kind: 'set'; mod: string; param: string; value: number }
  /** Light (or clear) one step of a step grid: bit `bit` of a bitmask param. */
  | { kind: 'step'; mod: string; param: string; bit: number; on: boolean }
  /** Notes in semitones from C4 (played for you, or: play any key yourself). */
  | { kind: 'play'; notes: number[]; spacing?: number; hold?: number }
  /** Play a module's surface (`name`: only that gesture counts); walkthrough
   *  and Show me play `demo` on it. */
  | { kind: 'touch'; mod: string; name?: string; demo: SurfaceDemo[] }

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
  /** Said on the card whenever `then` changes something (the tutorial never
   *  changes the rack without telling you). */
  thenNote?: string
  /** Pass straight over this step if it's already done when you get to it
   *  (e.g. POWER ON when you've continued from the previous lesson). */
  skipIfDone?: boolean
}

export interface Lesson {
  id: string
  title: string
  summary: string
  /** The starting rack (where the previous lesson ended), and the names the
   *  steps use for its modules. */
  build(): { patch: Patch; mods: Record<string, string> }
  steps: Step[]
}

export type TutorialMode = 'guided' | 'walkthrough'
