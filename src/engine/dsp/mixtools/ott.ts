import { Biquad } from '../biquad'
import { Dsp } from '../base'
import { fastTanh } from '../util'

/** Crossovers (Hz) and each band's thresholds (dB of 5 V): squashed above
 *  DOWN_T, lifted below UP_T. */
const LOW_X = 120
const HIGH_X = 2500
const DOWN_T = [-14, -16, -18]
const UP_T = [-34, -36, -38]
const RATIO_DOWN = 8
const RATIO_UP = 3.5
const MAX_LIFT = 24

/** One side's band split: lows and highs through two cascaded Butterworths
 *  each (24 dB/oct), mids what's left over, so the three add back exactly. */
class Split {
  readonly lp1: Biquad
  readonly lp2: Biquad
  readonly hp1: Biquad
  readonly hp2: Biquad
  lo = 0
  mid = 0
  hi = 0
  constructor(fs: number) {
    this.lp1 = new Biquad(fs).lowpass(LOW_X)
    this.lp2 = new Biquad(fs).lowpass(LOW_X)
    this.hp1 = new Biquad(fs).highpass(HIGH_X)
    this.hp2 = new Biquad(fs).highpass(HIGH_X)
  }
  run(x: number): void {
    this.lo = this.lp2.run(this.lp1.run(x))
    this.hi = this.hp2.run(this.hp1.run(x))
    this.mid = x - this.lo - this.hi
  }
}

/** OTT: see the spec. Each band's level is followed (stereo-linked), its gain
 *  computed in dB toward the two thresholds, scaled by UPWARD / DOWNWARD and
 *  DEPTH, then the bands are summed and saturated softly. */
export class OttDsp extends Dsp {
  private readonly iL = this.ii('l')
  private readonly iR = this.ii('r')
  private readonly oL = this.oi('ol')
  private readonly oR = this.oi('or')
  private readonly P = Object.fromEntries(['depth', 'time', 'up', 'down', 'lo', 'mid', 'hi', 'in', 'out'].map((id) => [id, this.pi(id)])) as Record<string, number>
  private readonly sl: Split
  private readonly sr: Split
  private readonly env = new Float64Array(3)
  private readonly gain = new Float64Array(3).fill(1)
  private n = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.sl = new Split(this.fs)
    this.sr = new Split(this.fs)
  }

  private band(b: number, lev: number): void {
    const p = this.p
    const P = this.P
    // the level: attack and release scaled by TIME (lows slower than highs)
    const t = 0.25 + p[P.time] * 3 * (b === 0 ? 1.6 : b === 1 ? 1 : 0.6)
    const a = 1 - Math.exp(-1 / (0.003 * t * this.fs))
    const r = 1 - Math.exp(-1 / (0.06 * t * this.fs))
    this.env[b] += (lev - this.env[b]) * (lev > this.env[b] ? a : r)
    if (this.n % 8 !== 0) return
    const dB = 20 * Math.log10(this.env[b] + 1e-6)
    let g = 0
    if (dB > DOWN_T[b]) g = -(dB - DOWN_T[b]) * (1 - 1 / RATIO_DOWN) * p[P.down]
    else if (dB < UP_T[b] && dB > -70) g = Math.min(MAX_LIFT, (UP_T[b] - dB) * (1 - 1 / RATIO_UP)) * p[P.up]
    const trim = p[b === 0 ? P.lo : b === 1 ? P.mid : P.hi]
    // makeup: the squashing takes level away, so DEPTH gives some back
    this.gain[b] = Math.pow(10, (g * p[P.depth] + trim + p[P.depth] * 9) / 20)
  }

  tick(): void {
    const p = this.p
    const P = this.P
    const ig = Math.pow(10, p[P.in] / 20)
    const l = this.in[this.iL] * ig
    const r = (this.patched[this.iR] ? this.in[this.iR] : this.in[this.iL]) * ig
    this.sl.run(l / 5)
    this.sr.run(r / 5)
    this.n++
    this.band(0, Math.max(Math.abs(this.sl.lo), Math.abs(this.sr.lo)))
    this.band(1, Math.max(Math.abs(this.sl.mid), Math.abs(this.sr.mid)))
    this.band(2, Math.max(Math.abs(this.sl.hi), Math.abs(this.sr.hi)))
    const g = this.gain
    const og = Math.pow(10, p[P.out] / 20) * 5
    this.out[this.oL] = fastTanh(this.sl.lo * g[0] + this.sl.mid * g[1] + this.sl.hi * g[2]) * og
    this.out[this.oR] = fastTanh(this.sr.lo * g[0] + this.sr.mid * g[1] + this.sr.hi * g[2]) * og
    for (let b = 0; b < 3; b++) this.led[b] = Math.min(1, Math.abs(Math.log10(g[b])) / 1.2)
  }
}
