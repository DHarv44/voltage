import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { STYLO_KEYS, STYLOL } from '../../modules/specs/stylophone'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const KB = { x: 0.04, y: 0.42, w: 0.92, h: 0.5 }

/** Printed-circuit keyboard; drag the stylus along it. */
export function Stylophone({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const pen = useRef<{ x: number; y: number } | null>(null)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const lit = telemetry.leds[mod]?.[STYLOL.key] ?? -1
    ctx.fillStyle = '#151515'
    ctx.fillRect(0, 0, W, H)
    // speaker grille
    ctx.fillStyle = '#2a2a2a'
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 14; c++) {
        ctx.beginPath()
        ctx.arc(W * (0.3 + c * 0.03), H * (0.08 + r * 0.07), H * 0.012, 0, Math.PI * 2)
        ctx.fill()
      }
    const n = STYLO_KEYS.length
    const kw = (KB.w * W) / n
    ctx.textAlign = 'center'
    ctx.font = `${Math.round(H * 0.06)}px Bahnschrift, 'Arial Narrow', sans-serif`
    for (let i = 0; i < n; i++) {
      const semi = STYLO_KEYS[i]
      const sharp = NAMES[((semi % 12) + 12) % 12].includes('♯')
      const kx = KB.x * W + i * kw
      ctx.fillStyle = i === lit ? '#fff1b8' : sharp ? '#b9bcc0' : '#dfe2e5'
      ctx.fillRect(kx + 2, KB.y * H + (sharp ? 0 : H * 0.08), kw - 4, KB.h * H - (sharp ? H * 0.08 : 0))
      ctx.fillStyle = '#333'
      ctx.fillText(sharp ? '' : NAMES[((semi % 12) + 12) % 12], kx + kw / 2, KB.y * H + KB.h * H - H * 0.03)
    }
    const p = pen.current
    if (p) {
      ctx.strokeStyle = '#c9ccd0'
      ctx.lineWidth = H * 0.03
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.x * W, p.y * H)
      ctx.lineTo(p.x * W + W * 0.08, p.y * H - H * 0.3)
      ctx.stroke()
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const at = (cx: number, cy: number) => {
      const fx = (cx - r.left) / r.width
      const fy = (cy - r.top) / r.height
      pen.current = { x: fx, y: fy }
      const onKeys = fy >= KB.y && fy <= KB.y + KB.h && fx >= KB.x && fx <= KB.x + KB.w
      const key = Math.floor(((fx - KB.x) / KB.w) * STYLO_KEYS.length)
      sendSurface(mod, 'stylus', key, 0, onKeys)
    }
    at(e.clientX, e.clientY)
    track(
      (ev) => at(ev.clientX, ev.clientY),
      () => {
        pen.current = null
        sendSurface(mod, 'stylus', 0, 0, false)
      },
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'crosshair' }}
      onPointerDown={down}
    />
  )
}
