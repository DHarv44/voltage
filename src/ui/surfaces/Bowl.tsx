import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { BOWLL } from '../../modules/specs/bowl'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const TAU = Math.PI * 2
/** Rim band (fraction of the bowl radius) that counts as rubbing. */
const RIM_IN = 0.62

/** Singing bowl from above. Circle the rim to bow it; click the middle to strike. */
export function Bowl({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const water = useRef(0)
  water.current = inst.params.water
  const puja = useRef<{ a: number } | null>(null)

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const level = led?.[BOWLL.level] ?? 0
    const cx = W / 2
    const cy = H / 2
    const R = Math.min(W, H) * 0.46
    ctx.fillStyle = '#1d1712'
    ctx.fillRect(0, 0, W, H)
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
    g.addColorStop(0, '#e2b86a')
    g.addColorStop(0.7, '#a8762e')
    g.addColorStop(1, '#5e3c14')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#6e4a1c'
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.86, 0, TAU)
    ctx.fill()
    // Water: ripples that dance with the sound.
    if (water.current > 0.02) {
      ctx.fillStyle = `rgba(110,160,190,${0.25 + water.current * 0.35})`
      ctx.beginPath()
      ctx.arc(cx, cy, R * (0.4 + water.current * 0.42), 0, TAU)
      ctx.fill()
      ctx.strokeStyle = `rgba(220,240,255,${level * 0.6})`
      ctx.lineWidth = 1.5
      for (let k = 1; k <= 4; k++) {
        const rr = R * (0.4 + water.current * 0.42) * ((k / 4 + now * 0.4) % 1)
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, TAU)
        ctx.stroke()
      }
    }
    // The singing: a glow ring on the rim.
    ctx.strokeStyle = `rgba(255,220,150,${level * 0.8})`
    ctx.lineWidth = 2 + level * 8
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.93, 0, TAU)
    ctx.stroke()
    const p = puja.current
    if (p) {
      ctx.fillStyle = '#5a3a20'
      ctx.beginPath()
      ctx.arc(cx + Math.cos(p.a) * R * 0.93, cy + Math.sin(p.a) * R * 0.93, R * 0.08, 0, TAU)
      ctx.fill()
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const R = Math.min(r.width, r.height) * 0.46
    const d = Math.hypot(e.clientX - cx, e.clientY - cy) / R
    if (d > 1.08) return
    e.stopPropagation()
    e.preventDefault()
    if (d < RIM_IN) {
      sendSurface(mod, 'strike', 1 - d * 0.6, 0, true)
      return
    }
    // Rubbing: angular speed of the hand round the rim, in revolutions per second.
    let last = { a: Math.atan2(e.clientY - cy, e.clientX - cx), t: performance.now() }
    puja.current = { a: last.a }
    let speed = 0
    track(
      (ev) => {
        const a = Math.atan2(ev.clientY - cy, ev.clientX - cx)
        const t = performance.now()
        let da = a - last.a
        da -= Math.round(da / TAU) * TAU
        const dt = Math.max(1, t - last.t) / 1000
        speed += (Math.abs(da) / TAU / dt - speed) * 0.3
        last = { a, t }
        puja.current = { a }
        sendSurface(mod, 'rub', speed, 0, true)
      },
      () => {
        puja.current = null
        sendSurface(mod, 'rub', 0, 0, false)
      },
    )
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
