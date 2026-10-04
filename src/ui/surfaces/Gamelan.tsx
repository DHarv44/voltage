import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { GAML, gamelanKeys } from '../../modules/specs/gamelan'
import { PX } from '../geometry'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

/** Key rectangles (canvas px) for the current instrument: bars, kettles or the gong. */
function layout(inst: number, n: number, W: number, H: number) {
  if (inst === 2) return [{ x: W * 0.5, y: H * 0.5, r: H * 0.42 }]
  const kettles = inst === 1
  const perRow = kettles ? Math.ceil(n / 2) : n
  return Array.from({ length: n }, (_, k) => {
    const row = kettles ? (k < perRow ? 1 : 0) : 0
    const col = kettles ? k % perRow : k
    const cw = W / perRow
    return { x: cw * (col + 0.5), y: kettles ? H * (row === 1 ? 0.72 : 0.3) : H * 0.5, r: Math.min(cw * 0.42, H * (kettles ? 0.18 : 0.42)) }
  })
}

/** Gamelan face: saron bars, two rows of bonang kettles, or the gong. Click to strike. */
export function Gamelan({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const i = Math.round(params.current.inst)
    const n = gamelanKeys(i, Math.round(params.current.tuning)).length
    const led = telemetry.leds[mod]
    const lit = led?.[GAML.key] ?? -1
    const flash = led?.[GAML.flash] ?? 0
    ctx.fillStyle = '#2a110d'
    ctx.fillRect(0, 0, W, H)
    layout(i, n, W, H).forEach((k, idx) => {
      const on = idx === lit ? flash : 0
      const g = ctx.createRadialGradient(k.x - k.r * 0.3, k.y - k.r * 0.3, k.r * 0.1, k.x, k.y, k.r)
      g.addColorStop(0, `rgb(${236},${200 + on * 40},${110 + on * 60})`)
      g.addColorStop(1, '#8a5e1e')
      ctx.fillStyle = g
      ctx.beginPath()
      if (i === 0) ctx.roundRect(k.x - k.r * 0.45, H * 0.12 + (idx / n) * H * 0.12, k.r * 0.9, H * 0.76 - (idx / n) * H * 0.24, 4)
      else ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2)
      ctx.fill()
      if (i !== 0) {
        ctx.fillStyle = 'rgba(80,50,15,0.6)'
        ctx.beginPath()
        ctx.arc(k.x, k.y, k.r * 0.32, 0, Math.PI * 2) // the boss
        ctx.fill()
      }
    })
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const py = ((e.clientY - r.top) / r.height) * H
    const i = Math.round(params.current.inst)
    const keys = layout(i, gamelanKeys(i, Math.round(params.current.tuning)).length, W, H)
    const k = keys.findIndex((c) => (i === 0 ? Math.abs(px - c.x) < c.r * 0.5 : Math.hypot(px - c.x, py - c.y) < c.r))
    if (k < 0) return
    e.stopPropagation()
    sendSurface(mod, 'hit', k, 0, true)
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
