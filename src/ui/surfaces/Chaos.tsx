import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { CHAOSL } from '../../modules/specs/chaos'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const TRAIL = 220

/** A fading trace of the system: the pendulum's tip, or the attractor's wings. */
export function Chaos({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const trail = useRef<{ x: number; y: number }[]>([])
  const frames = useRef(-1)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    if (led && telemetry.frames !== frames.current) {
      frames.current = telemetry.frames
      trail.current.push({ x: led[CHAOSL.x], y: led[CHAOSL.y] })
      if (trail.current.length > TRAIL) trail.current.shift()
    }
    const flip = led?.[CHAOSL.flip] ?? 0
    ctx.fillStyle = '#140a0a'
    ctx.fillRect(0, 0, W, H)
    const t = trail.current
    const cx = W / 2
    const cy = H / 2
    const s = Math.min(W, H) * 0.45
    for (let i = 1; i < t.length; i++) {
      const a = i / t.length
      ctx.strokeStyle = `rgba(255,${150 + flip * 100},${90 + flip * 120},${a * 0.9})`
      ctx.lineWidth = 1 + a * 2
      ctx.beginPath()
      ctx.moveTo(cx + t[i - 1].x * s, cy + t[i - 1].y * s)
      ctx.lineTo(cx + t[i].x * s, cy + t[i].y * s)
      ctx.stroke()
    }
    if (t.length) {
      const p = t[t.length - 1]
      ctx.fillStyle = '#fff1d8'
      ctx.beginPath()
      ctx.arc(cx + p.x * s, cy + p.y * s, 4 + flip * 6, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none' }}
    />
  )
}
