import { C4, polyBlep, TAU } from '../util'
import { KS_MAX, SAWS, type Voice } from './voice'

/** The engines, in SB_ENGINES order. Each turns a voice and its four knobs
 *  (k[0..3], 0..1) into one sample, before the envelope; `envV` is the
 *  envelope (some engines open their filter with it). */
type Engine = (v: Voice, k: Float64Array, envV: number, f: number, dt: number, fs: number) => number

const SPREAD = [0, -1, 1, -0.62, 0.62, -0.31, 0.31]
/** FM ratios the RATIO knob steps through. */
const RATIOS = [0.5, 1, 1.5, 2, 3, 4, 5, 7]

const saw = (ph: number, dt: number) => 2 * ph - 1 - polyBlep(ph, dt)
const square = (ph: number, dt: number) => (ph < 0.5 ? 1 : -1) + polyBlep(ph, dt) - polyBlep((ph + 0.5) % 1, dt)

/** TWIN: a saw and a square a little apart; SHAPE crossfades; the filter
 *  opens with the envelope. */
const twin: Engine = (v, k, envV, f, dt, fs) => {
  const d2 = dt * Math.pow(2, (k[1] * k[1] * 30) / 1200)
  v.ph[0] = (v.ph[0] + dt) % 1
  v.ph[1] = (v.ph[1] + d2) % 1
  const x = saw(v.ph[0], dt) * (1 - k[0]) + square(v.ph[1], d2) * k[0] + (2 * v.ph[1] - 1) * 0.3 * (1 - k[0])
  v.svf.process(x, 60 * Math.pow(250, k[2]) * (1 + envV * 2), 2 - k[3] * 1.85, fs)
  return v.svf.lp * 0.7
}

/** DUO: two-operator FM, the modulator's brightness falling over DECAY. */
const duo: Engine = (v, k, _e, _f, dt) => {
  const ratio = RATIOS[Math.min(RATIOS.length - 1, Math.floor(k[0] * RATIOS.length))]
  const decay = 0.05 + k[3] * k[3] * 3
  const index = k[1] * 6 * (0.25 + 0.75 * Math.exp(-v.age / decay))
  v.mph = (v.mph + dt * ratio) % 1
  const m = Math.sin(TAU * v.mph + v.fb * k[2] * 1.6)
  v.fb = m
  v.ph[0] = (v.ph[0] + dt) % 1
  return Math.sin(TAU * v.ph[0] + index * m) * 0.6
}

/** PLUCK: Karplus-Strong; DAMP is how long it rings, BODY how dark it gets. */
const pluck: Engine = (v, k, _e, f, _dt, fs) => {
  const n = Math.min(KS_MAX - 1, Math.max(2, Math.round(fs / f)))
  const y = v.ks[v.ksPos]
  const nxt = v.ks[(v.ksPos + 1) % n]
  const loss = 0.9 + k[0] * 0.0995 - (v.gate > 0 ? 0 : 0.02)
  v.ksLp += ((y + nxt) * 0.5 - v.ksLp) * (0.25 + (1 - k[2]) * 0.75)
  v.ks[v.ksPos] = v.ksLp * loss
  v.ksPos = (v.ksPos + 1) % n
  return y * 1.4
}

/** SWARM: seven detuned saws, the side saws mixed in by SPREAD, a sub. */
const swarm: Engine = (v, k, envV, _f, dt, fs) => {
  const det = k[0] * k[0] * 0.03
  let side = 0
  let mid = 0
  for (let i = 0; i < SAWS; i++) {
    const d = dt * (1 + SPREAD[i] * det)
    v.ph[i] = (v.ph[i] + d) % 1
    const s = saw(v.ph[i], d)
    if (i === 0) mid = s
    else side += s
  }
  v.ph[SAWS] = (v.ph[SAWS] + dt * 0.5) % 1
  const sub = v.ph[SAWS] < 0.5 ? 1 : -1
  const x = mid * (1 - k[1] * 0.6) + (side / 6) * k[1] * 1.6 + sub * k[3] * 0.7
  v.svf.process(x, 120 * Math.pow(140, k[2]) * (1 + envV * 0.6), 1.2, fs)
  return v.svf.lp * 0.6
}

/** PHASE: Casio-CZ-style phase distortion. A cosine read through a bent
 *  phase: bending it makes a saw (WAVE left), a pulse (middle) or a resonant
 *  sweep (right, at RESO × the note). DCW is how bent; ENV how far the
 *  envelope bends it more. */
