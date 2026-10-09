import type { UiEvent } from '../protocol'
import { Svf } from './drumVoices'

/** Effect numbers (POCKET_FX order). */
const ROLL = 4
const OCT_DOWN = 5
const OCT_UP = 6
const REVERSE = 7
const TAPE_STOP = 8
const SCRATCH = 9
const LOW_SWEEP = 10
const HIGH_SWEEP = 11
const CRUSH = 12
const CHOP = 13
const ECHO = 14
const WOBBLE = 15
/** LOOP ¼ … LOOP 32ND: the loop's length in sixteenths. */
const LOOP_STEPS = [4, 2, 1, 0.5]
const BUF_S = 4
const ECHO_S = 1.5
/** Fade in / out of an effect, and at a loop's seam (s). */
const FADE_S = 0.004
const SEAM_S = 0.002

/** The POCKETs' 16 punch-in effects on the output: they act while held and
 *  let go cleanly. Loops, rolls and pitch tricks replay a ring buffer of
 *  what was just played, measured in the POCKET's sixteenths; the sequencer
 *  keeps running underneath, so letting go lands back in time. */
export class PocketFx {
  /** The effect held (−1: none). */
  held = -1
  private cur = -1
  private fresh = false
  private mix = 0
  private readonly buf: Float32Array
  private readonly echo: Float32Array
  private w = 0
  private ew = 0
  private t = 0
  private anchor = 0
  private len = 0
  private seg = 0
  private segLen = 0
  private reps = 0
  private rp = 0
  private crushLeft = 0
  private crushHold = 0
  private chop = 0
  private readonly svf = new Svf()
  private readonly fadeK: number
  private readonly seam: number

  constructor(private readonly fs: number) {
    this.buf = new Float32Array(Math.ceil(BUF_S * fs))
    this.echo = new Float32Array(Math.ceil(ECHO_S * fs))
    this.fadeK = 1 - Math.exp(-1 / (FADE_S * fs))
    this.seam = SEAM_S * fs
  }

  /** A punch-in pad pressed or let go; true if it was one. */
  onUi(ev: UiEvent): boolean {
    if (ev.kind !== 'surface' || ev.name !== 'fx') return false
    const k = Math.round(ev.x)
    if (ev.down) {
      this.held = k
      this.cur = k
      this.fresh = true
    } else if (k === this.held) this.held = -1
    return true
  }

  /** The buffer at a (fractional, wrapping) position. */
  private at(pos: number): number {
    const n = this.buf.length
    const i = Math.floor(pos)
    const f = pos - i
    const a = this.buf[((i % n) + n) % n]
    const b = this.buf[(((i + 1) % n) + n) % n]
    return a + (b - a) * f
  }

  /** Fade at a loop's seam so it doesn't click. */
  private edge(off: number, len: number): number {
    return Math.min(1, off / this.seam, (len - off) / this.seam)
  }

  private effect(x: number, st: number): number {
    const t = this.t
    const k = this.cur
    if (this.fresh) {
      this.fresh = false
      this.t = 0
      this.anchor = this.w
      this.len = k < ROLL ? LOOP_STEPS[k] * st : k === REVERSE ? Math.min(8 * st, this.buf.length / 2) : 2 * st
      this.seg = 0
      this.segLen = st
      this.reps = 0
      this.rp = 0
      return x
    }
    if (k < ROLL) {
      const off = t % this.len
      return t < this.len ? x : this.at(this.anchor + off) * this.edge(off, this.len)
    }
    if (k === ROLL) {
      // a sixteenth repeated, halving every two repeats down to a 128th
      if (t - this.seg >= this.segLen) {
        this.seg = t
        if (++this.reps % 2 === 0 && this.segLen > st / 8) this.segLen /= 2
      }
      const off = t - this.seg
      return this.reps === 0 ? x : this.at(this.anchor + off) * this.edge(off, this.segLen)
    }
    if (k === OCT_DOWN) {
      const off = (t * 0.5) % this.len
      return this.at(this.anchor + off) * (t < this.len * 2 ? 1 : this.edge(off, this.len))
    }
    if (k === OCT_UP) {
      const off = (t * 2) % this.len
      return this.at(this.anchor - this.len + off) * this.edge(off, this.len)
    }
    if (k === REVERSE) {
      const off = t % this.len
      return this.at(this.anchor - 1 - off) * this.edge(off, this.len)
    }
    if (k === TAPE_STOP) {
      const v = Math.max(0, 1 - t / (4 * st))
      this.rp += v
      return this.at(this.anchor + this.rp) * Math.min(1, v * 8)
    }
    if (k === SCRATCH) return this.at(this.anchor - st * 0.75 * (1 - Math.cos((2 * Math.PI * t) / (2 * st))))
    if (k === LOW_SWEEP || k === HIGH_SWEEP) {
      const u = Math.min(1, t / (8 * st))
      const low = k === LOW_SWEEP
      this.svf.process(x, low ? 8000 * Math.pow(200 / 8000, u) : 30 * Math.pow(4000 / 30, u), 0.5, this.fs)
      return low ? this.svf.lp : this.svf.hp
    }
    if (k === CRUSH) {
      if (--this.crushLeft <= 0) {
        this.crushLeft = 6
        this.crushHold = Math.round(x / 0.35) * 0.35
      }
      return this.crushHold
    }
    if (k === CHOP) {
      this.chop += ((Math.floor(t / (st / 2)) % 2 === 0 ? 1 : 0) - this.chop) * 0.02
      return x * this.chop
    }
    if (k === WOBBLE) return this.at(this.w - (0.007 + 0.004 * Math.sin((2 * Math.PI * 5.5 * t) / this.fs)) * this.fs)
    return x // ECHO: the echo itself is added after
  }

  /** One sample of the output through the effects; `sixteenth` in seconds. */
  process(x: number, sixteenth: number): number {
    this.buf[this.w] = x
    // the echo keeps ringing out after its pad comes up
    const en = this.echo.length
    const ed = Math.min(en - 1, Math.round(3 * sixteenth * this.fs))
    const er = this.echo[(this.ew - ed + en) % en]
    this.echo[this.ew] = (this.held === ECHO ? x : 0) + er * 0.55
    this.ew = (this.ew + 1) % en
    this.mix += ((this.held >= 0 ? 1 : 0) - this.mix) * this.fadeK
    let y = x
    if (this.cur >= 0) {
      const wet = this.effect(x, sixteenth * this.fs)
      y = x + (wet - x) * this.mix
      if (this.held < 0 && this.mix < 1e-4) this.cur = -1
    }
    this.w = (this.w + 1) % this.buf.length
    this.t++
    return y + er * 0.6
  }
}
