import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { ORBITL, PLANETS } from '../../modules/specs/orbit'
import { actions } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

const COLORS = ['#ffb35a', '#5ec8ff', '#ff6a8a', '#9be37a']

/** Solar system from above. Drag a planet toward or away from the star to
 *  change its orbit (and so its rhythm). The dashed line is the sensor. */
export function Orbit({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params
  const scale = () => H * 0.47

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const p = params.current
    const cx = W / 2
    const cy = H / 2
    const s = scale()
    ctx.fillStyle = '#05060c'
    ctx.fillRect(0, 0, W, H)
    ctx.setLineDash([5, 6])
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, 0)
    ctx.stroke()
    ctx.setLineDash([])
    const conj = led?.[ORBITL.conj] ?? 0
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * (0.08 + conj * 0.05))
    sg.addColorStop(0, '#fff6d0')
    sg.addColorStop(1, 'rgba(255,190,80,0)')
    ctx.fillStyle = sg
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < Math.round(p.planets); i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.beginPath()
      ctx.arc(cx, cy, p[`r${i + 1}`] * s, 0, Math.PI * 2)
      ctx.stroke()
      if (!led) continue
      const px = cx + led[ORBITL.pos + i * 2] * s
      const py = cy + led[ORBITL.pos + i * 2 + 1] * s
      const f = led[ORBITL.flash + i] ?? 0
      ctx.fillStyle = COLORS[i]
      ctx.beginPath()
      ctx.arc(px, py, H * (0.025 + f * 0.02), 0, Math.PI * 2)
      ctx.fill()
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const led = telemetry.leds[mod]
    if (!led) return
    const r = e.currentTarget.getBoundingClientRect()
    const k = r.height / H
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const s = scale() * k
    let best = -1
    for (let i = 0; i < Math.round(params.current.planets); i++) {
      const px = cx + led[ORBITL.pos + i * 2] * s
      const py = cy + led[ORBITL.pos + i * 2 + 1] * s
      if (Math.hypot(e.clientX - px, e.clientY - py) < r.height * 0.07) best = i
    }
    if (best < 0) return
    e.stopPropagation()
    e.preventDefault()
    track(
      (ev) => actions.setParam(mod, `r${best + 1}`, Math.min(1, Math.max(0.15, Math.hypot(ev.clientX - cx, ev.clientY - cy) / s))),
      () => {},
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
    />
  )
}
