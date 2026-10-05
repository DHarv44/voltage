import type { ModuleSpec } from '../../modules/types'
import { PSL, PSTEPS } from '../../modules/specs/pocketSynth'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Svf } from './drumVoices'
import { PocketClock } from './pocketClock'
import { C4, polyBlep, TAU } from './util'

const SUB = 0
const SQUARE = 1
/** Note 0 is C2 (two octaves under the 0 V = C4 reference). */
const BASE = -24

/** POCKET BASS: a mono bass voice played by 16 note steps. A step's SLIDE
 *  glides into its note without restarting the envelope (tied, 303-style);
 *  ACCENT hits harder and opens the filter further. Off WRITE, the 16 buttons
 *  are a keyboard (semitones up from C). */
export class PocketBassDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly pTempo = this.pi('tempo')
  private readonly pSwing = this.pi('swing')
  private readonly pVol = this.pi('vol')
  private readonly pRun = this.pi('run')
  private readonly pVoice = this.pi('voice')
  private readonly pOct = this.pi('oct')
  private readonly pA = this.pi('a')
  private readonly pB = this.pi('b')
  private readonly pMask = this.pi('m')
  private readonly pNote = this.pi('n0')
  private readonly pFlag = this.pi('f0')
  private readonly clock: PocketClock
  private readonly filter = new Svf()
  private ph = 0
  private sub = 0
  /** Sounding pitch (semitones from C2), gliding toward `goalNote`. */
  private semis = 0
  private goalNote = 0
  private gliding = false
  private gateLeft = 0
  private held = false
  private amp = 0
  private ampT = 0
  private fenv = 0
  private accent = false
  private flash = 0
  private readonly atk: number
  private readonly rel: number
  private readonly glide: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(PSTEPS, fs)
    this.atk = 1 - Math.exp(-1 / (0.003 * fs))
    this.rel = Math.exp(-1 / (0.03 * fs))
    this.glide = 1 - Math.exp(-1 / (0.05 * fs))
  }

  private note(n: number, slide: boolean, accent: boolean, gateSec: number): void {
    this.goalNote = n
    // a slide only glides if a note is still sounding to glide from
    this.gliding = slide && (this.gateLeft > 0 || this.held)
    if (!this.gliding) {
      this.semis = n
      this.ampT = 0
      this.fenv = 1
      this.flash = 1
    }
    this.accent = accent
    this.gateLeft = gateSec * this.fs
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    // the keyboard (or auditioning a step while you set its note)
    if (ev.name === 'key') {
      if (ev.down) {
        this.note(Math.round(ev.x), false, false, 0)
        this.held = true
      } else this.held = false
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const c = this.clock
    if (c.tick(p[this.pRun] >= 0.5, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], p[this.pSwing])) {
      const s = c.step
      if (p[this.pMask] & (1 << s)) {
        const next = (s + 1) % PSTEPS
        // held into the next step if that one slides in
        const tie = (p[this.pMask] & (1 << next)) !== 0 && (p[this.pFlag + next] & 1) !== 0
        const f = p[this.pFlag + s]
        this.note(p[this.pNote + s], (f & 1) !== 0, (f & 2) !== 0, c.stepLen * (tie ? 1.05 : 0.55))
      }
    }

    // Pitch: slides glide, everything else jumps.
    this.semis += (this.goalNote - this.semis) * (this.gliding ? this.glide : 1)
    const v = (this.semis + BASE + 12 * p[this.pOct]) / 12
    const f = C4 * Math.pow(2, v)
    const dt = f / fs

    // Envelopes: gate holds the note; B sets how fast it decays meanwhile.
    const on = this.gateLeft > 0 || this.held
    if (this.gateLeft > 0) this.gateLeft--
    const decay = 0.08 + p[this.pB] * 1.4
    this.ampT += 1 / fs
    const shape = Math.exp(-this.ampT / decay)
    this.amp = on ? this.amp + (shape - this.amp) * this.atk : this.amp * this.rel
    this.fenv *= Math.exp(-1 / ((0.04 + p[this.pB] * 0.5) * fs))

    // Voices.
    this.ph = (this.ph + dt) % 1
    this.sub = (this.sub + dt * 0.5) % 1
    const voice = Math.round(p[this.pVoice])
    const tone = p[this.pA]
    let x: number
    let cutoff: number
    let k: number
    if (voice === SUB) {
      x = Math.sin(TAU * this.ph) * 0.9 + (this.sub < 0.5 ? 0.25 : -0.25)
      cutoff = 180 + tone * 1400
      k = 1.4
    } else if (voice === SQUARE) {
      x = (this.ph < 0.5 ? 1 : -1) + polyBlep(this.ph, dt) - polyBlep((this.ph + 0.5) % 1, dt)
      x *= 0.6
      cutoff = 120 * Math.pow(2, tone * 5 + this.fenv * 2)
      k = 1.1
    } else {
      // ACID: a saw through a resonant filter swept by its own envelope
      x = (2 * this.ph - 1 - polyBlep(this.ph, dt)) * 0.6
      cutoff = 90 * Math.pow(2, tone * 4.5 + this.fenv * (2.5 + (this.accent ? 2 : 0)))
      k = 0.22
    }
    this.filter.process(x, cutoff, k, fs)
    const gain = this.accent ? 1.35 : 1
    const y = Math.tanh(this.filter.lp * this.amp * gain * 1.6)

    const o = this.out
    o[0] = y * 5 * p[this.pVol]
    o[1] = c.clkSample()
    o[2] = v
    o[3] = on ? 10 : 0
    this.flash *= 0.9995
    this.led[PSL.step] = c.step
    this.led[PSL.flash] = this.flash
    this.led[PSL.note] = this.goalNote
  }
}
