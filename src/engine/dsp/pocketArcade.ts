import type { ModuleSpec } from '../../modules/types'
import { ARCADE_DUTY, MELODY_NOTES, PSL, PSTEPS, SCALE_STEPS } from '../../modules/specs/pocketSynth'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'
import { C4, TAU } from './util'

const ARP = 1
const SLIDE = 2
/** Chip arpeggios move on every video frame. */
const FRAME_HZ = 60
/** The noise drums: shift-register rate (Hz), decay (s), short (metallic) mode. */
const KICK = { rate: 1800, decay: 0.07, short: false }
const SNARE = { rate: 9000, decay: 0.16, short: false }
const HAT = { rate: 44000, decay: 0.035, short: true }
type Hit = typeof KICK
/** Which drum on each step (0 none, 1 kick, 2 snare, 3 hat), for BEAT and BUSY. */
const DRUM_PATTERNS = [
  [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 0],
  [1, 3, 3, 1, 2, 3, 3, 3, 1, 3, 1, 3, 2, 3, 3, 2],
]
const HITS: Hit[] = [KICK, KICK, SNARE, HAT]

/** Volume in 4 bits, as the old sound chips had it. */
const nibble = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 15) / 15

/** POCKET ARCADE: a chiptune box. The steps (scale degrees) play a naive pulse
 *  lead with a stepped volume envelope, delayed vibrato, chip arpeggios (the
 *  chord cycled at 60 Hz) and slides; a 4-bit stepped triangle plays bass
 *  (root and fifth on the beats, or the lead two octaves down) and a 15-bit
 *  noise register plays drums. Off WRITE, the buttons play the lead. */
