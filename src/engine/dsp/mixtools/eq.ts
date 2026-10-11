import { Changed } from '../biquad'
import { Dsp } from '../base'
import { CoefBiquad, eqCoefs } from '../eqMath'

/** EQ: four bands in series per side, re-designed only when a knob moves. */
export class EqDsp extends Dsp {
  private readonly iL = this.ii('l')
  private readonly iR = this.ii('r')
  private readonly oL = this.oi('ol')
  private readonly oR = this.oi('or')
  private readonly P = Object.fromEntries(['lf', 'lg', 'm1f', 'm1g', 'm1q', 'm2f', 'm2g', 'm2q', 'hf', 'hg', 'out'].map((id) => [id, this.pi(id)])) as Record<string, number>
  private readonly left = [new CoefBiquad(), new CoefBiquad(), new CoefBiquad(), new CoefBiquad()]
  private readonly right = [new CoefBiquad(), new CoefBiquad(), new CoefBiquad(), new CoefBiquad()]
  private readonly changed = [new Changed(), new Changed(), new Changed(), new Changed()]
  private n = 0

  /** Band b's frequency, gain and Q param indices (shelves get a fixed Q). */
  private readonly idx = [
    [this.P.lf, this.P.lg, -1],
    [this.P.m1f, this.P.m1g, this.P.m1q],
    [this.P.m2f, this.P.m2g, this.P.m2q],
    [this.P.hf, this.P.hg, -1],
  ]

  private design(): void {
    const p = this.p
    for (let b = 0; b < 4; b++) {
      const ix = this.idx[b]
      const f = p[ix[0]]
      const g = p[ix[1]]
      const q = ix[2] < 0 ? 0.7 : p[ix[2]]
      if (!this.changed[b].test(f, g, q)) continue
      eqCoefs(b, f, g, q, this.fs, this.left[b].c)
      this.right[b].c.set(this.left[b].c)
    }
  }

  tick(): void {
    if (this.n++ % 32 === 0) this.design()
    let l = this.in[this.iL]
    let r = this.patched[this.iR] ? this.in[this.iR] : l
    for (let b = 0; b < 4; b++) {
      l = this.left[b].run(l)
      r = this.right[b].run(r)
    }
    const g = Math.pow(10, this.p[this.P.out] / 20)
    this.out[this.oL] = l * g
    this.out[this.oR] = r * g
  }
}
