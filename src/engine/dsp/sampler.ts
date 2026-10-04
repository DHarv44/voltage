import { Dsp } from './base'
import { Schmitt } from './cores'
import type { UiEvent } from '../protocol'

const MAX_SECONDS = 60
const FADE_S = 0.002

/** Sampler. Holds one buffer (recorded at the engine rate, or a loaded file at
 *  its own rate — playback compensates). The buffer is cut into SLICES equal
 *  parts; a trigger plays slice SLICE (+ SLICE CV, 0–10 V across all slices),
 *  once or looping, forwards or reversed, pitched by PITCH + 1V/OCT. Short
 *  fades at slice edges avoid clicks, like a hardware sampler's envelope. */
export class SampleDsp extends Dsp {
  private iIn = this.ii('in')
  private iTrig = this.ii('trig')
  private iScv = this.ii('scv')
  private iV = this.ii('voct')
  private iRec = this.ii('rec')
  private pSlices = this.pi('slices')
  private pSlice = this.pi('slice')
  private pPitch = this.pi('pitch')
  private pLevel = this.pi('level')
  private pLoop = this.pi('loop')
  private pRev = this.pi('rev')

  private buf = new Float32Array(Math.round(MAX_SECONDS * this.fs))
  private len = 0
  private rate = this.fs
  private recording = false
  private playing = false
  private pos = 0
  private start = 0
  private end = 0
  private eos = 0
  private readonly trig = new Schmitt()
  private readonly recTrig = new Schmitt()

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.name === 'rec' && ev.down) this.toggleRec()
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    if (data.length > this.buf.length) this.buf = new Float32Array(data.length)
    this.buf.set(data)
    this.len = data.length
    this.rate = rate
    this.recording = false
    this.playing = false
  }

  dumpBuffer(): { rate: number; data: Float32Array } | null {
    return this.len ? { rate: this.rate, data: this.buf.slice(0, this.len) } : null
  }

  private toggleRec(): void {
    if (this.recording) {
      this.recording = false
      this.bufferOut.push({ slot: 0, rate: this.rate, data: this.buf.subarray(0, this.len) })
    } else {
      this.recording = true
      this.playing = false
      this.len = 0
      this.rate = this.fs
    }
  }

  private trigger(): void {
    if (!this.len) return
    const n = Math.max(1, Math.round(this.p[this.pSlices]))
    const cvSlice = Math.floor((Math.min(10, Math.max(0, this.in[this.iScv])) / 10) * n)
    const s = Math.min(n - 1, Math.round(this.p[this.pSlice]) + (this.patched[this.iScv] ? cvSlice : 0))
    this.start = Math.floor((s * this.len) / n)
    this.end = Math.floor(((s + 1) * this.len) / n)
    this.pos = this.p[this.pRev] >= 0.5 ? this.end - 1 : this.start
    this.playing = true
  }

  tick(): void {
    const i = this.in
    const p = this.p
    if (this.recTrig.rise(i[this.iRec])) this.toggleRec()
    if (this.trig.rise(i[this.iTrig])) this.trigger()

    if (this.recording) {
      this.buf[this.len++] = i[this.iIn]
      if (this.len >= this.buf.length) this.toggleRec()
    }

    let y = 0
    if (this.playing && this.len) {
      const rev = p[this.pRev] >= 0.5
      const step = (this.rate / this.fs) * Math.pow(2, p[this.pPitch] + i[this.iV]) * (rev ? -1 : 1)
      const k = Math.floor(this.pos)
      const f = this.pos - k
      const a = this.buf[k] ?? 0
      const b = this.buf[Math.min(k + 1, this.len - 1)] ?? 0
      // Edge fades (in samples of the source)
      const fade = FADE_S * this.rate
      const g = Math.min(1, (this.pos - this.start) / fade, (this.end - this.pos) / fade)
      y = (a + (b - a) * f) * Math.max(0, g)
      this.pos += step
      if (this.pos >= this.end || this.pos < this.start) {
        this.eos = Math.round(0.005 * this.fs)
        if (p[this.pLoop] >= 0.5) this.pos = rev ? this.end - 1 : this.start
        else this.playing = false
      }
    }

    this.out[0] = y * p[this.pLevel]
    this.out[1] = this.eos > 0 ? 10 : 0
    if (this.eos > 0) this.eos--
    this.led[0] = this.recording ? 1 : 0
    this.led[1] = this.playing ? 1 : 0
    this.led[2] = this.recording ? this.len / this.buf.length : this.len ? this.pos / this.len : 0
  }
}
