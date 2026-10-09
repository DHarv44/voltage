import type { ModuleSpec } from '../../modules/types'
import { ClapVoice, HatVoices, KickVoice, SnareVoice, Svf } from './drumVoices'
import { DrumPocketDsp } from './pocketDrums'
import { TAU } from './util'

/** POCKET's kit: kick, snare, clap, closed and open hats, tom, an FM blip and
 *  a filtered-noise zap. A is each sound's pitch, B its decay. */
export class PocketDsp extends DrumPocketDsp {
  private readonly kick: KickVoice
  private readonly snare: SnareVoice
  private readonly clap: ClapVoice
  private readonly hats: HatVoices
  private readonly tom: KickVoice
  private readonly zapF = new Svf()
  private blipPh = 0
  private blipEnv = 0
  private zapEnv = 0
  private zapT = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.kick = new KickVoice(fs)
    this.snare = new SnareVoice(fs, this.rng)
    this.clap = new ClapVoice(fs, this.rng)
    this.hats = new HatVoices(fs, this.rng)
    this.tom = new KickVoice(fs)
  }

  protected strike(s: number, vel: number): void {
    if (s === 0) this.kick.trigger(vel)
    else if (s === 1) this.snare.trigger(vel)
    else if (s === 2) this.clap.trigger(vel)
    else if (s === 3) this.hats.triggerClosed(vel)
    else if (s === 4) this.hats.triggerOpen(vel)
    else if (s === 5) this.tom.trigger(vel)
    else if (s === 6) {
      this.blipEnv = vel
      this.blipPh = 0
    } else {
      this.zapEnv = vel
      this.zapT = 0
    }
  }

  protected render(): number {
    const a = this.a
    const b = this.b
    let y = 0
    y += this.kick.step(40 + a[0] * 80, 0.1 + b[0] * 0.9, 0.6, 0.25)
    y += this.snare.step(150 + a[1] * 150, 0.5, 0.75, 0.05 + b[1] * 0.3) * 0.7
    y += this.clap.step(800 + a[2] * 2000, 0.05 + b[2] * 0.5, 0.011) * 0.7
    this.hats.step(0.6 + a[3] * 0.8, 0.02 + b[3] * 0.12, 0.1 + b[4] * 0.8, 6000 + a[4] * 4000)
    y += (this.hats.ch + this.hats.oh) * 0.5
    y += this.tom.step(80 + a[5] * 200, 0.1 + b[5] * 0.6, 0.3, 0) * 0.8
    if (this.blipEnv > 1e-4) {
      const f = 220 * Math.pow(2, a[6] * 3 - 1)
      this.blipPh = (this.blipPh + f / this.fs) % 1
      y += Math.sin(TAU * this.blipPh + 0.8 * Math.sin(TAU * this.blipPh * 2)) * this.blipEnv * 0.5
      this.blipEnv *= Math.exp(-1 / ((0.03 + b[6] * 0.6) * this.fs))
    }
    if (this.zapEnv > 1e-4) {
      this.zapT += 1 / this.fs
      const dec = 0.04 + b[7] * 0.4
      const fc = 200 + (2000 + a[7] * 8000) * Math.exp(-this.zapT / (dec * 0.5))
      this.zapF.process((this.rng.next() * 2 - 1) * this.zapEnv, fc, 0.15, this.fs)
      y += this.zapF.bp * 1.5
      this.zapEnv *= Math.exp(-1 / (dec * this.fs))
    }
    return y
  }
}
