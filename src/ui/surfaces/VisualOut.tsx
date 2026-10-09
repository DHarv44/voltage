import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'
import { fft } from './fft'

/** VECTOR: an XY CRT. The beam's brightness falls with its speed, and the
 *  phosphor fades by PERSIST each frame (drawn onto itself, never cleared). */
/** Has RST fired since we last looked? (The engine counts pulses on LED 0.) */
function wiped(mod: string, seen: { current: number }): boolean {
  const n = telemetry.leds[mod]?.[0] ?? 0
  if (n === seen.current) return false
  seen.current = n
  return true
}

export function Vector({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params
  const frames = useRef(-1)
  const resets = useRef(0)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx || telemetry.frames === frames.current) return
    frames.current = telemetry.frames
    const p = params.current
    ctx.globalCompositeOperation = 'source-over'
    // RST wipes the phosphor clean
    ctx.fillStyle = wiped(mod, resets) ? 'rgb(2,8,4)' : `rgba(2,8,4,${1 - p.persist})`
    ctx.fillRect(0, 0, W, H)
    const f = telemetry.scopes[mod]
    if (!f) return
    const s = (Math.min(W, H) / 2 / 5) / p.scale / 5 // ±5 divisions across the tube
    const cx = W / 2
    const cy = H / 2
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    const width = 1 + (1 - p.focus) * 6
    for (let i = 3; i < f.length; i += 3) {
      const x0 = cx + f[i - 3] * s
      const y0 = cy - f[i - 2] * s
      const x1 = cx + f[i] * s
      const y1 = cy - f[i + 1] * s
      const speed = Math.hypot(x1 - x0, y1 - y0)
      const a = Math.min(1, (f[i + 2] * 6) / (2 + speed)) // a fast beam deposits less light
      if (a < 0.01) continue
      ctx.strokeStyle = `rgba(90,255,140,${a})`
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none', background: '#020804' }}
    />
  )
}


/** Heat colour for a level 0..1. */
const heat = (v: number) => {
  const r = Math.min(255, v * 3 * 255)
  const g = Math.min(255, Math.max(0, (v * 3 - 1) * 255))
  const b = Math.min(255, Math.max(0, v < 0.33 ? v * 3 * 180 : (v * 3 - 2) * 255))
  return `rgb(${r | 0},${g | 0},${b | 0})`
}

/** WATERFALL: log-frequency spectrogram, newest column on the right. */
export function Waterfall({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params
  const frames = useRef(-1)
  const re = useRef(new Float32Array(2048))
  const im = useRef(new Float32Array(2048))
  const resets = useRef(0)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    const f = telemetry.scopes[mod]
    if (!ctx || !f || telemetry.frames === frames.current) return
    frames.current = telemetry.frames
    // RST wipes the history: the picture starts again from the right
    if (wiped(mod, resets)) ctx.clearRect(0, 0, W, H)
    const n = f.length
    const R = re.current
    const I = im.current
    for (let i = 0; i < n; i++) {
      R[i] = (f[i] / 5) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)) // Hann window
      I[i] = 0
    }
    fft(R, I)
    // scroll left by a column, then paint the newest on the right
    const col = Math.max(2, Math.round(W / 220))
    ctx.drawImage(ctx.canvas, -col, 0)
    const { range, gain } = params.current
    const fs = 48000
    for (let py = 0; py < H; py += 2) {
      const freq = 30 * Math.pow(18000 / 30, 1 - py / H)
      const bin = Math.min(n / 2 - 1, Math.round((freq / fs) * n))
      const mag = Math.hypot(R[bin], I[bin]) / (n / 4)
      const db = 20 * Math.log10(mag + 1e-9) + gain
      const v = Math.min(1, Math.max(0, (db + range) / range))
      ctx.fillStyle = heat(v)
      ctx.fillRect(W - col, py, col, 2)
    }
  })

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none', background: '#000' }}
    />
  )
}
