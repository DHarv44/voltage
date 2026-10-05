import type { ModuleSpec } from '../../modules/types'
import { ORBITL, PLANETS } from '../../modules/specs/orbit'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { TAU } from './util'

const CTRL = 16
/** Orbital period of a planet at radius 1, at SPEED 1 (seconds). */
const T1 = 4
const GATE_S = 0.005
const CONJ_RAD = 0.05

/** Kepler orbits: mean anomaly advances uniformly, Kepler's equation gives the
 *  eccentric anomaly, and from that the planet's true angle and distance. */
export class OrbitDsp extends Dsp {
  private readonly iSpeed = this.ii('speed')
  private readonly iReset = this.ii('reset')
  private readonly pPlanets = this.pi('planets')
  private readonly pSpeed = this.pi('speed')
  private readonly pEcc = this.pi('ecc')
  private readonly pR: number[]
  private readonly M = new Float64Array(PLANETS)
  private readonly lon = new Float64Array(PLANETS)
  /** Each orbit's periapsis points a different way. */
  private readonly peri: number[]
  private readonly gate = new Int32Array(PLANETS)
  private conj = 0
  private conjArmed = true
  private readonly reset = new Schmitt()
  private n = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.pR = Array.from({ length: PLANETS }, (_, i) => this.pi(`r${i + 1}`))
    this.peri = Array.from({ length: PLANETS }, () => this.rng.next() * TAU)
    for (let i = 0; i < PLANETS; i++) this.M[i] = this.rng.next() * TAU
  }

  private step(dt: number): void {
    const p = this.p
    const count = Math.round(p[this.pPlanets])
    const speed = p[this.pSpeed] * Math.pow(2, this.in[this.iSpeed])
    const e = p[this.pEcc]
    if (this.reset.rise(this.in[this.iReset])) this.M.fill(0)
    for (let i = 0; i < count; i++) {
      const a = p[this.pR[i]]
      this.M[i] = (this.M[i] + (TAU * dt * speed) / (T1 * Math.pow(a, 1.5))) % TAU
      let E = this.M[i]
      for (let k = 0; k < 4; k++) E -= (E - e * Math.sin(E) - this.M[i]) / (1 - e * Math.cos(E))
      const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
      const r = a * (1 - e * Math.cos(E))
      const lon = (((nu + this.peri[i]) % TAU) + TAU) % TAU
      if (lon < this.lon[i] - Math.PI) {
        this.gate[i] = Math.round(GATE_S * this.fs) // wrapped past 12 o'clock
        this.led[ORBITL.flash + i] = 1
      }
      this.lon[i] = lon
      // screen space: 12 o'clock is up, orbits run clockwise
      this.led[ORBITL.pos + i * 2] = Math.sin(lon) * r
      this.led[ORBITL.pos + i * 2 + 1] = -Math.cos(lon) * r
    }
    for (let i = count; i < PLANETS; i++) this.led[ORBITL.pos + i * 2] = 9
    // Conjunction: any two planets lined up with the star.
    let aligned = false
    for (let i = 0; i < count; i++)
      for (let j = i + 1; j < count; j++) {
        let d = Math.abs(this.lon[i] - this.lon[j])
        if (d > Math.PI) d = TAU - d
        if (d < CONJ_RAD) aligned = true
      }
    if (aligned && this.conjArmed) {
      this.conj = Math.round(GATE_S * this.fs)
      this.led[ORBITL.conj] = 1
    }
    this.conjArmed = !aligned
  }

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      this.step(CTRL / this.fs)
    }
    const o = this.out
    for (let i = 0; i < PLANETS; i++) {
      o[i] = this.gate[i] > 0 ? 10 : 0
      if (this.gate[i] > 0) this.gate[i]--
      this.led[ORBITL.flash + i] *= 0.9995
    }
    o[PLANETS] = this.conj > 0 ? 10 : 0
    if (this.conj > 0) this.conj--
    this.led[ORBITL.conj] *= 0.9995
    o[PLANETS + 1] = this.led[ORBITL.pos] * 5
    o[PLANETS + 2] = -this.led[ORBITL.pos + 1] * 5
  }
}
