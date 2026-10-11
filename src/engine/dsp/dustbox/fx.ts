import { Biquad } from '../biquad'
import { Converter, ERAS } from '../sampling/converter'
import { LowpassSvf } from '../sampling/svf'
import type { Rng } from '../util'

export const VINYL = 0
export const CRUSH = 1
export const FILTER = 2
export const STUTTER = 3
export const STOP = 4
export const DUB = 5

/** The last couple of seconds of the mix (what STUTTER and TAPE STOP play from). */
const HIST_S = 2.5

/** DUSTBOX's punch-in effects, on the stereo mix. `on` says whether the
 *  effect is in; AMOUNT shapes each its own way. */
export class DustFx {
  private readonly hL: Float32Array
  private readonly hR: Float32Array
  private at = 0
  private readonly crushL: Converter
  private readonly crushR: Converter
  private readonly hpL: Biquad
  private readonly hpR: Biquad
  private readonly lpL: LowpassSvf
  private readonly lpR: LowpassSvf
  private readonly djL: Biquad
  private readonly djR: Biquad
  private readonly dubL: Float32Array
  private readonly dubR: Float32Array
  private dubAt = 0
  private dubLp = 0
  private wasOn = false
  /** STUTTER: where the slice starts and how long; TAPE STOP: the read head and its speed. */
  private sliceStart = 0
  private slicePos = 0
  private head = 0
  private speed = 1
  private wow = 0
  private crackle = 0
  private count = 0
  out = 0
  outR = 0

  constructor(
    private readonly fs: number,
    private readonly rng: Rng,
  ) {
    const n = Math.round(HIST_S * fs)
    this.hL = new Float32Array(n)
    this.hR = new Float32Array(n)
    this.crushL = new Converter(fs)
    this.crushR = new Converter(fs)
    this.hpL = new Biquad(fs).highpass(110, 0.7)
    this.hpR = new Biquad(fs).highpass(110, 0.7)
    this.lpL = new LowpassSvf(fs)
    this.lpR = new LowpassSvf(fs)
    this.djL = new Biquad(fs)
    this.djR = new Biquad(fs)
    this.dubL = new Float32Array(Math.round(1.5 * fs))
    this.dubR = new Float32Array(Math.round(1.5 * fs))
  }

  private hist(buf: Float32Array, back: number): number {
    const n = buf.length
    const p = this.at - back
    const i = Math.floor(p)
    const f = p - i
    const a = buf[((i % n) + n) % n]
    const b = buf[(((i + 1) % n) + n) % n]
    return a + (b - a) * f
  }

  /** One stereo sample through effect `fx` (on or off), `beat` the beat in seconds. */
  run(l: number, r: number, fx: number, on: boolean, amount: number, beat: number): void {
    const n = this.hL.length
    this.hL[this.at] = l
    this.hR[this.at] = r
    const started = on && !this.wasOn
    this.wasOn = on
    let ol = l
    let or = r
    if (fx === DUB) {
      // a tempo echo that keeps going after you let go (its repeats ring out)
      const d = Math.min(this.dubL.length - 1, Math.round(beat * 0.75 * this.fs))
      const k = (this.dubAt - d + this.dubL.length) % this.dubL.length
      const fb = 0.35 + amount * 0.5
      const yl = this.dubL[k]
      const yr = this.dubR[k]
      this.dubLp += (yl - this.dubLp) * 0.25
      this.dubL[this.dubAt] = (on ? l : 0) + yr * fb
      this.dubR[this.dubAt] = (on ? r : 0) + this.dubLp * fb
      this.dubAt = (this.dubAt + 1) % this.dubL.length
      ol += yl * 0.8
      or += yr * 0.8
    }
    if (on) {
      if (fx === VINYL) {
        // a worn record: band-limited, wobbling, crackling
        this.wow += 0.55 / this.fs
        const back = 0.004 * this.fs * (1 + Math.sin(2 * Math.PI * this.wow) * amount * 0.6)
        this.lpL.set(9000 - amount * 6000, 0.1)
        this.lpR.set(9000 - amount * 6000, 0.1)
        ol = this.lpL.run(this.hpL.run(this.hist(this.hL, back)))
        or = this.lpR.run(this.hpR.run(this.hist(this.hR, back)))
        if (this.rng.next() < 0.0004 * (0.3 + amount)) this.crackle = (this.rng.next() * 2 - 1) * (0.5 + amount)
        ol += this.crackle
        or += this.crackle * 0.8
        this.crackle *= 0.6
        ol += (this.rng.next() * 2 - 1) * 0.004 * amount
        or += (this.rng.next() * 2 - 1) * 0.004 * amount
        // the band-limiting loses level: bring it back up to the dry sound's
        ol *= 1.6
        or *= 1.6
      } else if (fx === CRUSH) {
        if (this.count-- <= 0) {
          this.count = 256
          const e = ERAS[7]
          const rate = Math.round((22000 - amount * 18000) / 100) * 100
          const bits = Math.round(12 - amount * 8)
          this.crushL.set(e, rate, bits)
          this.crushR.set(e, rate, bits)
        }
        ol = (this.crushL.run(l * 5) / 5) * 0.7
        or = (this.crushR.run(r * 5) / 5) * 0.7
      } else if (fx === FILTER) {
        // the DJ filter: left of centre low-pass, right of centre high-pass
        if (this.count-- <= 0) {
          this.count = 64
          if (amount < 0.5) {
            const f = 20000 * Math.pow(150 / 20000, (0.5 - amount) * 2)
            this.djL.lowpass(f, 1.2)
            this.djR.lowpass(f, 1.2)
          } else {
            const f = 20 * Math.pow(4000 / 20, (amount - 0.5) * 2)
            this.djL.highpass(f, 1.2)
            this.djR.highpass(f, 1.2)
          }
        }
        ol = this.djL.run(l)
        or = this.djR.run(r)
      } else if (fx === STUTTER) {
        // the last 1/8 (or 1/16, past halfway) caught and repeated in time
        const len = Math.max(64, Math.round((beat / (amount < 0.5 ? 2 : 4)) * this.fs))
        if (started) {
          this.sliceStart = this.at - len
          this.slicePos = 0
        }
        const k = (((this.sliceStart + this.slicePos) % n) + n) % n
        const edge = Math.min(1, this.slicePos / 64, (len - this.slicePos) / 64)
        ol = this.hL[k] * edge
        or = this.hR[k] * edge
        this.slicePos = (this.slicePos + 1) % len
      } else if (fx === STOP) {
        // the turntable's motor cut: the read head slows to a stop
        if (started) {
          this.head = 0
          this.speed = 1
        }
        this.speed = Math.max(0, this.speed - 1 / ((0.25 + amount * 1.5) * this.fs))
        this.head += 1 - this.speed // falls behind the live signal as it slows
        ol = this.hist(this.hL, Math.min(n - 2, this.head)) * Math.min(1, this.speed * 4)
        or = this.hist(this.hR, Math.min(n - 2, this.head)) * Math.min(1, this.speed * 4)
      }
    }
    this.at = (this.at + 1) % n
    this.out = ol
    this.outR = or
  }
}
