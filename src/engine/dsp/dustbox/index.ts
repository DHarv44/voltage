import { DB_PADS, DBL } from '../../../modules/specs/dustbox'
import type { ModuleSpec } from '../../../modules/types'
import { DRUM_CHANNEL, type MidiEvent, type UiEvent } from '../../protocol'
import { padForNote } from '../../drumMap'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { Converter, ERAS } from '../sampling/converter'
import { makeFactory } from '../sampling/factory'
import { SampleVoice, type SampleData } from '../sampling/voice'
import { DustFx } from './fx'

const PAD_S = 4
const FACTORY_RATE = 32000

/** The factory pads: [factory sound, start (s), length (s)]: a kit cut from
 *  the break, then stabs and notes. */
const KIT: [number, number, number][] = [
  [7, 0, 0.3],
  [7, 0.5, 0.25],
  [7, 0.39, 0.06],
  [0, 0, 1.4],
  [6, 0, 0.6],
  [4, 0, 1],
  [3, 0, 2],
  [5, 0, 1.4],
]

/** DUSTBOX: see the spec. A voice per pad (pressing a pad again restarts
 *  it); the mix goes through GRIT (the 12-bit converter), the punch-in
 *  effect, then the bus compressor. */
export class DustboxDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iTrig = this.ii('trig')
  private readonly iPcv = this.ii('pcv')
  private readonly iClk = this.ii('clk')
  private readonly iFxg = this.ii('fxg')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly P = {
    fx: this.pi('fx'),
    amount: this.pi('amount'),
    latch: this.pi('latch'),
    grit: this.pi('grit'),
    comp: this.pi('comp'),
    pitch: this.pi('pitch'),
    tempo: this.pi('tempo'),
    level: this.pi('level'),
  }
  private readonly pads: SampleData[]
  private readonly voices: SampleVoice[]
  private readonly glow = new Float64Array(DB_PADS)
  private readonly trig = new Schmitt()
  private readonly clk = new Schmitt()
  private readonly fxIn = new Schmitt()
  private readonly grit: Converter
  private readonly fx: DustFx
  private armed = false
  /** The pad being recorded (−1 none) and whether from the box's own output. */
  private recPad = -1
  private resampling = false
  private fxHeld = false
  private fxLatched = false
  private env = 0
  private sinceClk = 0
  private beat = 0.66
  private lastL = 0
  private lastR = 0
  private count = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.pads = Array.from({ length: DB_PADS }, () => ({ data: new Float32Array(Math.round(PAD_S * fs)), len: 0, rate: fs }))
    // the factory pads, cut from the factory sounds
    const made = new Map<number, ReturnType<typeof makeFactory>>()
    KIT.forEach(([snd, at, len], i) => {
      if (!made.has(snd)) made.set(snd, makeFactory(snd, FACTORY_RATE))
      const s = made.get(snd)!
      const a = Math.round(at * s.rate)
      const n = Math.min(Math.round(len * s.rate), s.len - a, this.pads[i].data.length)
      this.pads[i].data.set(s.data.subarray(a, a + n))
      // a short fade at the end of each cut
      const f = Math.min(n, Math.round(0.01 * s.rate))
      for (let k = 0; k < f; k++) this.pads[i].data[n - 1 - k] *= k / f
      this.pads[i].len = n
      this.pads[i].rate = s.rate
    })
    this.voices = Array.from({ length: DB_PADS }, () => new SampleVoice(fs))
    this.grit = new Converter(fs)
    this.fx = new DustFx(fs, this.rng)
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'pad') this.press(ev.index, ev.down, 0.3 + (ev.vel / 127) * 0.7)
    else if (ev.kind === 'button') {
      if (ev.name === 'rec' && ev.down) this.rec()
      else if (ev.name === 'resample' && ev.down) this.resample()
      else if (ev.name === 'fx') {
        this.fxHeld = ev.down
        if (ev.down && this.p[this.P.latch] >= 0.5) this.fxLatched = !this.fxLatched
      }
    }
  }

  onMidi(ev: MidiEvent): void {
    // notes 36–51 play the sixteen pads (as on CHOP); the drum channel's kit notes the first eight
    if (ev.kind !== 'on' && ev.kind !== 'off') return
    const pad = ev.note >= 36 && ev.note < 36 + DB_PADS ? ev.note - 36 : ev.ch === DRUM_CHANNEL ? padForNote(ev.note) : -1
    if (ev.kind === 'on') this.press(pad, true, ev.vel / 127)
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot < 0 || slot >= DB_PADS) return
    const pad = this.pads[slot]
    const n = Math.min(pad.data.length, data.length)
    pad.data.set(data.subarray(0, n))
    pad.len = n
    pad.rate = rate
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    const pad = this.pads[slot]
    return pad?.len ? { rate: pad.rate, data: pad.data.slice(0, pad.len) } : null
  }

  /** REC: arm (the next pad pressed records), or stop a recording. */
  private rec(): void {
    if (this.recPad >= 0) this.finish()
    else this.armed = !this.armed
  }

  /** RESAMPLE: the box's own output into the next empty pad (or stop). */
  private resample(): void {
    if (this.recPad >= 0) return this.finish()
    let pad = -1
    for (let i = 0; i < DB_PADS && pad < 0; i++) if (this.pads[i].len === 0) pad = i
    this.start(pad < 0 ? DB_PADS - 1 : pad, true)
  }

  private start(pad: number, self: boolean): void {
    this.voices[pad].kill()
    this.recPad = pad
    this.resampling = self
    this.armed = false
    this.pads[pad].len = 0
    this.pads[pad].rate = this.fs
  }

  private finish(): void {
    const pad = this.pads[this.recPad]
    this.bufferOut.push({ slot: this.recPad, rate: pad.rate, data: pad.data.subarray(0, pad.len) })
    this.recPad = -1
  }

  private press(i: number, down: boolean, vel: number): void {
    if (i < 0 || i >= DB_PADS || !down) return
    if (this.armed) return this.start(i, false)
    const pad = this.pads[i]
    if (!pad.len || i === this.recPad) return
    this.voices[i].trigger(pad, 0, pad.len, Math.pow(2, this.p[this.P.pitch] / 12), vel)
    this.glow[i] = 1
  }

  tick(): void {
    const p = this.p
    if (this.trig.rise(this.in[this.iTrig])) this.press(Math.min(DB_PADS - 1, Math.max(0, Math.floor((this.in[this.iPcv] / 10) * DB_PADS))), true, 0.8)
    if (this.fxIn.rise(this.in[this.iFxg]) && p[this.P.latch] >= 0.5) this.fxLatched = !this.fxLatched
    // the beat, for STUTTER and DUB: from CLK's 16ths, or the TEMPO knob
    if (this.patched[this.iClk] === 1) {
      this.sinceClk++
      if (this.clk.rise(this.in[this.iClk])) {
        if (this.sinceClk < this.fs) this.beat = (this.sinceClk * 4) / this.fs
        this.sinceClk = 0
      }
    } else this.beat = 60 / p[this.P.tempo]
    // the pads
    let mix = 0
    for (let i = 0; i < DB_PADS; i++) {
      mix += this.voices[i].step()
      this.glow[i] *= 0.9993
      this.led[i] = this.glow[i]
    }
    // GRIT: the 12-bit converter, more of it (lower rate, fewer bits) as it turns
    if (this.count-- <= 0) {
      this.count = 128
      const g = p[this.P.grit]
      this.grit.set(ERAS[3], Math.round((40000 - g * 22000) / 100) * 100, Math.round(16 - g * 4))
    }
    const gritted = this.grit.run(mix * 5) / 5
    const g = p[this.P.grit]
    const dry = mix * (1 - Math.min(1, g * 2)) + gritted * Math.min(1, g * 2)
    // the punch-in effect over everything
    // HOLD: in while FX (or the FX gate) is held; LATCH: each press toggles it
    const latch = p[this.P.latch] >= 0.5
    const on = latch ? this.fxLatched : this.fxHeld || (this.patched[this.iFxg] === 1 && this.in[this.iFxg] > 1)
    this.fx.run(dry, dry, Math.round(p[this.P.fx]), on, p[this.P.amount], this.beat)
    // the bus compressor: squashes the peaks, brings the rest up
    const c = p[this.P.comp]
    const peak = Math.max(Math.abs(this.fx.out), Math.abs(this.fx.outR))
    this.env = peak > this.env ? this.env + (peak - this.env) * 0.15 : this.env * 0.99985
    const thr = 1 - c * 0.8
    const gain = this.env > thr ? Math.pow(thr / this.env, 0.75) : 1
    const make = 1 + c * 1.6
    const lv = p[this.P.level] * 5
    const l = Math.tanh(this.fx.out * gain * make) * lv
    const r = Math.tanh(this.fx.outR * gain * make) * lv
    this.out[this.oL] = l
    this.out[this.oR] = r
    // recording: IN, or the box itself
    if (this.recPad >= 0) {
      const pad = this.pads[this.recPad]
      pad.data[pad.len++] = this.resampling ? (this.lastL + this.lastR) / 10 : this.in[this.iIn] / 5
      if (pad.len >= pad.data.length) this.finish()
    }
    this.lastL = l
    this.lastR = r
    this.led[DBL.rec] = this.recPad >= 0 ? 1 : this.armed ? 0.5 : 0
    this.led[DBL.fx] = on ? 1 : 0
    this.led[DBL.fill] = this.recPad >= 0 ? this.pads[this.recPad].len / this.pads[this.recPad].data.length : 0
  }
}
