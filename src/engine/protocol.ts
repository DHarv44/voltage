/** Messages between the main thread and the AudioWorklet rack engine. */

/** MIDI note/controller events. `ch` is 1-based; channel 10 is the drum channel
 *  (pads and drum machines listen there, keyboards ignore it). */
export type MidiEvent =
  | { kind: 'on'; note: number; vel: number; ch?: number }
  | { kind: 'off'; note: number; ch?: number }
  | { kind: 'cc'; cc: number; value: number }
  | { kind: 'bend'; value: number }
  | { kind: 'panic' }

export const DRUM_CHANNEL = 10

/** Physical panel interactions that aren't parameters: pad hits, push buttons. */
export type UiEvent =
  | { kind: 'pad'; index: number; vel: number; down: boolean }
  | { kind: 'button'; name: string; down: boolean }

export interface PatchModuleMsg {
  id: string
  type: string
  seed: number
  /** In spec param order. */
  params: number[]
}

export interface PatchCableMsg {
  from: string
  fromOut: number
  to: string
  toIn: number
}

export type ToEngine =
  | { type: 'patch'; modules: PatchModuleMsg[]; cables: PatchCableMsg[] }
  | { type: 'param'; id: string; index: number; value: number }
  | { type: 'midi'; ev: MidiEvent }
  | { type: 'ui'; id: string; ev: UiEvent }
  | { type: 'record'; on: boolean }

/** Recorded output audio, streamed in chunks; `final` marks the flush after stop. */
export interface AudioChunkMsg {
  type: 'audio'
  l: Float32Array
  r: Float32Array
  final: boolean
}

export interface TelemetryMsg {
  type: 'telemetry'
  leds: Record<string, number[]>
  scopes: Record<string, Float32Array>
  /** Parameter values the engine itself changed (e.g. live-recorded steps): [module id, index, value]. */
  params: [string, number, number][]
}

export type FromEngine = TelemetryMsg | AudioChunkMsg | { type: 'error'; message: string }
