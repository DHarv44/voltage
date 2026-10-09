import type { ModuleSpec } from '../../modules/types'
import { MELODY_NOTES, PSL, PSTEPS, SCALE_STEPS } from '../../modules/specs/pocketSynth'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Svf } from './drumVoices'
import { PocketClock } from './pocketClock'
import { C4, polyBlep, TAU } from './util'

const SQUARE = 1
const BUZZ = 2
const GLIDE = 1
const ECHO = 1
const CRUSH = 2
/** The echo: up to this long (s), at three sixteenths. */
const ECHO_MAX_S = 1.2

/** POCKET ROBOT: one mono lead (saw, square, or a ring-modulated BUZZ) through
 *  a resonant low-pass with its own sweep, gliding between notes, into an
 *  ECHO or a CRUSH. The steps play it like the other POCKETs; off WRITE the
 *  buttons play it live, and with REC on (while running) each button pressed
 *  is written into the nearest step. */
export class PocketRobotDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oRst = this.oi('rsto')
  private readonly P = {
    tempo: this.pi('tempo'), swing: this.pi('swing'), vol: this.pi('vol'), run: this.pi('run'), voice: this.pi('voice'),
    oct: this.pi('oct'), a: this.pi('a'), b: this.pi('b'), scale: this.pi('scale'), root: this.pi('root'),
    glide: this.pi('glide'), fx: this.pi('fx'), rec: this.pi('rec'), mask: this.pi('m'), note: this.pi('n0'), flag: this.pi('f0'),
  }
  private readonly clock: PocketClock
  private readonly svf = new Svf()
  private readonly echo: Float32Array
  private echoAt = 0
  private ph = 0
  private rph = 0
  /** Pitch now, and where it's gliding to (volts; not `target`: the base class has one). */
  private volts = 0
  private goal = 0
  private gliding = false
  private gate = 0
  private amp = 0
  private sweep = 0
  private deg = 0
  private held = -1
  private flash = 0
  /** Samples since the current step began (where a recorded note lands). */
  private sinceStep = 0
  private crushHold = 0
  private crushAt = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(PSTEPS, fs)
    this.echo = new Float32Array(Math.ceil(ECHO_MAX_S * fs))
  }

  /** Scale degree → volts (0 V = C4), with root and octave. */
  private degVolts(degree: number): number {
    const steps = SCALE_STEPS[Math.round(this.p[this.P.scale])] ?? SCALE_STEPS[0]
    const d = Math.max(0, Math.round(degree))
    return (steps[d % steps.length] + 12 * Math.floor(d / steps.length) + this.p[this.P.root] + 12 * this.p[this.P.oct] - 12) / 12
  }

  private note(degree: number, glide: boolean, gateSec: number): void {
    this.deg = degree
    this.goal = this.degVolts(degree)
    // a glide swoops in from the last pitch (sounding or not); a plain note jumps
    this.gliding = glide
    if (!this.gliding) this.volts = this.goal
    this.gate = gateSec * this.fs
    this.sweep = 1
    this.flash = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || ev.name !== 'key') return
    if (!ev.down) {
      this.held = -1
      this.gate = 0
      return
    }
    // played live: legato from a key still held glides, like a mono synth
    const d = Math.min(MELODY_NOTES, Math.round(ev.x))
    this.note(d, this.held >= 0 || this.gate > 0, 30)
    this.held = d
    // recording: into this step, or the next one if it's more than half gone
    const c = this.clock
    if (this.p[this.P.rec] >= 0.5 && c.step >= 0) {
      const s = this.sinceStep > (c.stepLen * this.fs) / 2 ? (c.step + 1) % PSTEPS : c.step
      this.writeParam(this.P.note + s, d)
      this.writeParam(this.P.flag + s, 0)
      this.writeParam(this.P.mask, Math.round(this.p[this.P.mask]) | (1 << s))
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const c = this.clock
    this.sinceStep++
    if (c.tick(p[this.P.run] >= 0.5, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.P.tempo], p[this.P.swing], this.in[this.iRst])) {
      this.sinceStep = 0
      const s = c.step
      // steps play unless a key is held (the hand wins)
      if (this.held < 0 && (p[this.P.mask] & (1 << s)) !== 0) this.note(p[this.P.note + s], Math.round(p[this.P.flag + s]) === GLIDE, c.stepLen * 0.75)
    }
    this.out[this.oRst] = c.rstSample()

    // pitch: gliding toward the goal at GLIDE's pace
    if (this.gliding) {
      this.volts += (this.goal - this.volts) * (1 - Math.exp(-1 / (p[this.P.glide] * 0.4 * fs)))
      if (Math.abs(this.goal - this.volts) < 1e-4) this.gliding = false
    }
    const on = this.gate > 0 || this.held >= 0
    if (this.gate > 0) this.gate--
    this.amp += ((on ? 1 : 0) - this.amp) * (on ? 0.006 : 0.0015)
    this.sweep *= Math.exp(-1 / (0.25 * fs))

    let y = 0
    if (this.amp > 1e-4) {
      const f = C4 * Math.pow(2, this.volts)
      const dt = f / fs
      this.ph = (this.ph + dt) % 1
      const voice = Math.round(p[this.P.voice])
      if (voice === SQUARE) y = (this.ph < 0.5 ? 1 : -1) + polyBlep(this.ph, dt) - polyBlep((this.ph + 0.5) % 1, dt)
      else {
        y = 2 * this.ph - 1 - polyBlep(this.ph, dt)
        if (voice === BUZZ) {
          // ring-modulated by a sine a little off the octave: the robot buzz
          this.rph = (this.rph + dt * 2.02) % 1
          y *= Math.sin(TAU * this.rph)
        }
      }
      // TONE opens the filter, the sweep adds a squelch on every note
      this.svf.process(y, 120 * Math.pow(60, p[this.P.a] * 0.85 + this.sweep * 0.25), 0.55, fs)
      y = this.svf.lp * this.amp
    }

    // the effect, B its amount
    const fx = Math.round(p[this.P.fx])
    const amt = p[this.P.b]
    if (fx === ECHO) {
      const n = this.echo.length
      const delay = Math.min(n - 1, Math.max(1, Math.round(c.stepLen * 3 * fs)))
      const wet = this.echo[(this.echoAt - delay + n) % n]
      this.echo[this.echoAt] = y + wet * 0.55 * amt
      this.echoAt = (this.echoAt + 1) % n
      y += wet * amt
    } else if (fx === CRUSH) {
      // fewer bits, and samples held longer
      if (--this.crushAt <= 0) {
        const levels = Math.pow(2, 12 - amt * 9)
        this.crushHold = Math.round(y * levels) / levels
        this.crushAt = 1 + Math.round(amt * 14)
      }
      y = this.crushHold
    }

    const o = this.out
    o[0] = Math.tanh(y * 0.8) * 5 * p[this.P.vol]
    o[1] = c.clkSample()
    o[2] = this.volts
    o[3] = on ? 10 : 0
    this.flash *= 0.9995
    this.led[PSL.step] = c.step
    this.led[PSL.flash] = this.flash
    this.led[PSL.note] = this.deg
  }
}
