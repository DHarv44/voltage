import { power } from './power'

/** 0 V on a 1V/oct input = middle C. */
export const C4 = 261.6255653005986
export const TAU = Math.PI * 2

/** Seeded PRNG (mulberry32). Each module instance gets its own reproducible
 *  "component personality": tolerances, drift character, start phase. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed | 0 || 0x2545f491
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  gauss(): number {
    const u = 1 - this.next()
    const v = this.next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)
  }
}

/** Polynomial band-limited step correction for a discontinuity at phase 0. */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

/** Padé tanh, exact at ±3 and clamped beyond. */
export function fastTanh(x: number): number {
  if (x < -3) return -1
  if (x > 3) return 1
  const x2 = x * x
  return (x * (27 + x2)) / (27 + 9 * x2)
}

/** Op-amp output swing: linear until near the ±12 V rails, then a soft knee.
 *  The default ceiling follows the power supply (lower when it sags). */
export function rails(v: number, limit = power.rail): number {
  const a = v < 0 ? -v : v
  const knee = limit - 2
  if (a <= knee) return v
  const s = knee + 2 * fastTanh((a - knee) / 2)
  return v < 0 ? -s : s
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
