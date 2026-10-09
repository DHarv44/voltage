import type { ModuleSpec } from '../../modules/types'
import { ClickVoice, type ClickSound } from './clickVoice'
import { Svf } from './drumVoices'
import { DrumPocketDsp } from './pocketDrums'
import { TAU } from './util'

const TYPE = 0
const SPACE = 1
const STAPLE = 2
const GLITCH = 3
const BELL = 4
const RETURN = 5
const PHONE = 6
const sound = (): ClickSound => ({ f: 1000, ratio: 2, t1: 0.02, t2: 0.01, a2: 0.5, noise: 0.5, tn: 0.005 })

/** POCKET OFFICE's kit, all clicks and noise. TYPE, SPACE, STAPLE and BELL are
 *  struck modal clicks (two resonant modes and a noise snap), retuned on every
 *  hit (keys never sound quite alike); RETURN is a ratchet that speeds up and
 *  slams; GLITCH crushed noise that sometimes stutters; PHONE a two-tone
 *  trill; PAPER crackling, swelling noise. A is each sound's pitch or
 *  brightness, B its length. */
export class PocketOfficeDsp extends DrumPocketDsp {
  /** TYPE, SPACE, STAPLE, BELL: each its own click, so they overlap. */
  private readonly clicks = Array.from({ length: 4 }, () => new ClickVoice(this.fs))
  private readonly shapes = Array.from({ length: 4 }, () => sound())
  // RETURN: the ratchet's clicks, then the slam
  private readonly ratchet = new ClickVoice(this.fs)
  private readonly slam = new ClickVoice(this.fs)
  private readonly ratchetShape = sound()
  private readonly slamShape: ClickSound = { f: 110, ratio: 2.4, t1: 0.09, t2: 0.03, a2: 0.4, noise: 0.6, tn: 0.012 }
  private retLeft = 0
  private retWait = 0
  private retGap = 0
  // GLITCH
  private glEnv = 0
  private glHold = 0
  private glPh = 0
  private glRepeats = 0
  private glWait = 0
  // PHONE
  private phEnv = 0
  private phT = 0
  // PAPER
  private paEnv = 0
  private paT = 0
  private paLen = 0
  private readonly paF = new Svf()

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
  }

  /** A click retuned for this hit: mode frequency f (±4 % at random), lengths. */
  private click(slot: number, vel: number, f: number, ratio: number, t1: number, t2: number, a2: number, noise: number, tn: number): void {
    const s = this.shapes[slot]
    s.f = f * (0.96 + this.rng.next() * 0.08)
    s.ratio = ratio
    s.t1 = t1
    s.t2 = t2
    s.a2 = a2
    s.noise = noise
    s.tn = tn
    this.clicks[slot].strike(s, vel)
  }

  protected strike(s: number, vel: number): void {
    const A = this.a[s]
    const B = this.b[s]
    if (s === TYPE) this.click(0, vel, 1800 + A * 2600, 1.7, 0.006 + B * 0.03, 0.004, 0.6, 0.9, 0.004)
    else if (s === SPACE) this.click(1, vel, 220 + A * 320, 2.3, 0.03 + B * 0.12, 0.015, 0.5, 0.6, 0.01)
    else if (s === STAPLE) this.click(2, vel, 2100 + A * 1600, 1.57, 0.02 + B * 0.1, 0.05, 0.8, 0.8, 0.006)
    else if (s === BELL) this.click(3, vel * 0.7, 1900 + A * 1500, 2.76, 0.4 + B * 1.6, 0.2 + B * 0.6, 0.5, 0.05, 0.002)
    else if (s === GLITCH) {
      this.glEnv = vel
      this.glPh = 1
      // now and then a stutter: the same glitch twice or three times, fast
      this.glRepeats = this.rng.next() < 0.3 ? 1 + Math.floor(this.rng.next() * 2) : 0
      this.glWait = Math.round(0.03 * this.fs)
    } else if (s === RETURN) {
      // the carriage runs back: clicks closing in over B, then it slams
      this.retLeft = 7
      this.retGap = (0.04 + B * 0.07) * this.fs
      this.retWait = 0
      this.ratchetShape.f = 2600 + A * 1800
      this.ratchetShape.t1 = 0.006
      this.ratchetShape.noise = 0.7
    } else if (s === PHONE) {
      this.phEnv = vel
      this.phT = 0
    } else {
      this.paEnv = vel
      this.paT = 0
      this.paLen = 0.15 + B * 0.6
    }
  }

  protected render(): number {
    const fs = this.fs
    let y = 0
    for (let k = 0; k < 4; k++) y += this.clicks[k].next()

    // RETURN
    if (this.retLeft > 0 && --this.retWait <= 0) {
      this.retLeft--
      if (this.retLeft > 0) {
        this.ratchet.strike(this.ratchetShape, 0.45)
        this.retWait = this.retGap
        this.retGap *= 0.8
      } else this.slam.strike(this.slamShape, 1)
    }
    y += this.ratchet.next() + this.slam.next()

    // GLITCH: noise held at a ragged rate and cut to a few bits
    if (this.glEnv > 1e-3) {
      const A = this.a[GLITCH]
      this.glPh += (2000 + A * 18000) / fs
      if (this.glPh >= 1) {
        this.glPh -= Math.floor(this.glPh)
        this.glHold = Math.round((this.rng.next() * 2 - 1) * 3) / 3
      }
      y += this.glHold * this.glEnv * 0.45
      this.glEnv *= Math.exp(-1 / ((0.008 + this.b[GLITCH] * 0.1) * fs))
    }
    if (this.glRepeats > 0 && --this.glWait <= 0) {
      this.glRepeats--
      this.glEnv = 0.8
      this.glWait = Math.round(0.03 * fs)
    }

    // PHONE: two tones swapping twenty times a second
    if (this.phEnv > 1e-3) {
      this.phT += 1 / fs
      const base = 700 + this.a[PHONE] * 900
      const f = Math.floor(this.phT * 20) % 2 === 0 ? base : base * 1.25
      y += Math.sin(TAU * f * this.phT) * this.phEnv * 0.5
      if (this.phT > 0.05 + this.b[PHONE] * 0.6) this.phEnv *= Math.exp(-1 / (0.01 * fs))
    }

    // PAPER: crackles in a swell of hiss, through a band-pass
    if (this.paEnv > 1e-3) {
      this.paT += 1 / fs
      const shape = Math.sin(Math.PI * Math.min(1, this.paT / this.paLen))
      const crackle = this.rng.next() < 0.02 ? (this.rng.next() * 2 - 1) * 3 : 0
      this.paF.process((this.rng.next() * 2 - 1 + crackle) * shape, 1500 + this.a[7] * 5000, 0.6, fs)
      y += this.paF.bp * this.paEnv * 0.6
      if (this.paT > this.paLen) this.paEnv = 0
    }
    return y
  }
}
