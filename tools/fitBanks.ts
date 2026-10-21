/** Fit our drum modules to Strudel's drum-machine banks. For each bank it
 *  takes one sample per hit, measures it (src/dev/drumFeatures), and picks
 *  the nearest point of a grid of our module's settings measured the same
 *  way. Samples are only analysed, never kept. Writes src/timbre/banks.ts.
 *
 *  Run from T:/Dev/voltage (node, outside the app's tsconfig):
 *    node node_modules/rolldown/bin/cli.mjs tools/fitBanks.ts --platform node --format esm --file tools/fitBanks.mjs
 *    CACHE=<somewhere> node tools/fitBanks.mjs */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { measure, type Measure } from '../src/ab/measure'
import { bench } from '../src/dev/harness'
import { FS, pitchOf } from '../src/dev/drumFeatures'
import { decodeWav, resample } from '../src/dev/wav'

/** A hit as the A/B bench measures it (the same function on both sides), plus its pitch. */
interface Hit {
  m: Measure
  f0: number
}

const hitOf = (x: Float32Array): Hit => ({ m: measure(x, FS), f0: pitchOf(x) })

/** How far two hits are apart: octaves of pitch and brightness, log decay and attack, noise share. */
function distance(a: Hit, b: Hit, w: { f0: number; decay: number; bright: number; noise: number; body: number; flat?: number }): number {
  const oct = (p: number, q: number) => Math.abs(Math.log2(Math.max(50, p) / Math.max(50, q)))
  const pitch = a.f0 > 0 && b.f0 > 0 ? Math.abs(Math.log2(a.f0 / b.f0)) : a.f0 > 0 || b.f0 > 0 ? 1 : 0
  const attack = Math.abs(Math.log2((a.m.attack + 0.005) / (b.m.attack + 0.005))) / 1.5
  const flat = Math.abs(Math.log10((a.m.flat + 0.01) / (b.m.flat + 0.01))) / 0.5
  return w.f0 * pitch + w.decay * Math.abs(Math.log((a.m.decay + 0.02) / (b.m.decay + 0.02))) + w.bright * oct(a.m.bright, b.m.bright) + w.noise * Math.abs(a.m.noise - b.m.noise) * 3 + w.body * oct(a.m.body, b.m.body) + 0.3 * attack + (w.flat ?? 0) * flat
}

const MANIFEST = 'https://strudel.b-cdn.net/tidal-drum-machines.json'
const ALIASES = 'https://strudel.b-cdn.net/tidal-drum-machines-alias.json'
const CACHE = process.env.CACHE ?? './.banks-cache'
const OUT = process.env.OUT ?? 'src/timbre/banks.ts'
/** Variants of a hit per bank: Strudel plays the first unless the code says `bd:3`, so the first is fitted. */
const VARIANTS = 1

type Params = Record<string, number>
interface Fit {
  module: string
  /** The bank's name for the hit (ours differ for the closed hat and the toms). */
  sample: string
  /** Which input fires the hit, and the output to measure. */
  trig: string
  out: string
  /** Grid axes: param → values. */
  axes: Record<string, number[]>
  weights: { f0: number; decay: number; bright: number; noise: number; body: number; flat?: number }
  /** Fixed params while measuring. */
  base?: Params
}

/** Per hit: which module, how to fire it, what to search. */
const FITS: Record<string, Fit> = {
  bd: { module: 'kick', sample: 'bd', trig: 'trig', out: 'out', axes: { tune: [35, 42, 50, 60, 72, 88, 110], decay: [0.08, 0.14, 0.22, 0.35, 0.5, 0.8, 1.2], punch: [0.15, 0.5, 0.9] }, weights: { f0: 1.5, decay: 1, bright: 0.5, noise: 0.3, body: 0.5 } },
  sd: { module: 'snare', sample: 'sd', trig: 'trig', out: 'out', axes: { tune: [130, 160, 190, 230, 280, 350], decay: [0.07, 0.11, 0.16, 0.23, 0.33, 0.5], tone: [0.2, 0.5, 0.8], snappy: [0.2, 0.5, 0.85] }, weights: { f0: 0.6, decay: 1, bright: 0.8, noise: 1, body: 0.8 } },
  ch: { module: 'hats', sample: 'hh', trig: 'ch', out: 'ch', axes: { chd: [0.015, 0.025, 0.04, 0.06, 0.09, 0.14, 0.22], tone: [4500, 6000, 7500, 9500, 12000], tune: [0.7, 1, 1.45], noise: [0, 0.3, 0.6, 0.9] }, weights: { f0: 0, decay: 1, bright: 1, noise: 0.3, body: 0.8, flat: 1 } },
  oh: { module: 'hats', sample: 'oh', trig: 'oh', out: 'oh', axes: { ohd: [0.12, 0.2, 0.3, 0.45, 0.7, 1, 1.6], tone: [4500, 6000, 7500, 9500, 12000], tune: [0.7, 1, 1.45], noise: [0, 0.3, 0.6, 0.9] }, weights: { f0: 0, decay: 1, bright: 1, noise: 0.3, body: 0.8, flat: 1 } },
  cp: { module: 'clap', sample: 'cp', trig: 'trig', out: 'out', axes: { tone: [700, 900, 1100, 1400, 1800, 2400], decay: [0.1, 0.17, 0.26, 0.4, 0.65], spread: [0.005, 0.009, 0.015] }, weights: { f0: 0, decay: 1, bright: 1, noise: 0.5, body: 0.8 } },
  tom: { module: 'tom', sample: 'lt', trig: 'trig', out: 'out', axes: { tune: [60, 75, 95, 120, 150, 190, 240], decay: [0.15, 0.25, 0.4, 0.6, 0.9], sweep: [0.1, 0.3, 0.6] }, weights: { f0: 1.5, decay: 1, bright: 0.5, noise: 0.3, body: 0.5 } },
}

