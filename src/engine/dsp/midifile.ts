import { factoryNotes, MF_STRIDE, MFL } from '../../modules/specs/midifile'
import { Dsp, MAX_VOICES } from './base'
import { Schmitt } from './cores'

const RETRIG_S = 0.002
const PULSE_S = 0.005

/** MIDI FILE: a playhead in beats, moved by TEMPO (or by CLK's 16ths, the
 *  time between edges filled in); each note whose beat comes round takes a
 *  free voice (else the oldest) for its length. A voice handed straight to a
 *  new note drops its gate for 2 ms so envelopes start again. */
export class MidiFileDsp extends Dsp {
  private readonly I = { clk: this.ii('clk'), rst: this.ii('rst'), trs: this.ii('trs') }
  private readonly O = { voct: this.oi('voct'), gate: this.oi('gate'), vel: this.oi('vel'), eot: this.oi('eot') }
  private readonly P = { src: this.pi('src'), tempo: this.pi('tempo'), trans: this.pi('trans'), ch: this.pi('ch'), loop: this.pi('loop'), run: this.pi('run') }
  private readonly factory = factoryNotes()
  private file = new Float32Array(0)
  private fileBpm = 120
  private data = this.factory
  private len = 0
  private next = 0
  private beat = 0
  private readonly ends = new Float64Array(MAX_VOICES).fill(-1)
  private readonly starts = new Float64Array(MAX_VOICES)
  private readonly low = new Int32Array(MAX_VOICES)
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private since = 0
  private period = 0
  private edges = 0
  private eot = 0
  private wasRun = false
  private src = -1

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    this.file = data.slice()
    this.fileBpm = rate
    this.src = -1
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    return slot === 0 && this.file.length ? { rate: this.fileBpm, data: this.file.slice() } : null
  }

  /** The piece to play (re-read when SOURCE changes or a file arrives). */
  private pick(): void {
    const s = Math.round(this.p[this.P.src])
    if (s === this.src) return
    this.src = s
    this.data = s === 1 && this.file.length ? this.file : this.factory
    let end = 0
    for (let i = 0; i < this.data.length; i += MF_STRIDE) end = Math.max(end, this.data[i] + this.data[i + 3])
    // a whole number of bars
    this.len = Math.max(4, Math.ceil(end / 4 - 1e-6) * 4)
    this.restart()
  }

  private restart(): void {
    this.beat = 0
    this.next = 0
    this.edges = 0
    this.ends.fill(-1)
  }

  private start(note: number, vel: number, end: number): void {
    let v = -1
    let oldest = Infinity
    for (let k = 0; k < MAX_VOICES; k++) if (this.ends[k] < this.beat) return this.take(k, note, vel, end)
    for (let k = 0; k < MAX_VOICES; k++) if (this.starts[k] < oldest) (oldest = this.starts[k]), (v = k)
    this.low[v] = Math.round(RETRIG_S * this.fs)
    this.take(v, note, vel, end)
  }

  private take(v: number, note: number, vel: number, end: number): void {
    if (this.ends[v] >= this.beat - 0.02) this.low[v] = Math.round(RETRIG_S * this.fs)
    this.ends[v] = end
    this.starts[v] = this.beat
    this.polyOut[this.O.voct]![v] = (note - 60) / 12
    this.polyOut[this.O.vel]![v] = (vel / 127) * 10
  }

  tick(): void {
    const p = this.p
    this.pick()
    const run = p[this.P.run] >= 0.5
    if ((run && !this.wasRun) || this.rst.rise(this.in[this.I.rst])) this.restart()
    this.wasRun = run
    const ext = this.patched[this.I.clk] === 1
    this.since++
    if (ext && this.clk.rise(this.in[this.I.clk])) {
      if (this.since > 8) this.period = this.since
      this.since = 0
      if (run) this.beat = this.edges++ * 0.25
    } else if (run) {
      if (!ext) this.beat += p[this.P.tempo] / 60 / this.fs
      else if (this.period > 0) this.beat = Math.min(this.beat + 0.25 / this.period, this.edges * 0.25)
    }
    if (run && this.beat >= this.len) {
      this.eot = Math.round(PULSE_S * this.fs)
      if (p[this.P.loop] >= 0.5) this.restart()
      else this.writeParam(this.P.run, 0)
    }
    // notes whose time has come
    const ch = Math.round(p[this.P.ch])
    const tr = Math.round(p[this.P.trans]) + (this.patched[this.I.trs] ? Math.round(this.in[this.I.trs] * 12) : 0)
    const d = this.data
    while (run && this.next < d.length && d[this.next] <= this.beat) {
      const i = this.next
      this.next += MF_STRIDE
      if (ch > 0 && d[i + 4] !== ch) continue
      this.start(d[i + 1] + tr, d[i + 2], d[i] + d[i + 3])
    }
    for (let v = 0; v < MAX_VOICES; v++) {
      const on = run && this.ends[v] > this.beat && this.low[v] <= 0
      if (this.low[v] > 0) this.low[v]--
      this.pout(this.O.gate, v, on ? 10 : 0)
      if (v === 0) {
        this.out[this.O.voct] = this.polyOut[this.O.voct]![0]
        this.out[this.O.vel] = this.polyOut[this.O.vel]![0]
      }
    }
    this.chans[this.O.voct] = MAX_VOICES
    this.chans[this.O.gate] = MAX_VOICES
    this.chans[this.O.vel] = MAX_VOICES
    this.out[this.O.eot] = this.eot > 0 ? 10 : 0
    if (this.eot > 0) this.eot--
    this.led[MFL.beat] = this.beat
    this.led[MFL.len] = this.len
    this.led[MFL.run] = run ? 1 : 0
  }
}
