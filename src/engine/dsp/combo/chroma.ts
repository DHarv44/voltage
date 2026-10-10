/** Listening, for COMBO's learn mode: every HOP samples, an FFT of the last
 *  N samples becomes a chroma (how much of each of the 12 pitch classes is
 *  sounding) and an onset strength (spectral flux: how much louder things
 *  just got, which is where strums and hits are). Nothing allocates after
 *  construction. */

const N = 4096
const HOP = 1024
/** Pitches we listen to (Hz): a guitar's low E to well above its chords. */
const LO = 70
const HI = 2200
/** Below this is the bass: the low strings, the left hand. */
const BASS_HZ = 200

export class ChromaListener {
  readonly chroma = new Float64Array(12)
  /** The pitch classes down in the bass (where a guitarist's root usually is). */
  readonly bass = new Float64Array(12)
  flux = 0
  energy = 0
  /** A new frame was finished on this sample. */
  ready = false
  private readonly ring = new Float64Array(N)
  private w = 0
  private n = 0
  private readonly re = new Float64Array(N)
  private readonly im = new Float64Array(N)
  private readonly win = new Float64Array(N)
  private readonly rev = new Uint16Array(N)
  private readonly cos = new Float64Array(N / 2)
  private readonly sin = new Float64Array(N / 2)
  /** Each bin's pitch class (−1 outside the range) and its log magnitude last frame. */
  private readonly pc = new Int8Array(N / 2)
  private readonly last = new Float64Array(N / 2)
  private readonly weight = new Float64Array(N / 2)
  private readonly mag = new Float64Array(N / 2)
  private readonly binHz: number

  constructor(fs: number) {
    this.binHz = fs / N
    for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)
    const bits = Math.log2(N)
    for (let i = 0; i < N; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
      this.rev[i] = r
    }
    for (let i = 0; i < N / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / N)
      this.sin[i] = -Math.sin((2 * Math.PI * i) / N)
      const f = (i * fs) / N
      this.pc[i] = f < LO || f > HI ? -1 : ((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12
      // low bins are wider than a semitone (they smear between notes): they count less
      this.weight[i] = f < 150 ? 0.4 : 1
    }
  }

  /** One input sample. */
  push(x: number): void {
    this.ready = false
    this.ring[this.w] = x
    this.w = (this.w + 1) % N
    if (++this.n >= HOP) {
      this.n = 0
      this.frame()
      this.ready = true
    }
  }

  private frame(): void {
    const re = this.re
    const im = this.im
    for (let i = 0; i < N; i++) {
      const j = this.rev[i]
      re[j] = this.ring[(this.w + i) % N] * this.win[i]
      im[j] = 0
    }
    // iterative radix-2 FFT
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1
      const step = N / size
      for (let start = 0; start < N; start += size) {
        for (let k = 0; k < half; k++) {
          const c = this.cos[k * step]
          const s = this.sin[k * step]
          const a = start + k
          const b = a + half
          const tr = re[b] * c - im[b] * s
          const ti = re[b] * s + im[b] * c
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
    this.chroma.fill(0)
    this.bass.fill(0)
    let flux = 0
    let energy = 0
    const mag = this.mag
    for (let k = 1; k < N / 2; k++) {
      mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k])
      if (this.pc[k] < 0) continue
      const lg = Math.log(1 + mag[k] * 4)
      energy += mag[k]
      const d = lg - this.last[k]
      if (d > 0) flux += d
      this.last[k] = lg
    }
    // only the spectrum's peaks count, each at its true (interpolated)
    // frequency: a low note's energy spills into neighbouring bins, which
    // down there belong to the neighbouring semitones
    for (let k = 2; k < N / 2 - 1; k++) {
      if (this.pc[k] < 0) continue
      const b = mag[k]
      if (b <= mag[k - 1] || b < mag[k + 1] || b < 1e-6) continue
      const a = Math.log(mag[k - 1] + 1e-12)
      const lb = Math.log(b)
      const c = Math.log(mag[k + 1] + 1e-12)
      const den = a - 2 * lb + c
      const off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0
      const f = (k + off) * this.binHz
      const p = ((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12
      this.chroma[p] += b * this.weight[k]
      if (f < BASS_HZ) this.bass[p] += b
    }
    for (let p = 0; p < 12; p++) this.chroma[p] = Math.log(1 + this.chroma[p])
    this.flux = flux
    this.energy = energy
  }
}

/** Seconds between frames, for a sample rate. */
export const frameSeconds = (fs: number): number => HOP / fs
