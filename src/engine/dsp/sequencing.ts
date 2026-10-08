import type { MidiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { midiOut } from './external'

const RATES = [16, 8, 4, 2, 1] // pulses per bar for x4, x2, x1, d2, bar

/** MIDI clock: 24 ticks a quarter note, 96 a bar. */
const TICKS_PER_BAR = 96
const MIDI_CLOCK = 0xf8
const MIDI_START = 0xfa
const MIDI_STOP = 0xfc

/** Master clock: one bar-long phase ramp; every output is a 50% gate derived
 *  from it, so all divisions stay phase-locked. Crystal-stable (no drift).
 *  SYNC MIDI: the ramp follows incoming MIDI clock instead (a DAW's tempo and
 *  transport; START starts it on beat one, STOP stops it), the tempo smoothed
 *  from the ticks, which arrive with the browser's jitter, and shown on the
 *  TEMPO knob. MIDI OUT: sends MIDI clock, START and STOP from the ramp. */
export class ClockDsp extends Dsp {
  private iReset = this.ii('reset')
  private pBpm = this.pi('bpm')
  private pRun = this.pi('run')
  private pSync = this.pi('sync')
  private pOut = this.pi('mout')
  private readonly reset = new Schmitt()
  private phase = 0
  private rstPulse = 0
  private wasRunning = false
  // following MIDI clock
  private midiRunning = false
  private pendingTicks = 0
  private pendingStart = false
  /** Ticks since START (−1: started, waiting for the first tick, which is beat one). */
  private ticks = -1
  private since = 0
  private period: number
  private shownBpm = 0
  private showIn = 0
  // sending MIDI clock
  private lastTick = -1

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.period = (this.fs * 60) / 120 / 24
  }

  onMidi(ev: MidiEvent): void {
    if (ev.kind === 'clock') this.pendingTicks++
    else if (ev.kind === 'start') {
      this.pendingStart = true
      this.midiRunning = true
    } else if (ev.kind === 'continue') this.midiRunning = true
    else if (ev.kind === 'stop') this.midiRunning = false
  }

  /** Follow MIDI clock: count ticks, smooth the tempo, place the ramp. */
  private follow(): void {
    if (this.pendingStart) {
      this.pendingStart = false
      this.ticks = -1
      this.since = 0
    }
    this.since++
    while (this.pendingTicks > 0) {
      this.pendingTicks--
      // a sane interval refines the tempo (a gap after a stop doesn't)
      if (this.ticks >= 0 && this.since > this.period * 0.25 && this.since < this.period * 4) this.period += (this.since - this.period) * 0.03
      this.since = 0
      this.ticks++
    }
    // between ticks the ramp runs on at the measured tempo, but never past the next tick
    const ahead = this.ticks < 0 ? 0 : Math.min(0.999, this.since / this.period)
    const t = Math.max(0, this.ticks) + ahead
    this.phase = (t % TICKS_PER_BAR) / TICKS_PER_BAR
    // the TEMPO knob shows the tempo it's following
    if (--this.showIn <= 0) {
      this.showIn = Math.round(this.fs * 0.25)
      const bpm = (60 * this.fs) / (this.period * 24)
      if (Math.abs(bpm - this.shownBpm) > 0.5 && bpm >= 20 && bpm <= 300) {
        this.shownBpm = bpm
        this.writeParam(this.pBpm, Math.round(bpm * 10) / 10)
      }
    }
  }

  tick(): void {
    const midi = this.p[this.pSync] >= 0.5
    // following MIDI, it runs from the first tick after START (beat one)
    const running = this.p[this.pRun] >= 0.5 && (!midi || (this.midiRunning && (this.ticks >= 0 || this.pendingTicks > 0)))
    if (this.reset.rise(this.in[this.iReset]) || (running && !this.wasRunning)) {
      if (!midi) this.phase = 0
      this.rstPulse = Math.round(0.003 * this.fs)
      this.lastTick = -1
      if (!midi && this.p[this.pOut] >= 0.5) midiOut.push(MIDI_START)
    }
    if (!running && this.wasRunning && !midi && this.p[this.pOut] >= 0.5) midiOut.push(MIDI_STOP)
    this.wasRunning = running
    if (midi) this.follow()
    const o = this.out
    for (let k = 0; k < RATES.length; k++) {
      const x = this.phase * RATES[k]
      o[k] = running && x - Math.floor(x) < 0.5 ? 10 : 0
    }
    o[5] = this.rstPulse > 0 ? 10 : 0
    if (this.rstPulse > 0) this.rstPulse--
    this.led[0] = o[2] / 10
    // MIDI OUT: a clock byte on each 96th of the bar (not while following MIDI: no loops)
    if (running && !midi && this.p[this.pOut] >= 0.5) {
      const tk = Math.floor(this.phase * TICKS_PER_BAR)
      if (tk !== this.lastTick) {
        this.lastTick = tk
        midiOut.push(MIDI_CLOCK)
      }
    }
    if (running && !midi) {
      this.phase += this.p[this.pBpm] / 60 / 4 / this.fs
      if (this.phase >= 1) this.phase -= 1
    }
  }
}

const DIVS = [2, 3, 4, 5, 6, 8]

/** Counter-based divider: each output toggles on input edges (≈50% duty). */
export class DividerDsp extends Dsp {
  private iClk = this.ii('clk')
  private iReset = this.ii('reset')
  private readonly clk = new Schmitt()
  private readonly reset = new Schmitt()
  private count = 0

  tick(): void {
    if (this.reset.rise(this.in[this.iReset])) this.count = 0
    if (this.clk.rise(this.in[this.iClk])) this.count++
    // Each output goes high on the FIRST clock of its group (low until the
    // first clock arrives), so ÷4 of a 16th clock lands on the beat.
    const c = this.count - 1
    for (let k = 0; k < DIVS.length; k++) this.out[k] = c >= 0 && c % DIVS[k] < DIVS[k] / 2 ? 10 : 0
  }
}

const STEPS = 8

/** 8-step sequencer. Advances on clock edges; the gate follows the clock's
 *  width so legato vs staccato comes from the clock source, as on the classics. */
export class Seq8Dsp extends Dsp {
  private iClk = this.ii('clk')
  private iReset = this.ii('reset')
  private pLen = this.pi('len')
  private pQuant = this.pi('quant')
  private pStep = Array.from({ length: STEPS }, (_, i) => this.pi(`s${i + 1}`))
  private pGate = Array.from({ length: STEPS }, (_, i) => this.pi(`g${i + 1}`))
  private readonly clk = new Schmitt()
  private readonly reset = new Schmitt()
  /** −1 = before the first step, so the first clock lands on step 1. */
  private step = -1
  private trig = 0

  tick(): void {
    const p = this.p
    if (this.reset.rise(this.in[this.iReset])) this.step = -1
    if (this.clk.rise(this.in[this.iClk])) {
      const len = Math.max(1, Math.round(p[this.pLen]))
      this.step = (this.step + 1) % len
      if (p[this.pGate[this.step]] >= 0.5) this.trig = Math.round(0.003 * this.fs)
    }
    const s = Math.max(0, this.step)
    const v = p[this.pStep[s]]
    const o = this.out
    o[0] = p[this.pQuant] >= 0.5 ? Math.round(v * 12) / 12 : v
    o[1] = this.clk.high && this.step >= 0 && p[this.pGate[s]] >= 0.5 ? 10 : 0
    o[2] = this.trig > 0 ? 10 : 0
    if (this.trig > 0) this.trig--
    for (let k = 0; k < STEPS; k++) this.led[k] = k === this.step ? 1 : 0
  }
}
