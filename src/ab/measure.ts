/** What a rendered snippet sounds like, as numbers both engines can be
 *  compared on. Mono, any rate. */
export interface Measure {
  /** Peak level, dBFS. */
  peak: number
  /** RMS over the whole render, dBFS. */
  rms: number
  /** Seconds from the first sound to 90 % of the peak. */
  attack: number
  /** Seconds from the peak to 30 dB down (the render's end when it never gets there). */
  decay: number
  /** Spectral centroid over the loudest 100 ms, Hz. */
  bright: number
  /** Share of energy above 2 kHz over the loudest 100 ms. */
  noise: number
  /** Spectral centroid over the whole render, Hz. */
  body: number
  /** Spectral flatness over 2–16 kHz of the loudest 100 ms, 0 (a few tones: a bell) to 1 (noise). */
  flat: number
  /** Onsets heard (a hit count for drum lines). */
  hits: number
  /** RMS per 50 ms, dBFS, for the envelope drawing. */
  env: number[]
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120)

/** A Hann-windowed FFT magnitude of `n` samples from `from` (n a power of two). */
export function spectrum(x: Float32Array, from: number, n: number): Float32Array {
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

function centroid(mag: Float32Array, n: number, rate: number): { centroid: number; above2k: number } {
  let num = 0
  let den = 0
  let hi = 0
  for (let i = 1; i < mag.length; i++) {
    const f = (i * rate) / n
    const p = mag[i] * mag[i]
    num += f * p
    den += p
    if (f > 2000) hi += p
  }
  return { centroid: den > 0 ? num / den : 0, above2k: den > 0 ? hi / den : 0 }
}

export function measure(x: Float32Array, rate: number): Measure {
  const win = Math.round(0.05 * rate)
  const env: number[] = []
  let peak = 0
  let sum = 0
  for (let s = 0; s + win <= x.length; s += win) {
    let e = 0
    for (let i = s; i < s + win; i++) {
      const v = x[i]
      e += v * v
      peak = Math.max(peak, Math.abs(v))
    }
    sum += e
    env.push(db(Math.sqrt(e / win)))
  }
  const rms = db(Math.sqrt(sum / Math.max(1, x.length)))
  // the first note: from its first sound to 90 % of its own peak (within half a second)
  const th = peak * 0.1
  let first = -1
  for (let i = 0; i < x.length; i++)
    if (Math.abs(x[i]) >= th) {
      first = i
      break
    }
  let local = 0
  const span = Math.min(x.length, (first < 0 ? 0 : first) + Math.round(0.5 * rate))
  for (let i = Math.max(0, first); i < span; i++) local = Math.max(local, Math.abs(x[i]))
  let at = Math.max(0, first)
  for (let i = at; i < span; i++)
    if (Math.abs(x[i]) >= local * 0.9) {
      at = i
      break
    }
  let dec = x.length
  const fine = Math.round(0.005 * rate)
  const floor = local * Math.pow(10, -30 / 20)
  for (let s = at; s + fine <= x.length; s += fine) {
    let m = 0
    for (let i = s; i < s + fine; i++) m = Math.max(m, Math.abs(x[i]))
    if (m <= floor) {
      dec = s
      break
    }
  }
  // the loudest 100 ms for the early spectrum
  let loud = 0
  let loudAt = 0
  const w100 = Math.round(0.1 * rate)
  for (let s = 0; s + w100 <= x.length; s += w100 >> 1) {
    let e = 0
    for (let i = s; i < s + w100; i++) e += x[i] * x[i]
    if (e > loud) (loud = e), (loudAt = s)
  }
  const earlyMag = spectrum(x, loudAt, 4096)
  const early = centroid(earlyMag, 4096, rate)
  const whole = centroid(spectrum(x, 0, 32768), 32768, rate)
  // flatness: geometric over arithmetic mean of power in the band
  let logSum = 0
  let pSum = 0
  let bins = 0
  for (let i = 1; i < earlyMag.length; i++) {
    const f = (i * rate) / 4096
    if (f < 2000 || f > 16000) continue
    const p = earlyMag[i] * earlyMag[i] + 1e-12
    logSum += Math.log(p)
    pSum += p
    bins++
  }
  const flat = bins ? Math.exp(logSum / bins) / (pSum / bins) : 0
  // onsets: the 50 ms envelope rising 12 dB above the previous window
  let hits = 0
  for (let i = 1; i < env.length; i++) if (env[i] > env[i - 1] + 12 && env[i] > rms - 10) hits++
  return { peak: db(peak), rms, attack: first < 0 ? 0 : (at - first) / rate, decay: (dec - at) / rate, bright: early.centroid, noise: early.above2k, body: whole.centroid, flat, hits, env }
}

/** How two measures differ, 0 = the same; each term is roughly "one noticeable step". */
export function differ(a: Measure, b: Measure): { total: number; level: number; attack: number; decay: number; bright: number; noise: number; flat: number } {
  const oct = (p: number, q: number) => Math.abs(Math.log2(Math.max(50, p) / Math.max(50, q)))
  const level = Math.abs(a.rms - b.rms) / 6
  const attack = Math.abs(Math.log2((a.attack + 0.005) / (b.attack + 0.005))) / 1.5
  const decay = Math.abs(Math.log2((a.decay + 0.02) / (b.decay + 0.02))) / 1
  const bright = oct(a.bright, b.bright) / 1
  const noise = (Math.abs(a.noise - b.noise) * 3) / 1
  // flatness is log-ish: a bell (0.02) against a wash (0.3) is a big step
  const flat = Math.abs(Math.log10((a.flat + 0.01) / (b.flat + 0.01))) / 0.5
  return { total: level + attack + decay + bright + noise + flat, level, attack, decay, bright, noise, flat }
}
