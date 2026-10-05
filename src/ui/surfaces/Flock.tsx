import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { BOIDS, FLOCKL } from '../../modules/specs/flock'
import { PX } from '../geometry'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

/** The sky. Click to startle the flock away from that spot. */
export function Flock({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#f2a46a')
    g.addColorStop(1, '#5a3a5e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    if (!led) return
    ctx.fillStyle = '#1a1420'
    const s = H * 0.025
    for (let i = 0; i < BOIDS; i++) {
      const k = FLOCKL.boids + i * 3
      const px = led[k] * W
      const py = (1 - led[k + 1]) * H
      const a = -led[k + 2]
      ctx.beginPath()
      ctx.moveTo(px + Math.cos(a) * s * 1.6, py + Math.sin(a) * s * 1.6)
      ctx.lineTo(px + Math.cos(a + 2.5) * s, py + Math.sin(a + 2.5) * s)
      ctx.lineTo(px + Math.cos(a - 2.5) * s, py + Math.sin(a - 2.5) * s)
      ctx.fill()
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    sendSurface(mod, 'scare', (e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, true)
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }}
      onPointerDown={down}
    />
  )
}
