import type { ModuleSpec } from '../../modules/types'
import { ROOM } from '../../modules/specs/chamber'
import { Dsp } from './base'
import { Changed } from './biquad'
import { DelayLine } from './delayLine'

const C = 343
const MAX_S = 0.35
const MAX_ORDER = 2
const CTRL = 64
const HEIGHT = 1.5
/** Image-source index triples (nx, ny, nz) up to MAX_ORDER reflections. */
const IMAGES: [number, number, number][] = []
for (let nx = -MAX_ORDER; nx <= MAX_ORDER; nx++)
  for (let ny = -MAX_ORDER; ny <= MAX_ORDER; ny++)
    for (let nz = -1; nz <= 1; nz++) if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) <= MAX_ORDER) IMAGES.push([nx, ny, nz])
const TAPS = IMAGES.length
/** The unreflected path from speaker to mic. */
const DIRECT = IMAGES.findIndex(([a, b, c]) => a === 0 && b === 0 && c === 0)
const FDN = [1, 1.173, 1.367, 1.589]

/** Mirror coordinate of image n of a source at s in a room of length L. */
const mirror = (n: number, s: number, L: number) => n * L + (Math.abs(n) % 2 === 0 ? s : L - s)

/** Echo chamber: image-source early reflections per mic, a four-line
 *  feedback-delay tail whose RT60 comes from Sabine's formula. Tap delays
 *  glide when things move, so a moving speaker Doppler-shifts. */
export class ChamberDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly pSize = this.pi('size')
  private readonly pDamp = this.pi('damp')
  private readonly pWidth = this.pi('width')
  private readonly pTail = this.pi('tail')
  private readonly pMix = this.pi('mix')
  private readonly pSx = this.pi('sx')
  private readonly pSy = this.pi('sy')
  private readonly pMx = this.pi('mx')
  private readonly pMy = this.pi('my')
  private readonly line: DelayLine
  /** Per mic (L then R): current and target delay (samples) and gain per tap. */
  private readonly d = new Float64Array(TAPS * 2)
  private readonly g = new Float64Array(TAPS * 2)
  private readonly dT = new Float64Array(TAPS * 2)
  private readonly gT = new Float64Array(TAPS * 2)
  private readonly fdn: DelayLine[]
  private readonly fdnLen = new Float64Array(4)
  private readonly fdnG = new Float64Array(4)
  private readonly fdnLp = new Float64Array(4)
  private dampK = 0.3
  private airL = 0
  private airR = 0
  private n = CTRL
  private first = true
  private readonly changed = new Changed()
  private readonly glide: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.line = new DelayLine(Math.ceil(MAX_S * fs))
    this.fdn = FDN.map(() => new DelayLine(Math.ceil(0.25 * fs)))
    this.glide = 1 - Math.exp(-1 / (0.03 * fs))
  }

  private design(): void {
    const p = this.p
    const size = p[this.pSize]
    const W = ROOM.w * size
    const D = ROOM.d * size
    const Hh = ROOM.h * Math.sqrt(size)
    const alpha = 0.04 + p[this.pDamp] * 0.6
    const r = Math.sqrt(1 - alpha)
    const sx = p[this.pSx] * W
    const sy = p[this.pSy] * D
    const gap = (0.2 + p[this.pWidth] * 2.8) / 2
    for (let m = 0; m < 2; m++) {
      const mx = Math.min(W, Math.max(0, p[this.pMx] * W + (m === 0 ? -gap : gap)))
      const my = p[this.pMy] * D
      IMAGES.forEach(([nx, ny, nz], k) => {
        const ix = mirror(nx, sx, W)
        const iy = mirror(ny, sy, D)
        const iz = mirror(nz, HEIGHT, Hh)
        const dist = Math.max(0.3, Math.hypot(ix - mx, iy - my, iz - HEIGHT))
        const order = Math.abs(nx) + Math.abs(ny) + Math.abs(nz)
        this.dT[m * TAPS + k] = Math.min(MAX_S * this.fs - 4, (dist / C) * this.fs)
        this.gT[m * TAPS + k] = Math.pow(r, order) / dist
      })
    }
    // Sabine: RT60 = 0.161 V / (S α); FDN lines sized by the mean free path.
    const V = W * D * Hh
    const S = 2 * (W * D + W * Hh + D * Hh)
    const rt60 = Math.min(8, Math.max(0.15, (0.161 * V) / (S * alpha)))
    const mfp = ((4 * V) / S / C) * this.fs
    for (let i = 0; i < 4; i++) {
      this.fdnLen[i] = Math.min(0.24 * this.fs, mfp * FDN[i])
      this.fdnG[i] = Math.pow(10, (-3 * this.fdnLen[i]) / (rt60 * this.fs))
    }
    this.dampK = 0.15 + (1 - p[this.pDamp]) * 0.6
    if (this.first) {
      this.d.set(this.dT)
      this.g.set(this.gT)
      this.first = false
    }
  }

  tick(): void {
    const p = this.p
    if (++this.n >= CTRL) {
      this.n = 0
      if (this.changed.test(p[this.pSize], p[this.pDamp], p[this.pWidth], p[this.pSx], p[this.pSy], p[this.pMx], p[this.pMy])) this.design()
    }
    const x = this.in[this.iIn]
    this.line.write(x)
    const k = this.glide
    let l = 0
    let r = 0
    let earlyL = 0
    let earlyR = 0
    for (let t = 0; t < TAPS * 2; t++) {
      this.d[t] += (this.dT[t] - this.d[t]) * k
      this.g[t] += (this.gT[t] - this.g[t]) * k
      const v = this.line.tapLin(this.d[t]) * this.g[t]
      if (t < TAPS) {
        if (t === DIRECT) l += v
        else earlyL += v
      } else if (t - TAPS === DIRECT) r += v
      else earlyR += v
    }
    // Long paths lose their top end in air.
    this.airL += (earlyL - this.airL) * 0.5
    this.airR += (earlyR - this.airR) * 0.5

    // Late tail: Hadamard-mixed four-line FDN with damped feedback.
    const f0 = this.fdn[0].tapLin(this.fdnLen[0])
    const f1 = this.fdn[1].tapLin(this.fdnLen[1])
    const f2 = this.fdn[2].tapLin(this.fdnLen[2])
    const f3 = this.fdn[3].tapLin(this.fdnLen[3])
    const feed = (this.airL + this.airR) * 0.5 * p[this.pTail]
    this.feedLine(0, f0 + f1 + f2 + f3, feed)
    this.feedLine(1, f0 - f1 + f2 - f3, feed)
    this.feedLine(2, f0 + f1 - f2 - f3, feed)
    this.feedLine(3, f0 - f1 - f2 + f3, feed)
    const wet = 1.4
    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + (l + this.airL + (f0 + f2) * 0.5) * wet * mix
    this.out[1] = x * (1 - mix) + (r + this.airR + (f1 + f3) * 0.5) * wet * mix
  }

  private feedLine(i: number, h: number, feed: number): void {
    this.fdnLp[i] += (h * 0.5 * this.fdnG[i] - this.fdnLp[i]) * this.dampK
    this.fdn[i].write(feed + this.fdnLp[i])
  }
}