const phase: Engine = (v, k, envV, _f, dt) => {
  v.ph[0] = (v.ph[0] + dt) % 1
  const ph = v.ph[0]
  const dcw = Math.min(0.98, k[1] * (0.4 + 0.6 * envV * k[2] + 0.6 * (1 - k[2])))
  const mode = k[0] < 0.34 ? 0 : k[0] < 0.67 ? 1 : 2
  if (mode === 2) {
    // resonance: a fast cosine inside a falling window, reset every cycle
    const ratio = 1 + k[3] * 7 * dcw
    return (1 - ph) * Math.cos(TAU * ph * ratio) * 0.9
  }
  const d = 0.5 - dcw * 0.49 // the knee: 0.5 = no bend (a plain cosine)
  let bent: number
  if (mode === 0) bent = ph < d ? (ph / d) * 0.5 : 0.5 + ((ph - d) / (1 - d)) * 0.5
  else {
    // pulse: bend both halves
    const h = ph < 0.5 ? ph * 2 : (ph - 0.5) * 2
    const b = h < d * 2 ? (h / (d * 2)) * 0.5 : 0.5
    bent = ph < 0.5 ? b * 0.5 : 0.5 + b * 0.5
  }
  return -Math.cos(TAU * bent) * 0.7
}

/** DUST: noise ringing a resonator tuned to the note, a sine body under it,
 *  through a bit/rate crusher (GRIT). */
const dust: Engine = (v, k, _e, f, dt, fs) => {
  const n = v.white()
  v.svf.process(n, Math.min(fs * 0.45, f * (1 + k[0] * 3)), 2 - k[1] * 1.97, fs)
  v.ph[0] = (v.ph[0] + dt) % 1
  let x = v.svf.bp * (2 + k[1] * 6) * (1 - k[3] * 0.7) + Math.sin(TAU * v.ph[0]) * k[3]
  // GRIT: hold every Nth sample and fewer bits
  const every = 1 + Math.floor(k[2] * k[2] * 24)
  if (--v.heldFor <= 0) {
    const bits = 2 + (1 - k[2]) * 14
    const q = Math.pow(2, bits)
    v.held = Math.round(x * q) / q
    v.heldFor = every
  }
  x = v.held
  return Math.tanh(x) * 0.8
}

/** WAVE: a wavetable that morphs sine → triangle → saw → square → a hollow
 *  formant pulse (POSITION); WARP bends the phase; a twin a hair apart. */
function waveTable(j: number, w: number, d: number): number {
  if (j === 0) return Math.sin(TAU * w)
  if (j === 1) return 1 - 4 * Math.abs(w - 0.5)
  if (j === 2) return saw(w, d)
  if (j === 3) return square(w, d)
  return Math.sin(TAU * w) * Math.sin(TAU * w * 3)
}
/** The table at POSITION (k0, crossfading neighbours), read through WARP (k1). */
function waveAt(ph: number, d: number, k: Float64Array): number {
  const w = Math.pow(ph, 1 + k[1] * 2.5)
  const pos = k[0] * 4
  const i = Math.min(3, Math.floor(pos))
  const t = pos - i
  return waveTable(i, w, d) * (1 - t) + waveTable(i + 1, w, d) * t
}
const wave: Engine = (v, k, envV, _f, dt, fs) => {
  const d2 = dt * (1 + k[3] * 0.012)
  v.ph[0] = (v.ph[0] + dt) % 1
  v.ph[1] = (v.ph[1] + d2) % 1
  const x = (waveAt(v.ph[0], dt, k) + waveAt(v.ph[1], d2, k) * k[3]) / (1 + k[3])
  v.svf.process(x, 200 * Math.pow(80, k[2]) * (1 + envV), 1.4, fs)
  return v.svf.lp * 0.75
}

const ENGINES: Engine[] = [twin, duo, pluck, swarm, phase, dust, wave]

/** One sample of a voice through engine `engine`; `bend` shifts its pitch
 *  (volts: the LFO's vibrato). */
export function render(v: Voice, engine: number, k: Float64Array, envV: number, fs: number, bend: number): number {
  const f = C4 * Math.pow(2, v.volts + v.drift + bend)
  const dt = Math.min(0.45, f / fs)
  v.age += 1 / fs
  return (ENGINES[engine] ?? twin)(v, k, envV, f, dt, fs)
}
