import { useRef, type PointerEvent } from 'react'
import { actions } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

/** Wah treadle: drag up (toe down, bright) and down (heel down, dark). */
export function Treadle({ inst, x, y, w, h }: SurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const pos = useRef(inst.params.pos)
  pos.current = inst.params.pos

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const t = pos.current
    ctx.fillStyle = '#121213'
    ctx.fillRect(0, 0, W, H)
    // Rubber treadle seen from above, foreshortened by its rock angle.
    const tilt = 0.55 + t * 0.45
    const th = H * 0.86 * tilt
    const top = (H - th) / 2
    const g = ctx.createLinearGradient(0, top, 0, top + th)
    g.addColorStop(0, `rgb(${50 + t * 30},${50 + t * 30},${54 + t * 30})`)
    g.addColorStop(1, '#2a2a2c')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(W * 0.08, top, W * 0.84, th, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 2
    for (let i = 1; i < 9; i++) {
      const ly = top + (th * i) / 9
      ctx.beginPath()
      ctx.moveTo(W * 0.14, ly)
      ctx.lineTo(W * 0.86, ly)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = `${Math.round(H * 0.13)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(t * 100)}%`, W * 0.97, H * 0.95)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const start = { y: e.clientY, v: pos.current }
    const r = e.currentTarget.getBoundingClientRect()
    track(
      (ev) => {
        const v = Math.min(1, Math.max(0, start.v + (start.y - ev.clientY) / (r.height * 1.5)))
        actions.setParam(inst.id, 'pos', v)
      },
      () => {},
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'ns-resize' }}
      onPointerDown={down}
    />
  )
}
