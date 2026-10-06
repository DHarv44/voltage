import { EnvCore } from '../cores'
import { Svf } from '../drumVoices'
import { C4, polyBlep, TAU, type Rng } from '../util'

/** Supersaw oscillators per voice, and their detune pattern (−1..1). */
export const SAWS = 7
const SPREAD = [0, -1, 1, -0.62, 0.62, -0.31, 0.31]
/** Karplus-Strong delay: enough for the lowest note (≈ 30 Hz at 48 kHz). */
const KS_MAX = 2048
/** FM ratios the RATIO knob steps through. */
const RATIOS = [0.5, 1, 1.5, 2, 3, 4, 5, 7]

/** One sounding note, with state for every engine (a voice can change
 *  engine between notes). */
export class Voice {
  volts = 0
  vel = 1
  /** Samples left before a sequenced note lets go (−1: held until note off). */
  hold = -1
  gate = 0
  age = 0
  /** For stealing: when it started. */
  born = 0
  readonly env: EnvCore
  readonly ph = new Float64Array(SAWS + 1)
  mph = 0
  fb = 0
  readonly svf = new Svf()
  readonly ks = new Float32Array(KS_MAX)
  ksPos = 0
  ksLp = 0
  /** A little analog drift per voice, so chords breathe. */
  readonly drift: number

  constructor(fs: number, rng: Rng) {
    this.env = new EnvCore(fs, 1)
    this.drift = (rng.next() - 0.5) * 0.004
    for (let i = 0; i <= SAWS; i++) this.ph[i] = rng.next()
  }

  get sounding(): boolean {
    return this.gate > 0 || this.env.stage !== 0
  }

  /** Strike: (PLUCK) fill the string with a burst shaped by BRIGHT and PLUCK
   *  position; every engine restarts its brightness clock. */
  start(volts: number, vel: number, hold: number, born: number, k: Float64Array, rng: Rng, fs: number): void {
    this.volts = volts
    this.vel = vel
    this.hold = hold
    this.gate = 10
    this.age = 0
    this.born = born
    const f = C4 * Math.pow(2, volts)
    const n = Math.min(KS_MAX - 1, Math.max(2, Math.round(fs / f)))
    let lp = 0
    const bright = 0.15 + k[1] * 0.85
    const pos = Math.max(1, Math.round(n * (0.05 + k[3] * 0.45)))
    for (let i = 0; i < n; i++) {
      lp += (rng.next() * 2 - 1 - lp) * bright
      this.ks[i] = lp
    }
    // pluck position: a comb (the string can't move at its node)
    for (let i = n - 1; i >= pos; i--) this.ks[i] -= this.ks[i - pos] * 0.9
    this.ksPos = 0
  }
}

/** One sample of a voice through its engine (four knobs k[0..3], 0..1).
 *  Returns the dry signal before the envelope. */
export function render(v: Voice, engine: number, k: Float64Array, envV: number, fs: number): number {
  const f = C4 * Math.pow(2, v.volts + v.drift)
  const dt = Math.min(0.45, f / fs)
  v.age += 1 / fs
  switch (engine) {
    case 1: {
      // DUO: two-operator FM, the modulator's brightness falling over DECAY
      const ratio = RATIOS[Math.min(RATIOS.length - 1, Math.floor(k[0] * RATIOS.length))]
      const decay = 0.05 + k[3] * k[3] * 3
      const index = k[1] * 6 * (0.25 + 0.75 * Math.exp(-v.age / decay))
      v.mph = (v.mph + dt * ratio) % 1
      const m = Math.sin(TAU * v.mph + v.fb * k[2] * 1.6)
      v.fb = m
      v.ph[0] = (v.ph[0] + dt) % 1
      return Math.sin(TAU * v.ph[0] + index * m) * 0.6
    }
    case 2: {
      // PLUCK: Karplus-Strong; DAMP is how long it rings, BODY how dark it gets
      const n = Math.min(KS_MAX - 1, Math.max(2, Math.round(fs / f)))
      const y = v.ks[v.ksPos]
      const nxt = v.ks[(v.ksPos + 1) % n]
      const loss = 0.9 + k[0] * 0.0995 - (v.gate > 0 ? 0 : 0.02)
      v.ksLp += ((y + nxt) * 0.5 - v.ksLp) * (0.25 + (1 - k[2]) * 0.75)
      v.ks[v.ksPos] = v.ksLp * loss
      v.ksPos = (v.ksPos + 1) % n
      return y * 1.4
    }
    case 3: {
      // SWARM: seven detuned saws, side saws mixed by SPREAD, a sub an octave down
      const det = k[0] * k[0] * 0.03
      let side = 0
      let mid = 0
      for (let i = 0; i < SAWS; i++) {
        const d = dt * (1 + SPREAD[i] * det)
        v.ph[i] = (v.ph[i] + d) % 1
        const s = 2 * v.ph[i] - 1 - polyBlep(v.ph[i], d)
        if (i === 0) mid = s
        else side += s
      }
      v.ph[SAWS] = (v.ph[SAWS] + dt * 0.5) % 1
      const sub = v.ph[SAWS] < 0.5 ? 1 : -1
      const x = mid * (1 - k[1] * 0.6) + (side / 6) * k[1] * 1.6 + sub * k[3] * 0.7
      v.svf.process(x, 120 * Math.pow(140, k[2]) * (1 + envV * 0.6), 1.2, fs)
      return v.svf.lp * 0.6
    }
    default: {
      // TWIN: a saw and a square, a little apart; SHAPE crossfades them;
      // the filter opens with the envelope
      const d1 = dt
      const d2 = dt * Math.pow(2, (k[1] * k[1] * 30) / 1200)
      v.ph[0] = (v.ph[0] + d1) % 1
      v.ph[1] = (v.ph[1] + d2) % 1
      const saw = 2 * v.ph[0] - 1 - polyBlep(v.ph[0], d1)
      const p = v.ph[1]
      const sq = (p < 0.5 ? 1 : -1) + polyBlep(p, d2) - polyBlep((p + 0.5) % 1, d2)
      const x = saw * (1 - k[0]) + sq * k[0] + (2 * v.ph[1] - 1) * 0.3 * (1 - k[0])
      v.svf.process(x, 60 * Math.pow(250, k[2]) * (1 + envV * 2), 2 - k[3] * 1.85, fs)
      return v.svf.lp * 0.7
    }
  }
}
