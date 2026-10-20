/** A small RIFF/WAVE reader for dev scripts (PCM 8 / 16 / 24 / 32-bit and
 *  32-bit float; channels are summed to mono). Not used by the app. */
export interface Wave {
  rate: number
  data: Float32Array
}

export function decodeWav(buf: ArrayBuffer): Wave | null {
  const v = new DataView(buf)
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
  if (buf.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  let o = 12
  let format = 0
  let channels = 1
  let rate = 44100
  let bits = 16
  while (o + 8 <= buf.byteLength) {
    const id = tag(o)
    const size = v.getUint32(o + 4, true)
    const body = o + 8
    if (id === 'fmt ') {
      format = v.getUint16(body, true)
      channels = v.getUint16(body + 2, true)
      rate = v.getUint32(body + 4, true)
      bits = v.getUint16(body + 14, true)
      // WAVE_FORMAT_EXTENSIBLE: the real format is in the sub-format GUID's first two bytes
      if (format === 0xfffe && size >= 26) format = v.getUint16(body + 24, true)
    } else if (id === 'data') {
      const end = Math.min(buf.byteLength, body + size)
      const bytes = bits / 8
      const frames = Math.floor((end - body) / (bytes * channels))
      const data = new Float32Array(frames)
      const read = (p: number): number => {
        switch (bits) {
          case 8:
            return (v.getUint8(p) - 128) / 128
          case 16:
            return v.getInt16(p, true) / 32768
          case 24:
            return ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) << 8) / 2147483648
          case 32:
            return format === 3 ? v.getFloat32(p, true) : v.getInt32(p, true) / 2147483648
          default:
            return 0
        }
      }
      for (let i = 0; i < frames; i++) {
        let s = 0
        for (let c = 0; c < channels; c++) s += read(body + (i * channels + c) * bytes)
        data[i] = s / channels
      }
      return { rate, data }
    }
    o = body + size + (size & 1)
  }
  return null
}

/** Resample by linear interpolation (good enough for feature extraction). */
export function resample(w: Wave, rate: number): Float32Array {
  if (w.rate === rate) return w.data
  const n = Math.floor((w.data.length * rate) / w.rate)
  const out = new Float32Array(n)
  const step = w.rate / rate
  for (let i = 0; i < n; i++) {
    const x = i * step
    const j = Math.floor(x)
    const f = x - j
    out[i] = (w.data[j] ?? 0) * (1 - f) + (w.data[j + 1] ?? 0) * f
  }
  return out
}
