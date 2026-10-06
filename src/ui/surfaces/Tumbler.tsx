import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { TUMBLER_BALLS, TUMBLERL } from '../../modules/specs/tumbler'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const TAU = Math.PI * 2
/** Ball radius as a fraction of the drum's (matches the engine). */
const BALL = 0.075
/** A drag that moves less than this (px) is a click: kick the balls. */
const CLICK = 4

/** The drum, seen face-on: each wall in its note's colour, lighting up as a
 *  ball hits it. Drag round the drum to spin it by hand (let go and the motor
 *  takes over again); click to kick the balls. */
export function Tumbler({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const sides = useRef(5)
  sides.current = Math.round(inst.params.sides ?? 5)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#efe8d8'
    ctx.fillRect(0, 0, W, H)
    const cx = W / 2
    const cy = H / 2
    const rad = Math.min(W, H) * 0.46
    const n = sides.current
    const angle = (led?.[TUMBLERL.angle] ?? 0) * TAU
    // the walls: the drum turns anticlockwise for positive SPIN (y up)
    const corner = (k: number) => {
      const a = angle + (TAU * k) / n
      return [cx + Math.cos(a) * rad, cy - Math.sin(a) * rad] as const
    }
    ctx.lineCap = 'round'
    for (let k = 0; k < n; k++) {
      const [x0, y0] = corner(k)
      const [x1, y1] = corner(k + 1)
      const flash = led?.[TUMBLERL.flash + k] ?? 0
      const hue = (k / n) * 360
      ctx.strokeStyle = `hsl(${hue} 70% ${38 + flash * 30}%)`
      ctx.lineWidth = rad * (0.045 + flash * 0.05)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
    // the hub, so the spin reads even with no balls moving
    ctx.fillStyle = '#2a2520'
    ctx.beginPath()
    ctx.arc(cx, cy, rad * 0.04, 0, TAU)
    ctx.fill()
    if (!led) return
    for (let i = 0; i < TUMBLER_BALLS; i++) {
      const bx = led[TUMBLERL.pos + i * 2]
      if (bx < 0) continue
      const by = led[TUMBLERL.pos + i * 2 + 1]
      ctx.fillStyle = '#2a2520'
      ctx.beginPath()
      ctx.arc(cx + (bx * 2 - 1) * rad, cy - (by * 2 - 1) * rad, rad * BALL, 0, TAU)
      ctx.fill()
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    // the pointer's angle round the drum's centre (y up), and how fast it turns
    const at = (cx: number, cy: number) => Math.atan2(-(cy - (r.top + r.height / 2)), cx - (r.left + r.width / 2))
    let last = at(e.clientX, e.clientY)
    let t = performance.now()
    let moved = 0
    let omega = 0
    const sx = e.clientX
    const sy = e.clientY
    track(
      (ev) => {
        moved = Math.max(moved, Math.hypot(ev.clientX - sx, ev.clientY - sy))
        if (moved < CLICK) return
        const a = at(ev.clientX, ev.clientY)
        const now = performance.now()
        let da = a - last
        da -= Math.round(da / TAU) * TAU
        omega = omega * 0.5 + (da / Math.max(0.001, (now - t) / 1000)) * 0.5
        last = a
        t = now
        sendSurface(mod, 'spin', Math.max(-30, Math.min(30, omega)), 0, true)
      },
      () => {
        if (moved < CLICK) sendSurface(mod, 'kick', 0, 0, true)
        else sendSurface(mod, 'spin', 0, 0, false)
      },
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      title="Drag round the drum to spin it by hand · click to kick the balls"
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'grab' }}
      onPointerDown={down}
    />
  )
}
