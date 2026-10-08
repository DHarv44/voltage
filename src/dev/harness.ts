/** Dev-only DSP test bench: build a tiny graph, drive inputs, record outputs.
 *  Used from the browser console / automated checks; not imported by the app. */
import { Graph } from '../engine/graph'
import { SPECS } from '../modules'
/** The MIDI-out queue the bench's graph writes to (the same module instance). */
export { midiOut } from '../engine/dsp/external'

export const FS = 48000

/** mods: [id, type, params]; cables: [fromId, fromJack, toId, toJack]. */
export function bench(mods: [string, string, Record<string, number>?][], cables: [string, string, string, string][] = []) {
  const g = new Graph(FS)
  const typeOf = new Map(mods.map(([id, type]) => [id, type]))
  g.applyPatch({
    type: 'patch',
    modules: mods.map(([id, type, p = {}]) => ({ id, type, seed: 7, params: SPECS[type].params.map((ps) => p[ps.id] ?? ps.def) })),
    cables: cables.map(([f, fj, t, tj]) => ({
      from: f,
      fromOut: SPECS[typeOf.get(f)!].outputs.findIndex((j) => j.id === fj),
      to: t,
      toIn: SPECS[typeOf.get(t)!].inputs.findIndex((j) => j.id === tj),
    })),
  })
  const mod = (id: string) => g.getModule(id)!
  const inIdx = (id: string, jack: string) => SPECS[typeOf.get(id)!].inputs.findIndex((j) => j.id === jack)
  const outIdx = (id: string, jack: string) => SPECS[typeOf.get(id)!].outputs.findIndex((j) => j.id === jack)
  /** Force an unpatched input to behave as patched (for switched-jack tests). */
  const patch = (id: string, jack: string) => (mod(id).patched[inIdx(id, jack)] = 1)
  const set = (id: string, jack: string, v: number) => (mod(id).in[inIdx(id, jack)] = v)
  /** Run `secs`; `each(n)` may set inputs; probes are [id, outJack] pairs. */
  const run = (secs: number, probes: [string, string][], each?: (n: number) => void) => {
    const out = probes.map(() => new Float32Array(Math.round(secs * FS)))
    const L = new Float32Array(1)
    const R = new Float32Array(1)
    const audio = new Float32Array(Math.round(secs * FS))
    for (let n = 0; n < audio.length; n++) {
      each?.(n)
      g.process(1, L, R)
      audio[n] = L[0]
      probes.forEach(([id, j], k) => (out[k][n] = mod(id).out[outIdx(id, j)]))
    }
    return { out, audio }
  }
  return { g, mod, patch, set, run, inIdx, outIdx }
}

// ---- analysis helpers ----
export const peak = (b: ArrayLike<number>, a = 0, z = b.length) => {
  let m = 0
  for (let i = a; i < z; i++) m = Math.max(m, Math.abs(b[i]))
  return m
}
export const rms = (b: ArrayLike<number>, a = 0, z = b.length) => {
  let s = 0
  for (let i = a; i < z; i++) s += b[i] * b[i]
  return Math.sqrt(s / Math.max(1, z - a))
}
export const freq = (b: ArrayLike<number>, a = 0, z = b.length) => {
  let c = 0
  let f = -1
  let l = -1
  for (let i = a + 1; i < z; i++)
    if (b[i - 1] < 0 && b[i] >= 0) {
      if (f < 0) f = i
      l = i
      c++
    }
  return c > 1 ? ((c - 1) * FS) / (l - f) : 0
}
/** Amplitude of the `f` Hz component (single-bin DFT). */
export const amp = (b: ArrayLike<number>, f: number, a = 0, z = b.length) => {
  let s = 0
  let c = 0
  for (let i = a; i < z; i++) {
    s += b[i] * Math.sin((2 * Math.PI * f * i) / FS)
    c += b[i] * Math.cos((2 * Math.PI * f * i) / FS)
  }
  return (Math.hypot(s, c) * 2) / (z - a)
}
/** Sample indices of rising edges through `th`. */
export const rises = (b: ArrayLike<number>, th = 5) => {
  const r: number[] = []
  for (let i = 1; i < b.length; i++) if (b[i - 1] < th && b[i] >= th) r.push(i)
  return r
}
export const r2 = (v: number) => Math.round(v * 100) / 100
