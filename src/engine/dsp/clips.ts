import { CL_LAUNCH, CL_SCENE, CL_SCENES, CL_STEPS, CL_STOP, CL_TIE, CL_TRACKS, CLL } from '../../modules/specs/clips'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'

const RETRIG_S = 0.002

/** CLIPS: one bar of sixteen steps going round; each track plays its clip
 *  (PLAYING, kept with the patch) and a launched clip (or STOP) waits for
 *  the next bar, like a session view. A step's note sounds for GATE of the
 *  step; a TIE carries the note on without a new gate. */
export class ClipsDsp extends Dsp {
  private readonly I = { clk: this.ii('clk'), rst: this.ii('rst'), scv: this.ii('scv') }
  private readonly oP = Int32Array.from({ length: CL_TRACKS }, (_, t) => this.oi(`p${t + 1}`))
  private readonly oG = Int32Array.from({ length: CL_TRACKS }, (_, t) => this.oi(`g${t + 1}`))
  private readonly P = { tempo: this.pi('tempo'), run: this.pi('run'), gl: this.pi('gl') }
  private readonly pOct = Int32Array.from({ length: CL_TRACKS }, (_, t) => this.pi(`oct${t}`))
  private readonly pPl = Int32Array.from({ length: CL_TRACKS }, (_, t) => this.pi(`pl${t}`))
  /** Track t's first step param (clip c, step s at + c × 16 + s). */
  private readonly pStep = Int32Array.from({ length: CL_TRACKS }, (_, t) => this.pi(`n${t}0_0`))
  private readonly clock: PocketClock
  /** Per track: the clip cued (−2 none, −1 stop), the gate's samples left, held by a tie. */
  private readonly cued = new Int8Array(CL_TRACKS).fill(-2)
  private readonly gate = new Int32Array(CL_TRACKS)
  private readonly tied = new Uint8Array(CL_TRACKS)
  private readonly low = new Int32Array(CL_TRACKS)
  private step = -1
  private sceneWas = -1

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.clock = new PocketClock(CL_STEPS, this.fs)
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || ev.name !== 'clips' || !ev.down) return
    const now = this.step < 0
    const cue = (t: number, c: number) => {
      if (now) this.writeParam(this.pPl[t], c)
      else this.cued[t] = c
    }
    if (ev.y === CL_LAUNCH) cue(Math.floor(ev.x / CL_SCENES), ev.x % CL_SCENES)
    else if (ev.y === CL_STOP) cue(ev.x, -1)
    else if (ev.y === CL_SCENE) for (let t = 0; t < CL_TRACKS; t++) cue(t, ev.x)
  }

  tick(): void {
    const p = this.p
    const running = p[this.P.run] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.I.clk] === 1, this.in[this.I.clk], p[this.P.tempo], 0, this.in[this.I.rst])
    if (c.restarted || !running) {
      this.step = -1
      this.gate.fill(0)
      this.tied.fill(0)
    }
    // SCENE CV: 0–10 V across the four scenes, cued for the bar
    if (this.patched[this.I.scv]) {
      const s = Math.max(0, Math.min(CL_SCENES - 1, Math.floor(this.in[this.I.scv] / 2.5)))
      if (s !== this.sceneWas) {
        this.sceneWas = s
        for (let t = 0; t < CL_TRACKS; t++) this.cued[t] = s
      }
    }
    if (stepped) {
      this.step = (this.step + 1) % CL_STEPS
      if (this.step === 0)
        for (let t = 0; t < CL_TRACKS; t++)
          if (this.cued[t] > -2) {
            this.writeParam(this.pPl[t], this.cued[t])
            this.cued[t] = -2
          }
      const len = Math.round(c.stepLen * this.fs * p[this.P.gl])
      for (let t = 0; t < CL_TRACKS; t++) {
        const clip = Math.round(p[this.pPl[t]])
        if (clip < 0) {
          this.tied[t] = 0
          continue
        }
        const n = Math.round(p[this.pStep[t] + clip * CL_STEPS + this.step])
        if (n === CL_TIE) continue
        this.tied[t] = 0
        if (n < 0) continue
        // a tie ahead holds this note through
        const after = Math.round(p[this.pStep[t] + clip * CL_STEPS + ((this.step + 1) % CL_STEPS)])
        if (after === CL_TIE) this.tied[t] = 1
        if (this.gate[t] > 0) this.low[t] = Math.round(RETRIG_S * this.fs)
        this.gate[t] = len
        this.out[this.oP[t]] = Math.round(p[this.pOct[t]]) + n / 12
      }
    }
    for (let t = 0; t < CL_TRACKS; t++) {
      const on = (this.gate[t] > 0 || this.tied[t] === 1) && this.low[t] <= 0
      if (this.low[t] > 0) this.low[t]--
      else if (this.gate[t] > 0) this.gate[t]--
      this.out[this.oG[t]] = on ? 10 : 0
      this.led[CLL.playing + t] = Math.round(p[this.pPl[t]])
      this.led[CLL.cued + t] = this.cued[t] > -2 ? this.cued[t] : -2
    }
    this.led[CLL.step] = this.step
  }
}
