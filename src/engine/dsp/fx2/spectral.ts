import { Dsp } from '../base'
import { Svf } from '../drumVoices'
import { fastTanh, TAU } from '../util'

/** Two allpass chains whose outputs stay 90° apart across the audio band
 *  (a Hilbert transformer, Niemitalo's coefficients; chain B one sample late). */
const HA = [0.6923878, 0.9360654322959, 0.988229522686, 0.9987488452737].map((c) => c * c)
const HB = [0.4021921162426, 0.856171088242, 0.9722909545651, 0.9952884791278].map((c) => c * c)
const RANGES = [10, 300, 3000]

class AllpassChain {
  private readonly x1 = new Float64Array(4)
  private readonly x2 = new Float64Array(4)
  private readonly y1 = new Float64Array(4)
  private readonly y2 = new Float64Array(4)

  constructor(private readonly c: number[]) {}

  run(x: number): number {
    let v = x
    for (let i = 0; i < 4; i++) {
      const y = this.c[i] * (v + this.y2[i]) - this.x2[i]
      this.x2[i] = this.x1[i]
      this.x1[i] = v
      this.y2[i] = this.y1[i]
      this.y1[i] = y
      v = y
    }
    return v
  }
}

/** FREQ SHIFT: the signal split into two copies 90° apart, multiplied by a
 *  sine and cosine at the shift frequency and added (UP) or subtracted
 *  (DOWN): single-sideband modulation. FEEDBACK sends UP round again. */
export class FreqShiftDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iCv = this.ii('cv')
  private readonly O = { up: this.oi('up'), down: this.oi('down'), out: this.oi('out') }
  private readonly P = { shift: this.pi('shift'), range: this.pi('range'), fb: this.pi('fb'), mix: this.pi('mix') }
  private readonly a = new AllpassChain(HA)
  private readonly b = new AllpassChain(HB)
  private bLate = 0
  private ph = 0
  private last = 0

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const range = RANGES[Math.round(p[this.P.range])]
    const s = p[this.P.shift]
    const hz = s * Math.abs(s) * range + (this.patched[this.iCv] ? (this.in[this.iCv] / 5) * range : 0)
    this.ph = (this.ph + hz / this.fs) % 1
    const c = Math.cos(TAU * this.ph)
    const sn = Math.sin(TAU * this.ph)
    const v = x + this.last * p[this.P.fb]
    const ia = this.a.run(v)
    const ib = this.bLate
    this.bLate = this.b.run(v)
    const up = ia * c - ib * sn
    const down = ia * c + ib * sn
    this.last = 5 * fastTanh(up / 5)
    const mix = p[this.P.mix]
    this.out[this.O.up] = up
    this.out[this.O.down] = down
    this.out[this.O.out] = x * (1 - mix) + up * mix
  }
}

/** Formants (Hz) and their levels for A E I O U (an adult voice). */
const VOWELS = [
  [800, 1150, 2900, 1, 0.5, 0.25],
  [400, 1600, 2700, 1, 0.35, 0.25],
  [350, 2300, 3000, 1, 0.25, 0.3],
  [450, 800, 2830, 1, 0.55, 0.15],
  [325, 700, 2530, 1, 0.3, 0.1],
]

/** FORMANT: three band-passes in parallel at the vowel's formants
 *  (interpolated between neighbours, in log frequency), SIZE scaling them
 *  like a bigger or smaller throat. */
export class FormantDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iCv = this.ii('cv')
  private readonly oOut = this.oi('out')
  private readonly P = { vowel: this.pi('vowel'), size: this.pi('size'), res: this.pi('res'), mix: this.pi('mix') }
  private readonly f = [new Svf(), new Svf(), new Svf()]
  private readonly hz = new Float64Array(3)
  private readonly gain = new Float64Array(3)
  private n = 0

  private update(): void {
    const p = this.p
    const v = Math.max(0, Math.min(4, p[this.P.vowel] + (this.patched[this.iCv] ? this.in[this.iCv] / 2.5 : 0)))
    const i = Math.min(3, Math.floor(v))
    const t = v - i
    const a = VOWELS[i]
    const b = VOWELS[i + 1]
    const scale = Math.pow(2, -p[this.P.size] * 0.6)
    for (let k = 0; k < 3; k++) {
      this.hz[k] = Math.exp(Math.log(a[k]) * (1 - t) + Math.log(b[k]) * t) * scale
      this.gain[k] = a[k + 3] * (1 - t) + b[k + 3] * t
    }
  }

  tick(): void {
    if (this.n++ % 16 === 0) this.update()
    const p = this.p
    const x = this.in[this.iIn]
    // damping 2/Q; k × band-pass peaks at unity at each formant
    const k = 2 / (3 + p[this.P.res] * 17)
    let y = 0
    for (let j = 0; j < 3; j++) {
      this.f[j].process(x, this.hz[j], k, this.fs)
      y += this.f[j].bp * k * this.gain[j]
    }
    const mix = p[this.P.mix]
    this.out[this.oOut] = x * (1 - mix) + y * 1.8 * mix
  }
}
