import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { FX_DELAY, SketchFx } from '../sketchbook/fx'
import { rails } from '../util'
import { knobId, LOCK_PAGES, lockId, lockValue, LS_SPEED_X, LS_STEPS, LS_TRACKS, LSL } from '../../../modules/specs/lockstepDefs'
import { FmVoice } from './voice'

/** A:B conditions (index 1..9): play on the A-th of every B times round. */
const COND_A = [0, 1, 2, 1, 2, 3, 1, 2, 3, 4]
const COND_B = [0, 2, 2, 3, 3, 3, 4, 4, 4, 4]
const CHANCE = [0.75, 0.5, 0.25, 0.1]
const KNOBS = LOCK_PAGES * 4
const PAN = 10
const SEND = 11
const LED_DECAY = 0.9992

/** The step a swung clock is on: in each pair of steps the first lasts
 *  1 + swing, the second 1 − swing. */
function swungStep(x: number, swing: number): number {
  const pair = Math.floor(x / 2)
  return 2 * pair + (x - 2 * pair < 1 + swing ? 0 : 1)
}

/** LOCKSTEP: one master clock in 16ths (TEMPO, or CLK in, with the time
 *  between edges filled in so faster tracks land between them); each track
 *  reads it through its own SPEED and swing and wraps at its own LENGTH, so
 *  tracks drift against each other. A trig plays if its condition holds,
 *  with its note and its locked knobs held for the note's life. */
