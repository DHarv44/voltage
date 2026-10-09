import type { ModuleSpec } from '../../modules/types'
import { POCKET_STEPS, POCKETL } from '../../modules/specs/pocket'
import { patPre, POCKET_PATTERNS } from '../../modules/specs/pocketShared'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'
import { PocketFx } from './pocketFx'
import { PocketSong } from './pocketSong'

export const DRUM_SOUNDS = 8

/** A drum POCKET's brain: a 16-step sequencer (its own tempo with swing, or
 *  one step per CLK edge) firing eight sounds, each step able to lock the
 *  sound's A / B knobs; patterns A–D chained into a song, and the punch-in
 *  effects on the output. Subclasses are the kits: `strike` starts a sound
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
  /** Each pattern's step masks (pattern × sound) and where its locks start. */
  private readonly pM: Int32Array
  private readonly pLock: Int32Array
  /** Current A/B for each sound (knob or this step's lock). */
  protected readonly a = new Float64Array(DRUM_SOUNDS).fill(0.5)
  protected readonly b = new Float64Array(DRUM_SOUNDS).fill(0.5)
  private readonly clock: PocketClock
  private readonly song: PocketSong
  private readonly fx: PocketFx

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.pA = Int32Array.from({ length: DRUM_SOUNDS }, (_, s) => this.pi(`a${s}`))
    this.pB = Int32Array.from({ length: DRUM_SOUNDS }, (_, s) => this.pi(`b${s}`))
    const pats = POCKET_PATTERNS.length
    this.pM = Int32Array.from({ length: pats * DRUM_SOUNDS }, (_, k) => this.pi(`${patPre(Math.floor(k / DRUM_SOUNDS))}m${k % DRUM_SOUNDS}`))
    this.pLock = Int32Array.from({ length: pats }, (_, k) => this.pi(`${patPre(k)}la0_0`)) // locks are laid out a,b per step, per sound
    this.clock = new PocketClock(POCKET_STEPS, fs)
    this.song = new PocketSong((id) => this.pi(id))
    this.fx = new PocketFx(fs)
  }

  /** Start sound s at `vel` (its A/B are already in `a[s]` / `b[s]`). */
  protected abstract strike(s: number, vel: number): void
  /** One sample of the kit (about ±1). */
  protected abstract render(): number

  private lock(s: number, i: number, ab: 0 | 1): number {
    return this.p[this.pLock[this.song.playing] + (s * POCKET_STEPS + i) * 2 + ab]
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
    if (this.fx.onUi(ev)) return
    if (ev.kind === 'surface' && ev.name === 'hit' && ev.down) this.fire(Math.max(0, Math.min(DRUM_SOUNDS - 1, Math.round(ev.x))), -1, 0.9)
  }

  tick(): void {
    const p = this.p
    const c = this.clock
    const stepped = c.tick(p[this.pRun] >= 0.5, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], p[this.pSwing], this.in[this.iRst])
    if (c.restarted) this.song.reset()
    if (stepped) {
      if (c.step === 0) this.song.bar(p)
      const bit = 1 << c.step
      const m0 = this.song.playing * DRUM_SOUNDS
      for (let s = 0; s < DRUM_SOUNDS; s++) if (p[this.pM[m0 + s]] & bit) this.fire(s, c.step)
    }

    this.out[0] = this.fx.process(Math.tanh(this.render() * 0.9) * 5 * p[this.pVol], c.sixteenth)
    this.out[1] = c.clkSample()
    this.out[this.oRst] = c.rstSample()
    this.led[POCKETL.step] = c.step
    for (let s = 0; s < DRUM_SOUNDS; s++) this.led[POCKETL.hit0 + s] *= 0.9996
    this.song.leds(this.led, POCKETL.song, this.fx.held)
  }
}
