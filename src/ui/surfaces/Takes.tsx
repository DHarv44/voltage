import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { TK_MAX_BARS, TK_STATE, TK_TAKES, TKL } from '../../modules/specs/takes'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { fitFont, RES, sendSurface, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const COLORS = ['#ffb35c', '#7fd0ff', '#c69bff', '#8ef0a0']
const HEAD = 0.2
const LABEL_W = 0.1

/** TAKES' screen: REC and what it's doing along the top; below, a row per
 *  take and a column per bar, each cell drawn by how loud that take is there.
 *  The lit cell in each column is the take that plays that bar: click a cell
 *  to choose it (click the lit one again for silence). Right-click a take's
 *  name to clear it. */
export function Takes({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const barsOf = (p: Record<string, number>) => Math.max(1, Math.min(TK_MAX_BARS, Math.round(p.bars ?? 4)))
  const head = H * HEAD
  const gx = W * LABEL_W
  const rh = (H - head) / TK_TAKES

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const bars = barsOf(p)
    const cw = (W - gx) / bars
    const led = telemetry.leds[mod]
    const state = led?.[TKL.state] ?? TK_STATE.idle
    const take = led?.[TKL.take] ?? -1
    const pos = led?.[TKL.pos] ?? -1
    const has = led?.[TKL.has] ?? 0
    ctx.fillStyle = '#0f1318'
    ctx.fillRect(0, 0, W, H)
    // REC and the status
    const blink = Math.floor(now / 350) % 2 === 0
    ctx.fillStyle = state === TK_STATE.recording ? '#e8402f' : state === TK_STATE.armed ? (blink ? '#8a2f2f' : '#3a1a1a') : '#2a2d33'
    ctx.beginPath()
    ctx.roundRect(4, 4, gx * 1.4, head - 8, head * 0.2)
    ctx.fill()
    ctx.fillStyle = '#f2ece4'
    ctx.textAlign = 'center'
    fitFont(ctx, '● REC', gx * 1.3, head * 0.45, FONT, '700')
    ctx.fillText('● REC', 4 + gx * 0.7, head * 0.64)
    const full = has === (1 << TK_TAKES) - 1
    const msg =
      state === TK_STATE.recording
        ? `RECORDING TAKE ${take + 1}`
        : state === TK_STATE.armed
          ? `TAKE ${take + 1} STARTS AT THE TOP`
          : full
            ? 'ALL FOUR TAKES FULL: RIGHT-CLICK ONE TO CLEAR IT'
            : 'CLICK A CELL TO CHOOSE WHICH TAKE PLAYS THAT BAR'
    ctx.textAlign = 'left'
    ctx.fillStyle = state === TK_STATE.idle ? '#7d8590' : '#f2ece4'
    fitFont(ctx, msg, W - gx * 1.6 - 12, head * 0.36, FONT, '600')
    ctx.fillText(msg, gx * 1.6 + 8, head * 0.62)
    // the grid
    for (let t = 0; t < TK_TAKES; t++) {
      const y0 = head + t * rh
      const on = (has & (1 << t)) !== 0
      ctx.fillStyle = on ? COLORS[t] : '#3a3f46'
      ctx.textAlign = 'center'
      fitFont(ctx, `${t + 1}`, gx - 6, rh * 0.5, FONT, '700')
      ctx.fillText(`${t + 1}`, gx / 2, y0 + rh * 0.65)
      for (let b = 0; b < bars; b++) {
        const chosen = Math.round(p[`c${b}`] ?? 0) === t
        const x0 = gx + b * cw
        ctx.fillStyle = chosen ? '#2a3038' : '#161a1f'
        ctx.fillRect(x0 + 1.5, y0 + 1.5, cw - 3, rh - 3)
        const pk = led?.[TKL.peak0 + t * TK_MAX_BARS + b] ?? 0
        if (pk > 0) {
          ctx.fillStyle = COLORS[t]
          ctx.globalAlpha = chosen ? 0.95 : 0.35
          const hh = Math.max(2, pk * (rh - 8))
          ctx.fillRect(x0 + cw * 0.15, y0 + rh / 2 - hh / 2, cw * 0.7, hh)
          ctx.globalAlpha = 1
        }
        if (chosen) {
          ctx.strokeStyle = on ? COLORS[t] : '#555b63'
          ctx.lineWidth = 1.5 * RES
          ctx.strokeRect(x0 + 2, y0 + 2, cw - 4, rh - 4)
        }
      }
    }
    if (state === TK_STATE.recording && take >= 0) {
      ctx.fillStyle = 'rgba(232,64,47,0.18)'
      ctx.fillRect(gx, head + take * rh, ((Math.max(0, pos) + 1) / (bars * 16)) * (W - gx), rh)
    }
    if (pos >= 0) {
      ctx.fillStyle = 'rgba(255,224,138,0.85)'
      ctx.fillRect(gx + (pos / (bars * 16)) * (W - gx), head, 2 * RES, H - head)
    }
  })

  const where = (e: { clientX: number; clientY: number }, r: DOMRect) => ({ fx: ((e.clientX - r.left) / r.width) * W, fy: ((e.clientY - r.top) / r.height) * H })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy < head) {
      if (fx < gx * 1.6) sendSurface(mod, 'rec', 0, 0, true)
      return
    }
    if (fx < gx) return
    const p = live()
    const bars = barsOf(p)
    const t = Math.min(TK_TAKES - 1, Math.floor((fy - head) / rh))
    const b = Math.min(bars - 1, Math.floor((fx - gx) / ((W - gx) / bars)))
    actions.setParam(mod, `c${b}`, Math.round(p[`c${b}`] ?? 0) === t ? -1 : t)
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy < head || fx > gx) return
    sendSurface(mod, 'clear', Math.min(TK_TAKES - 1, Math.floor((fy - head) / rh)), 0, true)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} />
}
