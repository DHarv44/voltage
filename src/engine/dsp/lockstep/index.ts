import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { FX_DELAY, SketchFx } from '../sketchbook/fx'
import { rails } from '../util'
import {
  chainId,
  condId,
  knobId,
  LOCK_PAGES,
  lockId,
  lockValue,
  LS_BAR,
  LS_CHAIN,
  LS_PAT_VOLTS,
  LS_PATTERNS,
  LS_SPEED_X,
  LS_STEPS,
  LS_TRACKS,
  LSL,
  microId,
  muteId,
  noteId,
  retrigId,
  trigsId,
} from '../../../modules/specs/lockstepDefs'
import { FmVoice } from './voice'

/** One pattern's param indices, per track (steps × fields). */
interface PatIdx {
  tr: Int32Array
  note: Int32Array[]
  cond: Int32Array[]
  rt: Int32Array[]
  mt: Int32Array[]
  /** step × LOCK_PAGES + page */
  lock: Int32Array[]
}

/** A:B conditions (index 1..9): play on the A-th of every B times round. */
const COND_A = [0, 1, 2, 1, 2, 3, 1, 2, 3, 4]
const COND_B = [0, 2, 2, 3, 3, 3, 4, 4, 4, 4]
const CHANCE = [0.75, 0.5, 0.25, 0.1]
const KNOBS = LOCK_PAGES * 4
const PAN = 10
const SEND = 11
const LED_DECAY = 0.9992

/** Where a swung clock is, in steps (continuous): in each pair of steps the
 *  first lasts 1 + swing, the second 1 − swing. */
