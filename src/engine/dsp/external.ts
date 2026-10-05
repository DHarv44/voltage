/** The audio interface's input, as the engine sees it this sample. The graph
 *  points this at the worklet's input block and advances `i` each sample;
 *  AUDIO IN modules read from it. Empty when nothing is connected. */
export const external = {
  l: null as Float32Array | null,
  r: null as Float32Array | null,
  i: 0,
}

/** Input sample for channel 0 (left) or 1 (right) right now (0 if none). */
export function externalSample(ch: 0 | 1): number {
  const buf = ch === 0 ? external.l : (external.r ?? external.l)
  return buf ? (buf[external.i] ?? 0) : 0
}
