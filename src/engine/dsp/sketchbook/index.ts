import type { ModuleSpec } from '../../../modules/types'
import { SB_STEPS, SB_TRACKS, SB_VOICES, SBL } from '../../../modules/specs/sketchbook'
import type { MidiEvent, UiEvent } from '../../protocol'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { PocketClock } from '../pocketClock'
import { Tape } from './tape'
import { render } from './engines'
import { Voice } from './voice'

/** SKETCHBOOK (see the spec): six voices on the selected engine, played from
 *  its keybed, the computer keyboard / MIDI, V/OCT+GATE, or its own pattern;
 *  everything you hear can go onto the 4-track loop tape. */
export class SketchbookDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iVoct = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iAudio = this.ii('audio')
  private readonly p0 = {
    engine: this.pi('engine'), oct: this.pi('oct'), k: this.pi('k0_0'),
    a: this.pi('a'), d: this.pi('d'), s: this.pi('s'), r: this.pi('r'),
    tempo: this.pi('tempo'), len: this.pi('len'), swing: this.pi('swing'), glen: this.pi('glen'), n: this.pi('n0'),
    run: this.pi('run'), bars: this.pi('bars'), trk: this.pi('trk'), drive: this.pi('drive'), vol: this.pi('vol'),
    lv: this.pi('lv0'), master: this.pi('master'),
  }
  private readonly voices: Voice[]
  private readonly clock: PocketClock
  private readonly tape: Tape
  private readonly gateIn = new Schmitt()
  private readonly knobs = new Float64Array(4)
  private readonly trackOut = new Float32Array(SB_TRACKS)
  private seqStep = -1
  private wasRunning = false
  private born = 0
  private extVolts = 0
  private lastVolts = 0
  private livePeak = 0
  private n = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.voices = Array.from({ length: SB_VOICES }, () => new Voice(fs, this.rng))
    this.clock = new PocketClock(SB_STEPS, fs)
    this.tape = new Tape(fs)
  }

  /** Start a note on a free voice (or the oldest). `hold`: samples until it
   *  lets go by itself (−1: until noteOff). */
  private noteOn(volts: number, vel: number, hold: number): void {
    let v = this.voices[0]
    for (const x of this.voices) {
      if (!x.sounding) {
        v = x
        break
      }
      if (x.born < v.born) v = x
    }
    this.loadKnobs()
    v.start(volts, vel, hold, this.born++, this.knobs, this.fs)
    this.lastVolts = volts
  }

  private noteOff(volts: number): void {
    for (const v of this.voices) if (v.gate > 0 && v.hold < 0 && Math.abs(v.volts - volts) < 1e-6) v.gate = 0
  }

  /** Keybed key → volts: 25 keys from C, two octaves below C4 at OCTAVE 0 … */
  private keyVolts(key: number): number {
    return (key + 12 * Math.round(this.p[this.p0.oct]) - 12) / 12
  }

  private loadKnobs(): void {
    const base = this.p0.k + Math.round(this.p[this.p0.engine]) * 4
    for (let i = 0; i < 4; i++) this.knobs[i] = this.p[base + i]
  }

  onMidi(ev: MidiEvent): void {
    if (ev.kind === 'on') this.noteOn((ev.note - 60) / 12, ev.vel / 127, -1)
    else if (ev.kind === 'off') this.noteOff((ev.note - 60) / 12)
    else if (ev.kind === 'panic') for (const v of this.voices) v.gate = 0
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'key') {
      const volts = this.keyVolts(Math.round(ev.x))
      if (ev.down) this.noteOn(volts, 0.9, -1)
      else this.noteOff(volts)
    } else if (ev.name === 'rec' && ev.down) this.tape.recording = !this.tape.recording
    else if (ev.name === 'clear' && ev.down) this.tape.clear(Math.round(ev.x))
  }

  tick(): void {
    const p = this.p
    const q = this.p0
    const fs = this.fs
    const running = p[q.run] >= 0.5
    if (running && !this.wasRunning) {
      this.tape.rewind()
      this.seqStep = -1
    }
    this.wasRunning = running
    const c = this.clock
    // the pattern: one step per 16th (or per CLK edge)
    if (c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[q.tempo], p[q.swing])) {
      this.seqStep = (this.seqStep + 1) % Math.max(1, Math.round(p[q.len]))
      const note = Math.round(p[q.n + this.seqStep])
      if (note >= 0) this.noteOn(this.keyVolts(note), 0.85, Math.round(p[q.glen] * c.stepLen * fs))
    }
    // V/OCT + GATE from the rack
    const g = this.in[this.iGate]
    const wasHigh = this.gateIn.high
    if (this.gateIn.rise(g)) {
      this.extVolts = this.in[this.iVoct]
      this.noteOn(this.extVolts, 1, -1)
    } else if (wasHigh && !this.gateIn.high) this.noteOff(this.extVolts)

    // the voices, on the selected engine
    const engine = Math.round(p[q.engine])
    this.loadKnobs()
    let mix = 0
    let gates = 0
    let sounding = 0
    for (const v of this.voices) {
      if (v.hold > 0 && --v.hold === 0) v.gate = 0
      if (!v.sounding) continue
      sounding++
      if (v.gate > 0) gates++
      const e = v.env.step(v.gate, v.age === 0, p[q.a], p[q.d], p[q.s], p[q.r])
      mix += render(v, engine, this.knobs, e, fs) * e * v.vel
    }
    const synth = Math.tanh(mix * 0.9) * p[q.vol]

    // the tape (loop length follows the tempo), then the mix
    if ((this.n++ & 63) === 0) this.tape.setLength(Math.round(p[q.bars]), c.stepLen, fs)
    const audio = this.patched[this.iAudio] ? this.in[this.iAudio] / 5 : 0
    this.tape.step(synth + audio, running, Math.round(p[q.trk]), p[q.drive], this.trackOut)
    let out = synth + audio
    for (let t = 0; t < SB_TRACKS; t++) out += this.trackOut[t] * p[q.lv + t]
    const y = Math.tanh(out * p[q.master] * 2) * 5

    const o = this.out
    o[0] = c.clkSample()
    o[1] = this.lastVolts
    o[2] = gates > 0 ? 10 : 0
    o[3] = y
    o[4] = y

    const a = Math.abs(synth)
    this.livePeak = a > this.livePeak ? a : this.livePeak * 0.99995
    const led = this.led
    led[SBL.step] = this.seqStep
    led[SBL.pos] = this.tape.pos / this.tape.len
    led[SBL.rec] = this.tape.recording ? 1 : 0
    led[SBL.run] = running ? 1 : 0
    for (let t = 0; t < SB_TRACKS; t++) led[SBL.peak + t] = this.tape.peak[t]
    led[SBL.live] = this.livePeak
    led[SBL.note] = Math.round(this.lastVolts * 12)
    led[SBL.voices] = sounding
  }
}
