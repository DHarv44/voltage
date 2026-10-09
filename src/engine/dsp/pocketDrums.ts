import type { ModuleSpec } from '../../modules/types'
import { POCKET_STEPS, POCKETL } from '../../modules/specs/pocket'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'

export const DRUM_SOUNDS = 8

/** A drum POCKET's brain: a 16-step sequencer (its own tempo with swing, or
 *  one step per CLK edge) firing eight sounds, each step able to lock the
 *  sound's A / B knobs. Subclasses are the kits: `strike` starts a sound
 *  (with its A / B in `a` / `b`), `render` is one sample of everything. */
export abstract class DrumPocketDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oRst = this.oi('rsto')
  private readonly pTempo = this.pi('tempo')
  private readonly pSwing = this.pi('swing')
  private readonly pVol = this.pi('vol')
  private readonly pRun = this.pi('run')
  private readonly pA: Int32Array
  private readonly pB: Int32Array
  private readonly pM: Int32Array
  private readonly pLock: number
  /** Current A/B for each sound (knob or this step's lock). */
  protected readonly a = new Float64Array(DRUM_SOUNDS).fill(0.5)
  protected readonly b = new Float64Array(DRUM_SOUNDS).fill(0.5)
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private step = -1
  private ph = 1
  private clkOut = 0
  private rstOut = 0
  private wasRunning = false

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.pA = Int32Array.from({ length: DRUM_SOUNDS }, (_, s) => this.pi(`a${s}`))
    this.pB = Int32Array.from({ length: DRUM_SOUNDS }, (_, s) => this.pi(`b${s}`))
    this.pM = Int32Array.from({ length: DRUM_SOUNDS }, (_, s) => this.pi(`m${s}`))
    this.pLock = this.pi('la0_0') // locks are laid out a,b per step, per sound
  }

  /** Start sound s at `vel` (its A/B are already in `a[s]` / `b[s]`). */
  protected abstract strike(s: number, vel: number): void
  /** One sample of the kit (about ±1). */
  protected abstract render(): number

  private lock(s: number, i: number, ab: 0 | 1): number {
    return this.p[this.pLock + (s * POCKET_STEPS + i) * 2 + ab]
  }

  /** Fire sound s, using step i's locks if it has any (i = −1: live hit). */
  private fire(s: number, i: number, vel = 1): void {
    const la = i >= 0 ? this.lock(s, i, 0) : -1
    const lb = i >= 0 ? this.lock(s, i, 1) : -1
    this.a[s] = la >= 0 ? la : this.p[this.pA[s]]
    this.b[s] = lb >= 0 ? lb : this.p[this.pB[s]]
    this.strike(s, vel)
    this.led[POCKETL.hit0 + s] = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'hit' && ev.down) this.fire(Math.max(0, Math.min(DRUM_SOUNDS - 1, Math.round(ev.x))), -1, 0.9)
  }

  private advance(): void {
    this.step = (this.step + 1) % POCKET_STEPS
    const bit = 1 << this.step
    for (let s = 0; s < DRUM_SOUNDS; s++) if (this.p[this.pM[s]] & bit) this.fire(s, this.step)
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

    this.out[0] = Math.tanh(this.render() * 0.9) * 5 * p[this.pVol]
    this.out[1] = this.clkOut > 0 ? 10 : 0
    if (this.clkOut > 0) this.clkOut--
    this.out[this.oRst] = this.rstOut > 0 ? 10 : 0
    if (this.rstOut > 0) this.rstOut--
    this.led[POCKETL.step] = this.step
    for (let s = 0; s < DRUM_SOUNDS; s++) this.led[POCKETL.hit0 + s] *= 0.9996
  }
}
