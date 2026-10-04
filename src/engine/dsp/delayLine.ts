/** Circular delay line with integer and fractional (linear / Hermite) taps. */
export class DelayLine {
  readonly buf: Float32Array
  private w = 0

  constructor(maxSamples: number) {
    this.buf = new Float32Array(Math.max(4, Math.ceil(maxSamples) + 4))
  }

  write(x: number): void {
    this.buf[this.w] = x
    this.w = this.w + 1 >= this.buf.length ? 0 : this.w + 1
  }

  /** Sample written `d` samples ago (d ≥ 1 reads the last write). */
  tap(d: number): number {
    let i = this.w - d
    if (i < 0) i += this.buf.length
    return this.buf[i]
  }

  /** Linear-interpolated fractional tap. */
  tapLin(d: number): number {
    const i = Math.floor(d)
    const f = d - i
    const a = this.tap(i)
    return a + (this.tap(i + 1) - a) * f
  }

  /** 4-point Hermite fractional tap (for pitch-sensitive modulated delays). */
  tapHermite(d: number): number {
    const i = Math.floor(d)
    const f = d - i
    const ym1 = this.tap(Math.max(1, i - 1))
    const y0 = this.tap(Math.max(1, i))
    const y1 = this.tap(i + 1)
    const y2 = this.tap(i + 2)
    const c1 = 0.5 * (y1 - ym1)
    const c2 = ym1 - 2.5 * y0 + 2 * y1 - 0.5 * y2
    const c3 = 0.5 * (y2 - ym1) + 1.5 * (y0 - y1)
    return ((c3 * f + c2) * f + c1) * f + y0
  }
}

/** Schroeder allpass around a DelayLine: w = x + g·w[n−N]; y = w[n−N] − g·w. */
export class Allpass {
  readonly line: DelayLine
  constructor(
    readonly len: number,
    public g: number,
    maxExtra = 0,
  ) {
    this.line = new DelayLine(len + maxExtra + 2)
  }
  process(x: number, extra = 0): number {
    const d = extra ? this.line.tapLin(this.len + extra) : this.line.tap(this.len)
    const w = x + this.g * d
    this.line.write(w)
    return d - this.g * w
  }
}