/** Render one hit of a module with these params and measure it. */
function render(fit: Fit, params: Params): Hit {
  const b = bench([['d', fit.module, { ...fit.base, ...params }]])
  b.patch('d', fit.trig)
  const { out } = b.run(2, [['d', fit.out]], (n) => b.set('d', fit.trig, n < 96 ? 10 : 0))
  return hitOf(out[0])
}

function* grid(axes: Record<string, number[]>): Generator<Params> {
  const keys = Object.keys(axes)
  const idx = keys.map(() => 0)
  for (;;) {
    yield Object.fromEntries(keys.map((k, i) => [k, axes[k][idx[i]]]))
    let i = 0
    while (i < keys.length) {
      if (++idx[i] < axes[keys[i]].length) break
      idx[i++] = 0
    }
    if (i === keys.length) return
  }
}

async function fetchCached(url: string, file: string): Promise<ArrayBuffer | null> {
  if (existsSync(file)) return readFileSync(file).buffer.slice(0) as ArrayBuffer
  const r = await fetch(url)
  if (!r.ok) return null
  const buf = await r.arrayBuffer()
  writeFileSync(file, Buffer.from(buf))
  return buf
}

async function main(): Promise<void> {
  mkdirSync(CACHE, { recursive: true })
  const manifest = (await (await fetch(MANIFEST)).json()) as Record<string, string | string[]>
  const aliases = (await (await fetch(ALIASES)).json()) as Record<string, string>
  const base = manifest._base as string
  // our grids, measured once
  const points: Record<string, { params: Params; f: Hit }[]> = {}
  for (const [hit, fit] of Object.entries(FITS)) {
    const t0 = Date.now()
    points[hit] = []
    for (const params of grid(fit.axes)) points[hit].push({ params, f: render(fit, params) })
    console.log(`${hit}: ${points[hit].length} settings measured in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  }
  const banks: Record<string, Record<string, Params>> = {}
  const keys = Object.keys(manifest).filter((k) => k !== '_base')
  const bankNames = [...new Set(keys.map((k) => k.slice(0, k.lastIndexOf('_'))))].filter(Boolean)
  for (const bank of bankNames) {
    const preset: Record<string, Params> = {}
    const notes: string[] = []
    for (const [hit, fit] of Object.entries(FITS)) {
      const entry = manifest[`${bank}_${fit.sample}`]
      const files = (Array.isArray(entry) ? entry : entry ? [entry] : []).slice(0, VARIANTS)
      const measured: Hit[] = []
      for (const [i, file] of files.entries()) {
        const cached = `${CACHE}/${bank}_${fit.sample}${i ? `-${i}` : ''}.wav`
        let buf: ArrayBuffer | null
        try {
          buf = await fetchCached(base + file.split('/').map(encodeURIComponent).join('/'), cached)
        } catch {
          buf = null
        }
        const wav = buf && decodeWav(buf)
        if (!wav) continue
        const x = resample(wav, FS)
        if (x.length >= FS * 0.02) measured.push(hitOf(x))
      }
      if (!measured.length) {
        if (files.length) notes.push(`${hit} unreadable`)
        continue
      }
      const f = measured[0]
      if (hit === 'bd' || hit === 'sd') notes.push(`${hit} ${f.f0.toFixed(0)}Hz ${f.m.decay.toFixed(2)}s`)
      let best = points[hit][0]
      let bd = Infinity
      for (const p of points[hit]) {
        const d = distance(f, p.f, FITS[hit].weights)
        if (d < bd) (bd = d), (best = p)
      }
      preset[hit] = best.params
    }
    // a bank with nothing we fit (Latin percussion, a synth's few hits) is still a known name
    banks[bank.toLowerCase()] = preset
    console.log(`${bank}: ${Object.keys(preset).join(' ')}  (${notes.join(', ')})`)
  }
  const aliasMap: Record<string, string> = {}
  for (const [full, alias] of Object.entries(aliases)) aliasMap[alias.toLowerCase()] = full.toLowerCase()
  const lines = [
    '/** GENERATED by tools/fitBanks.ts: our drum modules set to sound like',
    " *  Strudel's drum-machine banks (one setting per hit, fitted by measuring",
    ' *  each bank\'s samples against a grid of ours). Keys are lower-case bank',
    ' *  names; BANK_ALIASES holds the short names .bank() accepts. */',
    'export type BankPreset = Partial<Record<string, Record<string, number>>>',
    '',
    'export const BANKS: Record<string, BankPreset> = {',
    ...Object.entries(banks).map(([k, v]) => `  ${k}: ${JSON.stringify(v).replace(/"([a-z]+)":/g, '$1: ').replace(/,/g, ', ').replace(/\{/g, '{ ').replace(/\}/g, ' }')},`),
    '}',
    '',
    'export const BANK_ALIASES: Record<string, string> = {',
    ...Object.entries(aliasMap).map(([a, b]) => `  '${a}': '${b}',`),
    '}',
    '',
  ]
  writeFileSync(OUT, lines.join('\n'))
  console.log(`wrote ${OUT}: ${Object.keys(banks).length} banks, ${Object.keys(aliasMap).length} aliases`)
}

void main()
