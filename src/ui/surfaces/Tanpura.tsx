import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { TANL, TANPURA_FIRST } from '../../modules/specs/tanpura'
import { PX } from '../geometry'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const XS = [0.26, 0.42, 0.58, 0.74]

/** Four strings on the tanpura's neck; the plucked one shimmers. Click a string to pluck it. */
export function Tanpura({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const first = useRef(0)
  first.current = Math.round(inst.params.first)
  const amp = useRef([0, 0, 0, 0])

  useFrame(ref, (now, dt) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const s = led?.[TANL.string] ?? -1
    const flash = led?.[TANL.flash] ?? 0
    const a = amp.current
    for (let i = 0; i < 4; i++) a[i] = i === s ? Math.max(a[i] * Math.exp(-dt / 2.5), flash) : a[i] * Math.exp(-dt / 2.5)
    const g = ctx.createLinearGradient(0, 0, W, 0)
    g.addColorStop(0, '#3b2414')
    g.addColorStop(0.5, '#6e4423')
    g.addColorStop(1, '#3b2414')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#e8dcc2'
    ctx.fillRect(W * 0.18, H * 0.86, W * 0.64, H * 0.05) // jawari bridge
    const names = [TANPURA_FIRST[first.current], 'SA', 'SA', 'LOW SA']
    ctx.textAlign = 'center'
    ctx.font = `${Math.round(H * 0.05)}px Bahnschrift, 'Arial Narrow', sans-serif`
    XS.forEach((fx, i) => {
      const sx = fx * W
      ctx.strokeStyle = i === 3 ? '#c9a46a' : '#e9e9e4'
      ctx.lineWidth = i === 3 ? 3 : 2
      ctx.beginPath()
      for (let k = 0; k <= 40; k++) {
        const t = k / 40
        const yy = H * 0.04 + t * H * 0.82
        const wob = Math.sin(Math.PI * t) * a[i] * W * 0.012 * Math.sin(now * 90 + i * 2)
        if (k === 0) ctx.moveTo(sx + wob, yy)
        else ctx.lineTo(sx + wob, yy)
      }
      ctx.stroke()
      ctx.fillStyle = 'rgba(240,225,200,0.7)'
      ctx.fillText(names[i], sx, H * 0.98)
    })
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    let best = 0
    XS.forEach((sx, i) => {
      if (Math.abs(sx - fx) < Math.abs(XS[best] - fx)) best = i
    })
    if (Math.abs(XS[best] - fx) > 0.07) return
    e.stopPropagation()
    sendSurface(mod, 'pluck', best, 0, true)
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
