import { LOCK_PAGES, sampleBits, sampleIndex } from '../../../modules/specs/lockstepDefs'
import { Svf } from '../drumVoices'
import { quantise } from '../sampling/converter'
import type { SampleData } from '../sampling/voice'

/** −60 dB at the knob time. */
const T60 = 6.9
const SWEEP_S = 0.04
const FADE_S = 0.003

/** A sample for slot k (0–7 factory, 8 the track's own), its root note (MIDI). */
export type SampleBank = (k: number) => { s: SampleData; root: number } | null

/** LOCKSTEP's sampler voice (ALGO = SAMPLE), a drop-in for the FM voice. The
 *  FM page's knobs are SAMPLE, START, LENGTH and BITS, read when a note starts
 *  (so a step can lock a different sample, or a different slice of the break);
 *  ATTACK, DECAY, SWEEP and LEVEL, the filter, the LFO and slides work as
 *  they do for FM. BITS drops the bits and the rate, the old sampler grit. */
export class SampleTrackVoice {
  amp = 0
  volts = 0
  out = 0
  bend = 0
  readonly locks = new Float64Array(LOCK_PAGES * 4).fill(-1)
  private pending = false
  private rising = false
  private s: SampleData | null = null
  private root = 60
  private pos = 0
  private end = 0
  private sweep = 0
  private held = 0
  private hold = 0
  private glideStep = 0
  private glideLeft = 0
  private readonly svf = new Svf()
  private readonly sweepK: number
  private readonly fadeN: number

  constructor(
    private readonly fs: number,
    private readonly bank: SampleBank,
  ) {
    this.sweepK = Math.exp(-1 / (SWEEP_S * fs))
    this.fadeN = Math.round(FADE_S * fs)
  }

  /** A new note: the sample and its region are picked on the next step, with
   *  the knobs (and this step's locks) as they are then. */
  start(volts: number): void {
    this.volts = volts
    this.glideLeft = 0
    this.pending = true
  }

  slide(volts: number, samples: number): void {
    const from = this.volts
    if (!this.rising && this.amp < 0.01) this.start(from)
    this.glideLeft = Math.max(1, Math.round(samples))
    this.glideStep = (volts - from) / this.glideLeft
  }

  /** One sample with the knobs `v` (locks applied); the ALGO isn't needed. */
  step(v: Float64Array, _algo?: number): void {
    if (this.pending) {
      this.pending = false
      const b = this.bank(sampleIndex(v[0]))
      if (b && b.s.len > 1) {
        this.s = b.s
        this.root = b.root
        this.pos = Math.floor(v[1] * (b.s.len - 1))
        this.end = Math.min(b.s.len, this.pos + Math.max(64, Math.round(v[2] * (b.s.len - this.pos))))
        this.rising = true
        this.amp = 0
        this.sweep = 1
        this.hold = 0
      }
    }
    const s = this.s
    if (!s || (!this.rising && this.amp < 1e-5) || this.pos >= this.end) {
      this.amp = 0
      this.out = 0
      return
    }
    const fs = this.fs
    if (this.rising) {
      this.amp += 1 / ((0.0005 + v[4] * v[4] * 2) * fs)
      if (this.amp >= 1) {
        this.amp = 1
        this.rising = false
      }
    } else this.amp *= Math.exp(-T60 / (0.02 * Math.pow(200, v[5]) * fs))
    this.sweep *= this.sweepK
    if (this.glideLeft > 0) {
      this.volts += this.glideStep
      this.glideLeft--
    }
    // read at the note's speed (C4 plays the sample as recorded at its root)
    const ratio = Math.pow(2, this.volts + this.bend + v[6] * 5 * this.sweep - (this.root - 60) / 12)
    const i = Math.floor(this.pos)
    const f = this.pos - i
    let y = s.data[i] + ((s.data[i + 1] ?? 0) - s.data[i]) * f
    this.pos += (s.rate / fs) * ratio
    // the region's last moments fade (a slice cut mid-sound doesn't click)
    const left = this.end - this.pos
    if (left < this.fadeN) y *= Math.max(0, left / this.fadeN)
    // BITS: fewer bits, and the rate held down with them
    if (v[3] > 0.02) {
      if (--this.hold <= 0) {
        this.hold = 1 + Math.floor(v[3] * v[3] * 6)
        this.held = quantise(Math.max(-1, Math.min(1, y)), sampleBits(v[3]), false)
      }
      y = this.held
    }
    this.svf.process(y, 40 * Math.pow(450, v[8]), 2 - 1.85 * v[9], fs)
    this.out = this.svf.lp * this.amp * v[7]
  }
}
