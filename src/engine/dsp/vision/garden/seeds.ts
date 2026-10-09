import { GARDEN_SEEDS, SEED_VALUES } from '../../../../modules/specs/garden'
import type { Rng } from '../../util'

/** Longest a seed stays aloft (s) before it's counted lost. */
const MAX_FLIGHT = 40

/** Dandelion seeds on the wind. Each one rides its parachute: it sinks slowly,
 *  catches updrafts, and goes where the wind goes. Where it comes down a new
 *  dandelion can take root, so they spread across the bed by themselves. */
export class Seeds {
  private readonly x = new Float32Array(GARDEN_SEEDS)
  private readonly y = new Float32Array(GARDEN_SEEDS).fill(-1)
  private readonly z = new Float32Array(GARDEN_SEEDS)
  private readonly vx = new Float32Array(GARDEN_SEEDS)
  private readonly vy = new Float32Array(GARDEN_SEEDS)
  private readonly age = new Float32Array(GARDEN_SEEDS)
  /** Landed this tick (x), for the garden to plant; −1 = none. */
  readonly landed = new Float32Array(GARDEN_SEEDS).fill(-1)

  constructor(private readonly rng: Rng) {}

  /** No seeds in the air. */
  reset(): void {
    this.y.fill(-1)
    this.landed.fill(-1)
  }

  /** Let one go from a dandelion's head; false if the air is full. */
  launch(x: number, y: number, z: number): boolean {
    for (let k = 0; k < GARDEN_SEEDS; k++) {
      if (this.y[k] >= 0) continue
      this.x[k] = x
      this.y[k] = y
      this.z[k] = z
      this.vx[k] = 0
      this.vy[k] = 0.05
      this.age[k] = 0
      return true
    }
    return false
  }

  /** `wind`: the garden's gust (−1..1, + = to the right). */
  step(dt: number, wind: number): void {
    const e = 1 - Math.exp(-dt / 0.8)
    for (let k = 0; k < GARDEN_SEEDS; k++) {
      this.landed[k] = -1
      if (this.y[k] < 0) continue
      // x is across the bed (0..1), y height in scene units
      this.vx[k] += (wind * 0.09 + 0.01 + this.rng.gauss() * 0.05 - this.vx[k]) * e
      this.vy[k] += (-0.035 + this.rng.gauss() * 0.06 + Math.abs(wind) * 0.01 - this.vy[k]) * e
      this.x[k] += this.vx[k] * dt
      this.y[k] += this.vy[k] * dt
      this.z[k] += this.rng.gauss() * 0.02 * dt
      this.age[k] += dt
      if (this.y[k] <= 0.01) {
        if (this.x[k] > 0.03 && this.x[k] < 0.97) this.landed[k] = this.x[k]
        this.y[k] = -1
      } else if (this.x[k] < -0.2 || this.x[k] > 1.2 || this.age[k] > MAX_FLIGHT) this.y[k] = -1 // blown away
    }
  }

  /** The highest seed in the air (scene units; 0 with none aloft). */
  highest(): number {
    let h = 0
    for (let k = 0; k < GARDEN_SEEDS; k++) if (this.y[k] > h) h = this.y[k]
    return h
  }

  publish(led: Float32Array, base: number): void {
    for (let k = 0; k < GARDEN_SEEDS; k++) {
      const o = base + k * SEED_VALUES
      led[o] = this.x[k]
      led[o + 1] = this.y[k]
      led[o + 2] = this.z[k]
    }
  }
}
