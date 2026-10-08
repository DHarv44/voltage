import type { ModuleSpec } from '../../modules/types'
import { MELODY_NOTES, PSL, PSTEPS, SCALE_STEPS } from '../../modules/specs/pocketSynth'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'
import { C4, polyBlep, TAU } from './util'

const BELL = 0
const PLUCK = 1
const VOICES = 4
const CHORD = 1
const ARP = 2

/** One sounding note. */
class Voice {
  ph = 0
  mod = 0
  volts = 0
  gate = 0
  env = 0
  age = 0
  lp = 0
}

/** POCKET MELODY: steps are scale degrees, so every note fits the key. A step
 *  is a single note, a CHORD (the triad on that degree, in the scale) or an
 *  ARP (that triad played up, three notes inside the step). Off WRITE, the 16
 *  buttons play the scale. */
export class PocketMelodyDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oRst = this.oi('rsto')
  private readonly pTempo = this.pi('tempo')
  private readonly pSwing = this.pi('swing')
  private readonly pVol = this.pi('vol')
  private readonly pRun = this.pi('run')
  private readonly pVoice = this.pi('voice')
  private readonly pOct = this.pi('oct')
  private readonly pA = this.pi('a')
  private readonly pB = this.pi('b')
  private readonly pScale = this.pi('scale')
  private readonly pRoot = this.pi('root')
  private readonly pMask = this.pi('m')
  private readonly pNote = this.pi('n0')
  private readonly pFlag = this.pi('f0')
  private readonly oNotes = this.oi('notes')
  private readonly clock: PocketClock
  private readonly voices = Array.from({ length: VOICES }, () => new Voice())
  private nextVoice = 0
  /** Arpeggio in progress: remaining notes, the degree it's built on, timing. */
  private arpLeft = 0
  private arpDegree = 0
  private arpEvery = 0
  private arpWait = 0
  private chordSize = 0
  private lastVolts = 0
  private heldKey = -1
  private flash = 0
  private lastDegree = 0
  private readonly atk: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(PSTEPS, fs)
    this.atk = 1 - Math.exp(-1 / (0.004 * fs))
  }

  /** Scale degree → volts (0 V = C4), with root and octave. */
  private volts(degree: number): number {
    const steps = SCALE_STEPS[Math.round(this.p[this.pScale])] ?? SCALE_STEPS[0]
    const d = Math.max(0, Math.round(degree))
    const semis = steps[d % steps.length] + 12 * Math.floor(d / steps.length)
    return (semis + this.p[this.pRoot] + 12 * this.p[this.pOct] - 12) / 12
  }

  private play(degree: number, gateSec: number): void {
    const v = this.voices[this.nextVoice++ % VOICES]
    v.volts = this.volts(degree)
    v.gate = gateSec * this.fs
    v.age = 0
    v.mod = 0
    this.lastVolts = v.volts
    this.lastDegree = degree
    this.flash = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || ev.name !== 'key') return
    if (ev.down) {
      this.heldKey = Math.min(MELODY_NOTES + 1, Math.round(ev.x))
      this.play(this.heldKey, 30) // held until the key comes up
    } else {
      this.heldKey = -1
      for (const v of this.voices) if (v.gate > this.fs * 2) v.gate = 0
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const c = this.clock
    const stepped = c.tick(p[this.pRun] >= 0.5, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], p[this.pSwing], this.in[this.iRst])
    this.out[this.oRst] = c.rstSample()
    if (stepped) {
      const s = c.step
      if (p[this.pMask] & (1 << s)) {
        const d = p[this.pNote + s]
        const mode = Math.round(p[this.pFlag + s])
        if (mode === CHORD) {
          this.play(d, c.stepLen * 0.9)
          this.play(d + 2, c.stepLen * 0.9)
          this.play(d + 4, c.stepLen * 0.9)
          this.chordSize = 3
        } else if (mode === ARP) {
          this.arpDegree = d
          this.arpEvery = (c.stepLen * fs) / 3
          this.arpLeft = 3
          this.arpWait = 0
          this.chordSize = 1
        } else {
          this.play(d, c.stepLen * 0.6)
          this.chordSize = 1
        }
      }
    }
    // the arpeggio steps through its triad inside the step
    if (this.arpLeft > 0 && --this.arpWait <= 0) {
      this.play(this.arpDegree + (3 - this.arpLeft) * 2, (this.arpEvery / fs) * 0.8)
      this.arpLeft--
      this.arpWait = this.arpEvery
    }

    const voice = Math.round(p[this.pVoice])
    const tone = p[this.pA]
    const decay = 0.15 + p[this.pB] * 2.2
    let y = 0
    let anyGate = false
    for (let i = 0; i < VOICES; i++) {
      const v = this.voices[i]
      const on = v.gate > 0
      if (on) {
        v.gate--
        anyGate = true
      }
      v.age += 1 / fs
      // BELL and PLUCK ring out over DECAY; LEAD holds while the gate is open
      const ring = voice === 2 ? (on ? 1 : 0) : Math.exp(-v.age / decay)
      v.env += ((on || voice !== 2 ? ring : 0) - v.env) * (on ? this.atk : 1 - Math.exp(-1 / (0.06 * fs)))
      if (v.env < 1e-4 && !on) continue
      const f = C4 * Math.pow(2, v.volts)
      const dt = f / fs
      v.ph = (v.ph + dt) % 1
      let s: number
      if (voice === BELL) {
        // two-operator FM: the brightness fades faster than the note
        v.mod = (v.mod + dt * 3.5) % 1
        const index = (0.5 + tone * 3) * Math.exp(-v.age / (decay * 0.35))
        s = Math.sin(TAU * v.ph + index * Math.sin(TAU * v.mod))
      } else if (voice === PLUCK) {
        const saw = 2 * v.ph - 1 - polyBlep(v.ph, dt)
        const bright = 0.04 + (0.1 + tone * 0.6) * Math.exp(-v.age / (decay * 0.25))
        v.lp += (saw - v.lp) * Math.min(1, bright)
        s = v.lp
      } else {
        // LEAD: a square with a touch of vibrato, softened by TONE
        const vib = 1 + 0.004 * Math.sin(TAU * 5.3 * v.age) * Math.min(1, v.age * 2)
        const ph = (v.ph * vib) % 1
        const sq = (ph < 0.5 ? 1 : -1) + polyBlep(ph, dt) - polyBlep((ph + 0.5) % 1, dt)
        v.lp += (sq - v.lp) * (0.05 + tone * 0.5)
        s = v.lp * 0.7
      }
      y += s * v.env
    }

    const o = this.out
    o[0] = Math.tanh(y * 0.45) * 5 * p[this.pVol]
    o[1] = c.clkSample()
    o[2] = this.lastVolts
    o[3] = anyGate || this.heldKey >= 0 ? 10 : 0
    // the chord (or single note) on the poly cable
    const n = Math.max(1, this.chordSize)
    for (let k = 0; k < n; k++) this.pout(this.oNotes, k, this.volts(this.lastDegree - (n - 1 - k) * 2))
    this.chans[this.oNotes] = n
    this.flash *= 0.9995
    this.led[PSL.step] = c.step
    this.led[PSL.flash] = this.flash
    this.led[PSL.note] = this.lastDegree
  }
}
