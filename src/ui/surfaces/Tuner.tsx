import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { KEY_NAMES, TUNEL } from '../../modules/specs/tune'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const noteName = (v: number) => {
  const s = Math.round(v * 12)
  return `${KEY_NAMES[((s % 12) + 12) % 12]}${Math.floor(s / 12) + 4}`
}

/** Pitch corrector display: the note it hears, how far off it is, and the
 *  note it is pulling to. */
export function Tuner({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const shown = useRef(0)

  useFrame(ref, (_now, dt) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const voiced = (led?.[TUNEL.voiced] ?? 0) > 0.5
    const heard = led?.[TUNEL.heard] ?? 0
    const target = led?.[TUNEL.target] ?? 0
    const cents = Math.max(-50, Math.min(50, (heard - target) * 1200))
    shown.current += ((voiced ? cents : 0) - shown.current) * Math.min(1, dt * 12)
    ctx.fillStyle = '#081016'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(140,200,255,0.25)'
    ctx.lineWidth = 2
    for (let c = -50; c <= 50; c += 10) {
      const gx = W / 2 + (c / 50) * W * 0.42
      ctx.beginPath()
      ctx.moveTo(gx, H * (c === 0 ? 0.55 : 0.68))
      ctx.lineTo(gx, H * 0.85)
      ctx.stroke()
    }
    const nx = W / 2 + (shown.current / 50) * W * 0.42
    ctx.fillStyle = voiced ? (Math.abs(cents) < 8 ? '#5effa0' : '#ffd25a') : 'rgba(140,200,255,0.3)'
    ctx.beginPath()
    ctx.moveTo(nx, H * 0.55)
    ctx.lineTo(nx - H * 0.08, H * 0.42)
    ctx.lineTo(nx + H * 0.08, H * 0.42)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.font = `600 ${Math.round(H * 0.3)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillStyle = voiced ? '#e8f4ff' : 'rgba(140,200,255,0.35)'
    ctx.fillText(voiced ? noteName(heard) : '—', W * 0.25, H * 0.34)
    ctx.font = `${Math.round(H * 0.17)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillStyle = 'rgba(140,200,255,0.7)'
    ctx.fillText(voiced ? `→ ${noteName(target)}` : 'listening', W * 0.72, H * 0.3)
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
