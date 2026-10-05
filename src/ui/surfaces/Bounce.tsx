import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { BALLS, BOUNCEL } from '../../modules/specs/bounce'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const BOX_W = 1.6
const COLORS = ['#ffd25a', '#5ef2ff', '#ff6a8a', '#9be37a']

/** The box. Click to grab the nearest ball, drag and let go to throw it. */
export function Bounce({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#0c141c'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(160,200,255,0.25)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, W - 2, H - 2)
    if (!led) return
    const r = H * 0.04
    for (let i = 0; i < BALLS; i++) {
      const bx = led[BOUNCEL.pos + i * 2]
      if (bx < 0) continue
      const by = led[BOUNCEL.pos + i * 2 + 1]
      const f = led[BOUNCEL.flash + i] ?? 0
      const px = bx * W
      const py = (1 - by) * H
      if (f > 0.02) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 5)
        g.addColorStop(0, COLORS[i] + 'aa')
        g.addColorStop(1, COLORS[i] + '00')
        ctx.fillStyle = g
        ctx.globalAlpha = Math.min(1, f * 2)
        ctx.fillRect(px - r * 5, py - r * 5, r * 10, r * 10)
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = COLORS[i]
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const at = (cx: number, cy: number) => ({ x: ((cx - r.left) / r.width) * BOX_W, y: 1 - (cy - r.top) / r.height, t: performance.now() })
    let last = at(e.clientX, e.clientY)
    let vel = { x: 0, y: 0 }
    sendSurface(mod, 'grab', last.x, last.y, true)
    track(
      (ev) => {
        const p = at(ev.clientX, ev.clientY)
        const dt = Math.max(1, p.t - last.t) / 1000
        vel = { x: vel.x * 0.5 + ((p.x - last.x) / dt) * 0.5, y: vel.y * 0.5 + ((p.y - last.y) / dt) * 0.5 }
        last = p
        sendSurface(mod, 'grab', p.x, p.y, true)
      },
      () => sendSurface(mod, 'throw', Math.max(-6, Math.min(6, vel.x)), Math.max(-6, Math.min(6, vel.y)), false),
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'grab' }}
      onPointerDown={down}
    />
  )
}