export class LockstepDsp extends Dsp {
  private iClk = this.ii('clk')
  private iRun = this.ii('run')
  private iFill = this.ii('fill')
  private iReset = this.ii('reset')
  private oClk = this.oi('clko')
  private oT = [1, 2, 3, 4].map((i) => this.oi(`t${i}`))
  private oL = this.oi('l')
  private oR = this.oi('r')
  private P = {
    run: this.pi('run'), fill: this.pi('fill'), tempo: this.pi('tempo'), swing: this.pi('swing'),
    dtime: this.pi('dtime'), dfb: this.pi('dfb'), master: this.pi('master'),
  }
  private kIdx = Array.from({ length: LS_TRACKS }, (_, t) => Int32Array.from({ length: KNOBS }, (_, j) => this.pi(knobId(t, j))))
  private algoIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`algo${t}`))
  private rootIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`root${t}`))
  private lenIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`len${t}`))
  private spdIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`spd${t}`))
  private trIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`tr${t}`))
  private noteIdx = Array.from({ length: LS_TRACKS }, (_, t) => Int32Array.from({ length: LS_STEPS }, (_, s) => this.pi(`n${t}_${s}`)))
  private condIdx = Array.from({ length: LS_TRACKS }, (_, t) => Int32Array.from({ length: LS_STEPS }, (_, s) => this.pi(`c${t}_${s}`)))
  private lockIdx = Array.from({ length: LS_TRACKS }, (_, t) =>
    Int32Array.from({ length: LS_STEPS * LOCK_PAGES }, (_, i) => this.pi(lockId(t, Math.floor(i / LOCK_PAGES), i % LOCK_PAGES))),
  )

  private readonly voices = Array.from({ length: LS_TRACKS }, () => new FmVoice(this.fs))
  private readonly vals = Array.from({ length: LS_TRACKS }, () => new Float64Array(KNOBS))
  /** Each track's absolute step count since PLAY (−1 = not started). */
  private readonly pos = new Float64Array(LS_TRACKS).fill(-1)
  private readonly delay = new SketchFx(this.fs)
  private readonly clkIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  /** Master clock position in 16ths. */
  private phase = 0
  private edges = 0
  private since = 0
  private period = 0
  private wasRunning = false

  private restart(): void {
    this.phase = 0
    this.edges = 0
    this.pos.fill(-1)
  }

  private passes(cond: number, loop: number, fill: boolean): boolean {
    if (cond === 0) return true
    if (cond <= 9) return loop % COND_B[cond] === COND_A[cond] - 1
    if (cond <= 13) return this.rng.next() < CHANCE[cond - 10]
    if (cond === 14) return fill
    if (cond === 15) return !fill
    return cond === 16 ? loop === 0 : loop > 0
  }

  private trig(t: number, s: number, loop: number, fill: boolean): void {
    const p = this.p
    if (((p[this.trIdx[t]] >>> s) & 1) === 0) return
    if (!this.passes(Math.round(p[this.condIdx[t][s]]), loop, fill)) return
    const v = this.voices[t]
    const li = this.lockIdx[t]
    for (let page = 0; page < LOCK_PAGES; page++) {
      const word = p[li[s * LOCK_PAGES + page]]
      for (let k = 0; k < 4; k++) v.locks[page * 4 + k] = lockValue(word, k)
    }
    v.start((p[this.rootIdx[t]] + p[this.noteIdx[t][s]]) / 12)
    this.led[LSL.flash + t] = 1
  }

  tick(): void {
    const { P } = this
    const i = this.in
    const p = this.p
    const external = this.patched[this.iClk] === 1
    const running = this.patched[this.iRun] ? i[this.iRun] > 1.2 : p[P.run] >= 0.5
    if ((running && !this.wasRunning) || this.rstIn.rise(i[this.iReset])) this.restart()
    this.wasRunning = running
    const fill = p[P.fill] >= 0.5 || (this.patched[this.iFill] === 1 && i[this.iFill] > 1.2)

    // Master clock: internal 16ths, or CLK edges with the gaps filled in.
    this.since++
    const edge = this.clkIn.rise(i[this.iClk])
    let stepLen = 15 / p[P.tempo]
    if (external) {
      if (edge) {
        if (this.since > 8 && this.since < this.fs * 4) this.period = this.since
        this.since = 0
        if (running) this.phase = this.edges++
      } else if (running && this.edges > 0 && this.period > 0) this.phase = Math.min(this.phase + 1 / this.period, this.edges - 1e-9)
      if (this.period > 0) stepLen = this.period / this.fs
    } else if (running) this.phase += p[P.tempo] / 15 / this.fs

    const live = running && (!external || this.edges > 0)
    const swing = p[P.swing]
    let mixL = 0
    let mixR = 0
    let send = 0
    for (let t = 0; t < LS_TRACKS; t++) {
      const len = Math.max(1, Math.round(p[this.lenIdx[t]]))
      if (live) {
        const at = swungStep(this.phase * LS_SPEED_X[Math.round(p[this.spdIdx[t]])], swing)
        if (at !== this.pos[t]) {
          this.pos[t] = at
          this.trig(t, at % len, Math.floor(at / len), fill)
        }
      }
      // the voice: its knobs, with the playing note's locks over them
      const v = this.voices[t]
      const vals = this.vals[t]
      const ki = this.kIdx[t]
      for (let j = 0; j < KNOBS; j++) vals[j] = v.locks[j] >= 0 ? v.locks[j] : p[ki[j]]
      v.step(vals, Math.round(p[this.algoIdx[t]]))
      const x = v.out
      const pan = vals[PAN]
      mixL += x * Math.sqrt(1 - pan)
      mixR += x * Math.sqrt(pan)
      send += x * vals[SEND]
      this.out[this.oT[t]] = x * 5
      this.led[LSL.step + t] = running && this.pos[t] >= 0 ? this.pos[t] % len : -1
      this.led[LSL.flash + t] *= LED_DECAY
    }

    // ping-pong delay send: the effect returns dry + wet, keep the wet
    this.delay.process(send, FX_DELAY, 1, p[P.dtime], p[P.dfb], stepLen)
    const gain = 10 * p[P.master]
    this.out[this.oL] = rails((mixL + this.delay.l[0] - send) * gain)
    this.out[this.oR] = rails((mixR + this.delay.r[0] - send) * gain)
    this.out[this.oClk] = running && this.phase % 1 < 0.5 ? 10 : 0
    this.led[LSL.beat] = running && this.phase % 4 < 0.5 ? 1 : 0
    this.led[LSL.fill] = fill ? 1 : 0
  }
}
