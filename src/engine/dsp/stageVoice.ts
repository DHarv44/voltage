import { Mode } from './modal'
import { C4, TAU } from './util'

export const TINE = 0
export const REED = 1
const MODES = 3
/** The vibrating part's modes (× the note): a Rhodes-style tine coupled to
 *  its tonebar (the fundamental, a bell partial, a quick metallic tick), and a
 *  Wurlitzer-style reed, a clamped steel bar (the cantilever's own ratios). */
const RATIO = [
  [1, 7.1, 20.1],
  [1, 6.27, 17.55],
]
/** How long each mode rings at C4, seconds to −60 dB (DECAY scales the first),
 *  and how much it loses per octave up. */
const RING = [
  [8, 0.9, 0.06],
  [4, 0.45, 0.05],
]
const RING_PER_OCT = 0.55
/** Felt dampers: how fast each mode dies when the key comes up (s to −60 dB). */
const DAMPED = [0.16, 0.05, 0.03]
/** Mode.tune takes a time constant (to 1/e); −60 dB is 6.9 of them. */
const T60 = 6.9

/** One key of STAGE: the hammer, the tine or reed's modes, the pickup. */
export class StageVoice {
  private readonly modes = [new Mode(), new Mode(), new Mode()]
  /** The note (Hz), how hard it was struck (0..1), model, live or not. */
  f = 0
  vel = 0
  private model = TINE
  live = false
  private flux = 0
  private dc = 0
  /** The damper's thump on release: envelope and low-passed noise. */
  private thump = 0
  private thumpLp = 0

  /** A hammer strike: the modes tuned and set ringing, the upper ones only
   *  as far as the felt's contact time lets them (a soft blow is long and
   *  dull, a hard one short and bright). */
  strike(pitch: number, vel: number, model: number, bell: number, decay: number, fs: number): void {
    this.f = C4 * Math.pow(2, pitch)
    this.vel = vel
    this.model = model
    // the felt's contact time: longer for a soft blow, and shorter up the
    // keyboard (smaller, harder hammers), never more than a third of a cycle
    const contact = Math.min((3.2 - 2.4 * vel) / 1000, 0.33 / this.f) // s
    const life = Math.pow(2, (decay - 0.5) * 3) * Math.pow(2, -pitch * RING_PER_OCT)
    const amp = 0.06 + Math.pow(vel, 1.7) // the swing, in pickup widths (about 25 dB soft to hard)
    for (let k = 0; k < MODES; k++) {
      const hz = this.f * RATIO[model][k]
      const m = this.modes[k]
      m.tune(hz, (k === 0 ? RING[model][0] * life : RING[model][k] * Math.pow(2, -pitch * RING_PER_OCT)) / T60, fs)
      if (hz > fs * 0.45) continue
      const felt = 1 / (1 + Math.pow(hz * contact * 1.6, 4)) // the felt's spectrum
      const share = k === 0 ? 1 : k === 1 ? 0.12 + 0.5 * bell : 0.04 + 0.12 * bell
      m.strike(amp * share * felt) // a ringing tine struck again takes the new blow on top
    }
    if (!this.live) this.primed = false
    this.live = true
  }

  /** The pickup's last reading is from this note (no jump on its first sample). */
  private primed = false

  /** The key comes up: the dampers land (and thump, `thump` 0..1). */
  damp(fs: number, thump: number): void {
    for (let k = 0; k < MODES; k++) this.modes[k].tune(this.f * RATIO[this.model][k], DAMPED[k] / T60, fs)
    this.thump = thump * (0.4 + 0.6 * this.vel)
  }

  /** One sample: what the pickup puts out. `voicing` 0..1. */
  step(voicing: number, fs: number, noise: number, thumpK: number, thumpDecay: number): number {
    if (!this.live) return 0
    const m = this.modes
    const x = m[0].step() + m[1].step() + m[2].step()
    let y: number
    if (this.model === TINE) {
      // magnetic pickup: the flux through the coil falls off either side of
      // the pole; the voltage is its rate of change. Far off centre it's
      // nearly linear (round); swinging near the centre it folds (bark, bell)
      const off = 1.05 - 0.8 * voicing
      const u = x - off
      const flux = 1 / (1 + u * u)
      if (!this.primed) {
        this.flux = 1 / (1 + off * off) // at rest
        this.primed = true
      }
      y = ((flux - this.flux) * fs) / (TAU * this.f) / 0.65
      this.flux = flux
    } else {
      // electrostatic pickup: the reed is one plate of a capacitor, so the
      // voltage goes as 1 / (gap − x): lopsided, nasal, and biting when hard
      const k = 0.35 + 0.5 * voicing
      const xs = Math.max(-0.95, Math.min(0.95, x * 0.85))
      y = xs / (1 - k * xs)
    }
    // the preamp's coupling capacitor: no DC
    this.dc += (y - this.dc) * 0.0015
    y -= this.dc
    if (this.thump > 1e-4) {
      this.thumpLp += (noise - this.thumpLp) * thumpK
      y += this.thumpLp * this.thump * 0.5
      this.thump *= thumpDecay
    }
    if (m[0].energy + m[1].energy + m[2].energy < 1e-9 && this.thump <= 1e-4) {
      this.live = false
      this.flux = this.dc = 0
    }
    return y
  }
}
