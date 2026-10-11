import type { ModuleSpec } from '../../modules/types'
import { TK_MAX_BARS, TK_MAX_SECONDS, TK_STATE, TK_TAKES, TKL } from '../../modules/specs/takes'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { PocketClock } from './pocketClock'

const STEPS_PER_BAR = 16
/** Bar-line edits cross over this long (s). */
const XFADE_S = 0.006

/** TAKES: counts the passage in 16ths (its own tempo, or CLK; RST to the
 *  top). Armed, it records the next whole pass from the top into the first
 *  empty take; playing, each bar comes from the take chosen for it, the
 *  join crossed over. Takes are sample-counted from the top of the passage,
 *  so they play back where they were recorded (at the tempo they were). */
export class TakesDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iRec = this.ii('rec')
  private readonly oOut = this.oi('out')
  private readonly pTempo = this.pi('tempo')
  private readonly pBars = this.pi('bars')
  private readonly pLevel = this.pi('level')
  private readonly pMon = this.pi('mon')
  private readonly pRun = this.pi('run')
  private readonly pC0 = this.pi('c0')
  private readonly clock: PocketClock
  private readonly recIn = new Schmitt()
  private readonly bufs: Float32Array[]
  private readonly lens = new Int32Array(TK_TAKES)
  private readonly max: number
  private state: number = TK_STATE.idle
  private recTake = -1
  /** 16ths into the passage (−1 stopped), and samples since its top. */
  private pos = -1
  private at = 0
  private cur = -1
  private prev = -1
  private fade = 0
  private readonly xfade: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(STEPS_PER_BAR * TK_MAX_BARS, fs)
    this.max = Math.round(TK_MAX_SECONDS * fs)
    this.bufs = Array.from({ length: TK_TAKES }, () => new Float32Array(this.max))
    this.xfade = Math.max(1, Math.round(XFADE_S * fs))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || !ev.down) return
    if (ev.name === 'rec') this.arm()
    else if (ev.name === 'clear') {
      const t = Math.round(ev.x)
      if (t < 0 || t >= TK_TAKES) return
      if (t === this.recTake) this.state = TK_STATE.idle
      this.lens[t] = 0
      this.bufs[t].fill(0)
      this.peaks(t)
      this.bufferOut.push({ slot: t, rate: this.fs, data: new Float32Array(0) })
    }
  }

  /** REC: arm (or disarm) the next pass into the first empty take. */
  private arm(): void {
    if (this.state !== TK_STATE.idle) {
      this.state = TK_STATE.idle
      return
    }
    let t = -1
    for (let k = 0; k < TK_TAKES && t < 0; k++) if (this.lens[k] === 0) t = k
    if (t < 0) return // all four full: clear one first
    this.recTake = t
    this.state = TK_STATE.armed
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot < 0 || slot >= TK_TAKES) return
    const n = Math.min(this.max, data.length)
    this.bufs[slot].set(data.subarray(0, n))
    this.lens[slot] = n
    this.peaks(slot)
    void rate
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    if (slot < 0 || slot >= TK_TAKES || this.lens[slot] === 0) return null
    return { rate: this.fs, data: this.bufs[slot].slice(0, this.lens[slot]) }
  }

  /** Take t's loudness in each bar (for the screen). */
  private peaks(t: number): void {
    const bars = Math.max(1, Math.min(TK_MAX_BARS, Math.round(this.p[this.pBars])))
    const n = this.lens[t]
    for (let b = 0; b < TK_MAX_BARS; b++) {
      let pk = 0
      if (b < bars && n > 0) {
        const a = Math.floor((b * n) / bars)
        const z = Math.floor(((b + 1) * n) / bars)
        for (let i = a; i < z; i += 16) pk = Math.max(pk, Math.abs(this.bufs[t][i]))
      }
      this.led[TKL.peak0 + t * TK_MAX_BARS + b] = Math.min(1, pk / 5)
    }
  }

  tick(): void {
    const p = this.p
    const running = p[this.pRun] >= 0.5
    const c = this.clock
    if (this.recIn.rise(this.in[this.iRec])) this.arm()
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], 0, this.in[this.iRst])
    if (c.restarted || !running) {
      this.pos = -1
      if (this.state === TK_STATE.recording) this.finish()
    }
    const len = Math.max(1, Math.min(TK_MAX_BARS, Math.round(p[this.pBars]))) * STEPS_PER_BAR
    if (stepped) {
      this.pos = this.pos + 1 >= len ? 0 : this.pos + 1
      if (this.pos === 0) {
        // the top of the passage: an armed take starts, a recording one is done
        if (this.state === TK_STATE.recording) this.finish()
        if (this.state === TK_STATE.armed) {
          this.state = TK_STATE.recording
          this.lens[this.recTake] = 0
        }
        this.at = 0
      }
    }
    const x = this.in[this.iIn]
    let y = 0
    if (this.pos >= 0) {
      if (this.state === TK_STATE.recording && this.at < this.max) {
        this.bufs[this.recTake][this.at] = x
        this.lens[this.recTake] = this.at + 1
      }
      // which take plays this bar; a change crosses over
      const bar = Math.floor(this.pos / STEPS_PER_BAR)
      const want = Math.round(p[this.pC0 + bar])
      if (want !== this.cur) {
        this.prev = this.cur
        this.cur = want
        this.fade = this.xfade
      }
      const g = this.fade > 0 ? 1 - this.fade / this.xfade : 1
      y = this.read(this.cur) * g + (this.fade > 0 ? this.read(this.prev) * (1 - g) : 0)
      if (this.fade > 0) this.fade--
      this.at++
    }
    const mon = p[this.pMon] >= 0.5 ? x : 0
    this.out[this.oOut] = y * p[this.pLevel] + mon
    this.led[TKL.state] = this.state
    this.led[TKL.take] = this.recTake
    this.led[TKL.pos] = this.pos
    let has = 0
    for (let k = 0; k < TK_TAKES; k++) if (this.lens[k] > 0) has |= 1 << k
    this.led[TKL.has] = has
  }

  /** A take's sample at the playhead (silent past its end, or no take). */
  private read(t: number): number {
    if (t < 0 || t >= TK_TAKES || this.state === TK_STATE.recording && t === this.recTake) return 0
    return this.at < this.lens[t] ? this.bufs[t][this.at] : 0
  }

  private finish(): void {
    const t = this.recTake
    this.state = TK_STATE.idle
    if (t < 0 || this.lens[t] === 0) return
    this.peaks(t)
    this.bufferOut.push({ slot: t, rate: this.fs, data: this.bufs[t].subarray(0, this.lens[t]) })
  }
}
