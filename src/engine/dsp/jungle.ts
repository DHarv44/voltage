import { JG_SLICES, JG_STEPS, JGL } from '../../modules/specs/jungle'
import type { ModuleSpec } from '../../modules/types'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { PocketClock } from './pocketClock'
import { Converter, ERAS } from './sampling/converter'
import { makeFactory } from './sampling/factory'
import type { SampleData } from './sampling/voice'

const MAX_REC_S = 16
const FADE_S = 0.002
const TRIG_S = 0.004

/** JUNGLE: see the spec. One player: each step (and each roll inside it)
 *  starts it at the step's slice; it plays on until the next. REPITCH reads
 *  the source faster; CYCLIC reads CYCLE-long pieces at the pitch, each
 *  piece starting further along by the tempo's ratio (repeating material
 *  when slower, skipping it when faster: the buzz at the cycle rate). */
export class JungleDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iIn = this.ii('in')
  private readonly iRec = this.ii('rec')
  private readonly oOut = this.oi('out')
  private readonly oTrig = this.oi('trig')
  private readonly P = {
    tempo: this.pi('tempo'),
    src: this.pi('src'),
    mode: this.pi('mode'),
    cycle: this.pi('cycle'),
    pitch: this.pi('pitch'),
    crunch: this.pi('crunch'),
    level: this.pi('level'),
    run: this.pi('run'),
    s0: this.pi('s0'),
  }
  private readonly factory: SampleData
  private readonly user: SampleData
  private readonly clock: PocketClock
  private readonly recIn = new Schmitt()
  private readonly crunch: Converter
  private recording = false
  private srcWas: SampleData | null = null
  private step = -1
  /** The player: the cycle's start and how far into it, the direction, the slice's bounds. */
  private start = 0
  private into = 0
  private dir = 1
  private fade = 0
  private playing = false
  /** Rolls: samples between retriggers in this step (0 = none), samples to the next. */
  private rollEvery = 0
  private rollIn = 0
  private trig = 0
  private count = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.factory = makeFactory(7, 32000)
    this.user = { data: new Float32Array(Math.round(MAX_REC_S * fs)), len: 0, rate: fs }
    this.clock = new PocketClock(JG_STEPS, fs)
    this.crunch = new Converter(fs)
  }

  private get source(): SampleData {
    return this.user.len > 0 ? this.user : this.factory
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'button' || !ev.down) return
    if (ev.name === 'rec') this.toggleRec()
    else if (ev.name === 'edit') this.edit()
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    const n = Math.min(this.user.data.length, data.length)
    this.user.data.set(data.subarray(0, n))
    this.user.len = n
    this.user.rate = rate
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    return slot === 0 && this.user.len ? { rate: this.user.rate, data: this.user.data.slice(0, this.user.len) } : null
  }

  /** REC: record IN as the break (a recording stopped at once clears it: the factory break again). */
  private toggleRec(): void {
    this.recording = !this.recording
    if (this.recording) {
      this.user.len = 0
      this.user.rate = this.fs
    } else this.bufferOut.push({ slot: 0, rate: this.user.rate, data: this.user.data.subarray(0, this.user.len) })
  }

  /** A new edit: mostly the break in order, some hits moved, rolls at the
   *  ends of phrases, the odd reversed hit. */
  private edit(): void {
    for (let i = 0; i < JG_STEPS; i++) {
      const r = this.rng.next()
      const s = r < 0.55 ? i : r < 0.85 ? Math.floor(this.rng.next() * JG_SLICES) : (i + 16) % JG_SLICES
      const f = i >= 12 && this.rng.next() < 0.35 ? (this.rng.next() < 0.6 ? 1 : 2) : this.rng.next() < 0.08 ? 3 : 0
      this.writeParam(this.P.s0 + i * 2, s)
      this.writeParam(this.P.s0 + i * 2 + 1, f)
    }
  }

  /** Slice loudness for the screen (when the source changes). */
  private peaks(): void {
    const s = this.source
    for (let k = 0; k < JG_SLICES; k++) {
      let pk = 0
      const a = Math.floor((k * s.len) / JG_SLICES)
      const z = Math.floor(((k + 1) * s.len) / JG_SLICES)
      for (let i = a; i < z; i += 8) pk = Math.max(pk, Math.abs(s.data[i]))
      this.led[JGL.slice0 + k] = pk
    }
  }

  /** Start the player at the step's slice (backwards from its end for REVERSE). */
  private hit(): void {
    const s = this.source
    const slice = Math.round(this.p[this.P.s0 + this.step * 2])
    if (slice < 0) {
      this.playing = false
      return
    }
    const fx = Math.round(this.p[this.P.s0 + this.step * 2 + 1])
    const len = s.len / JG_SLICES
    this.dir = fx === 3 ? -1 : 1
    this.start = fx === 3 ? (slice + 1) * len - 1 : slice * len
    this.into = 0
    this.fade = 0
    this.playing = true
    this.trig = Math.round(TRIG_S * this.fs)
  }

  private read(at: number): number {
    const s = this.source
    if (at < 0 || at >= s.len - 1) return 0
    const i = Math.floor(at)
    const f = at - i
    return s.data[i] + (s.data[i + 1] - s.data[i]) * f
  }

  tick(): void {
    const p = this.p
    const s = this.source
    if (s !== this.srcWas || (this.recording && this.count % 4096 === 0)) {
      this.srcWas = s
      this.peaks()
    }
    if (this.recIn.rise(this.in[this.iRec])) this.toggleRec()
    if (this.recording) {
      this.user.data[this.user.len++] = this.in[this.iIn] / 5
      if (this.user.len >= this.user.data.length) this.toggleRec()
    }
    // the steps
    const running = p[this.P.run] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.P.tempo], 0, this.in[this.iRst])
    if (c.restarted || !running) {
      this.step = -1
      this.playing = false
    }
    if (stepped) {
      this.step = (this.step + 1) % JG_STEPS
      const fx = Math.round(p[this.P.s0 + this.step * 2 + 1])
      this.rollEvery = fx === 1 || fx === 2 ? Math.round((c.stepLen * this.fs) / (fx === 1 ? 2 : 4)) : 0
      this.rollIn = this.rollEvery
      this.hit()
    } else if (this.rollEvery > 0 && --this.rollIn <= 0) {
      this.rollIn = this.rollEvery
      this.hit()
    }
    // the player
    let y = 0
    if (this.playing) {
      const tempo = this.patched[this.iClk] === 1 ? 15 / Math.max(0.01, c.sixteenth) : p[this.P.tempo]
      const ratio = tempo / Math.max(1, p[this.P.src])
      const pitch = Math.pow(2, p[this.P.pitch] / 12)
      const rate = s.rate / this.fs
      if (p[this.P.mode] < 0.5) {
        // REPITCH: faster is higher
        y = this.read(this.start + this.into * this.dir)
        this.into += rate * ratio * pitch
      } else {
        // CYCLIC: a cycle at the pitch, then the next cycle's start moved on by the tempo
        const cyc = p[this.P.cycle] * s.rate
        y = this.read(this.start + this.into * this.dir)
        this.into += rate * pitch
        if (this.into >= cyc) {
          this.start += cyc * ratio * this.dir
          this.into = 0
        }
      }
      this.fade = Math.min(1, this.fade + 1 / (FADE_S * this.fs))
      y *= this.fade
    }
    // CRUNCH: the 12-bit converter, more of it as it turns
    if (this.count++ % 256 === 0) {
      const k = p[this.P.crunch]
      this.crunch.set(ERAS[3], Math.round((40000 - k * 24000) / 100) * 100, Math.round(16 - k * 4))
    }
    const k = Math.min(1, p[this.P.crunch] * 2)
    const out = y * (1 - k) + (this.crunch.run(y * 5) / 5) * k
    this.out[this.oOut] = Math.tanh(out * 1.3) * 5 * p[this.P.level]
    this.out[this.oTrig] = this.trig > 0 ? 10 : 0
    if (this.trig > 0) this.trig--
    this.led[0] = this.step
    this.led[JGL.rec] = this.recording ? 1 : 0
  }
}
