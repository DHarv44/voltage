import { SB_DRUMS } from '../../../modules/specs/sketchbook'
import { ClapVoice, HatVoices, KickVoice, Resonator, SnareVoice } from '../drumVoices'
import { TAU, type Rng } from '../util'

const KICK = 0
const SNARE = 1
const CLAP = 2
const CLOSED = 3
const OPEN = 4
const TOM = 5
const RIM = 6
const ZAP = 7

/** SKETCHBOOK's drum kit: eight analog-modelled sounds (the same circuits as
 *  GROOVE-1 and the drum modules), each with TUNE, DECAY, TONE and LEVEL
 *  (0..1 knobs, k[s*4 .. s*4+3]). The hats share one metal source, so the
 *  closed one chokes the open one. */
export class SketchDrums {
  private readonly kick: KickVoice
  private readonly snare: SnareVoice
  private readonly clap: ClapVoice
  private readonly hats: HatVoices
  private readonly tom: KickVoice
  private readonly zap: KickVoice
  private readonly rim = new Resonator()
  private rimClick = 0
  /** Each sound's flash (for the screen). */
  readonly flash = new Float32Array(SB_DRUMS.length)

  constructor(private readonly fs: number, rng: Rng) {
    this.kick = new KickVoice(fs)
    this.snare = new SnareVoice(fs, rng)
    this.clap = new ClapVoice(fs, rng)
    this.hats = new HatVoices(fs, rng)
    this.tom = new KickVoice(fs)
    this.zap = new KickVoice(fs)
  }

  trigger(s: number, vel: number): void {
    switch (s) {
      case KICK:
        this.kick.trigger(vel)
        break
      case SNARE:
        this.snare.trigger(vel)
        break
      case CLAP:
        this.clap.trigger(vel)
        break
      case CLOSED:
        this.hats.triggerClosed(vel)
        break
      case OPEN:
        this.hats.triggerOpen(vel)
        break
      case TOM:
        this.tom.trigger(vel)
        break
      case RIM:
        this.rim.ping(vel)
        this.rimClick = vel
        break
      case ZAP:
        this.zap.trigger(vel)
        break
    }
    this.flash[s] = 1
  }

  private k: Float64Array = new Float64Array(0)
  private base = 0
  private knob(s: number, i: number): number {
    return this.k[this.base + s * 4 + i]
  }
  private level(s: number): number {
    return this.knob(s, 3) * 1.4
  }

  /** One sample of the whole kit (≈ ±1). `k` = the params, `base` where the 32 drum knobs start. */
  step(k: Float64Array, base: number): number {
    const fs = this.fs
    this.k = k
    this.base = base
    let y = 0
    y += this.kick.step(35 + this.knob(KICK, 0) * 60, 0.1 + this.knob(KICK, 1) * 1.2, this.knob(KICK, 2), 0.2) * this.level(KICK)
    y +=
      this.snare.step(140 + this.knob(SNARE, 0) * 200, this.knob(SNARE, 2), 0.4 + this.knob(SNARE, 2) * 0.6, 0.06 + this.knob(SNARE, 1) * 0.4) *
      this.level(SNARE)
    y += this.clap.step(700 + this.knob(CLAP, 2) * 2000, 0.08 + this.knob(CLAP, 1) * 0.6, 0.006 + this.knob(CLAP, 0) * 0.01) * this.level(CLAP)
    this.hats.step(0.6 + this.knob(CLOSED, 0) * 1.2, 0.015 + this.knob(CLOSED, 1) * 0.15, 0.1 + this.knob(OPEN, 1) * 1.2, 5000 + this.knob(CLOSED, 2) * 6000)
    y += this.hats.ch * this.level(CLOSED) * 0.7 + this.hats.oh * this.level(OPEN) * 0.7
    y += this.tom.step(80 + this.knob(TOM, 0) * 220, 0.1 + this.knob(TOM, 1) * 0.8, 0.15 + this.knob(TOM, 2) * 0.4, 0.1) * this.level(TOM)
    // rim: a high woody ping and a click
    const rimF = 1200 + this.knob(RIM, 0) * 1400
    const rimR = Math.exp(-4.6 / ((0.02 + this.knob(RIM, 1) * 0.1) * fs))
    y += (this.rim.step((TAU * rimF) / fs, rimR) + this.rimClick * (this.knob(RIM, 2) - 0.3)) * this.level(RIM) * 0.8
    this.rimClick *= 0.7
    // zap: a kick pitched way up with all the sweep it's got (the laser)
    y += this.zap.step(150 + this.knob(ZAP, 0) * 700, 0.05 + this.knob(ZAP, 1) * 0.5, 0.6 + this.knob(ZAP, 2) * 0.4, 0.3) * this.level(ZAP) * 0.7
    for (let s = 0; s < this.flash.length; s++) this.flash[s] *= 0.9995
    return y
  }
}
