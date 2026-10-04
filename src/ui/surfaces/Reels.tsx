import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { FT_SECONDS, FTL } from '../../modules/specs/fourtrack'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const TAU = Math.PI * 2

/** Cassette window: two reels whose tape packs grow and shrink with the head
 *  position and spin at the speed tape is actually moving, plus the counter. */
export function Reels({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const spin = useRef({ l: 0, r: 0 })

  useFrame(ref, (_now, dt) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const head = led?.[FTL.head] ?? 0
    const speed = led?.[FTL.speed] ?? 0
    const frac = Math.min(1, Math.max(0, head / FT_SECONDS))
    ctx.fillStyle = '#141416'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#26282c'
    ctx.beginPath()
    ctx.roundRect(W * 0.04, H * 0.08, W * 0.92, H * 0.64, 10)
    ctx.fill()

    const hub = H * 0.07
    const full = H * 0.27
    const rl = hub + (full - hub) * Math.sqrt(1 - frac)
    const rr = hub + (full - hub) * Math.sqrt(frac)
    // Tape moves at constant linear speed: a smaller pack spins faster.
    const lin = speed * 0.9
    spin.current.l += (lin / Math.max(rl / H, 0.05)) * dt * 0.08
    spin.current.r += (lin / Math.max(rr / H, 0.05)) * dt * 0.08
    const reels: [number, number, number][] = [
      [W * 0.3, rl, spin.current.l],
      [W * 0.7, rr, spin.current.r],
    ]
    const cy = H * 0.4
    ctx.strokeStyle = '#3b2a1e'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(W * 0.3, cy + rl)
    ctx.lineTo(W * 0.42, H * 0.68)
    ctx.lineTo(W * 0.58, H * 0.68)
    ctx.lineTo(W * 0.7, cy + rr)
    ctx.stroke()
    for (const [cx, r, a] of reels) {
      ctx.fillStyle = '#4a3324'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#e9e5dc'
      ctx.beginPath()
      ctx.arc(cx, cy, hub, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#26282c'
      for (let k = 0; k < 6; k++) {
        const ang = a + (k * TAU) / 6
        ctx.beginPath()
        ctx.arc(cx + Math.cos(ang) * hub * 0.62, cy + Math.sin(ang) * hub * 0.62, hub * 0.16, 0, TAU)
        ctx.fill()
      }
    }

    // Counter.
    const m = Math.floor(head / 60)
    const s = head - m * 60
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(W * 0.36, H * 0.78, W * 0.28, H * 0.17)
    ctx.fillStyle = (led?.[FTL.rec] ?? 0) > 0.5 ? '#ff5a4a' : '#ffd25a'
    ctx.font = `${Math.round(H * 0.13)}px Consolas, 'Courier New', monospace`
    ctx.textAlign = 'center'
    ctx.fillText(`${m}:${s.toFixed(1).padStart(4, '0')}`, W * 0.5, H * 0.915)
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
