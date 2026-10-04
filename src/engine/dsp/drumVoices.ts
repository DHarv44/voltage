import { TAU, fastTanh, type Rng } from './util'

/** Analog drum circuits, shared by the single drum modules and GROOVE-1.
 *  Levels are ~±1; callers scale to volts. `level` on trigger = accent/velocity. */

/** Bridged-T style resonator: a decaying sinusoid you "ping". Pinging while it
 *  still rings adds energy, as on the real circuit (fast retriggers stack). */
export class Resonator {
  private c = 0
  private s = 0
  ping(a: number): void {
    this.c += a
  }
  step(w: number, r: number): number {
    const cw = Math.cos(w)
    const sw = Math.sin(w)
    const c = this.c
    const s = this.s
    this.c = r * (c * cw - s * sw)
    this.s = r * (c * sw + s * cw)
    return this.s
  }
}

/** Zero-delay-feedback state-variable filter (Simper), for noise and metal shaping. */
export class Svf {
  private ic1 = 0
  private ic2 = 0
  lp = 0
  bp = 0
  hp = 0
  process(x: number, fc: number, k: number, fs: number): void {
    const g = Math.tan((Math.PI * Math.min(fc, fs * 0.45)) / fs)
    const a1 = 1 / (1 + g * (g + k))
    const a2 = g * a1
    const a3 = g * a2
    const v3 = x - this.ic2
    const v1 = a1 * this.ic1 + a2 * v3
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    this.lp = v2
    this.bp = v1
    this.hp = x - k * v1 - v2
  }
}

const decayCoef = (seconds: number, fs: number) => Math.exp(-4.6 / (Math.max(seconds, 0.005) * fs)) // −40 dB at `seconds`

export class KickVoice {
  private res = new Resonator()
  private pitchEnv = 0
  private readonly kPitch: number
  constructor(private readonly fs: number) {
    this.kPitch = Math.exp(-1 / (0.012 * fs))
  }
  trigger(level: number): void {
    this.res.ping(level)
    this.pitchEnv = 1
  }
  /** tune Hz, decay s, punch 0..1 (pitch-sweep depth), drive 0..1 */
  step(tune: number, decay: number, punch: number, drive: number): number {
    const f = tune * (1 + 2.5 * punch * this.pitchEnv)
    this.pitchEnv *= this.kPitch
    const y = this.res.step((TAU * f) / this.fs, decayCoef(decay, this.fs))
    const g = 1 + drive * 4
    return fastTanh(y * g) / fastTanh(g)
  }
}

export class SnareVoice {
  private body1 = new Resonator()
  private body2 = new Resonator()
  private noiseEnv = 0
  private hpX = 0
  private hpY = 0
  constructor(
    private readonly fs: number,
    private readonly rng: Rng,
  ) {}
  trigger(level: number): void {
    this.body1.ping(level * 0.8)
    this.body2.ping(level * 0.55)
    this.noiseEnv = level
  }
  /** tune Hz (lower head), tone 0..1 (upper-head balance), snappy 0..1, decay s (wires) */
  step(tune: number, tone: number, snappy: number, decay: number): number {
    const fs = this.fs
    const b1 = this.body1.step((TAU * tune) / fs, decayCoef(0.16, fs))
    const b2 = this.body2.step((TAU * tune * 1.62) / fs, decayCoef(0.1, fs))
    const body = b1 * (1 - 0.5 * tone) + b2 * (0.3 + 0.7 * tone)
    // Snare wires: highpassed white noise with its own envelope.
    const w = this.rng.next() * 2 - 1
    const R = 1 - (TAU * 1800) / fs
    this.hpY = w - this.hpX + R * this.hpY
    this.hpX = w
    const wires = this.hpY * this.noiseEnv
    this.noiseEnv *= decayCoef(decay, fs)
    return fastTanh(body * 0.9 + wires * snappy * 1.1)
  }
}

const BURSTS = 4
const BURST_TAU = 0.0022

/** Clap: several rapid noise bursts (hands not quite together) then a short
 *  reverberant tail, through a bandpass. */
export class ClapVoice {
  private t = 1e9
  private level = 0
  private readonly bp = new Svf()
  constructor(
    private readonly fs: number,
    private readonly rng: Rng,
  ) {}
  trigger(level: number): void {
    this.t = 0
    this.level = level
  }
  /** tone Hz (bandpass centre), decay s (tail), spread s (burst spacing) */
  step(tone: number, decay: number, spread: number): number {
    const fs = this.fs
    const ts = this.t++ / fs
    const k = Math.min(BURSTS - 1, Math.floor(ts / spread))
    const burst = Math.exp(-(ts - k * spread) / BURST_TAU)
    const tailStart = (BURSTS - 1) * spread
    const tail = ts >= tailStart ? 0.45 * Math.exp((-4.6 * (ts - tailStart)) / Math.max(decay, 0.02)) : 0
    const env = Math.max(burst, tail) * this.level
    this.bp.process((this.rng.next() * 2 - 1) * env, tone, 0.7, fs)
    return fastTanh(this.bp.bp * 2.2)
  }
}

/** The 808's six square-wave oscillators (Hz). Their inharmonic mix is the "metal". */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

/** Closed + open hi-hat sharing one metal source and filter bank; a closed hit
 *  chokes the open one, exactly like the pedal on a real kit. */
export class HatVoices {
  private readonly phase: Float64Array
  private readonly bpLow = new Svf()
  private readonly bpHigh = new Svf()
  private hpX = 0
  private hpY = 0
  private chEnv = 0
  private ohEnv = 0
  ch = 0
  oh = 0
  constructor(
    private readonly fs: number,
    rng: Rng,
  ) {
    this.phase = Float64Array.from(METAL, () => rng.next())
  }
  triggerClosed(level: number): void {
    this.chEnv = level
    this.ohEnv = 0 // choke
  }
  triggerOpen(level: number): void {
    this.ohEnv = level
  }
  /** tune = metal pitch multiplier, chDecay/ohDecay s, tone Hz (upper bandpass) */
  step(tune: number, chDecay: number, ohDecay: number, tone: number): void {
    const fs = this.fs
    let metal = 0
    for (let i = 0; i < METAL.length; i++) {
      let ph = this.phase[i] + (METAL[i] * tune) / fs
      if (ph >= 1) ph -= 1
      this.phase[i] = ph
      metal += ph < 0.5 ? 1 : -1
    }
    metal /= METAL.length
    this.bpLow.process(metal, tone * 0.48, 1.2, fs)
    this.bpHigh.process(metal, tone, 1.2, fs)
    const x = this.bpLow.bp * 0.6 + this.bpHigh.bp
    const R = 1 - (TAU * 5000) / fs
    this.hpY = x - this.hpX + R * this.hpY
    this.hpX = x
    this.ch = fastTanh(this.hpY * this.chEnv * 3)
    this.oh = fastTanh(this.hpY * this.ohEnv * 3)
    this.chEnv *= decayCoef(chDecay, fs)
    this.ohEnv *= decayCoef(ohDecay, fs)
  }
}

/** Short trigger/flash helper: counts down samples. */
export class Pulse {
  private n = 0
  fire(samples: number): void {
    this.n = samples
  }
  get on(): boolean {
    return this.n > 0
  }
  step(): boolean {
    if (this.n <= 0) return false
    this.n--
    return true
  }
}
