import { GRAIN_SECONDS, GRL, MAX_GRAINS, WAVE_BINS } from '../../modules/specs/ambient'
import type { ModuleSpec } from '../../modules/types'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { fastTanh } from './util'

/** GRAINS: a four-second memory and up to 32 grains playing from it. */
export class GrainsDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iFrz = this.ii('frz')
  private readonly iPos = this.ii('pos')
  private readonly iV = this.ii('voct')
  private readonly iTrig = this.ii('trig')
  private readonly iDens = this.ii('dens')
  private readonly P = {
    pos: this.pi('pos'),
    size: this.pi('size'),
    density: this.pi('density'),
    pitch: this.pi('pitch'),
    spray: this.pi('spray'),
    spread: this.pi('spread'),
    rev: this.pi('rev'),
    fb: this.pi('fb'),
    mix: this.pi('mix'),
    freeze: this.pi('freeze'),
  }
  private readonly buf: Float32Array
  private readonly n: number
  private w = 0
  private readonly binLen: number
  private readonly peaks = new Float32Array(WAVE_BINS)
  // grains
  private readonly on = new Uint8Array(MAX_GRAINS)
  private readonly at = new Float64Array(MAX_GRAINS)
  private readonly step = new Float64Array(MAX_GRAINS)
  private readonly len = new Float64Array(MAX_GRAINS)
  /** Samples each grain has played. */
  private readonly done = new Float64Array(MAX_GRAINS)
  private readonly gl = new Float64Array(MAX_GRAINS)
  private readonly gr = new Float64Array(MAX_GRAINS)
  private next = 0
  private readonly trig = new Schmitt()
  private wetMono = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.n = Math.round(GRAIN_SECONDS * fs)
    this.buf = new Float32Array(this.n)
    this.binLen = Math.ceil(this.n / WAVE_BINS)
  }

  /** Start a grain (if a slot is free). */
  private spawn(): void {
    let g = -1
    for (let k = 0; k < MAX_GRAINS; k++)
      if (!this.on[k]) {
        g = k
        break
      }
    if (g < 0) return
    const p = this.p
    const rng = this.rng
    const fs = this.fs
    const len = Math.max(32, p[this.P.size] * fs)
    const rate = Math.pow(2, p[this.P.pitch] / 12 + this.in[this.iV])
    const dir = rng.next() < p[this.P.rev] ? -1 : 1
    const frozen = this.frozen()
    // How far behind "now" it starts. Over its life the grain closes on the
    // write head by (its speed − the tape's) × length: it must never catch the
    // head (or the newest sample, when frozen), nor run off the oldest end.
    const pos = Math.min(1, Math.max(0, p[this.P.pos] + this.in[this.iPos] / 10 + (rng.next() - 0.5) * p[this.P.spray]))
    const span = (dir * rate - (frozen ? 0 : 1)) * len
    const lo = 2 + Math.max(0, span)
    const hi = Math.max(lo, this.n - 4 - Math.max(0, -span))
    let start = this.w - (lo + pos * (hi - lo))
    if (start < 0) start += this.n
    this.on[g] = 1
    this.at[g] = start
    this.step[g] = rate * dir
    this.len[g] = len
    this.done[g] = 0
    const pan = (rng.next() * 2 - 1) * p[this.P.spread]
    this.gl[g] = Math.sqrt((1 - pan) / 2)
    this.gr[g] = Math.sqrt((1 + pan) / 2)
  }

  private frozen(): boolean {
    return this.p[this.P.freeze] >= 0.5 || this.in[this.iFrz] > 1
  }

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const n = this.n
    // record (unless frozen), with the cloud fed back for washes
    if (!this.frozen()) {
      const v = fastTanh((x + this.wetMono * p[this.P.fb]) / 6) * 6
      this.buf[this.w] = v
      const b = Math.floor(this.w / this.binLen)
      const a = v < 0 ? -v : v
      if (this.w % this.binLen === 0) this.peaks[b] = a
      else if (a > this.peaks[b]) this.peaks[b] = a
      this.w = this.w + 1 >= n ? 0 : this.w + 1
    }

    // when grains start: DENSITY a second, loosely (a cloud, not a clock); TRIG adds one
    const dens = Math.max(0.1, p[this.P.density] * Math.pow(2, this.in[this.iDens] / 2))
    if (--this.next <= 0) {
      this.spawn()
      this.next = (this.fs / dens) * (0.5 + this.rng.next())
    }
    if (this.trig.rise(this.in[this.iTrig])) this.spawn()

    let L = 0
    let R = 0
    for (let g = 0; g < MAX_GRAINS; g++) {
      if (!this.on[g]) {
        this.led[GRL.pos + g] = -1
        this.led[GRL.amp + g] = 0
        continue
      }
      const t = this.done[g] / this.len[g]
      const s = Math.sin(Math.PI * t)
      const env = s * s
      let i = this.at[g]
      i = i - Math.floor(i / n) * n
      const i0 = Math.floor(i)
      const f = i - i0
      const a = this.buf[i0]
      const y = (a + (this.buf[i0 + 1 >= n ? 0 : i0 + 1] - a) * f) * env
      L += y * this.gl[g]
      R += y * this.gr[g]
      this.at[g] = i + this.step[g]
      this.done[g]++
      if (this.done[g] >= this.len[g]) this.on[g] = 0
      this.led[GRL.pos + g] = i / n
      this.led[GRL.amp + g] = env
    }
    // overlapping grains add up: keep the cloud about as loud as one grain
    const overlap = dens * p[this.P.size]
    const gain = 1 / Math.sqrt(Math.max(1, overlap * 0.6))
    L *= gain
    R *= gain
    this.wetMono = (L + R) * 0.5
    const mix = p[this.P.mix]
    this.out[0] = x * (1 - mix) + L * mix * 1.2
    this.out[1] = x * (1 - mix) + R * mix * 1.2
    for (let b = 0; b < WAVE_BINS; b++) this.led[GRL.wave + b] = this.peaks[b] / 5
    this.led[GRL.head] = this.w / n
  }
}
