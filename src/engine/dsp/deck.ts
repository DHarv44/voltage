import { DK_OWN, DK_STEPS, DK_TRACKS, DKL } from '../../modules/specs/deck'
import type { ModuleSpec } from '../../modules/types'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { PocketClock } from './pocketClock'
import { Converter, ERAS } from './sampling/converter'
import { makeFactory } from './sampling/factory'
import { LowpassSvf } from './sampling/svf'
import { SampleVoice, type SampleData } from './sampling/voice'

const MAX_REC_S = 8
const FACTORY_RATE = 32000
/** The factory break is two bars at 120. */
const BREAK = 7
const BREAK_BPM = 120
/** Track pans (−1..1) and their equal-power gains. */
const PAN = [0, -0.35, 0.35, 0.15]
const GL = PAN.map((p) => Math.cos(((p + 1) * Math.PI) / 4))
const GR = PAN.map((p) => Math.sin(((p + 1) * Math.PI) / 4))

/** DECK: see the spec. Each track has two voices (a retrigger lets the last
 *  hit go in a few ms rather than clicking), then its crush (a converter,
 *  blended in), its low-pass and its level, all four set by the scenes as
 *  the crossfader morphs between them. */
export class DeckDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iXf = this.ii('xfcv')
  private readonly iRec = this.ii('rec')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly oT = this.oi('t1')
  private readonly P = {
    xf: this.pi('xf'),
    tempo: this.pi('tempo'),
    level: this.pi('level'),
    rectrk: this.pi('rectrk'),
    run: this.pi('run'),
    m0: this.pi('m0'),
    a0: this.pi('a0cut'),
    b0: this.pi('b0cut'),
  }
  private readonly factory: SampleData[] = []
  private readonly own: SampleData[] = []
  /** The tempo each OWN loop was recorded at (0 = a loaded file: not synced). */
  private readonly ownBpm = new Float32Array(DK_TRACKS)
  private recBuf: Float32Array
  private recLen = 0
  private recTrk = -1
  private armed = false
  /** The take began on a bar (so it ends on the next one, a loop in time). */
  private synced = false
  private readonly voices: SampleVoice[] = []
  private readonly next = new Uint8Array(DK_TRACKS)
  /** Each track's tempo ratio (its base speed before the scene's pitch). */
  private readonly base = new Float32Array(DK_TRACKS).fill(1)
  private readonly crush: Converter[] = []
  private readonly lp: LowpassSvf[] = []
  private readonly gain = new Float32Array(DK_TRACKS)
  private readonly mix = new Float32Array(DK_TRACKS)
  private readonly pitch = new Float32Array(DK_TRACKS).fill(1)
  private readonly meter = new Float32Array(DK_TRACKS)
  private readonly clock: PocketClock
  private readonly recIn = new Schmitt()
  private step = -1
  private count = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    for (let k = 0; k < DK_OWN; k++) this.factory.push(makeFactory(k, FACTORY_RATE))
    for (let t = 0; t < DK_TRACKS; t++) {
      this.own.push({ data: new Float32Array(Math.round(MAX_REC_S * fs)), len: 0, rate: fs })
      for (let v = 0; v < 2; v++) {
        const sv = new SampleVoice(fs)
        sv.attack = 0.001
        sv.release = 0.006
        this.voices.push(sv)
      }
      this.crush.push(new Converter(fs))
      this.lp.push(new LowpassSvf(fs))
    }
    this.recBuf = new Float32Array(Math.round(MAX_REC_S * fs))
    this.clock = new PocketClock(DK_STEPS, fs)
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.down && ev.name === 'rec') this.pressRec()
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot < 0 || slot >= DK_TRACKS) return
    const o = this.own[slot]
    const n = Math.min(o.data.length, data.length)
    o.data.set(data.subarray(0, n))
    o.len = n
    o.rate = rate
    this.ownBpm[slot] = 0
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    const o = this.own[slot]
    return o && o.len ? { rate: o.rate, data: o.data.slice(0, o.len) } : null
  }

  private get tempo(): number {
    return this.patched[this.iClk] === 1 ? 15 / Math.max(0.01, this.clock.sixteenth) : this.p[this.P.tempo]
  }

  /** REC: while playing, arm for the next bar (again to cancel); stopped,
   *  record straight away until pressed again. */
  private pressRec(): void {
    if (this.recTrk >= 0) this.finishRec()
    else if (this.armed) this.armed = false
    else if (this.step >= 0) this.armed = true
    else this.startRec()
  }

  private startRec(): void {
    this.armed = false
    this.recTrk = Math.round(this.p[this.P.rectrk])
    this.recLen = 0
    this.synced = this.step >= 0
  }

  /** The take becomes the track's OWN sound (the buffers swap: nothing copied). */
  private finishRec(): void {
    const t = this.recTrk
    this.recTrk = -1
    if (this.recLen < this.fs * 0.05) return
    const o = this.own[t]
    const old = o.data
    o.data = this.recBuf
    this.recBuf = old
    o.len = this.recLen
    o.rate = this.fs
    this.ownBpm[t] = this.synced ? this.tempo : 0
    this.bufferOut.push({ slot: t, rate: o.rate, data: o.data.subarray(0, o.len) })
    this.writeParam(this.P.m0 + t * 3 + 1, DK_OWN)
    if (Math.round(this.p[this.P.m0 + t * 3]) === 0) {
      this.writeParam(this.P.m0 + t * 3, 0xffff)
      this.writeParam(this.P.m0 + t * 3 + 2, 0)
    }
  }

  private sound(t: number): SampleData {
    const k = Math.round(this.p[this.P.m0 + t * 3 + 1])
    return k >= DK_OWN ? this.own[t] : this.factory[k]
  }

  /** Play track t on this step: from the step's sixteenth (SLICE) or the top (HIT). */
  private hit(t: number): void {
    const s = this.sound(t)
    if (s.len < 2) return
    const k = Math.round(this.p[this.P.m0 + t * 3 + 1])
    const slice = this.p[this.P.m0 + t * 3 + 2] < 0.5
    let bar = s.len
    let bpm = 0
    if (k === BREAK) {
      bar = s.len / 2
      bpm = BREAK_BPM
    } else if (k >= DK_OWN) bpm = this.ownBpm[t]
    this.base[t] = slice && bpm > 0 ? this.tempo / bpm : 1
    const a = this.voices[t * 2 + this.next[t]]
    const b = this.voices[t * 2 + (1 - this.next[t])]
    b.noteOff()
    a.trigger(s, slice ? (this.step * bar) / DK_STEPS : 0, s.len, this.base[t] * this.pitch[t], 1)
    this.next[t] = 1 - this.next[t]
  }

  /** The scenes, morphed: each track's gain, crush, cutoff and pitch. */
  private scenes(): void {
    const p = this.p
    const x = Math.max(0, Math.min(1, p[this.P.xf] + (this.patched[this.iXf] === 1 ? this.in[this.iXf] / 10 : 0)))
    for (let t = 0; t < DK_TRACKS; t++) {
      const a = this.P.a0 + t * 4
      const b = this.P.b0 + t * 4
      const cut = p[a] + (p[b] - p[a]) * x
      const pit = p[a + 1] + (p[b + 1] - p[a + 1]) * x
      const crs = p[a + 3] + (p[b + 3] - p[a + 3]) * x
      this.gain[t] = (p[a + 2] + (p[b + 2] - p[a + 2]) * x) * p[this.P.level] * 1.7
      this.mix[t] = Math.min(1, crs * 3)
      this.pitch[t] = Math.pow(2, pit / 12)
      this.lp[t].set(60 * Math.pow(2, cut * 8.4), 0.25)
      this.crush[t].set(ERAS[3], Math.round((40000 - crs * 34000) / 100) * 100, Math.round(16 - crs * 11))
    }
  }

  tick(): void {
    const p = this.p
    if (this.count++ % 32 === 0) this.scenes()
    if (this.recIn.rise(this.in[this.iRec])) this.pressRec()
    // the steps
    const running = p[this.P.run] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.P.tempo], 0, this.in[this.iRst])
    if (c.restarted || !running) {
      if (this.step >= 0) for (let v = 0; v < this.voices.length; v++) this.voices[v].noteOff()
      this.step = -1
    }
    if (stepped) {
      this.step = (this.step + 1) % DK_STEPS
      if (this.step === 0) {
        if (this.recTrk >= 0 && this.synced && this.recLen > 0) this.finishRec()
        else if (this.armed) this.startRec()
      }
      for (let t = 0; t < DK_TRACKS; t++) if ((Math.round(p[this.P.m0 + t * 3]) >> this.step) & 1) this.hit(t)
    }
    // pickup recording
    if (this.recTrk >= 0) {
      this.recBuf[this.recLen++] = this.in[this.iIn] / 5
      if (this.recLen >= this.recBuf.length) this.finishRec()
    }
    // the tracks
    let l = 0
    let r = 0
    for (let t = 0; t < DK_TRACKS; t++) {
      const va = this.voices[t * 2]
      const vb = this.voices[t * 2 + 1]
      const ratio = this.base[t] * this.pitch[t]
      va.ratio = ratio
      vb.ratio = ratio
      let y = (va.step() + vb.step()) * 5
      const m = this.mix[t]
      if (m > 0) y += (this.crush[t].run(y) - y) * m
      y = this.lp[t].run(y) * this.gain[t]
      this.out[this.oT + t] = y
      l += y * GL[t]
      r += y * GR[t]
      const a = Math.abs(y) / 5
      this.meter[t] = a > this.meter[t] ? a : this.meter[t] * 0.9997
      this.led[DKL.level0 + t] = this.meter[t]
      this.led[DKL.own0 + t] = this.own[t].len > 0 ? 1 : 0
    }
    this.out[this.oL] = 6 * Math.tanh(l / 6)
    this.out[this.oR] = 6 * Math.tanh(r / 6)
    this.led[DKL.step] = this.step
    this.led[DKL.rec] = this.recTrk
    this.led[DKL.armed] = this.recTrk >= 0 ? 1 : this.armed ? 0.5 : 0
  }
}
