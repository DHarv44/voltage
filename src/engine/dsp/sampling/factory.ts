import { Rng, TAU } from '../util'
import type { SampleData } from './voice'

/** A factory sample: its sound, the note it was played at (MIDI), and a loop
 *  for the sustained ones (source samples; 0, 0 = none). */
export interface FactorySample extends SampleData {
  name: string
  root: number
  loopStart: number
  loopEnd: number
}

/** The factory sounds, synthesised here (nothing downloaded): what the
 *  period samplers shipped with, in our own takes. */
export const FACTORY_NAMES = ['ORCH HIT', 'CHOIR', 'STRINGS', 'BELL', 'BASS', 'PIANO', 'HEY!', 'BREAK'] as const

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** Two-pole resonant band-pass (formants), run sample by sample. */
class Formant {
  private y1 = 0
  private y2 = 0
  private readonly a1: number
  private readonly a2: number
  private readonly g: number
  constructor(f: number, bw: number, rate: number) {
    const r = Math.exp((-Math.PI * bw) / rate)
    this.a1 = 2 * r * Math.cos((TAU * f) / rate)
    this.a2 = -r * r
    this.g = 1 - r
  }
  run(x: number): number {
    const y = this.g * x + this.a1 * this.y1 + this.a2 * this.y2
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

/** A saw with a little drift (an ensemble voice). */
function saw(ph: number): number {
  return 2 * (ph - Math.floor(ph)) - 1
}

/** A short, dark hall: four combs (for the stab's tail). */
function hall(d: Float32Array, rate: number, mix: number): void {
  const lens = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => Math.round(s * rate))
  const bufs = lens.map((n) => new Float32Array(n))
  const at = [0, 0, 0, 0]
  const lp = [0, 0, 0, 0]
  for (let i = 0; i < d.length; i++) {
    let w = 0
    for (let c = 0; c < 4; c++) {
      const y = bufs[c][at[c]]
      lp[c] += (y - lp[c]) * 0.4
      bufs[c][at[c]] = d[i] * 0.3 + lp[c] * 0.84
      at[c] = (at[c] + 1) % lens[c]
      w += y
    }
    d[i] += w * mix * 0.25
  }
}

function normalise(d: Float32Array, peak = 0.9): void {
  let m = 0
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]))
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m
}

