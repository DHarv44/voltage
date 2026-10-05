import type { ModuleSpec } from '../../modules/types'
import { STYLO_KEYS, STYLOL } from '../../modules/specs/stylophone'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Biquad } from './biquad'
import { C4, polyBlep, TAU } from './util'

/** Stylus organ. A relaxation oscillator (ramp charge, sudden discharge)
 *  through a tiny speaker: strong upper mids, almost no bass. Each key is a
 *  trimmer resistor, so tuning is a little off key to key, like the original. */
export class StylophoneDsp extends Dsp {
  private readonly pTune = this.pi('tune')
  private readonly pOct = this.pi('octave')
  private readonly pVib = this.pi('vib')
  private readonly pLevel = this.pi('level')
  private readonly trim: number[]
  private key = -1
  private ph = 0
  private vib = 0
  private amp = 0
  private readonly spkHp: Biquad
  private readonly spkPeak: Biquad
  private readonly spkLp: Biquad
  private readonly contact: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.trim = STYLO_KEYS.map(() => this.rng.gauss() * 0.004)
    this.spkHp = new Biquad(fs).highpass(450, 0.8)
    this.spkPeak = new Biquad(fs).peak(1800, 1.5, 6)
    this.spkLp = new Biquad(fs).lowpass(6000, 0.7)
    this.contact = 1 - Math.exp(-1 / (0.002 * fs))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'stylus') this.key = ev.down ? Math.max(0, Math.min(STYLO_KEYS.length - 1, Math.round(ev.x))) : -1
  }

  tick(): void {
    const p = this.p
    const on = this.key >= 0
    this.amp += ((on ? 1 : 0) - this.amp) * this.contact
    if (on) {
      this.vib = (this.vib + 5.5 / this.fs) % 1
      const vib = p[this.pVib] >= 0.5 ? 0.012 * Math.sin(TAU * this.vib) : 0
      const volts = (STYLO_KEYS[this.key] + p[this.pTune]) / 12 + (Math.round(p[this.pOct]) - 1) + this.trim[this.key]
      const dt = (C4 * Math.pow(2, volts + vib)) / this.fs
      this.ph = (this.ph + dt) % 1
      this.out[1] = volts
    }
    // ramp up as the cap charges, snap back on discharge (band-limited)
    const ramp = on || this.amp > 1e-4 ? 2 * this.ph - 1 - polyBlep(this.ph, 0.005) : 0
    const y = this.spkLp.run(this.spkPeak.run(this.spkHp.run(ramp * this.amp)))
    this.out[0] = Math.tanh(y * 1.6) * 5 * p[this.pLevel]
    this.out[2] = on ? 10 : 0
    this.led[STYLOL.key] = this.key
  }
}
