import { DRUM_CHANNEL, type MidiEvent } from '../protocol'
import { TAU, fastTanh, polyBlep } from './util'

/** Circuit building blocks shared by single modules and multi-section system units. */

/** Band-limited oscillator core: PolyBLEP saw/pulse, naive tri/sine (all ±1). */
export class OscCore {
  phase = 0
  saw = 0
  sqr = 0
  tri = 0
  sin = 0

  step(dt: number, pw: number): void {
    const t = this.phase
    this.saw = 2 * t - 1 - polyBlep(t, dt)
    let sq = t < pw ? 1 : -1
    sq += polyBlep(t, dt)
    let t2 = t - pw
    if (t2 < 0) t2 += 1
    this.sqr = sq - polyBlep(t2, dt)
    this.tri = 1 - 4 * Math.abs(t - 0.5)
    this.sin = Math.sin(TAU * t)
    const n = t + dt
    this.phase = n >= 1 ? n - 1 : n
  }
}

/** Transistor ladder (Huovilainen-style), 2× oversampled. Input/output ≈ ±1.
 *  g = 1 − exp(−2π·fc / 2fs); k = 0..~4.4 (self-oscillation ≈ 4). */
export class LadderCore {
  private s1 = 0
  private s2 = 0
  private s3 = 0
  private s4 = 0
  private xPrev = 0
  lp2 = 0

  process(x1: number, g: number, k: number): number {
    let a4 = 0
    let a2 = 0
    for (let n = 0; n < 2; n++) {
      const x = n === 0 ? 0.5 * (this.xPrev + x1) : x1
      const u = fastTanh(x - k * this.s4)
      const t1 = fastTanh(this.s1)
      const t2 = fastTanh(this.s2)
      const t3 = fastTanh(this.s3)
      const t4 = fastTanh(this.s4)
      this.s1 += g * (u - t1)
      this.s2 += g * (t1 - t2)
      this.s3 += g * (t2 - t3)
      this.s4 += g * (t3 - t4)
      a4 += this.s4
      a2 += this.s2
    }
    this.xPrev = x1
    this.lp2 = a2 * 0.5
    return a4 * 0.5
  }
}

/** Schmitt-trigger input (rises above 1.2 V, falls below 0.8 V). */
export class Schmitt {
  high = false
  /** Returns true on the rising edge. */
  rise(v: number): boolean {
    if (this.high) {
      if (v < 0.8) this.high = false
      return false
    }
    if (v > 1.2) {
      this.high = true
      return true
    }
    return false
  }
}

const SHAPE_ATTACK = Math.log(1.3 / 0.3) // RC toward 1.3 crosses 1.0 at τ·ln(1.3/0.3)
const SHAPE_DECAY = 4.6 // ~1% left after the knob time

/** Analog ADSR core: convex RC attack, exponential decay/release. Level 0..1. */
export class EnvCore {
  v = 0
  stage = 0 // 0 idle, 1 attack, 2 decay/sustain, 3 release
  private gate = new Schmitt()
  private readonly fsTol: number

  constructor(fs: number, timeTol: number) {
    this.fsTol = fs * timeTol
  }

  private coef(time: number, shape: number): number {
    return 1 - Math.exp(-shape / (Math.max(time, 0.0005) * this.fsTol))
  }

  step(gateV: number, retrig: boolean, a: number, d: number, s: number, r: number): number {
    const wasHigh = this.gate.high
    if (this.gate.rise(gateV) || (retrig && this.gate.high)) this.stage = 1
    else if (wasHigh && !this.gate.high) this.stage = 3

    if (this.stage === 1) {
      this.v += (1.3 - this.v) * this.coef(a, SHAPE_ATTACK)
      if (this.v >= 1) {
        this.v = 1
        this.stage = 2
      }
    } else if (this.stage === 2) {
      this.v += (s - this.v) * this.coef(d, SHAPE_DECAY)
    } else if (this.stage === 3) {
      this.v -= this.v * this.coef(r, SHAPE_DECAY)
      if (this.v < 1e-6) {
        this.v = 0
        this.stage = 0
      }
    }
    return this.v
  }
}

/** Mono last-note-priority keyboard state. Pitch in volts, 0 V = MIDI 60. */
export class KeyboardCore {
  private stack: number[] = []
  private target = 0
  pitch = 0
  vel = 0
  mod = 0
  bend = 0
  trig = 0

  get gate(): boolean {
    return this.stack.length > 0
  }

  midi(ev: MidiEvent, fs: number): void {
    if ((ev.kind === 'on' || ev.kind === 'off') && ev.ch === DRUM_CHANNEL) return // drums, not keys
    switch (ev.kind) {
      case 'on':
        this.stack = this.stack.filter((n) => n !== ev.note)
        this.stack.push(ev.note)
        this.target = (ev.note - 60) / 12
        this.vel = ev.vel
        this.trig = Math.round(0.002 * fs)
        break
      case 'off':
        this.stack = this.stack.filter((n) => n !== ev.note)
        if (this.stack.length) this.target = (this.stack[this.stack.length - 1] - 60) / 12
        break
      case 'cc':
        if (ev.cc === 1) this.mod = ev.value
        else if (ev.cc === 123) this.stack = []
        break
      case 'bend':
        this.bend = ev.value
        break
      case 'panic':
        this.stack = []
        break
    }
  }

  /** Advance glide by one sample. */
  step(glide: number, fs: number): void {
    if (glide > 0.001) this.pitch += (this.target - this.pitch) * (1 - Math.exp(-3 / (glide * fs)))
    else this.pitch = this.target
    if (this.trig > 0) this.trig--
  }
}

/** Audio interface stage: AC coupling (5 Hz), audio-taper volume, soft limit, peak meter. */
export class AudioOutCore {
  private x = 0
  private y = 0
  peak = 0
  private readonly R: number
  private readonly decay: number

  constructor(fs: number) {
    this.R = 1 - (TAU * 5) / fs
    this.decay = Math.exp(-1 / (0.15 * fs))
  }

  process(v: number, vol: number): number {
    this.y = v - this.x + this.R * this.y
    this.x = v
    const s = limit(this.y * ((vol * vol) / 8))
    const a = s < 0 ? -s : s
    this.peak = a > this.peak ? a : this.peak * this.decay
    return s
  }
}

function limit(x: number): number {
  const a = x < 0 ? -x : x
  if (a < 0.9) return x
  const s = 0.9 + 0.1 * fastTanh((a - 0.9) / 0.1)
  return x < 0 ? -s : s
}