/** Build factory sound `k` at `rate`. */
export function makeFactory(k: number, rate: number): FactorySample {
  const name = FACTORY_NAMES[k] ?? FACTORY_NAMES[0]
  const rng = new Rng(0x5a17 + k)
  const secs = name === 'BREAK' ? 4 : name === 'STRINGS' || name === 'CHOIR' ? 2.4 : name === 'BELL' ? 3 : name === 'HEY!' ? 0.6 : 1.6
  const n = Math.round(secs * rate)
  const d = new Float32Array(n)
  let root = 60
  let loopStart = 0
  let loopEnd = 0
  const t = (i: number) => i / rate
  if (name === 'ORCH HIT') {
    // brass and strings on a C chord over a timpani, struck at once
    const notes = [48, 52, 55, 60, 64, 67, 72]
    const fs = [new Formant(700, 400, rate), new Formant(1300, 600, rate), new Formant(2600, 900, rate), new Formant(3800, 1400, rate)]
    const ph = notes.map(() => rng.next())
    for (let i = 0; i < n; i++) {
      const tt = t(i)
      const env = Math.min(1, tt / 0.004) * Math.exp(-tt / 0.32)
      let x = 0
      notes.forEach((m, j) => {
        ph[j] += (hz(m) * (1 + (j % 2 ? 0.004 : -0.003))) / rate
        x += saw(ph[j])
      })
      const brass = fs[0].run(x) + fs[1].run(x) * 0.7 + fs[2].run(x) * 0.45 + fs[3].run(x) * 0.3
      const timp = Math.sin(TAU * 65 * tt * (1 + 0.3 * Math.exp(-tt / 0.05))) * Math.exp(-tt / 0.5)
      // the brass's rasp: the raw saws, brightest at the strike
      d[i] = (brass * 1.3 + x * (0.06 + 0.16 * Math.exp(-tt / 0.12))) * env + timp * 0.6 + (rng.next() * 2 - 1) * Math.exp(-tt / 0.01) * 0.3
    }
    hall(d, rate, 0.9)
  } else if (name === 'CHOIR' || name === 'STRINGS') {
    // a held chord: voices drifting against each other (sustained, loopable)
    root = 57
    const notes = name === 'CHOIR' ? [57, 57, 57, 69] : [45, 57, 64, 69, 72]
    const ph = notes.map(() => rng.next())
    const vib = notes.map(() => rng.next() * 6)
    const fs = name === 'CHOIR' ? [new Formant(800, 120, rate), new Formant(1150, 150, rate), new Formant(2900, 250, rate)] : []
    let lp = 0
    for (let i = 0; i < n; i++) {
      const tt = t(i)
      let x = 0
      notes.forEach((m, j) => {
        ph[j] += (hz(m) * (1 + 0.004 * Math.sin(TAU * 5.2 * tt + vib[j]) + (j - 1.5) * 0.002)) / rate
        x += saw(ph[j])
      })
      const env = Math.min(1, tt / (name === 'CHOIR' ? 0.15 : 0.25))
      if (name === 'CHOIR') d[i] = (fs[0].run(x) + fs[1].run(x) * 0.6 + fs[2].run(x) * 0.2 + x * 0.01) * env
      else {
        lp += (x - lp) * 0.18
        d[i] = lp * env
      }
    }
    loopStart = Math.round(0.6 * rate)
    loopEnd = Math.round(2.2 * rate)
  } else if (name === 'BELL') {
    root = 72
    for (let i = 0; i < n; i++) {
      const tt = t(i)
      const f = hz(72)
      const mod = Math.sin(TAU * f * 3.5 * tt) * 2.2 * Math.exp(-tt / 0.6)
      d[i] = Math.sin(TAU * f * tt + mod) * Math.exp(-tt / 0.9) + Math.sin(TAU * f * 2.76 * tt) * 0.2 * Math.exp(-tt / 0.3)
    }
  } else if (name === 'BASS') {
    root = 36
    let ph = 0
    let lp = 0
    for (let i = 0; i < n; i++) {
      const tt = t(i)
      ph += hz(36) / rate
      const cut = 0.04 + 0.4 * Math.exp(-tt / 0.08)
      lp += (saw(ph) - lp) * cut
      d[i] = lp * Math.exp(-tt / 0.7) + (rng.next() * 2 - 1) * Math.exp(-tt / 0.004) * 0.2
    }
  } else if (name === 'PIANO') {
    for (let i = 0; i < n; i++) {
      const tt = t(i)
      let x = 0
      for (let h = 1; h <= 10; h++) x += (Math.sin(TAU * hz(60) * h * (1 + 0.0004 * h * h) * tt) / h) * Math.exp(-tt * (0.8 + h * 0.5))
      d[i] = x * Math.min(1, tt / 0.002)
    }
  } else if (name === 'HEY!') {
    // an "h" of breath, then "ey" sliding (a shouted vocal)
    root = 64
    const ph = [0]
    const f1 = new Formant(600, 150, rate)
    const f2 = new Formant(1800, 200, rate)
    for (let i = 0; i < n; i++) {
      const tt = t(i)
      ph[0] += (hz(64) * (1 - 0.06 * Math.min(1, tt / 0.5))) / rate
      const breath = (rng.next() * 2 - 1) * Math.exp(-tt / 0.05) * 0.5
      const voice = saw(ph[0]) * Math.min(1, Math.max(0, (tt - 0.03) / 0.03)) * Math.exp(-Math.max(0, tt - 0.3) / 0.12)
      d[i] = f1.run(voice + breath) + f2.run(voice + breath) * 0.8
    }
  } else {
    // BREAK: two bars at 120 BPM, a swung kick, snare and hats with ghosts
    root = 60
    const step = (60 / 120 / 4) * rate
    const kick = 'x.....x...x.....x..x..x...x.....'
    const snare = '....x..g.g..x.......x..g....x..g'
    const hat = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    for (let s = 0; s < 32; s++) {
      const at = Math.round(s * step + (s % 2 ? step * 0.12 : 0))
      const hit = (len: number, f: (u: number) => number) => {
        for (let i = 0; i < len && at + i < n; i++) d[at + i] += f(i / rate)
      }
      if (kick[s] === 'x') hit(Math.round(0.35 * rate), (u) => Math.sin(TAU * 52 * u * (1 + 2.5 * Math.exp(-u / 0.03))) * Math.exp(-u / 0.18))
      if (snare[s] !== '.') {
        const g = snare[s] === 'g' ? 0.25 : 1
        hit(Math.round(0.25 * rate), (u) => g * ((rng.next() * 2 - 1) * Math.exp(-u / 0.09) * 0.7 + Math.sin(TAU * 190 * u) * Math.exp(-u / 0.05) * 0.5))
      }
      if (hat[s] === 'x') {
        let hp = 0
        hit(Math.round(0.05 * rate), (u) => {
          const w = rng.next() * 2 - 1
          hp += (w - hp) * 0.5
          return (w - hp) * Math.exp(-u / 0.015) * (s % 2 ? 0.18 : 0.3)
        })
      }
    }
  }
  normalise(d)
  return { name, data: d, len: n, rate, root, loopStart, loopEnd }
}
