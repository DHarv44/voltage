import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { ECOL } from '../../modules/specs/ecosystem'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const HISTORY = 300

/** Population chart (rabbits green, foxes orange) and the phase loop they trace. */
export function Ecosystem({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const hist = useRef<[number, number][]>([])
  const frames = useRef(-1)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    if (led && telemetry.frames !== frames.current) {
      frames.current = telemetry.frames
      hist.current.push([led[ECOL.prey], led[ECOL.pred]])
      if (hist.current.length > HISTORY) hist.current.shift()
    }
    const hs = hist.current
    ctx.fillStyle = '#0e1a10'
    ctx.fillRect(0, 0, W, H)
    const cw = W * 0.68
    for (const [k, color] of [
      [0, '#9be37a'],
      [1, '#ffa24a'],
    ] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      hs.forEach((v, i) => {
        const px = (i / HISTORY) * cw
        const py = H - v[k] * H * 0.9 - H * 0.05
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
    // Phase portrait: prey across, predators up.
    const px0 = cw + W * 0.03
    const pw = W - px0 - W * 0.02
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.strokeRect(px0, H * 0.1, pw, H * 0.8)
    ctx.strokeStyle = 'rgba(230,240,200,0.7)'
    ctx.beginPath()
    hs.forEach(([a, b], i) => {
      const qx = px0 + a * pw
      const qy = H * 0.9 - b * H * 0.8
      if (i === 0) ctx.moveTo(qx, qy)
      else ctx.lineTo(qx, qy)
    })
    ctx.stroke()
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
