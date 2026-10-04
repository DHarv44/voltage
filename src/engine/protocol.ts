/** Messages between the main thread and the AudioWorklet rack engine. */

/** MIDI note/controller events. `ch` is 1-based; channel 10 is the drum channel
 *  (pads and drum machines listen there, keyboards ignore it). */
export type MidiEvent =
  | { kind: 'on'; note: number; vel: number; ch?: number }
  | { kind: 'off'; note: number; ch?: number }
  | { kind: 'cc'; cc: number; value: number }
  | { kind: 'bend'; value: number }
  /** Channel or polyphonic aftertouch, 0..127. */
  | { kind: 'pressure'; value: number }
  | { kind: 'panic' }

export const DRUM_CHANNEL = 10

/** Physical panel interactions that aren't parameters: pad hits, push buttons. */
export type UiEvent =
  | { kind: 'pad'; index: number; vel: number; down: boolean }
  | { kind: 'button'; name: string; down: boolean }
  /** Touch plate: x = position across (0..1), y = pressure (0..1); sent continuously while held. */
  | { kind: 'touch'; index: number; x: number; y: number; down: boolean }
  /** XY pad: position 0..1 (y up), pressure 0..1; sent continuously while held. */
  | { kind: 'xy'; x: number; y: number; p: number; down: boolean }
  /** Instrument surfaces (platter, antennas, strings…): meaning of x/y is per module. */
  | { kind: 'surface'; name: string; x: number; y: number; down: boolean }

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
  /** Watch one module's jack voltages (null = stop). */
  | { type: 'probe'; id: string | null }
  /** Load audio into a module's buffer slot (restored loop, loaded sample file). */
  | ({ type: 'buffer' } & BufferMsg)
  /** Ask for a copy of a module's buffer (for WAV export). */
  | { type: 'getBuffer'; id: string; slot: number }
  /** Analog imperfections: power-supply sag, jack crosstalk. */
  | { type: 'options'; sag: boolean; crosstalk: boolean }

/** Audio held by a module (LOOP slots, SAMPLE). Empty data = slot cleared. */
export interface BufferMsg {
  id: string
  slot: number
  rate: number
  data: Float32Array
}

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
  /** Min/max of every jack on the probed module since the last telemetry frame. */
  probe?: ProbeFrame
}

export interface ProbeFrame {
  id: string
  /** [min, max] per input, then per output. */
  ins: [number, number][]
  outs: [number, number][]
}

export type FromEngine =
  | TelemetryMsg
  | AudioChunkMsg
  | { type: 'error'; message: string }
  /** A module's buffer changed (persist it), or `dump` = reply to getBuffer. */
  | ({ type: 'buffer'; dump: boolean } & BufferMsg)
