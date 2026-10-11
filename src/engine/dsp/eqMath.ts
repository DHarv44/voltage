/** EQ's bands and their curve, as plain maths: the engine designs its
 *  filters from these, the screen draws the response from the same numbers. */

export const EQ_BANDS = 4

/** A band's coefficients [b0, b1, b2, a1, a2] (normalised RBJ cookbook):
 *  band 0 a low shelf, 1 and 2 bells, 3 a high shelf. */
export function eqCoefs(band: number, f: number, db: number, q: number, fs: number, out: Float64Array): void {
  const w = (2 * Math.PI * Math.min(f, fs * 0.49)) / fs
  const cs = Math.cos(w)
  const sn = Math.sin(w)
  const A = Math.pow(10, db / 40)
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number
  if (band === 1 || band === 2) {
    const al = sn / (2 * q)
    b0 = 1 + al * A
    b1 = -2 * cs
    b2 = 1 - al * A
    a0 = 1 + al / A
    a1 = -2 * cs
    a2 = 1 - al / A
  } else {
    const k = 2 * Math.sqrt(A) * (sn / 2) * Math.SQRT2
    const s = band === 0 ? 1 : -1
    b0 = A * (A + 1 - s * (A - 1) * cs + k)
    b1 = s * 2 * A * (A - 1 - s * (A + 1) * cs)
    b2 = A * (A + 1 - s * (A - 1) * cs - k)
    a0 = A + 1 + s * (A - 1) * cs + k
    a1 = -s * 2 * (A - 1 + s * (A + 1) * cs)
    a2 = A + 1 + s * (A - 1) * cs - k
  }
  out[0] = b0 / a0
  out[1] = b1 / a0
  out[2] = b2 / a0
  out[3] = a1 / a0
  out[4] = a2 / a0
}

/** A biquad's gain (dB) at `f`. */
export function coefDb(c: Float64Array, f: number, fs: number): number {
  const w = (2 * Math.PI * f) / fs
  const c1 = Math.cos(w)
  const c2 = Math.cos(2 * w)
  const s1 = Math.sin(w)
  const s2 = Math.sin(2 * w)
  const nr = c[0] + c[1] * c1 + c[2] * c2
  const ni = -(c[1] * s1 + c[2] * s2)
  const dr = 1 + c[3] * c1 + c[4] * c2
  const di = -(c[3] * s1 + c[4] * s2)
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di))
}

/** A biquad run sample by sample from coefficients (transposed direct form II). */
export class CoefBiquad {
  readonly c = new Float64Array(5)
  private z1 = 0
  private z2 = 0

  constructor() {
    this.c[0] = 1
  }

  run(x: number): number {
    const c = this.c
    const y = c[0] * x + this.z1
    this.z1 = c[1] * x - c[3] * y + this.z2
    this.z2 = c[2] * x - c[4] * y
    return y
  }
}
