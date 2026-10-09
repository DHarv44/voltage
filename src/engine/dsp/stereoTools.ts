import type { ModuleSpec } from '../../modules/types'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { DelayLine } from './delayLine'
import { rails, TAU } from './util'

const QUARTER_PI = Math.PI / 4
const SINE = 0
const TRI = 1
const SQUARE = 2

/** PANNER: equal-power pan (−3 dB in the middle) of PAN + PAN CV (±5 V =
 *  full sweep) + the auto-pan LFO (AUTO deep). The square is softened a hair
 *  so it doesn't click; RANDOM glides to a new spot each cycle. */
export class PannerDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iCv = this.ii('cv')
  private readonly iRst = this.ii('rst')
  private readonly pPan = this.pi('pan')
  private readonly pAuto = this.pi('auto')
  private readonly pRate = this.pi('rate')
  private readonly pShape = this.pi('shape')
  private readonly rst = new Schmitt()
  private ph = 0
  private lfo = 0
  private rand = 0
  private readonly soft: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.soft = 1 - Math.exp(-1 / (0.004 * fs))
  }

  tick(): void {
    const p = this.p
    if (this.rst.rise(this.in[this.iRst])) this.ph = 0
    this.ph += p[this.pRate] / this.fs
    if (this.ph >= 1) {
      this.ph -= 1
      this.rand = this.rng.next() * 2 - 1
    }
    const shape = Math.round(p[this.pShape])
    const goal = shape === SINE ? Math.sin(TAU * this.ph) : shape === TRI ? 1 - 4 * Math.abs(this.ph - 0.5) : shape === SQUARE ? (this.ph < 0.5 ? 1 : -1) : this.rand
    // sine and triangle are smooth already; the others glide (RANDOM slowly)
    this.lfo += (goal - this.lfo) * (shape === SINE || shape === TRI ? 1 : shape === SQUARE ? this.soft : this.soft * 0.05)
    let pos = p[this.pPan] + this.in[this.iCv] / 5 + p[this.pAuto] * this.lfo
    pos = pos < -1 ? -1 : pos > 1 ? 1 : pos
    const a = (pos + 1) * QUARTER_PI
    const x = this.in[this.iIn]
    this.out[0] = x * Math.cos(a)
    this.out[1] = x * Math.sin(a)
    this.led[0] = Math.cos(a)
    this.led[1] = Math.sin(a)
  }
}

/** WIDENER: mid/side. The side (L − R) is scaled by WIDTH after a one-pole
 *  high-pass at BASS MONO, so the lows stay in the middle. With R unpatched
 *  the right channel is the left delayed by HAAS ms: a mono sound opened out
 *  without changing its tone in mono. LED: the output's phase correlation. */
export class WidenerDsp extends Dsp {
  private readonly iL = this.ii('l')
  private readonly iR = this.ii('r')
  private readonly iCv = this.ii('cv')
  private readonly pWidth = this.pi('width')
  private readonly pHaas = this.pi('haas')
  private readonly pMono = this.pi('mono')
  private readonly haas: DelayLine
  private sideLp = 0
  private lr = 0
  private ll = 0
  private rr = 0
  private readonly avg: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.haas = new DelayLine(0.03 * fs)
    this.avg = 1 - Math.exp(-1 / (0.3 * fs))
  }

  tick(): void {
    const p = this.p
    const l = this.in[this.iL]
    this.haas.write(l)
    const hd = p[this.pHaas] * this.fs
    const r = this.patched[this.iR] ? this.in[this.iR] : hd >= 1 ? this.haas.tapLin(hd) : l
    const mid = (l + r) * 0.5
    const side = (l - r) * 0.5
    // one-pole high-pass on the side: below BASS MONO it fades to the middle
    this.sideLp += (side - this.sideLp) * Math.min(1, (TAU * p[this.pMono]) / this.fs)
    let w = p[this.pWidth] + this.in[this.iCv] / 5
    w = w < 0 ? 0 : w > 2.5 ? 2.5 : w
    const s = (side - this.sideLp) * w
    const oL = rails(mid + s)
    const oR = rails(mid - s)
    this.out[0] = oL
    this.out[1] = oR
    const k = this.avg
    this.lr += (oL * oR - this.lr) * k
    this.ll += (oL * oL - this.ll) * k
    this.rr += (oR * oR - this.rr) * k
    this.led[0] = this.ll + this.rr > 1e-6 ? this.lr / Math.sqrt(this.ll * this.rr + 1e-9) : 0
  }
}
