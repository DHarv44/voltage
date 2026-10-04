import { Dsp } from './base'
import { Schmitt } from './cores'

/** Hit at `step` of a Euclidean rhythm (hits spread as evenly as possible over
 *  `steps`, Bresenham-style; same patterns as Bjorklund up to rotation). */
export function euclidHit(step: number, hits: number, steps: number, rot: number): boolean {
  if (hits <= 0 || steps <= 0) return false
  if (hits >= steps) return true
  const i = (((step + rot) % steps) + steps) % steps
  return (i * hits) % steps < hits
}

/** Two Euclidean channels sharing a clock. Outputs follow the clock's high
 *  half on hit steps, so pulse width comes from the clock, as on hardware. */
export class EuclidDsp extends Dsp {
  private iClk = this.ii('clk')
  private iRst = this.ii('rst')
  private P = ['A', 'B'].map((c) => ({ steps: this.pi(`steps${c}`), fills: this.pi(`fills${c}`), rot: this.pi(`rot${c}`) }))
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private readonly step = new Int32Array(2).fill(-1)
  private readonly hit = new Uint8Array(2)

  tick(): void {
    const p = this.p
    if (this.rst.rise(this.in[this.iRst])) this.step.fill(-1)
    const edge = this.clk.rise(this.in[this.iClk])
    for (let c = 0; c < 2; c++) {
      const P = this.P[c]
      if (edge) {
        const steps = Math.round(p[P.steps])
        this.step[c] = (this.step[c] + 1) % steps
        this.hit[c] = euclidHit(this.step[c], Math.round(p[P.fills]), steps, Math.round(p[P.rot])) ? 1 : 0
      }
      const on = this.hit[c] === 1 && this.clk.high
      this.out[c] = on ? 10 : 0
      this.led[c] = on ? 1 : this.led[c] * 0.999
    }
  }
}

/** Turing-Machine-style shift register. On each clock the register rotates by
 *  one within LENGTH bits; the bit coming round is flipped with probability
 *  CHANGE (+CV). CHANGE 0 = locked loop, 0.5 = fully random, 1 = locked
 *  loop of double length (every pass inverted). CV = top 8 bits as a voltage. */
export class TuringDsp extends Dsp {
  private iClk = this.ii('clk')
  private iChg = this.ii('chg')
  private pChange = this.pi('change')
  private pLen = this.pi('len')
  private pRange = this.pi('range')
  private readonly clk = new Schmitt()
  private reg = Math.floor(this.rng.next() * 0xffff)
  private cv = 0

  tick(): void {
    const p = this.p
    if (this.clk.rise(this.in[this.iClk])) {
      const len = Math.round(p[this.pLen])
      const mask = (1 << len) - 1
      const r = this.reg & mask
      let bit = (r >> (len - 1)) & 1
      const change = Math.min(1, Math.max(0, p[this.pChange] + this.in[this.iChg] / 10))
      if (this.rng.next() < change) bit ^= 1
      this.reg = ((r << 1) | bit) & mask
      // Expand the loop to 8 bits so short lengths still give full-range CV.
      let v = 0
      for (let k = 0; k < 8; k++) v |= ((this.reg >> (k % len)) & 1) << k
      this.cv = (v / 255) * p[this.pRange]
      for (let k = 0; k < 8; k++) this.led[k] = (v >> (7 - k)) & 1
    }
    const bit0 = this.reg & 1
    this.out[0] = this.cv
    this.out[1] = bit0 && this.clk.high ? 10 : 0
    this.out[2] = bit0 ? 10 : 0
  }
}
