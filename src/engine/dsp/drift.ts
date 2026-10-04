import type { Rng } from './util'

const UPDATE = 64

/** Thermal pitch wander of a free-running analog oscillator, in octaves.
 *  A leaky random walk (~2 s correlation) whose depth shrinks as the circuit
 *  warms up, plus a cold-start offset that settles over the first few minutes. */
export class Drift {
  private walk = 0
  private n = 0
  private value = 0
  private readonly a: number
  private readonly b: number
  private readonly coldOffset: number
  private readonly rng: Rng
  private readonly coldCents: number
  private readonly warmCents: number

  constructor(rng: Rng, fs: number, coldCents = 4, warmCents = 1.2, tau = 2) {
    this.rng = rng
    this.coldCents = coldCents
    this.warmCents = warmCents
    this.a = Math.exp(-1 / (tau * (fs / UPDATE)))
    this.b = Math.sqrt(1 - this.a * this.a)
    this.coldOffset = rng.gauss() * 9
  }

  /** age = seconds since this module powered up. */
  next(age: number): number {
    if (this.n-- <= 0) {
      this.n = UPDATE
      this.walk = this.walk * this.a + this.rng.gauss() * this.b
      const cold = Math.exp(-age / 90)
      const depth = this.warmCents + (this.coldCents - this.warmCents) * cold
      this.value = (this.walk * depth + this.coldOffset * cold) / 1200
    }
    return this.value
  }
}
