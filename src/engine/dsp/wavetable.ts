import { Dsp } from './base'
import { Drift } from './drift'
import { C4 } from './util'

const SIZE = 1024
const MIPS = 8 // max harmonics per mip: 256, 128, … 2
const WAVES = 8

/** Harmonic amplitude recipes (sine/cosine series). Returns [sinAmp, cosAmp] for harmonic n. */
const RECIPES: ((n: number) => [number, number])[] = [
  (n) => [n === 1 ? 1 : 0, 0], // sine
  (n) => [n % 2 ? ((8 / (Math.PI * Math.PI)) * (((n - 1) / 2) % 2 ? -1 : 1)) / (n * n) : 0, 0], // triangle
  (n) => [(2 / (Math.PI * n)) * (n % 2 ? 1 : -1), 0], // saw
  (n) => [n % 2 ? 4 / (Math.PI * n) : 0, 0], // square
  (n) => [0, (2 / (Math.PI * n)) * Math.sin(Math.PI * n * 0.25)], // 25 % pulse
  (n) => [[1, 2, 3, 4, 6, 8].includes(n) ? [1, 0.8, 0.6, 0.5, 0.35, 0.25][[1, 2, 3, 4, 6, 8].indexOf(n)] : 0, 0], // organ drawbars
  (n) => [0.25 * Math.exp(-(((n - 6) / 2) ** 2)) + 0.18 * Math.exp(-(((n - 11) / 2.5) ** 2)) + (n === 1 ? 0.3 : 0), 0], // vocal formants
  (n) => [1 / Math.sqrt(n), 0], // bright
]

/** Shared, lazily built band-limited tables: [wave][mip] → Float32Array(SIZE + 1). */
let TABLES: Float32Array[][] | null = null

function buildTables(): Float32Array[][] {
  const sinT = Float64Array.from({ length: SIZE }, (_, i) => Math.sin((2 * Math.PI * i) / SIZE))
  return RECIPES.map((recipe) =>
    Array.from({ length: MIPS }, (_, mip) => {
      const maxH = 256 >> mip
      const t = new Float32Array(SIZE + 1)
      for (let n = 1; n <= maxH; n++) {
        const [a, b] = recipe(n)
        if (a === 0 && b === 0) continue
        for (let i = 0; i < SIZE; i++) {
          const k = (n * i) % SIZE
          t[i] += a * sinT[k] + b * sinT[(k + SIZE / 4) % SIZE]
        }
      }
      let peak = 0
      for (let i = 0; i < SIZE; i++) peak = Math.max(peak, Math.abs(t[i]))
      for (let i = 0; i < SIZE; i++) t[i] /= peak || 1
      t[SIZE] = t[0] // guard point for interpolation
      return t
    }),
  )
}

/** Wavetable oscillator morphing across 8 waves. Each wave is stored at 8
 *  harmonic limits; the mip is chosen per note so nothing above Nyquist is
 *  ever played (no aliasing), like a real band-limited wavetable synth. */
export class WaveDsp extends Dsp {
  private iV = this.ii('voct')
  private iW = this.ii('wcv')
  private iFm = this.ii('fm')
  private pCoarse = this.pi('coarse')
  private pFine = this.pi('fine')
  private pWave = this.pi('wave')
  private pWamt = this.pi('wamt')
  private pFm = this.pi('fmamt')
  private phase = this.rng.next()
  private readonly drift = new Drift(this.rng, this.fs, 3, 0.8)
  private readonly tables = (TABLES ??= buildTables())

  tick(): void {
    const i = this.in
    const p = this.p
    const oct = i[this.iV] + p[this.pCoarse] + p[this.pFine] / 12 + i[this.iFm] * p[this.pFm] + this.drift.next(this.age)
    const f = Math.min(C4 * Math.pow(2, oct), this.fs * 0.45)
    const allowed = (0.45 * this.fs) / f // harmonics that fit below Nyquist
    const mip = Math.max(0, Math.min(MIPS - 1, Math.ceil(Math.log2(256 / Math.max(allowed, 1)))))

    let w = p[this.pWave] + (i[this.iW] / 5) * 3.5 * p[this.pWamt]
    w = w < 0 ? 0 : w > WAVES - 1 ? WAVES - 1 : w
    const w0 = Math.floor(w)
    const w1 = Math.min(WAVES - 1, w0 + 1)
    const wf = w - w0

    const pos = this.phase * SIZE
    const k = Math.floor(pos)
    const fr = pos - k
    const a = this.tables[w0][mip]
    const b = this.tables[w1][mip]
    const va = a[k] + (a[k + 1] - a[k]) * fr
    const vb = b[k] + (b[k + 1] - b[k]) * fr
    this.out[0] = (va + (vb - va) * wf) * 5

    this.phase += f / this.fs
    if (this.phase >= 1) this.phase -= 1
  }
}
