import { useEffect, useRef } from 'react'
import { spectrum } from './measure'

/** A small spectrogram (log-frequency, 50 Hz – 16 kHz) with the envelope drawn over it. */
export function Spectro({ data, rate, width = 260, height = 72 }: { data: Float32Array; rate: number; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const g = cv.getContext('2d')!
    g.fillStyle = '#0e1012'
    g.fillRect(0, 0, width, height)
    if (!data.length) return
    const n = 2048
    const cols = width
    const hop = Math.max(1, Math.floor((data.length - n) / cols))
    const img = g.createImageData(cols, height)
    const lo = Math.log2(50)
    const hi = Math.log2(Math.min(16000, rate / 2))
    let peak = 1e-9
    const mags: Float32Array[] = []
    for (let c = 0; c < cols; c++) {
      const m = spectrum(data, c * hop, n)
      for (let i = 1; i < m.length; i++) peak = Math.max(peak, m[i])
      mags.push(m)
    }
    for (let c = 0; c < cols; c++) {
      const m = mags[c]
      for (let y = 0; y < height; y++) {
        const f = Math.pow(2, hi - ((hi - lo) * y) / height)
        const bin = Math.min(m.length - 1, Math.round((f * n) / rate))
        const v = Math.max(0, 1 + (20 * Math.log10(m[bin] / peak + 1e-9)) / 60)
        const o = (y * cols + c) * 4
        img.data[o] = 30 + 200 * v * v
        img.data[o + 1] = 40 + 170 * v
        img.data[o + 2] = 50 + 60 * v
        img.data[o + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    // the envelope
    g.strokeStyle = 'rgba(255,255,255,0.75)'
    g.lineWidth = 1
    g.beginPath()
    const win = Math.round(0.01 * rate)
    for (let c = 0; c < cols; c++) {
      const s = Math.floor((c / cols) * data.length)
      let e = 0
      for (let i = s; i < s + win && i < data.length; i++) e += data[i] * data[i]
      const dbv = 20 * Math.log10(Math.sqrt(e / win) + 1e-6)
      const y = height - Math.max(0, Math.min(1, (dbv + 60) / 60)) * height
      c ? g.lineTo(c, y) : g.moveTo(c, y)
    }
    g.stroke()
  }, [data, rate, width, height])
  return <canvas ref={ref} width={width} height={height} style={{ display: 'block', borderRadius: 3 }} />
}
