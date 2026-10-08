/** The audio interface's input, as the engine sees it this sample. The graph
 *  points this at the worklet's input block and advances `i` each sample;
 *  AUDIO IN modules read from it. Empty when nothing is connected. */
export const external = {
  l: null as Float32Array | null,
  r: null as Float32Array | null,
  i: 0,
}

/** What the speakers got last sample (the sum of every OUT and system direct
 *  out, ±1 = full scale): TAP reads it, so the whole mix can be recorded. */
export const masterBus = { l: 0, r: 0 }

/** The audio frame the current block starts at (the worklet sets it). */
export const audioClock = { frame: 0 }

const MIDI_OUT_MAX = 256
/** MIDI bytes waiting to go out (CLOCK's MIDI OUT), with their audio frames.
 *  The worklet hands them to the page after each block; no allocation here. */
export const midiOut = {
  bytes: new Uint8Array(MIDI_OUT_MAX),
  frames: new Float64Array(MIDI_OUT_MAX),
  n: 0,
  /** Queue one realtime byte now (this sample). */
  push(byte: number): void {
    if (this.n >= MIDI_OUT_MAX) return
    this.bytes[this.n] = byte
    this.frames[this.n] = audioClock.frame + external.i
    this.n++
  },
}

/** Input sample for channel 0 (left) or 1 (right) right now (0 if none). */
export function externalSample(ch: 0 | 1): number {
  const buf = ch === 0 ? external.l : (external.r ?? external.l)
  return buf ? (buf[external.i] ?? 0) : 0
}