function swungPos(x: number, swing: number): number {
  const pair = Math.floor(x / 2)
  const r = x - 2 * pair
  return r < 1 + swing ? 2 * pair + r / (1 + swing) : 2 * pair + 1 + (r - 1 - swing) / (1 - swing)
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
    dtime: this.pi('dtime'), dfb: this.pi('dfb'), master: this.pi('master'), pat: this.pi('pat'),
    chon: this.pi('chon'), chlen: this.pi('chlen'),
  }
  private iPat = this.ii('pat')
  private chIdx = Int32Array.from({ length: LS_CHAIN }, (_, i) => this.pi(chainId(i)))
  /** The chain slot playing (−1: the chain starts at the next bar). */
  private slot = -1
  private chainWas = false
  private kIdx = Array.from({ length: LS_TRACKS }, (_, t) => Int32Array.from({ length: KNOBS }, (_, j) => this.pi(knobId(t, j))))
  private algoIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`algo${t}`))
  private rootIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`root${t}`))
  private lenIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`len${t}`))
  private spdIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(`spd${t}`))
  private muteIdx = Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(muteId(t)))
  private pats: PatIdx[] = LS_PATTERNS.map((_, pat) => {
    const steps = (id: (t: number, s: number, pat: number) => string) =>
      Array.from({ length: LS_TRACKS }, (_, t) => Int32Array.from({ length: LS_STEPS }, (_, s) => this.pi(id(t, s, pat))))
    return {
      tr: Int32Array.from({ length: LS_TRACKS }, (_, t) => this.pi(trigsId(t, pat))),
      note: steps(noteId),
      cond: steps(condId),
      rt: steps(retrigId),
      mt: steps(microId),
      lock: Array.from({ length: LS_TRACKS }, (_, t) =>
        Int32Array.from({ length: LS_STEPS * LOCK_PAGES }, (_, i) => this.pi(lockId(t, Math.floor(i / LOCK_PAGES), i % LOCK_PAGES, pat))),
      ),
    }
  })
  /** The pattern playing, and the master position its bar 1 began at. */
  private playing = 0
  private origin = 0
  /** Where the current bar began (pattern changes wait for the next). */
  private bar = 0
  private cur: PatIdx = this.pats[0]
  /** Each track's next step to fire (absolute count since PLAY). */
  private readonly next = new Float64Array(LS_TRACKS)
  /** Ratchets in progress: hits left, samples between them, samples to the next. */
  private readonly rtLeft = new Int32Array(LS_TRACKS)
  private readonly rtGap = new Float64Array(LS_TRACKS)
  private readonly rtWait = new Float64Array(LS_TRACKS)

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
  private rstOut = 0
  private oRst = this.oi('rsto')

  private restart(): void {
    this.phase = 0
    this.edges = 0
    this.origin = 0
    this.bar = 0
    this.chainWas = this.chaining()
    if (this.chainWas) {
      this.slot = 0
      this.show(this.chainPat(0))
    }
    this.begin(this.cued())
    this.rstOut = Math.round(0.003 * this.fs) // followers start over too
  }

  private cued(): number {
    return Math.max(0, Math.min(LS_PATTERNS.length - 1, Math.round(this.p[this.P.pat])))
  }

  private chaining(): boolean {
    return this.p[this.P.chon] >= 0.5 && Math.round(this.p[this.P.chlen]) > 0
  }

  private chainPat(i: number): number {
    return Math.round(this.p[this.chIdx[i]])
  }

  /** The face follows the pattern a chain or PAT in picked. */
  private show(pat: number): void {
    if (pat !== Math.round(this.p[this.P.pat])) this.writeParam(this.P.pat, pat)
  }

  /** Pattern `pat` from its first step. */
  private begin(pat: number): void {
    this.playing = pat
    this.cur = this.pats[pat]
    this.pos.fill(-1)
    this.next.fill(0)
    this.rtLeft.fill(0)
  }

  private passes(cond: number, loop: number, fill: boolean): boolean {
    if (cond === 0) return true
    if (cond <= 9) return loop % COND_B[cond] === COND_A[cond] - 1
    if (cond <= 13) return this.rng.next() < CHANCE[cond - 10]
    if (cond === 14) return fill
    if (cond === 15) return !fill
    return cond === 16 ? loop === 0 : loop > 0
  }

  /** Step s of track t comes round: play it if it's lit, passes its
   *  condition and the track isn't muted; a ratchet re-strikes the same note
   *  evenly through the step (`stepSamples` long). */
  private trig(t: number, s: number, loop: number, fill: boolean, stepSamples: number): void {
    const p = this.p
    const d = this.cur
    if (((p[d.tr[t]] >>> s) & 1) === 0) return
    if (p[this.muteIdx[t]] >= 0.5) return
    if (!this.passes(Math.round(p[d.cond[t][s]]), loop, fill)) return
    const hits = 1 + Math.round(p[d.rt[t][s]])
    this.rtLeft[t] = hits - 1
    this.rtGap[t] = stepSamples / hits
    this.rtWait[t] = this.rtGap[t]
    const v = this.voices[t]
    const li = d.lock[t]
    for (let page = 0; page < LOCK_PAGES; page++) {
      const word = p[li[s * LOCK_PAGES + page]]
      for (let k = 0; k < 4; k++) v.locks[page * 4 + k] = lockValue(word, k)
    }
    v.start((p[this.rootIdx[t]] + p[d.note[t][s]]) / 12)
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

    // the chain (from slot 1 at the next bar when it's switched on), or PAT in
    const chain = this.chaining()
    if (chain !== this.chainWas) {
      this.chainWas = chain
      this.slot = -1
    }
    if (!chain && this.patched[this.iPat]) this.show(Math.max(0, Math.min(LS_PATTERNS.length - 1, Math.floor(i[this.iPat] / LS_PAT_VOLTS))))
    // a new pattern: straight away when stopped, else from the next bar
    const want = this.cued()
    if (running) {
      while (this.phase - this.bar >= LS_BAR) {
        this.bar += LS_BAR
        if (chain) {
          // every bar the chain moves on, and its pattern starts from step 1
          this.slot = (this.slot + 1) % Math.round(p[P.chlen])
          const next = this.chainPat(this.slot)
          this.show(next)
          this.origin = this.bar
          this.begin(next)
        } else if (want !== this.playing) {
          this.origin = this.bar
          this.begin(want)
        }
      }
    } else if (want !== this.playing) this.begin(want)

    const live = running && (!external || this.edges > 0)
    const swing = p[P.swing]
    let mixL = 0
    let mixR = 0
    let send = 0
    for (let t = 0; t < LS_TRACKS; t++) {
      const len = Math.max(1, Math.round(p[this.lenIdx[t]]))
      const v = this.voices[t]
      if (live) {
        const speed = LS_SPEED_X[Math.round(p[this.spdIdx[t]])]
        const x = swungPos((this.phase - this.origin) * speed, swing)
        // a jump (SPEED changed, clock caught up) skips ahead rather than firing a burst
        if (x - this.next[t] > 2) this.next[t] = Math.floor(x)
        // fire each step once its time (nudged by MICRO, in 24ths) has come
        for (let guard = 0; guard < 3; guard++) {
          const k = this.next[t]
          const s = k % len
          if (x < k + p[this.cur.mt[t][s]] / 24) break
          this.next[t] = k + 1
          this.pos[t] = k
          this.trig(t, s, Math.floor(k / len), fill, (stepLen * this.fs) / speed)
        }
      }
      // ratchets: the same note again, the same locks
      if (this.rtLeft[t] > 0 && --this.rtWait[t] <= 0) {
        this.rtLeft[t]--
        this.rtWait[t] = this.rtGap[t]
        v.start(v.volts)
        this.led[LSL.flash + t] = 1
      }
      // the voice: its knobs, with the playing note's locks over them
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
    this.out[this.oRst] = this.rstOut > 0 ? 10 : 0
    if (this.rstOut > 0) this.rstOut--
    this.led[LSL.beat] = running && this.phase % 4 < 0.5 ? 1 : 0
    this.led[LSL.fill] = fill ? 1 : 0
    this.led[LSL.pat] = this.playing
    this.led[LSL.chain] = chain && running ? this.slot : -1
  }
}
