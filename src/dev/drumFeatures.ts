/** What a drum hit sounds like, as a few numbers: used to fit our drum
 *  modules to sampled drum machines (dev only). All at 48 kHz mono. */
export const FS = 48000

export interface DrumFeatures {
  /** Seconds from the peak to 30 dB down. */
  decay: number
  /** Fundamental in Hz over the first 60 ms (0 when there's no clear pitch). */
  f0: number
  /** Spectral centroid of the first 30 ms, Hz. */
  bright: number
  /** Share of energy above 2 kHz over the first 30 ms, 0–1. */
  noise: number
  /** Spectral centroid of the whole hit, Hz. */
  body: number
}

/** Index of the onset: where the signal first reaches a tenth of its peak. */
export function onsetOf(x: Float32Array): number {
  let peak = 0
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]))
  const th = peak * 0.1
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) >= th) return Math.max(0, i - 24)
  return 0
}

function decayOf(x: Float32Array, from: number): number {
  const win = Math.round(0.005 * FS)
  const env: number[] = []
  for (let s = from; s + win <= x.length; s += win) {
    let e = 0
    for (let i = s; i < s + win; i++) e += x[i] * x[i]
    env.push(Math.sqrt(e / win))
  }
  let peak = 0
  let at = 0
  env.forEach((e, i) => {
    if (e > peak) (peak = e), (at = i)
  })
  const th = peak * Math.pow(10, -30 / 20)
  for (let i = at; i < env.length; i++) if (env[i] <= th) return ((i - at) * win) / FS
  return ((env.length - at) * win) / FS
}

/** Radix-2 FFT magnitude of a Hann-windowed frame (n a power of two). */
function spectrum(x: Float32Array, from: number, n: number): Float32Array {
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < n; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n))
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k)
        const wi = Math.sin(ang * k)
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
  }
  const mag = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i])
  return mag
}

function centroid(mag: Float32Array, n: number): { centroid: number; above2k: number } {
  let num = 0
  let den = 0
  let hi = 0
  for (let i = 1; i < mag.length; i++) {
    const f = (i * FS) / n
    const p = mag[i] * mag[i]
    num += f * p
    den += p
    if (f > 2000) hi += p
  }
  return { centroid: den > 0 ? num / den : 0, above2k: den > 0 ? hi / den : 0 }
}

/** Fundamental by autocorrelation over 30–500 Hz: the strongest lag after
 *  the correlation first dips (short lags are always correlated on a low
 *  tone); 0 when there's no dip or the peak is weak. */
function pitchOf(x: Float32Array, from: number, len: number): number {
  const hi = Math.ceil(FS / 30)
  let e0 = 0
  for (let i = 0; i < len; i++) e0 += (x[from + i] ?? 0) ** 2
  if (e0 <= 0) return 0
  let dipped = false
  let best = 0
  let bestLag = 0
  for (let lag = 1; lag <= hi; lag++) {
    let s = 0
    for (let i = 0; i + lag < len; i++) s += (x[from + i] ?? 0) * (x[from + i + lag] ?? 0)
    if (!dipped) {
      if (s < 0) dipped = true
      continue
    }
    if (s > best) (best = s), (bestLag = lag)
  }
  return dipped && best / e0 > 0.25 && bestLag >= FS / 500 ? FS / bestLag : 0
}

export function featuresOf(raw: Float32Array): DrumFeatures {
  // without any DC offset (some old samples carry one)
  let mean = 0
  for (const v of raw) mean += v
  mean /= Math.max(1, raw.length)
  const x = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i++) x[i] = raw[i] - mean
  const on = onsetOf(x)
  const early = spectrum(x, on, 2048)
  const whole = spectrum(x, on, 16384)
  const e = centroid(early, 2048)
  const w = centroid(whole, 16384)
  return { decay: decayOf(x, on), f0: pitchOf(x, on, Math.round(0.06 * FS)), bright: e.centroid, noise: e.above2k, body: w.centroid }
}

/** The middle of several measurements, feature by feature (a bank's variants of one hit). */
export function medianFeatures(fs: DrumFeatures[]): DrumFeatures {
  const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const pitched = fs.filter((f) => f.f0 > 0)
  return {
    decay: mid(fs.map((f) => f.decay)),
    f0: pitched.length * 2 >= fs.length ? mid(pitched.map((f) => f.f0)) : 0,
    bright: mid(fs.map((f) => f.bright)),
    noise: mid(fs.map((f) => f.noise)),
    body: mid(fs.map((f) => f.body)),
  }
}

/** How far apart two hits are: octaves of pitch and brightness, log decay, noise share. */
export function distance(a: DrumFeatures, b: DrumFeatures, w: { f0: number; decay: number; bright: number; noise: number; body: number }): number {
  const oct = (p: number, q: number) => Math.abs(Math.log2(Math.max(20, p) / Math.max(20, q)))
  const pitch = a.f0 > 0 && b.f0 > 0 ? oct(a.f0, b.f0) : a.f0 > 0 || b.f0 > 0 ? 1 : 0
  return w.f0 * pitch + w.decay * Math.abs(Math.log(Math.max(0.01, a.decay) / Math.max(0.01, b.decay))) + w.bright * oct(a.bright, b.bright) + w.noise * Math.abs(a.noise - b.noise) * 3 + w.body * oct(a.body, b.body)
}
