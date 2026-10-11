/** Dev-only: render a whole patch headless and measure it (for tuning example
 *  racks by numbers). Not imported by the app; from the console:
 *    const R = await import('/src/dev/renderPatch.ts'); R.stats(R.render(patch, 20)) */
import { buildPatchMsg } from '../audio/patchMsg'
import { Graph } from '../engine/graph'
import type { Patch } from '../patch/types'
import { FS } from './harness'

/** `secs` of the patch's left output. */
export function render(patch: Patch, secs: number): Float32Array {
  const g = new Graph(FS)
  const msg = buildPatchMsg(patch)
  if (msg.type === 'patch') g.applyPatch(msg)
  const n = Math.round(secs * FS)
  const a = new Float32Array(n)
  const L = new Float32Array(128)
  for (let i = 0; i < n; i += 128) {
    g.process(128, L, null)
    a.set(L.subarray(0, Math.min(128, n - i)), i)
  }
  return a
}

/** Level, brightness (first-difference / level), the share above ~2 kHz,
 *  and the peak, from `skip` seconds in (after things get going). */
export function stats(a: Float32Array, skip = 4): { rms: number; bright: number; above2k: number; peak: number } {
  let s = 0
  let d = 0
  let pk = 0
  let lp = 0
  let hi = 0
  for (let i = Math.round(FS * skip); i < a.length; i++) {
    s += a[i] * a[i]
    d += (a[i] - a[i - 1]) ** 2
    pk = Math.max(pk, Math.abs(a[i]))
    lp += (a[i] - lp) * 0.23
    hi += (a[i] - lp) ** 2
  }
  const n = a.length - Math.round(FS * skip)
  const r = (v: number) => Math.round(v * 1000) / 1000
  return { rms: r(Math.sqrt(s / n)), bright: r(Math.sqrt(d / s)), above2k: r(Math.sqrt(hi / s)), peak: r(pk) }
}
