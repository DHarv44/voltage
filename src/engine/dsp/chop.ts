import type { ModuleSpec } from '../../modules/types'
import { CHOP_PADS, CHOPL } from '../../modules/specs/chop'
import { padForNote } from '../drumMap'
import { DRUM_CHANNEL, type MidiEvent, type UiEvent } from '../protocol'
import { Dsp } from './base'
import { BattleRecord } from './battleRecord'
import { Schmitt } from './cores'

const MAX_S = 20
const VOICES = 4
const PRESS_RATE = 8
const FADE = 0.002
/** Notes per beat for each RATE (1/8, 1/16, 1/16T, 1/32). */
const RATE_DIV = [2, 4, 6, 8]

/** One playing slice. */
class Voice {
  pos = -1
  end = 0
  gain = 0
  pad = -1
}

/** MPC-style chopper (see the spec). */
export class ChopDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iRec = this.ii('rec')
  private readonly iClk = this.ii('clk')
  private readonly pTempo = this.pi('tempo')
  private readonly pSwing = this.pi('swing')
  private readonly pRate = this.pi('rate')
  private readonly pVintage = this.pi('vintage')
  private readonly pPitch = this.pi('pitch')
  private readonly pLevel = this.pi('level')
  private readonly pMode = this.pi('mode')
  private buf: Float32Array
  private len = 0
  private rate: number
  private press: BattleRecord | null
  private recording = false
  private readonly starts = new Int32Array(CHOP_PADS + 1)
  private lastMode = -1
  private readonly voices = Array.from({ length: VOICES }, () => new Voice())
  private nextVoice = 0
  private readonly held = new Uint8Array(CHOP_PADS)
  private readonly vel = new Float64Array(CHOP_PADS)
  private repeat = false
  private repeatPh = 0
  private repeatStep = 0
  private readonly recTrig = new Schmitt()
  private readonly clk = new Schmitt()
  private clkPeriod = 0
  private sinceClk = 0
  private trig = 0
  private padCv = 0
  private hold = 0
  private holdN = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.buf = new Float32Array(MAX_S * fs)
    this.rate = fs
    this.press = new BattleRecord(fs)
  }

  /** Slice points: evenly, or at the 15 strongest onsets (energy rises). */
  private chop(): void {
    const n = this.len
    const even = this.p[this.pMode] < 0.5
    this.lastMode = this.p[this.pMode]
    if (even || n < this.fs * 0.2) {
      for (let i = 0; i <= CHOP_PADS; i++) this.starts[i] = Math.floor((i * n) / CHOP_PADS)
      return
    }
    const hop = 256
    const frames = Math.floor(n / hop)
    const flux = new Float32Array(frames)
    let prev = 0
    for (let f = 0; f < frames; f++) {
      let e = 0
      for (let k = 0; k < hop; k++) e += this.buf[f * hop + k] ** 2
      e = Math.sqrt(e / hop)
      flux[f] = Math.max(0, e - prev)
      prev = prev * 0.6 + e * 0.4
    }
    // Greedy: strongest onsets first, at least 60 ms apart.
    const minGap = Math.round((0.06 * this.rate) / hop)
    const picked: number[] = [0]
    const order = Array.from(flux.keys()).sort((a, b) => flux[b] - flux[a])
    for (const f of order) {
      if (picked.length >= CHOP_PADS) break
      if (flux[f] <= 0) break
      if (picked.every((q) => Math.abs(q - f) >= minGap)) picked.push(f)
    }
    picked.sort((a, b) => a - b)
    while (picked.length < CHOP_PADS) picked.push(frames)
    for (let i = 0; i < CHOP_PADS; i++) this.starts[i] = Math.min(n, picked[i] * hop)
    this.starts[CHOP_PADS] = n
  }

  private hit(pad: number, vel: number): void {
    if (pad < 0 || pad >= CHOP_PADS || !this.len) return
    const start = this.starts[pad]
    let end = this.len
    for (let k = pad + 1; k <= CHOP_PADS; k++)
      if (this.starts[k] > start) {
        end = this.starts[k]
        break
      }
    // retriggering a pad cuts its own voice (mono per pad, like MPC "note on")
    let v = this.voices.find((x) => x.pad === pad && x.pos >= 0)
    if (!v) v = this.voices[this.nextVoice++ % VOICES]
    v.pos = start
    v.end = end
    v.gain = vel
    v.pad = pad
    this.trig = Math.round(0.005 * this.fs)
    this.padCv = pad
    this.led[pad] = 1
  }

  private padEvent(pad: number, vel: number, down: boolean): void {
    if (pad < 0 || pad >= CHOP_PADS) return
    this.held[pad] = down ? 1 : 0
    if (down) {
      this.vel[pad] = vel
      this.hit(pad, vel)
      this.repeatPh = 0
    }
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'pad') this.padEvent(ev.index, 0.3 + (ev.vel / 127) * 0.7, ev.down)
    else if (ev.kind === 'button' && ev.name === 'repeat') this.repeat = ev.down
    else if (ev.kind === 'button' && ev.name === 'rec' && ev.down) this.toggleRec()
  }

  onMidi(ev: MidiEvent): void {
    if (ev.kind !== 'on' && ev.kind !== 'off') return
    const pad = ev.ch === DRUM_CHANNEL ? padForNote(ev.note) : ev.note - 36
    this.padEvent(pad, ev.kind === 'on' ? 0.3 + (ev.vel / 127) * 0.7 : 0, ev.kind === 'on')
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    if (data.length > this.buf.length) this.buf = new Float32Array(data.length)
    this.buf.set(data)
    this.len = data.length
    this.rate = rate
    this.press = null
    this.recording = false
    this.chop()
  }

  dumpBuffer(): { rate: number; data: Float32Array } | null {
    return this.len ? { rate: this.rate, data: this.buf.slice(0, this.len) } : null
  }

  private toggleRec(): void {
    if (this.recording) {
      this.recording = false
      this.chop()
      if (this.len) this.bufferOut.push({ slot: 0, rate: this.rate, data: this.buf.subarray(0, this.len) })
    } else {
      this.recording = true
      this.press = null
      this.len = 0
      this.rate = this.fs
      for (const v of this.voices) v.pos = -1
    }
  }

  tick(): void {
    const p = this.p
    if (this.press) {
      for (let k = 0; k < PRESS_RATE && !this.press.done; k++) this.buf[this.len++] = this.press.next()
      if (this.press.done) {
        this.press = null
        this.chop()
      }
    }
    if (p[this.pMode] !== this.lastMode && !this.press && !this.recording) this.chop()
    if (this.recTrig.rise(this.in[this.iRec])) this.toggleRec()
    if (this.recording) {
      this.buf[this.len++] = this.in[this.iIn] / 5
      if (this.len >= this.buf.length) this.toggleRec()
    }

    // Note repeat: the held pads retrigger on the beat grid, with MPC swing.
    this.sinceClk += 1 / this.fs
    if (this.clk.rise(this.in[this.iClk])) {
      if (this.sinceClk < 4) this.clkPeriod = this.sinceClk
      this.sinceClk = 0
    }
    const beat = this.patched[this.iClk] && this.clkPeriod > 0 ? this.clkPeriod : 60 / p[this.pTempo]
    if (this.repeat) {
      const div = RATE_DIV[Math.round(p[this.pRate])] ?? 4
      const step = beat / div
      const swung = this.repeatStep % 2 === 1 ? (p[this.pSwing] - 0.5) * 2 * step : 0
      this.repeatPh += 1 / this.fs
      if (this.repeatPh >= step + swung) {
        this.repeatPh -= step + swung
        this.repeatStep++
        for (let k = 0; k < CHOP_PADS; k++) if (this.held[k]) this.hit(k, this.vel[k])
      }
    } else this.repeatStep = 0

    // Voices, then the vintage converter: fewer bits, a lower sample rate.
    const ratio = (this.rate / this.fs) * Math.pow(2, p[this.pPitch] / 12)
    const fade = FADE * this.rate
    let y = 0
    for (const v of this.voices) {
      if (v.pos < 0) continue
      const i = Math.floor(v.pos)
      const f = v.pos - i
      const a = this.buf[i] ?? 0
      const b = this.buf[Math.min(i + 1, this.len - 1)] ?? 0
      const edge = Math.min(1, (v.end - v.pos) / fade)
      y += (a + (b - a) * f) * v.gain * Math.max(0, edge)
      v.pos += ratio
      if (v.pos >= v.end) v.pos = -1
    }
    const vin = p[this.pVintage]
    const holdLen = vin <= 0.01 ? 1 : this.fs / (48000 - Math.min(1, vin * 2) * 8000 - Math.max(0, vin * 2 - 1) * 14000)
    if (++this.holdN >= holdLen) {
      this.holdN = 0
      const bits = 16 - Math.min(1, vin * 2) * 4
      const q = Math.pow(2, bits - 1)
      this.hold = Math.round(Math.tanh(y) * q) / q
    }
    const o = this.out
    o[0] = (vin <= 0.01 ? Math.tanh(y) : this.hold) * 5 * p[this.pLevel]
    o[1] = this.trig > 0 ? 10 : 0
    o[2] = this.padCv / 12
    if (this.trig > 0) this.trig--
    for (let k = 0; k < CHOP_PADS; k++) if (!this.held[k]) this.led[k] *= 0.9995
    this.led[CHOPL.rec] = this.recording ? 1 : 0
    let v0 = -1
    for (const v of this.voices) if (v.pos >= 0) v0 = v.pos
    this.led[CHOPL.pos] = this.recording ? this.len / this.buf.length : v0 >= 0 && this.len ? v0 / this.len : 0
    this.led[CHOPL.repeat] = this.repeat ? 1 : 0
  }
}
