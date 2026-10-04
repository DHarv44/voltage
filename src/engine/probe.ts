import type { Dsp } from './dsp/base'
import type { ProbeFrame } from './protocol'

/** Watches one module's jacks for the hover readout: running min/max of every
 *  input and output, collected and reset at each telemetry frame. */
export class Probe {
  readonly id: string
  private readonly d: Dsp
  private readonly inMin: Float64Array
  private readonly inMax: Float64Array
  private readonly outMin: Float64Array
  private readonly outMax: Float64Array

  constructor(id: string, d: Dsp) {
    this.id = id
    this.d = d
    this.inMin = new Float64Array(d.in.length).fill(Infinity)
    this.inMax = new Float64Array(d.in.length).fill(-Infinity)
    this.outMin = new Float64Array(d.out.length).fill(Infinity)
    this.outMax = new Float64Array(d.out.length).fill(-Infinity)
  }

  sample(): void {
    const { in: i, out: o } = this.d
    for (let k = 0; k < i.length; k++) {
      if (i[k] < this.inMin[k]) this.inMin[k] = i[k]
      if (i[k] > this.inMax[k]) this.inMax[k] = i[k]
    }
    for (let k = 0; k < o.length; k++) {
      if (o[k] < this.outMin[k]) this.outMin[k] = o[k]
      if (o[k] > this.outMax[k]) this.outMax[k] = o[k]
    }
  }

  take(): ProbeFrame {
    const pairs = (lo: Float64Array, hi: Float64Array): [number, number][] =>
      Array.from(lo, (v, k) => [Number.isFinite(v) ? v : 0, Number.isFinite(hi[k]) ? hi[k] : 0])
    const frame = { id: this.id, ins: pairs(this.inMin, this.inMax), outs: pairs(this.outMin, this.outMax) }
    this.inMin.fill(Infinity)
    this.inMax.fill(-Infinity)
    this.outMin.fill(Infinity)
    this.outMax.fill(-Infinity)
    return frame
  }
}
