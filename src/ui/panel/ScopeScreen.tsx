import { useEffect, useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { PX } from '../geometry'

interface Props {
  mod: string
  x: number
  y: number
  w: number
  h: number
  vdiv1: number
  vdiv2: number
  time: number
}

const RES = 2
const DIVS_X = 10
const DIVS_Y = 8

/** CRT-style dual-trace display fed by the engine's scope frames. */
export function ScopeScreen({ mod, x, y, w, h, vdiv1, vdiv2, time }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const view = useRef({ vdiv1, vdiv2, time })
  view.current = { vdiv1, vdiv2, time }
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useEffect(() => {
    const draw = () => {
      const ctx = ref.current?.getContext('2d')
      if (ctx) paint(ctx, W, H, telemetry.scopes[mod], view.current)
    }
    draw()
    return telemetry.subscribe(draw)
  }, [mod, W, H])

  return (
    <canvas
      ref={ref}
      className="scope-screen"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
    />
  )
}

function paint(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  frame: Float32Array | undefined,
  v: { vdiv1: number; vdiv2: number; time: number },
) {
  ctx.fillStyle = '#07140d'
  ctx.fillRect(0, 0, W, H)
  ctx.lineWidth = 1
  for (let i = 1; i < DIVS_X; i++) {
    ctx.strokeStyle = i === DIVS_X / 2 ? 'rgba(120,255,170,0.28)' : 'rgba(120,255,170,0.11)'
    line(ctx, (i / DIVS_X) * W, 0, (i / DIVS_X) * W, H)
  }
  for (let i = 1; i < DIVS_Y; i++) {
    ctx.strokeStyle = i === DIVS_Y / 2 ? 'rgba(120,255,170,0.28)' : 'rgba(120,255,170,0.11)'
    line(ctx, 0, (i / DIVS_Y) * H, W, (i / DIVS_Y) * H)
  }
  if (frame) {
    const n = frame.length / 2
    trace(ctx, frame, 0, n, W, H, v.vdiv1, '#ffd84a')
    trace(ctx, frame, n, n, W, H, v.vdiv2, '#56d8ff')
  }
  ctx.font = `${10 * RES}px Bahnschrift, 'Arial Narrow', sans-serif`
  ctx.fillStyle = 'rgba(160,255,190,0.55)'
  const ms = (v.time / DIVS_X) * 1000
  ctx.fillText(`${ms < 1 ? ms.toFixed(2) : ms.toFixed(ms < 10 ? 1 : 0)} ms/div`, 6 * RES, H - 6 * RES)
  ctx.fillStyle = '#ffd84a'
  ctx.fillText(`1: ${v.vdiv1.toFixed(2)} V`, 6 * RES, 14 * RES)
  ctx.fillStyle = '#56d8ff'
  ctx.fillText(`2: ${v.vdiv2.toFixed(2)} V`, 80 * RES, 14 * RES)
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function trace(
  ctx: CanvasRenderingContext2D,
  f: Float32Array,
  off: number,
  n: number,
  W: number,
  H: number,
  vdiv: number,
  color: string,
) {
  const scale = H / DIVS_Y / vdiv
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6 * RES
  ctx.shadowColor = color
  ctx.shadowBlur = 6 * RES
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const px = (i / (n - 1)) * W
    const py = Math.min(H + 4, Math.max(-4, H / 2 - f[off + i] * scale))
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.restore()
}
