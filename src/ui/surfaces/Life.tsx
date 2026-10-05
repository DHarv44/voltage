import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { LIFE_H, LIFE_W, LIFEL } from '../../modules/specs/life'
import { PX } from '../geometry'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

/** The colony. Click a cell to bring it to life (or kill it). */
export function Life({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const col = led?.[LIFEL.col] ?? -1
    const cw = W / LIFE_W
    const ch = H / LIFE_H
    ctx.fillStyle = '#0a140d'
    ctx.fillRect(0, 0, W, H)
    if (col >= 0) {
      ctx.fillStyle = 'rgba(155,227,122,0.12)'
      ctx.fillRect(col * cw, 0, cw, H)
    }
    for (let r = 0; r < LIFE_H; r++)
      for (let c = 0; c < LIFE_W; c++) {
        const alive = (led?.[LIFEL.cells + r * LIFE_W + c] ?? 0) > 0.5
        ctx.fillStyle = alive ? (c === col ? '#e8ffd8' : '#9be37a') : 'rgba(155,227,122,0.07)'
        ctx.beginPath()
        ctx.roundRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4, 3)
        ctx.fill()
      }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const c = Math.floor(((e.clientX - r.left) / r.width) * LIFE_W)
    const row = Math.floor(((e.clientY - r.top) / r.height) * LIFE_H)
    sendSurface(mod, 'cell', c, row, true)
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
