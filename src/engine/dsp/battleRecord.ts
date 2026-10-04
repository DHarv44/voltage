import { polyBlep, TAU } from './util'

/** RBJ band-pass biquad (constant 0 dB peak). */
class Bandpass {
  private b0: number
  private a1: number
  private a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0
  constructor(f: number, q: number, fs: number) {
    const w = (TAU * f) / fs
    const al = Math.sin(w) / (2 * q)
    const a0 = 1 + al
    this.b0 = al / a0
    this.a1 = (-2 * Math.cos(w)) / a0
    this.a2 = (1 - al) / a0
  }
  run(x: number): number {
    const y = this.b0 * x - this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

const BPM = 92
const STEP = 60 / BPM / 4
const BREAK_AT = 1.6
const KICK = [0, 10, 16, 19, 26]
const SNARE = [4, 12, 20, 28]
const OPEN_HAT = 30
const HORN = [233.08, 293.66, 349.23]

/** The factory "battle record": everything a scratch DJ wants near the start of
 *  a side, synthesised rather than sampled. An "ahh" vocal stab (a sawtooth
 *  through vowel formants), a brass stab, then a two-bar boom-bap break.
 *  next() presses one sample at a time so the engine can spread the work. */
export class BattleRecord {
  readonly length: number
  private n = 0
  private readonly fs: number
  private readonly f1: Bandpass
  private readonly f2: Bandpass
  private readonly f3: Bandpass
  private readonly snareBp: Bandpass
  private vPh = 0
  private hPh = [0, 0, 0]
  private hornLp = 0
  private step = -1
  private kick = { ph: 0, t: 1e9 }
  private snare = { ph: 0, t: 1e9 }
  private hat = { t: 1e9, open: false }
  private hatHp = 0
  private hatPrev = 0
  private seed = 0x1234567

  constructor(fs: number) {
    this.fs = fs
    this.length = Math.round(8 * fs)
    this.f1 = new Bandpass(800, 6, fs)
    this.f2 = new Bandpass(1150, 8, fs)
    this.f3 = new Bandpass(2900, 10, fs)
    this.snareBp = new Bandpass(1800, 1.2, fs)
  }

  get done(): boolean {
    return this.n >= this.length
  }

  private noise(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
    return this.seed / 2147483648
  }

  private saw(ph: number, dt: number): number {
    return 2 * ph - 1 - polyBlep(ph, dt)
  }

  next(): number {
    const fs = this.fs
    const t = this.n++ / fs
    let y = 0

    // "Ahh": voice with vibrato and a slight fall, through /a/ formants.
    if (t < 0.7) {
      const env = Math.min(1, t / 0.02) * Math.exp(-Math.max(0, t - 0.25) * 6)
      const f0 = 210 * (1 - 0.06 * t) * (1 + 0.015 * Math.sin(TAU * 5.5 * t))
      const dt = f0 / fs
      this.vPh = (this.vPh + dt) % 1
      const src = this.saw(this.vPh, dt) + this.noise() * 0.05
      y += env * (this.f1.run(src) * 2.2 + this.f2.run(src) * 1.4 + this.f3.run(src) * 0.6)
    }

    // Brass stab: B♭ major triad of saws through an enveloped low-pass.
    if (t > 0.85 && t < 1.45) {
      const tt = t - 0.85
      const env = Math.min(1, tt / 0.015) * Math.exp(-tt * 4)
      let s = 0
      for (let i = 0; i < 3; i++) {
        const dt = HORN[i] / fs
        this.hPh[i] = (this.hPh[i] + dt) % 1
        s += this.saw(this.hPh[i], dt)
      }
      const cut = 600 + 4000 * env
      this.hornLp += (s - this.hornLp) * (1 - Math.exp((-TAU * cut) / fs))
      y += this.hornLp * env * 0.35
    }

    // Boom-bap break, two bars, from BREAK_AT to the run-out.
    const bt = t - BREAK_AT
    if (bt >= 0 && bt < STEP * 32) {
      const s = Math.floor(bt / STEP)
      if (s !== this.step) {
        this.step = s
        if (KICK.includes(s)) this.kick = { ph: 0, t: 0 }
        if (SNARE.includes(s)) this.snare = { ph: 0, t: 0 }
        if (s % 2 === 0 || s === OPEN_HAT) this.hat = { t: 0, open: s === OPEN_HAT }
      }
      const k = this.kick
      if (k.t < 0.6) {
        const f = 48 + 110 * Math.exp(-k.t / 0.035)
        k.ph = (k.ph + f / fs) % 1
        y += Math.sin(TAU * k.ph) * Math.exp(-k.t / 0.28) * 1.1
        k.t += 1 / fs
      }
      const sn = this.snare
      if (sn.t < 0.4) {
        sn.ph = (sn.ph + 185 / fs) % 1
        y += Math.sin(TAU * sn.ph) * Math.exp(-sn.t / 0.06) * 0.4
        y += this.snareBp.run(this.noise()) * Math.exp(-sn.t / 0.15) * 1.6
        sn.t += 1 / fs
      }
      const h = this.hat
      if (h.t < 0.4) {
        const nz = this.noise()
        this.hatHp = 0.6 * (this.hatHp + nz - this.hatPrev)
        this.hatPrev = nz
        y += this.hatHp * Math.exp(-h.t / (h.open ? 0.22 : 0.035)) * 0.35
        h.t += 1 / fs
      }
    }
    return Math.tanh(y * 0.9)
  }
}
