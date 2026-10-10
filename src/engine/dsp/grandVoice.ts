import type { GrandModel } from '../../modules/specs/grand'
import type { Rng } from './util'
import { C4, TAU } from './util'

/** Most modes a note can hold (partials, plus extra strings on the low ones). */
const MAXM = 48
/** The lowest partials ring on every string of the note (that's where the
 *  unison beating and the two-stage decay are heard); higher ones on one. */
const SHARED = 5
/** Each string of a unison: how far it's detuned (× UNISON cents), its share
 *  of the blow, and how long it rings (× the note's ring): one string carries
 *  the long aftersound, the others give most of the prompt sound and die
 *  sooner, so a note falls fast and then sings on. */
const STRING_DETUNE = [0, 1, -0.75]
const STRING_SHARE = [0.25, 0.45, 0.3]
const STRING_RING = [1.6, 0.32, 0.45]
/** Where the hammer hits the string (fraction of its length): the partials
 *  with a node there are barely struck. */
const STRIKE_AT = 0.122
/** Above this (octaves over C4, about F#6) the strings have no dampers. */
const NO_DAMPERS = 2.5
/** Mode.tune-style decay is a time constant; −60 dB is 6.9 of them. */
const T60 = 6.9
/** Check which modes have died away this often (samples). */
const CULL = 256

/** One key of GRAND: its strings' partials as rotating phasors (no sin() per
 *  sample), a felt hammer, its damper, and the action's knock. */
export class GrandVoice {
  private readonly re = new Float64Array(MAXM)
  private readonly im = new Float64Array(MAXM)
  private readonly c = new Float64Array(MAXM)
  private readonly s = new Float64Array(MAXM)
  /** Per-sample decay: ringing (held), and once the damper's down. */
  private readonly g = new Float64Array(MAXM)
  private readonly gDamped = new Float64Array(MAXM)
  private readonly on = new Uint8Array(MAXM)
  private n = 0
  private cull = 0
  private knock = 0
  private knockLp = 0
  live = false
  pitch = 0
  vel = 0

  /** A blow of the hammer (`soft`: the una corda, one string fewer and a
   *  softer part of the felt). */
  strike(pitch: number, vel: number, soft: boolean, m: GrandModel, bright: number, decay: number, unison: number, knock: number, fs: number, rng: Rng): void {
    const again = this.live && Math.abs(pitch - this.pitch) < 1e-3
    this.pitch = pitch
    this.vel = vel
    const f = C4 * Math.pow(2, pitch)
    const B = m.b4 * Math.pow(2, pitch * (pitch > 0 ? m.bPerOct : 0.25))
    let strings = pitch < -2.3 ? 1 : pitch < -1.25 ? 2 : 3
    if (soft) strings = Math.max(1, strings - 1)
    const partials = Math.max(5, Math.min(36, Math.round(36 * Math.pow(2, -Math.max(0, pitch + 2) * 0.6))))
    // the felt: a soft blow is long and dull, a hard one short and bright
    // (felt stiffens as it's squeezed), and up the keys hammers are smaller
    const contact = Math.min((4.5 - 3.5 * vel) / 1000, 1.2 / f) * (1.25 - 0.7 * bright) * (soft ? 1.3 : 1)
    const steep = 1.5 + 2 * vel
    // the bass speaks loudest and the treble softest on a real piano, but not by this much
    const register = Math.pow(2, pitch * (pitch > 0 ? 0.3 : 0.22))
    const blow = (0.03 + Math.pow(vel, 1.4)) * (soft ? 0.7 : 1) * register
    // how long it rings: low strings for ages, high ones briefly
    const ring1 = m.ring * Math.pow(2, (decay - 0.5) * 2.5) * Math.pow(2, -pitch * 0.45)
    const damped = 0.15 + 0.3 * Math.max(0, -pitch) / 3
    const cents = unison * 2 * m.unison
    let k = 0
    for (let p = 1; p <= partials && k < MAXM; p++) {
      const fp = f * p * Math.sqrt(1 + B * p * p)
      if (fp > fs * 0.45) break
      const comb = Math.abs(Math.sin(Math.PI * p * STRIKE_AT))
      const felt = 1 / (1 + Math.pow(fp * contact * 0.5, steep))
      const amp = (blow * comb * felt) / Math.pow(p, 0.7)
      const t = ring1 / (1 + Math.pow(fp / 1800, 2) * 0.9)
      const copies = p <= SHARED ? strings : 1
      for (let j = 0; j < copies && k < MAXM; j++, k++) {
        const hz = fp * Math.pow(2, (cents * (copies > 1 ? STRING_DETUNE[j] : 0) + (rng.next() - 0.5) * 0.3) / 1200)
        const w = (TAU * hz) / fs
        this.c[k] = Math.cos(w)
        this.s[k] = Math.sin(w)
        this.g[k] = Math.exp(-T60 / (Math.max(0.02, t * (copies > 1 ? STRING_RING[j] : 1)) * fs))
        this.gDamped[k] = pitch > NO_DAMPERS ? this.g[k] : Math.exp(-T60 / (damped * fs))
        // a key struck again while it rings takes the new blow on top
        if (!again) this.re[k] = this.im[k] = 0
        this.re[k] += amp * (copies > 1 ? STRING_SHARE[j] * (3 / copies) : 1)
        this.on[k] = 1
      }
    }
    for (let j = k; j < this.n; j++) this.on[j] = 0
    this.n = k
    this.knock = knock * (0.3 + 0.7 * vel)
    this.live = true
  }

  /** The key comes up: the damper lands (the top strings have none). */
  damp(): void {
    for (let k = 0; k < this.n; k++) this.g[k] = this.gDamped[k]
  }

  /** One sample of the strings at the bridge, plus the action's knock. */
  step(noise: number, knockK: number, knockDecay: number): number {
    if (!this.live) return 0
    let y = 0
    for (let k = 0; k < this.n; k++) {
      if (!this.on[k]) continue
      const g = this.g[k]
      const re = (this.re[k] * this.c[k] - this.im[k] * this.s[k]) * g
      const im = (this.re[k] * this.s[k] + this.im[k] * this.c[k]) * g
      this.re[k] = re
      this.im[k] = im
      y += im
    }
    if (this.knock > 1e-4) {
      this.knockLp += (noise - this.knockLp) * knockK
      y += this.knockLp * this.knock
      this.knock *= knockDecay
    }
    // now and then: drop the modes that have died away (and the voice, once all have)
    if (++this.cull >= CULL) {
      this.cull = 0
      let any = this.knock > 1e-4
      for (let k = 0; k < this.n; k++) {
        if (!this.on[k]) continue
        if (this.re[k] * this.re[k] + this.im[k] * this.im[k] < 1e-12) this.on[k] = 0
        else any = true
      }
      if (!any) this.live = false
    }
    return y
  }
}
