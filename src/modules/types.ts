/** Shared, DOM-free module descriptions. The UI renders panels from these and the
 *  audio engine looks up jack/param indices from them, so both sides agree on order.
 *  All panel coordinates are millimetres, like a real Eurorack panel drawing. */

export type Curve = 'lin' | 'exp'

export type Unit = 'Hz' | 's' | 'oct' | 'st' | '%' | 'x' | 'V' | 'V/div' | 's/scr' | 'bpm'

export interface ParamSpec {
  id: string
  label: string
  min: number
  max: number
  def: number
  curve?: Curve
  /** Integer positions (switches, detented knobs); never smoothed. */
  stepped?: boolean
  options?: string[]
  unit?: Unit
}

export interface JackSpec {
  id: string
  label: string
  /** Output carries up to 8 voices (polyphonic cable). */
  poly?: boolean
}

export type KnobSize = 'L' | 'M' | 'S'

export interface JackControl {
  kind: 'in' | 'out'
  jack: string
  x: number
  y: number
  /** Overrides the jack label; '' hides it. */
  label?: string
}

export type Control =
  | { kind: 'knob'; param: string; x: number; y: number; size?: KnobSize; label?: string }
  | { kind: 'switch'; param: string; x: number; y: number }
  | JackControl
  | { kind: 'led'; index: number; x: number; y: number; color?: string; bipolar?: boolean }
  | { kind: 'text'; text: string; x: number; y: number; size?: number }
  | { kind: 'scope'; x: number; y: number; w: number; h: number }
  /** three.js creature tank, drawn from the module's LED-channel state. */
  | { kind: 'vision'; x: number; y: number; w: number; h: number }
  /** XY touch surface with morph corners. */
  | { kind: 'xypad'; x: number; y: number; w: number; h: number }
  /** Printed outline grouping a circuit section on system panels. */
  | { kind: 'section'; x: number; y: number; w: number; h: number; label: string }
  /** Velocity-sensitive rubber pad; glows from LED `led`. */
  | { kind: 'pad'; index: number; x: number; y: number; size: number; label?: string; sub?: string; led?: number }
  /** Momentary push button sending a UI event `name`; optional LED. */
  | { kind: 'button'; name: string; x: number; y: number; label: string; led?: number; ledColor?: string }
  /** Touch plate (Buchla-style): drag on it; across = position, height = pressure. */
  | { kind: 'plate'; index: number; x: number; y: number; w: number; h: number; label?: string; led?: number }
  /** Button that opens a file picker and loads an audio file into buffer `slot`. */
  | { kind: 'file'; slot: number; x: number; y: number; label: string }
  /** Horizontal position bar driven by LED `led` (0..1). */
  | { kind: 'progress'; x: number; y: number; w: number; led: number }
  | StepsControl

/** A TR-style step grid. Each row is a 16-bit mask param per pattern. */
export interface StepsControl {
  kind: 'steps'
  x: number
  y: number
  dx: number
  dy: number
  cols: number
  /** One mask param per pattern (A, B, C, D…) for each row. */
  rows: { label: string; p: string[] }[]
  /** Pattern selector param. */
  pattern?: string
  /** Selector position → pattern index it edits; −1 = a chain (edit the playing one). */
  patternMap?: number[]
  /** Optional length param: steps beyond it are dimmed. */
  length?: string
  /** LED index carrying the current step (−1 = stopped). */
  stepLed: number
  /** LED index carrying the playing pattern (0 = A, 1 = B). */
  patternLed?: number
}

export type Category =
  | 'Systems'
  | 'Polyphonic'
  | 'Sources'
  | 'Filters'
  | 'Amplifiers'
  | 'Modulation'
  | 'Shapers'
  | 'Drums'
  | 'Sequencing'
  | 'Effects'
  | 'Sampling'
  | 'Utilities'
  | 'Visuals'
  | 'I/O'

export interface PanelStyle {
  bg: string
  fg: string
  accent: string
}

export interface ModuleSpec {
  type: string
  /** Header printed on the panel. */
  title: string
  /** Longer name for the library. */
  name: string
  tagline: string
  category: Category
  hp: number
  panel: PanelStyle
  inputs: JackSpec[]
  outputs: JackSpec[]
  params: ParamSpec[]
  leds?: number
  controls: Control[]
}

export const HP_MM = 5.08
export const PANEL_H_MM = 128.5
