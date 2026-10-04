import type { ModuleSpec } from '../../modules/types'
import { THL } from '../../modules/specs/theremin'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { C4, TAU } from './util'

/** Heterodyne theremin. Two RF oscillators beat against each other; the hand's
 *  capacitance detunes one, and the audible difference tone is the note. That
 *  is modelled directly: the hand sets the difference frequency, which gives the
 *  instrument its feel — far from the rod the pitch falls toward a subsonic
 *  growl, and the notes crowd closer the nearer the hand gets. The detector's
 *  nonlinearity shapes the tone (TIMBRE: pure sine → reedy, cello-like). */
export class ThereminDsp extends Dsp {
  private readonly pTune = this.pi('tune')
  private readonly pRange = this.pi('range')
  private readonly pTimbre = this.pi('timbre')
  private readonly pSnap = this.pi('snap')
  private readonly pVol = this.pi('vol')
  private present = false
  private tp = 0
  private tv = 1
  private hp = 0
  private hv = 1
  private ph = 0
  private amp = 0
  private lp = 0
  private readonly hand: number
  private readonly ampK: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.hand = 1 - Math.exp(-1 / (0.012 * fs)) // the antennas' field has a little inertia
    this.ampK = 1 - Math.exp(-1 / (0.008 * fs))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || ev.name !== 'hand') return
    this.present = ev.down
    if (ev.down) {
      this.tp = Math.min(1, Math.max(0, ev.x))
      this.tv = Math.min(1, Math.max(0, ev.y))
    } else this.tv = 1 // hand comes to rest on the volume loop
  }

  tick(): void {
    const p = this.p
    this.hp += (this.tp - this.hp) * this.hand
    this.hv += (this.tv - this.hv) * this.hand

    // Hand capacitance → octaves above the bottom of the range (denser near the rod).
    let volts = p[this.pTune] - 1 + p[this.pRange] * Math.pow(this.hp, 1.5)
    const snap = p[this.pSnap]
    if (snap > 0) {
      const semis = volts * 12
      const target = Math.round(semis)
      volts = (semis + (target - semis) * snap) / 12
    }
    const f = C4 * Math.pow(2, volts)
    this.ph += f / this.fs
    this.ph -= Math.floor(this.ph)

    // Detector nonlinearity: phase-distorted sine, then a gentle low-pass.
    const t = p[this.pTimbre]
    const s = Math.sin(TAU * this.ph + t * 1.6 * Math.sin(TAU * this.ph)) + t * 0.25 * Math.sin(2 * TAU * this.ph)
    const cut = Math.min(0.9, (f * (2 + t * 10)) / this.fs)
    this.lp += (s - this.lp) * cut

    // Volume loop: closer = quieter (real ones go fully silent at the loop).
    const target = Math.pow(1 - this.hv, 1.6)
    this.amp += (target - this.amp) * this.ampK

    const o = this.out
    o[0] = this.lp * this.amp * 5 * p[this.pVol]
    o[1] = volts
    o[2] = this.amp * 10
    o[3] = this.present && this.amp > 0.05 ? 10 : 0

    const led = this.led
    led[THL.pitchHand] = this.hp
    led[THL.volHand] = this.hv
    led[THL.volts] = volts
    led[THL.level] = this.amp
  }
}
