import { TAU } from './util'

/** RBJ-cookbook biquad (transposed direct form II). Re-design it only when
 *  its settings change: the set* calls cost a few transcendental functions. */
export class Biquad {
  private b0 = 1
  private b1 = 0
  private b2 = 0
  private a1 = 0
  private a2 = 0
  private z1 = 0
  private z2 = 0

  constructor(private readonly fs: number) {}

  private set(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): this {
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = a1 / a0
    this.a2 = a2 / a0
    return this
  }

  private w(f: number): { cs: number; sn: number } {
    const w = (TAU * Math.min(f, this.fs * 0.49)) / this.fs
    return { cs: Math.cos(w), sn: Math.sin(w) }
  }

  lowpass(f: number, q = Math.SQRT1_2): this {
    const { cs, sn } = this.w(f)
    const al = sn / (2 * q)
    return this.set((1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + al, -2 * cs, 1 - al)
  }

  highpass(f: number, q = Math.SQRT1_2): this {
    const { cs, sn } = this.w(f)
    const al = sn / (2 * q)
    return this.set((1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al)
  }

  bandpass(f: number, q: number): this {
    const { cs, sn } = this.w(f)
    const al = sn / (2 * q)
    return this.set(al, 0, -al, 1 + al, -2 * cs, 1 - al)
  }

  peak(f: number, q: number, db: number): this {
    const { cs, sn } = this.w(f)
    const A = Math.pow(10, db / 40)
    const al = sn / (2 * q)
    return this.set(1 + al * A, -2 * cs, 1 - al * A, 1 + al / A, -2 * cs, 1 - al / A)
  }

  lowShelf(f: number, db: number): this {
    const { cs, sn } = this.w(f)
    const A = Math.pow(10, db / 40)
    const al = (sn / 2) * Math.SQRT2
    const k = 2 * Math.sqrt(A) * al
    return this.set(
      A * (A + 1 - (A - 1) * cs + k),
      2 * A * (A - 1 - (A + 1) * cs),
      A * (A + 1 - (A - 1) * cs - k),
      A + 1 + (A - 1) * cs + k,
      -2 * (A - 1 + (A + 1) * cs),
      A + 1 + (A - 1) * cs - k,
    )
  }

  highShelf(f: number, db: number): this {
    const { cs, sn } = this.w(f)
    const A = Math.pow(10, db / 40)
    const al = (sn / 2) * Math.SQRT2
    const k = 2 * Math.sqrt(A) * al
    return this.set(
      A * (A + 1 + (A - 1) * cs + k),
      -2 * A * (A - 1 + (A + 1) * cs),
      A * (A + 1 + (A - 1) * cs - k),
      A + 1 - (A - 1) * cs + k,
      2 * (A - 1 - (A + 1) * cs),
      A + 1 - (A - 1) * cs - k,
    )
  }

  run(x: number): number {
    const y = this.b0 * x + this.z1
    this.z1 = this.b1 * x - this.a1 * y + this.z2
    this.z2 = this.b2 * x - this.a2 * y
    return y
  }
}

/** Watches up to eight numbers and reports when any changed (cheap re-design
 *  gate). Allocation-free, so it can run on the audio thread. */
export class Changed {
  private readonly last = new Float64Array(8).fill(NaN)
  test(a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0): boolean {
    const l = this.last
    if (l[0] === a && l[1] === b && l[2] === c && l[3] === d && l[4] === e && l[5] === f && l[6] === g && l[7] === h) return false
    l[0] = a
    l[1] = b
    l[2] = c
    l[3] = d
    l[4] = e
    l[5] = f
    l[6] = g
    l[7] = h
    return true
  }
}
