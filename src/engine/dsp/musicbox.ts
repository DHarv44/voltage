import type { ModuleSpec } from '../../modules/types'
import { MB_NOTES, MB_STEPS, MBL } from '../../modules/specs/musicbox'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { C4, TAU } from './util'

/** Partials of a weighted steel tine (inharmonic, upper ones short-lived). */
const PARTIALS = [
  { ratio: 1, amp: 1, decay: 1 },
  { ratio: 5.93, amp: 0.22, decay: 0.22 },
  { ratio: 14.2, amp: 0.07, decay: 0.08 },
]
/** Strip steps advanced per crank revolution. */
const STEPS_PER_TURN = 2
const DAMP_S = 0.006

/** One partial as a rotating phasor: no sin() per sample. */
class Mode {
  re = 0
  im = 0
  c = 1
  s = 0
  g = 1
  tune(f: number, decaySec: number, fs: number): void {
    const w = (TAU * Math.min(f, fs * 0.45)) / fs
    this.c = Math.cos(w)
    this.s = Math.sin(w)
    this.g = Math.exp(-1 / (decaySec * fs))
  }
  step(): number {
    const re = (this.re * this.c - this.im * this.s) * this.g
    this.im = (this.re * this.s + this.im * this.c) * this.g
    this.re = re
    return this.im
  }
}

class Tine {
  readonly modes = PARTIALS.map(() => new Mode())
  /** Samples of pin-damping left before the pluck lands. */
  damp = 0
  pending = false
}

/** Music box mechanism: the strip moves under the comb (crank, motor or CLK)
 *  and every hole that passes a tine plucks it. */
export class MusicBoxDsp extends Dsp {
  private readonly pMotor = this.pi('motor')
  private readonly pTempo = this.pi('tempo')
  private readonly pDecay = this.pi('decay')
  private readonly pTone = this.pi('tone')
  private readonly pLevel = this.pi('level')
  private readonly pRow0 = this.pi('r0')
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private readonly tines: Tine[]
  private readonly freqs: number[]
  private pos = 0
  private crank = 0
  private crankTarget = 0
  private lastDecay = -1
  private pitch = 0
  private gate = 0
  private stepPulse = 0
  private tine = -1
  private flash = 0
  private body = 0
  private body2 = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    // each tine is tuned by hand: a few cents out, as on every real comb
    this.freqs = MB_NOTES.map((s) => C4 * Math.pow(2, s / 12 + this.rng.gauss() * 0.0015))
    this.tines = MB_NOTES.map(() => new Tine())
  }

  onUi(ev: UiEvent): void {
    // x = revolutions turned since the last event. A ratchet stops it going back.
    if (ev.kind === 'surface' && ev.name === 'crank') this.crankTarget += Math.max(0, ev.x)
  }

  private retune(decay: number): void {
    this.tines.forEach((t, i) => t.modes.forEach((m, k) => m.tune(this.freqs[i] * PARTIALS[k].ratio, decay * PARTIALS[k].decay * (1.4 - i / 30), this.fs)))
    this.lastDecay = decay
  }

  private pluck(row: number): void {
    const t = this.tines[row]
    t.pending = true
    t.damp = Math.round(DAMP_S * this.fs)
    this.pitch = MB_NOTES[row] / 12
    this.gate = Math.round(0.01 * this.fs)
    this.tine = row
    this.flash = 1
  }

  /** Strip moved from a to b (steps): pluck every punched hole crossed. */
  private advance(a: number, b: number): void {
    for (let s = Math.floor(a) + 1; s <= Math.floor(b); s++) {
      const step = ((s % MB_STEPS) + MB_STEPS) % MB_STEPS
      this.stepPulse = Math.round(0.005 * this.fs)
      const bit = 2 ** step
      for (let r = 0; r < this.tines.length; r++) if (Math.floor(this.p[this.pRow0 + r] / bit) % 2 === 1) this.pluck(r)
    }
  }

  tick(): void {
    const p = this.p
    if (p[this.pDecay] !== this.lastDecay) this.retune(p[this.pDecay])
    if (this.rst.rise(this.in[this.iRst])) this.pos = -0.001

    const before = this.pos
    if (this.patched[this.iClk]) {
      if (this.clk.rise(this.in[this.iClk])) this.pos = Math.floor(this.pos) + 1
    } else if (p[this.pMotor] >= 0.5) this.pos += p[this.pTempo] / this.fs
    else {
      // the crank's flywheel smooths the hand
      const d = (this.crankTarget - this.crank) * (1 - Math.exp(-1 / (0.03 * this.fs)))
      this.crank += d
      this.pos += d * STEPS_PER_TURN
    }
    if (this.pos !== before) this.advance(before, this.pos)
    if (this.pos >= MB_STEPS * 1000) this.pos -= MB_STEPS * 1000

    let y = 0
    for (const t of this.tines) {
      if (t.damp > 0) {
        for (const m of t.modes) {
          m.re *= 0.995
          m.im *= 0.995
        }
        if (--t.damp === 0 && t.pending) {
          t.pending = false
          t.modes.forEach((m, k) => {
            m.re = PARTIALS[k].amp
            m.im = 0
          })
        }
      }
      for (const m of t.modes) y += m.step()
    }
    // Soundboard: a broad resonance and the case's low-pass.
    const k = 0.08 + p[this.pTone] * 0.5
    this.body += (y - this.body) * k
    this.body2 += (this.body - this.body2) * k
    const out = (this.body2 * 0.6 + (y - this.body2) * 0.15 * p[this.pTone]) * 0.9

    const o = this.out
    o[0] = out * 2.2 * p[this.pLevel]
    o[1] = this.gate > 0 ? 10 : 0
    o[2] = this.pitch
    o[3] = this.stepPulse > 0 ? 10 : 0
    if (this.gate > 0) this.gate--
    if (this.stepPulse > 0) this.stepPulse--
    this.flash *= 0.99985

    const led = this.led
    led[MBL.pos] = ((this.pos % MB_STEPS) + MB_STEPS) % MB_STEPS
    led[MBL.tine] = this.tine
    led[MBL.flash] = this.flash
    led[MBL.crank] = this.crank - Math.floor(this.crank)
  }
}
