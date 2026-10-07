import { Dsp } from './base'
import { Biquad, Changed } from './biquad'

const LOOKAHEAD_S = 0.002
const LOW_HZ = 110
const HIGH_HZ = 8000
const MID_Q = 0.8
/** 0 dB = a 5 V peak. */
const FULL = 5

/** MASTER: EQ (low shelf, sweepable mid bell, high shelf) → mid/side width →
 *  DRIVE → a look-ahead peak limiter. The audio is delayed by the look-ahead
 *  so the gain is already down when a peak arrives; a held minimum over that
 *  window keeps it down for the whole peak, then RELEASE brings it back. */
export class MasterDsp extends Dsp {
  private iL = this.ii('l')
  private iR = this.ii('r')
  private oL = this.oi('l')
  private oR = this.oi('r')
  private P = {
    low: this.pi('low'), mid: this.pi('mid'), freq: this.pi('freq'), high: this.pi('high'),
    width: this.pi('width'), drive: this.pi('drive'), ceiling: this.pi('ceiling'), release: this.pi('release'),
  }
  private readonly eq = Array.from({ length: 6 }, () => new Biquad(this.fs))
  private readonly changed = new Changed()
  private readonly n = Math.max(1, Math.round(LOOKAHEAD_S * this.fs))
  private readonly dl = new Float32Array(this.n)
  private readonly dr = new Float32Array(this.n)
  private w = 0
  private held = 1
  private holdLeft = 0
  private gain = 1
  private readonly attK = 1 - Math.exp(-5 / this.n)

  tick(): void {
    const i = this.in
    const p = this.p
    const P = this.P
    if (this.changed.test(p[P.low], p[P.mid], p[P.freq], p[P.high]))
      for (let c = 0; c < 2; c++) {
        this.eq[c * 3].lowShelf(LOW_HZ, p[P.low])
        this.eq[c * 3 + 1].peak(p[P.freq], MID_Q, p[P.mid])
        this.eq[c * 3 + 2].highShelf(HIGH_HZ, p[P.high])
      }
    let l = i[this.iL]
    let r = this.patched[this.iR] ? i[this.iR] : l
    l = this.eq[2].run(this.eq[1].run(this.eq[0].run(l)))
    r = this.eq[5].run(this.eq[4].run(this.eq[3].run(r)))

    // width: scale the side signal
    const mid = (l + r) * 0.5
    const side = (l - r) * 0.5 * p[P.width]
    const drive = Math.pow(10, p[P.drive] / 20)
    l = (mid + side) * drive
    r = (mid - side) * drive

    // look-ahead limiter
    const ceil = Math.pow(10, p[P.ceiling] / 20)
    const pk = Math.max(Math.abs(l), Math.abs(r)) / FULL
    const need = pk > ceil ? ceil / pk : 1
    if (need <= this.held) {
      this.held = need
      this.holdLeft = this.n
    } else if (this.holdLeft > 0) this.holdLeft--
    else this.held = need
    if (this.held < this.gain) this.gain += (this.held - this.gain) * this.attK
    else this.gain += (this.held - this.gain) * (1 - Math.exp(-1 / (p[P.release] * this.fs)))

    const outL = this.dl[this.w] * this.gain
    const outR = this.dr[this.w] * this.gain
    this.dl[this.w] = l
    this.dr[this.w] = r
    this.w = (this.w + 1) % this.n
    const lim = ceil * FULL
    this.out[this.oL] = outL > lim ? lim : outL < -lim ? -lim : outL
    this.out[this.oR] = outR > lim ? lim : outR < -lim ? -lim : outR

    const grDb = -20 * Math.log10(this.gain)
    this.led[0] = grDb > 6 ? 1 : 0
    this.led[1] = grDb > 3 ? 1 : 0
    this.led[2] = grDb > 0.5 ? 1 : 0
  }
}
