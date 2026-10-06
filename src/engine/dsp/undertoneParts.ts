import { polyBlep } from './util'

/** A subharmonic: the VCO divided by n, phase-locked to it (it counts the
 *  VCO's cycles, like the flip-flop dividers in the hardware), so it never
 *  drifts against its parent. Band-limited with the parent's dt / n. */
export class SubOsc {
  private cnt = 0

  out(t: number, dt: number, n: number, sqr: boolean): number {
    if (this.cnt >= n) this.cnt %= n
    const ph = (this.cnt + t) / n
    const d = dt / n
    if (!sqr) return 2 * ph - 1 - polyBlep(ph, d)
    let t2 = ph - 0.5
    if (t2 < 0) t2 += 1
    return (ph < 0.5 ? 1 : -1) + polyBlep(ph, d) - polyBlep(t2, d)
  }

  /** The parent wrapped: one more cycle counted. */
  wrap(n: number): void {
    this.cnt = (this.cnt + 1) % n
  }
}

/** Attack–decay envelope (RC attack toward 1.3, exponential decay), 0..1.
 *  A strike restarts the attack from wherever it is, like the hardware. */
export class AdEnv {
  v = 0
  private rising = false

  strike(): void {
    this.rising = true
  }

  step(a: number, d: number, fs: number): number {
    if (this.rising) {
      this.v += (1.3 - this.v) * (1 - Math.exp(-1.47 / (Math.max(a, 0.0005) * fs)))
      if (this.v >= 1) {
        this.v = 1
        this.rising = false
      }
    } else this.v *= Math.exp(-4.6 / (Math.max(d, 0.0005) * fs))
    return this.v
  }
}

const log2s = (ratios: number[]) => Float64Array.from([...ratios, 2], Math.log2)
/** Just scales within the octave (and the octave itself, to round up to). */
const JI12 = log2s([1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8])
const JI8 = log2s([1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 7 / 4, 15 / 8])

function nearest(v: number, table: Float64Array): number {
  const oct = Math.floor(v)
  const f = v - oct
  let best = table[0]
  for (let k = 1; k < table.length; k++) if (Math.abs(table[k] - f) < Math.abs(best - f)) best = table[k]
  return oct + best
}

/** Snap an offset in octaves: OFF, 12-ET, 8-ET, 12-JI, 8-JI (UT_QUANT order). */
export function quantize(v: number, mode: number): number {
  switch (mode) {
    case 1:
      return Math.round(v * 12) / 12
    case 2:
      return Math.round(v * 8) / 8
    case 3:
      return nearest(v, JI12)
    case 4:
      return nearest(v, JI8)
    default:
      return v
  }
}
