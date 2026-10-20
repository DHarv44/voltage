/** Fit Strudel's wt_ wavetables to our oscillators: for each single-cycle
 *  wave, its harmonic series (DFT at multiples of the cycle's pitch) is
 *  compared with VCO's four waves and WAVE's eight tables measured the same
 *  way; the nearest wins, and the spectral centroid (in harmonics) sets a
 *  key-tracking low-pass. Writes src/timbre/wavetables.ts.
 *
 *  Run from T:/Dev/voltage:
 *    node node_modules/rolldown/bin/cli.mjs tools/fitWavetables.ts --platform node --format esm --file tools/fitWavetables.mjs
 *    CACHE=<somewhere> node tools/fitWavetables.mjs */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { bench, FS } from '../src/dev/harness'
import { decodeWav } from '../src/dev/wav'

const MANIFEST = 'https://strudel.b-cdn.net/uzu-wavetables.json'
const CACHE = process.env.CACHE ?? './.banks-cache'
const OUT = process.env.OUT ?? 'src/timbre/wavetables.ts'
const H = 24

export interface Candidate {
  osc: 'vco' | 'wave'
  out: string
  params?: Record<string, number>
}

/** Harmonic amplitudes 1..H (relative to the strongest) of a periodic signal at f0. */
function harmonics(x: Float32Array, f0: number, fs: number): number[] {
  const n = x.length
  const h: number[] = []
  for (let k = 1; k <= H; k++) {
    const f = k * f0
    if (f >= fs / 2) {
      h.push(0)
      continue
    }
    let s = 0
    let c = 0
    for (let i = 0; i < n; i++) {
      s += x[i] * Math.sin((2 * Math.PI * f * i) / fs)
      c += x[i] * Math.cos((2 * Math.PI * f * i) / fs)
    }
    h.push(Math.hypot(s, c))
  }
  const top = Math.max(1e-9, ...h)
  return h.map((v) => v / top)
}

/** One cycle of the file, at its own rate: a short file is one cycle
 *  (AKWF, 600 samples); a long one is a frame-based wavetable, 2048 samples
 *  a frame (Serum's convention, which uzu-wavetables follows), of which the
 *  first frame is taken; anything else gets its strongest autocorrelation
 *  lag over its first 8192 samples. */
function cycleOf(x: Float32Array): Float32Array {
  const n = x.length
  if (n <= 4096) return x
  if (n % 2048 === 0) return x.subarray(0, 2048)
  const head = x.subarray(0, Math.min(n, 8192))
  let best = 0
  let lag = head.length
  let dipped = false
  for (let l = 16; l < head.length / 2; l++) {
    let s = 0
    for (let i = 0; i + l < head.length; i++) s += head[i] * head[i + l]
    if (!dipped) {
      if (s < 0) dipped = true
      continue
    }
    if (s > best) (best = s), (lag = l)
  }
  return x.subarray(0, lag)
}

const centroid = (h: number[]) => h.reduce((s, v, i) => s + (i + 1) * v * v, 0) / Math.max(1e-9, h.reduce((s, v) => s + v * v, 0))
const dist = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (Math.log10(v + 0.01) - Math.log10(b[i] + 0.01)) ** 2, 0)

function measure(c: Candidate): number[] {
  const b = bench([['o', c.osc, c.params]])
  const { out } = b.run(0.5, [['o', c.out]])
  const x = out[0].subarray(Math.round(0.1 * FS))
  // the oscillator's pitch at 0 V from its zero crossings
  let crossings = 0
  let first = -1
  let last = -1
  for (let i = 1; i < x.length; i++)
    if (x[i - 1] < 0 && x[i] >= 0) {
      if (first < 0) first = i
      last = i
      crossings++
    }
  const f0 = ((crossings - 1) * FS) / (last - first)
  return harmonics(x, f0, FS)
}

async function main(): Promise<void> {
  mkdirSync(CACHE, { recursive: true })
  const candidates: Candidate[] = [
    { osc: 'vco', out: 'sin' },
    { osc: 'vco', out: 'tri' },
    { osc: 'vco', out: 'saw' },
    { osc: 'vco', out: 'sqr' },
    ...Array.from({ length: 8 }, (_, w) => ({ osc: 'wave' as const, out: 'out', params: { wave: w } })),
  ]
  const ours = candidates.map((c) => ({ c, h: measure(c) }))
  const manifest = (await (await fetch(MANIFEST)).json()) as Record<string, string | string[]>
  const base = manifest._base as string
  const rows: string[] = []
  for (const [name, entry] of Object.entries(manifest)) {
    if (name === '_base') continue
    const file = Array.isArray(entry) ? entry[0] : entry
    const cached = `${CACHE}/${name}.wav`
    let buf: ArrayBuffer
    if (existsSync(cached)) buf = readFileSync(cached).buffer.slice(0) as ArrayBuffer
    else {
      const r = await fetch(base + file.split('/').map(encodeURIComponent).join('/'))
      if (!r.ok) continue
      buf = await r.arrayBuffer()
      writeFileSync(cached, Buffer.from(buf))
    }
    const wav = decodeWav(buf)
    if (!wav) continue
    const cycle = cycleOf(wav.data)
    const period = cycle.length
    const h = harmonics(cycle, wav.rate / period, wav.rate)
    let best = ours[0]
    let bd = Infinity
    for (const o of ours) {
      const d = dist(h, o.h)
      if (d < bd) (bd = d), (best = o)
    }
    const bright = centroid(h)
    const pick = best.c.osc === 'vco' ? `osc: 'vco', out: '${best.c.out}'` : `osc: 'wave', wave: ${best.c.params!.wave}`
    rows.push(`  ${name}: { ${pick}, bright: ${bright.toFixed(2)} },`)
    console.log(`${name}: period ${period} → ${pick} (d ${bd.toFixed(2)}), centroid ${bright.toFixed(2)}`)
  }
  writeFileSync(
    OUT,
    [
      '/** GENERATED by tools/fitWavetables.ts: the oscillator and wave nearest each',
      " *  of Strudel's wt_ wavetables by harmonic series, and the wave's spectral",
      ' *  centroid in harmonics (a key-tracking low-pass stands in for the rest). */',
      "export interface WavetableFit { osc: 'vco' | 'wave'; out?: string; wave?: number; bright: number }",
      '',
      'export const WAVETABLES: Record<string, WavetableFit> = {',
      ...rows,
      '}',
      '',
    ].join('\n'),
  )
  console.log(`wrote ${OUT}: ${rows.length} wavetables`)
}

void main()