export class PocketArcadeDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oRst = this.oi('rsto')
  private readonly oPulse = this.oi('pulse')
  private readonly oTri = this.oi('tri')
  private readonly oNoise = this.oi('noise')
  private readonly P = {
    tempo: this.pi('tempo'), swing: this.pi('swing'), vol: this.pi('vol'), run: this.pi('run'), voice: this.pi('voice'),
    oct: this.pi('oct'), a: this.pi('a'), b: this.pi('b'), scale: this.pi('scale'), root: this.pi('root'),
    bass: this.pi('bass'), drums: this.pi('drums'), mask: this.pi('m'), note: this.pi('n0'), flag: this.pi('f0'),
  }
  private readonly clock: PocketClock
  // the pulse lead
  private ph = 0
  private deg = 0
  private mode = 0
  private gate = 0
  private env = 0
  /** Seconds since the note began (not `age`: the base class has one). */
  private noteAge = 0
  private volts = 0
  /** The note a slide is heading for (not `target`: the base class has one). */
  private goal = 0
  private glide = 0
  private arpIdx = 0
  private arpWait = 0
  private held = -1
  private flash = 0
  // the triangle bass
  private tph = 0
  private tvolts = 0
  private tgate = 0
  private tlevel = 0
  // the noise drums
  private lfsr = 1
  private nph = 0
  private nbit = 0
  private nenv = 0
  private hit: Hit = KICK

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(PSTEPS, fs)
  }

  /** Scale degree → volts (0 V = C4), with root and octave. */
  private degVolts(degree: number): number {
    const steps = SCALE_STEPS[Math.round(this.p[this.P.scale])] ?? SCALE_STEPS[0]
    const d = Math.max(0, Math.round(degree))
    return (steps[d % steps.length] + 12 * Math.floor(d / steps.length) + this.p[this.P.root] + 12 * this.p[this.P.oct] - 12) / 12
  }

  private lead(degree: number, mode: number, gateSec: number): void {
    this.deg = degree
    this.mode = mode
    this.goal = this.degVolts(degree)
    // a slide glides from the note still sounding; anything else jumps there
    if (mode === SLIDE && this.gate > 0) this.glide = (this.goal - this.volts) / Math.max(1, gateSec * 0.5 * this.fs)
    else {
      this.volts = this.goal
      this.glide = 0
    }
    this.gate = gateSec * this.fs
    this.env = 1
    this.noteAge = 0
    this.arpIdx = 0
    this.arpWait = 0
    this.flash = 1
  }

  private bassNote(volts: number, gateSec: number): void {
    this.tvolts = volts
    this.tgate = gateSec * this.fs
  }

  private drum(kind: number): void {
    if (kind <= 0) return
    this.hit = HITS[kind]
    this.nenv = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || ev.name !== 'key') return
    if (ev.down) {
      this.held = Math.min(MELODY_NOTES + 1, Math.round(ev.x))
      this.lead(this.held, 0, 30)
    } else {
      this.held = -1
      this.gate = 0
    }
  }

  private onStep(s: number, stepLen: number): void {
    const p = this.p
    const lit = (p[this.P.mask] & (1 << s)) !== 0
    const d = p[this.P.note + s]
    if (lit) this.lead(d, Math.round(p[this.P.flag + s]), stepLen * (Math.round(p[this.P.flag + s]) === ARP ? 1 : 0.8))
    const bass = Math.round(p[this.P.bass])
    if (bass === 1 && s % 4 === 0) this.bassNote(this.degVolts(s % 8 === 0 ? 0 : 4) - 2, stepLen * 1.8)
    else if (bass === 2 && lit) this.bassNote(this.degVolts(d) - 2, stepLen * 0.9)
    const drums = Math.round(p[this.P.drums])
    if (drums > 0) this.drum(DRUM_PATTERNS[drums - 1][s])
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const c = this.clock
    if (c.tick(p[this.P.run] >= 0.5, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.P.tempo], p[this.P.swing], this.in[this.iRst])) this.onStep(c.step, c.stepLen)
    this.out[this.oRst] = c.rstSample()

    // the pulse lead: stepped volume, delayed vibrato, arpeggio, slide
    let lead = 0
    const on = this.gate > 0
    if (on) this.gate--
    this.noteAge += 1 / fs
    const decay = 0.06 + p[this.P.b] * 1.5
    this.env *= on ? Math.exp(-1 / (decay * fs)) : Math.exp(-1 / (0.02 * fs))
    if (this.glide !== 0) {
      this.volts += this.glide
      if ((this.glide > 0 && this.volts >= this.goal) || (this.glide < 0 && this.volts <= this.goal)) {
        this.volts = this.goal
        this.glide = 0
      }
    }
    if (this.env > 0.01) {
      let v = this.volts
      if (this.mode === ARP) {
        if (--this.arpWait <= 0) {
          this.arpIdx = (this.arpIdx + 1) % 3
          this.arpWait = fs / FRAME_HZ
        }
        v = this.degVolts(this.deg + this.arpIdx * 2)
      }
      const vib = this.noteAge > 0.15 ? p[this.P.a] * 0.05 * Math.sin(TAU * 6 * this.noteAge) : 0
      this.ph = (this.ph + (C4 * Math.pow(2, v + vib)) / fs) % 1
      const duty = ARCADE_DUTY[Math.round(p[this.P.voice])] ?? 0.5
      lead = ((this.ph < duty ? 1 : -1) - (2 * duty - 1)) * nibble(this.env)
    }

    // the triangle bass: 16 steps of level, on or off (no volume on the real thing)
    if (this.tgate > 0) this.tgate--
    this.tlevel += ((this.tgate > 0 ? 1 : 0) - this.tlevel) * 0.01
    let tri = 0
    if (this.tlevel > 0.001) {
      this.tph = (this.tph + (C4 * Math.pow(2, this.tvolts)) / fs) % 1
      tri = (Math.round((1 - 4 * Math.abs(this.tph - 0.5)) * 7.5) / 7.5) * this.tlevel
    }

    // the noise drums: a 15-bit register clocked at the hit's rate
    let noise = 0
    if (this.nenv > 0.004) {
      this.nph += this.hit.rate / fs
      while (this.nph >= 1) {
        this.nph -= 1
        const fb = (this.lfsr ^ (this.lfsr >> (this.hit.short ? 6 : 1))) & 1
        this.lfsr = (this.lfsr >> 1) | (fb << 14)
        this.nbit = this.lfsr & 1
      }
      this.nenv *= Math.exp(-1 / (this.hit.decay * fs))
      noise = (this.nbit ? 1 : -1) * nibble(this.nenv)
    }

    const o = this.out
    const vol = p[this.P.vol]
    o[0] = Math.tanh(lead * 0.45 + tri * 0.55 + noise * 0.3) * 5 * vol
    o[1] = c.clkSample()
    o[2] = this.volts
    o[3] = on || this.held >= 0 ? 10 : 0
    o[this.oPulse] = lead * 5
    o[this.oTri] = tri * 5
    o[this.oNoise] = noise * 5
    this.flash *= 0.9995
    this.led[PSL.step] = c.step
    this.led[PSL.flash] = this.flash
    this.led[PSL.note] = this.deg
  }
}
