import type { ModuleSpec } from '../../modules/types'
import { Dsp } from './base'
import { Biquad } from './biquad'

/** Points per telemetry frame the vector display keeps (decimated by 2). */
const VEC_POINTS = 1200
const FFT = 2048

/** VECTOR: collects (x, y, z) since the last frame for the CRT to draw. */
export class VectorDsp extends Dsp {
  private readonly iX = this.ii('x')
  private readonly iY = this.ii('y')
  private readonly iZ = this.ii('z')
  private readonly buf = new Float32Array(VEC_POINTS * 3)
  private n = 0
  private skip = 0

  tick(): void {
    if (++this.skip < 2) return
    this.skip = 0
    if (this.n >= VEC_POINTS) return
    const k = this.n++ * 3
    this.buf[k] = this.in[this.iX]
    this.buf[k + 1] = this.in[this.iY]
    this.buf[k + 2] = this.patched[this.iZ] ? Math.min(1, Math.max(0, this.in[this.iZ] / 5)) : 1
  }

  takeFrame(): Float32Array | null {
    if (!this.n) return null
    const f = this.buf.slice(0, this.n * 3)
    this.n = 0
    return f
  }
}

/** WATERFALL: the latest FFT-sized block, in time order, for the spectrogram. */
export class WaterfallDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly ring = new Float32Array(FFT)
  private w = 0

  tick(): void {
    this.ring[this.w] = this.in[this.iIn]
    this.w = (this.w + 1) % FFT
  }

  takeFrame(): Float32Array | null {
    const f = new Float32Array(FFT)
    f.set(this.ring.subarray(this.w))
    f.set(this.ring.subarray(0, this.w), FFT - this.w)
    return f
  }
}

/** LIGHTS: three band envelopes (bass, mids, treble) for the rack's glow. */
export class LightShowDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly pSens = this.pi('sens')
  private readonly pLevel = this.pi('level')
  private readonly lo: Biquad
  private readonly mid: Biquad
  private readonly hi: Biquad
  private readonly env = new Float64Array(3)

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.lo = new Biquad(fs).lowpass(180)
    this.mid = new Biquad(fs).bandpass(1000, 0.8)
    this.hi = new Biquad(fs).highpass(4000)
  }

  tick(): void {
    const x = this.in[this.iIn] * this.p[this.pSens] * 0.4
    this.band(0, this.lo.run(x))
    this.band(1, this.mid.run(x))
    this.band(2, this.hi.run(x) * 2)
  }

  private band(b: number, v: number): void {
    const a = Math.abs(v)
    this.env[b] += (a - this.env[b]) * (a > this.env[b] ? 0.02 : 0.0004)
    this.led[b] = Math.min(1, this.env[b]) * this.p[this.pLevel]
  }
}
