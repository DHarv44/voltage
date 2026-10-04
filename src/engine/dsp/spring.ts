import { Dsp } from './base'
import { TAU, fastTanh, rails } from './util'

const SPRINGS = 3
const LENGTHS = [0.0371, 0.0413, 0.0479] // seconds per round trip
/** Negative coefficient = lows delayed most (≈7 samples per stage at DC vs
 *  ≈0.14 at Nyquist): 60 stages smear a click ~9 ms, highs first, lows last. */
const DISPERSION_STAGES = 60
const DISPERSION_A = -0.75

/** One spring: a delay line closed in a feedback loop through a chain of
 *  first-order allpasses. Like a real spring, the line is dispersive: high
 *  frequencies arrive before low ones, so every round trip turns a click into
 *  the falling "drip" chirp, and recirculating builds the splashy tail. */
class SpringLine {
  private readonly buf: Float32Array
  private w = 0
  private readonly apX = new Float64Array(DISPERSION_STAGES)
  private readonly apY = new Float64Array(DISPERSION_STAGES)
  private lp = 0
  private dcX = 0
  private dcY = 0
  out = 0

  constructor(seconds: number, fs: number) {
    this.buf = new Float32Array(Math.max(4, Math.round(seconds * fs)))
  }

  step(input: number, g: number, lpA: number, dcR: number): number {
    const delayed = this.buf[this.w]
    let y = delayed
    const ax = this.apX
    const ay = this.apY
    for (let k = 0; k < DISPERSION_STAGES; k++) {
      const out = DISPERSION_A * y + ax[k] - DISPERSION_A * ay[k]
      ax[k] = y
      ay[k] = out
      y = out
    }
    this.lp += lpA * (y - this.lp)
    // DC blocker keeps the loop centred.
    this.dcY = this.lp - this.dcX + dcR * this.dcY
    this.dcX = this.lp
    this.out = this.dcY
    this.buf[this.w] = input + g * this.dcY
    if (++this.w >= this.buf.length) this.w = 0
    return this.out
  }
}

/** Three-spring tank, driven by a saturating transducer amp. */
export class SpringDsp extends Dsp {
  private iIn = this.ii('in')
  private pDecay = this.pi('decay')
  private pTone = this.pi('tone')
  private pDrive = this.pi('drive')
  private pMix = this.pi('mix')
  private readonly lines: SpringLine[]
  private readonly dcR = 1 - (TAU * 20) / this.fs

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.lines = LENGTHS.slice(0, SPRINGS).map((s) => new SpringLine(s * this.tol(0.02), this.fs))
  }

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const drive = fastTanh((x / 5) * p[this.pDrive]) * 0.5
    const g = 0.55 + 0.38 * p[this.pDecay] // max ≈ 3.5 s RT60, like a long real tank
    const lpA = 1 - Math.exp((-TAU * p[this.pTone]) / this.fs)
    let sum = 0
    for (let i = 0; i < this.lines.length; i++) sum += this.lines[i].step(drive, g, lpA, this.dcR)
    const wet = rails(sum * 3)
    const mix = p[this.pMix]
    this.out[0] = rails(x * (1 - mix) + wet * mix)
    this.out[1] = wet
  }
}
