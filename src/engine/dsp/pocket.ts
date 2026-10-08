import type { ModuleSpec } from '../../modules/types'
import { POCKET_SOUNDS, POCKET_STEPS, POCKETL } from '../../modules/specs/pocket'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { ClapVoice, HatVoices, KickVoice, SnareVoice, Svf } from './drumVoices'
import { TAU } from './util'

const N = POCKET_SOUNDS.length

/** Pocket groovebox engine: a 16-step sequencer driving eight small voices,
 *  with each step able to override the sound's A/B knobs (parameter locks). */
export class PocketDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oRst = this.oi('rsto')
  private readonly pTempo = this.pi('tempo')
  private readonly pSwing = this.pi('swing')
  private readonly pVol = this.pi('vol')
  private readonly pRun = this.pi('run')
  private readonly pA: number[]
  private readonly pB: number[]
  private readonly pM: number[]
  private readonly pLock: number
  private readonly kick: KickVoice
  private readonly snare: SnareVoice
  private readonly clap: ClapVoice
  private readonly hats: HatVoices
  private readonly tom: KickVoice
  private readonly zapF = new Svf()
  /** Current A/B for each sound (knob or this step's lock). */
  private readonly a = new Float64Array(N).fill(0.5)
  private readonly b = new Float64Array(N).fill(0.5)
  private blipPh = 0
  private blipEnv = 0
  private zapEnv = 0
  private zapT = 0
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private step = -1
  private ph = 1
  private clkOut = 0
  private rstOut = 0
  private wasRunning = false

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.pA = POCKET_SOUNDS.map((_, s) => this.pi(`a${s}`))
    this.pB = POCKET_SOUNDS.map((_, s) => this.pi(`b${s}`))
    this.pM = POCKET_SOUNDS.map((_, s) => this.pi(`m${s}`))
    this.pLock = this.pi('la0_0') // locks are laid out a,b per step, per sound
    this.kick = new KickVoice(fs)
    this.snare = new SnareVoice(fs, this.rng)
    this.clap = new ClapVoice(fs, this.rng)
    this.hats = new HatVoices(fs, this.rng)
    this.tom = new KickVoice(fs)
  }

  private lock(s: number, i: number, ab: 0 | 1): number {
    return this.p[this.pLock + (s * POCKET_STEPS + i) * 2 + ab]
  }

  /** Fire sound s, using step i's locks if it has any (i = −1: live hit). */
  private fire(s: number, i: number, vel = 1): void {
    const la = i >= 0 ? this.lock(s, i, 0) : -1
    const lb = i >= 0 ? this.lock(s, i, 1) : -1
    this.a[s] = la >= 0 ? la : this.p[this.pA[s]]
    this.b[s] = lb >= 0 ? lb : this.p[this.pB[s]]
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
    this.led[POCKETL.hit0 + s] = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'hit' && ev.down) this.fire(Math.max(0, Math.min(N - 1, Math.round(ev.x))), -1, 0.9)
  }

  private advance(): void {
    this.step = (this.step + 1) % POCKET_STEPS
    const bit = 1 << this.step
    for (let s = 0; s < N; s++) if (this.p[this.pM[s]] & bit) this.fire(s, this.step)
    this.clkOut = Math.round(0.005 * this.fs)
  }

  tick(): void {
    const p = this.p
    const running = p[this.pRun] >= 0.5
    // starting, or RST: back before step 1 (and tell followers: RST out)
    if ((running && !this.wasRunning) || this.rst.rise(this.in[this.iRst])) {
      this.step = -1
      this.ph = 1
      this.rstOut = Math.round(0.003 * this.fs)
    }
    this.wasRunning = running
    if (running) {
      if (this.patched[this.iClk]) {
        if (this.clk.rise(this.in[this.iClk])) this.advance()
      } else {
        // 16ths; odd steps land late by SWING
        const sixteenth = 60 / p[this.pTempo] / 4
        const len = sixteenth * (this.step % 2 === 0 ? 1 + p[this.pSwing] : 1 - p[this.pSwing])
        this.ph += 1 / this.fs / len
        if (this.ph >= 1) {
          this.ph -= 1
          this.advance()
        }
      }
    } else this.step = -1

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
    this.out[0] = Math.tanh(y * 0.9) * 5 * p[this.pVol]
    this.out[1] = this.clkOut > 0 ? 10 : 0
    if (this.clkOut > 0) this.clkOut--
    this.out[this.oRst] = this.rstOut > 0 ? 10 : 0
    if (this.rstOut > 0) this.rstOut--
    this.led[POCKETL.step] = this.step
    for (let s = 0; s < N; s++) this.led[POCKETL.hit0 + s] *= 0.9996
  }
}
