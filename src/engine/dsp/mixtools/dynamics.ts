import { Dsp } from '../base'

const coef = (s: number, fs: number) => 1 - Math.exp(-1 / (Math.max(1e-5, s) * fs))
const EPS = 1e-4

/** A peak follower with separate attack and release. */
class Follower {
  v = 0
  constructor(
    private readonly a: number,
    private readonly r: number,
  ) {}
  run(x: number): number {
    this.v += (x - this.v) * (x > this.v ? this.a : this.r)
    return this.v
  }
}

/** TRANSIENT: two pairs of followers on the (stereo-linked) level. A fast-
 *  and a slow-attack follower differ only while a hit is starting: that
 *  difference, scaled by ATTACK, is the attack gain. A fast- and a slow-
 *  release follower differ only in the tail: SUSTAIN's gain. */
export class TransientDsp extends Dsp {
  private readonly iL = this.ii('l')
  private readonly iR = this.ii('r')
  private readonly oL = this.oi('ol')
  private readonly oR = this.oi('or')
  private readonly P = { att: this.pi('att'), sus: this.pi('sus'), out: this.pi('out') }
  private readonly aFast = new Follower(coef(0.0005, this.fs), coef(0.08, this.fs))
  private readonly aSlow = new Follower(coef(0.02, this.fs), coef(0.08, this.fs))
  private readonly sFast = new Follower(coef(0.002, this.fs), coef(0.03, this.fs))
  private readonly sSlow = new Follower(coef(0.002, this.fs), coef(0.35, this.fs))

  tick(): void {
    const p = this.p
    const l = this.in[this.iL]
    const r = this.patched[this.iR] ? this.in[this.iR] : l
    const x = Math.max(Math.abs(l), Math.abs(r))
    const af = this.aFast.run(x)
    const as = this.aSlow.run(x)
    const sf = this.sFast.run(x)
    const ss = this.sSlow.run(x)
    const onset = Math.min(2, Math.max(0, af - as) / (as + EPS))
    const tail = Math.min(1, Math.max(0, ss - sf) / (ss + EPS))
    const g = Math.max(0, (1 + p[this.P.att] * onset * 1.5) * (1 + p[this.P.sus] * tail * 2)) * Math.pow(10, p[this.P.out] / 20)
    this.out[this.oL] = l * g
    this.out[this.oR] = r * g
    this.led[0] = Math.min(1, onset)
  }
}

/** NOISE GATE: opens when the level (of KEY if patched) rises past THRESHOLD,
 *  stays open for HOLD after it falls 3 dB below (hysteresis), then closes
 *  over RELEASE, down by RANGE. Levels in dB of 5 V. */
export class NoiseGateDsp extends Dsp {
  private readonly iL = this.ii('l')
  private readonly iR = this.ii('r')
  private readonly iKey = this.ii('key')
  private readonly oL = this.oi('ol')
  private readonly oR = this.oi('or')
  private readonly oG = this.oi('gate')
  private readonly P = { thr: this.pi('thr'), range: this.pi('range'), att: this.pi('att'), hold: this.pi('hold'), rel: this.pi('rel') }
  private readonly level = new Follower(coef(0.0002, this.fs), coef(0.03, this.fs))
  private open = false
  private held = 0
  private g = 0

  tick(): void {
    const p = this.p
    const l = this.in[this.iL]
    const r = this.patched[this.iR] ? this.in[this.iR] : l
    const key = this.patched[this.iKey] ? Math.abs(this.in[this.iKey]) : Math.max(Math.abs(l), Math.abs(r))
    const lev = this.level.run(key / 5)
    const dB = 20 * Math.log10(lev + 1e-9)
    const thr = p[this.P.thr]
    if (dB > thr) {
      this.open = true
      this.held = Math.round(p[this.P.hold] * this.fs)
    } else if (dB < thr - 3) {
      if (this.held > 0) this.held--
      else this.open = false
    }
    const floor = Math.pow(10, -p[this.P.range] / 20)
    const target = this.open ? 1 : floor
    this.g += (target - this.g) * (this.open ? coef(p[this.P.att], this.fs) : coef(p[this.P.rel] / 4.6, this.fs))
    this.out[this.oL] = l * this.g
    this.out[this.oR] = r * this.g
    this.out[this.oG] = this.open ? 10 : 0
    this.led[0] = this.open ? 1 : 0
  }
}
