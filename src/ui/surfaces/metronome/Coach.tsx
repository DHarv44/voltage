import { useRef } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { COACH_POLY_N, COL } from '../../../modules/specs/metronomes'
import { patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { RES, useFrame, type SurfaceProps } from '../common'
import { drawBeats, drawTempo, FONT } from './draw'

const INK = '#1d2621'
const ON = '#2d6cdf'
const POLY = '#d9772b'

/** COACH's screen: the tempo now, where the ramp is headed and how far it's
 *  come, the beat lights (rings in a silent bar: keep time yourself), the
 *  bar count and the polyrhythm. */
export function Coach({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const led = telemetry.leds[mod]
    const running = (led?.[COL.beat] ?? -1) >= 0
    const gap = (led?.[COL.gap] ?? 0) >= 0.5
    ctx.fillStyle = '#e4ece6'
    ctx.fillRect(0, 0, W, H)

    drawTempo(ctx, led?.[COL.bpm] ?? p.start, W * 0.33, H * 0.25, H * 0.34, INK)
    // the ramp: from START to TARGET
    const ramping = Math.round(p.step) > 0 && Math.round(p.target) !== Math.round(p.start)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK
    ctx.font = `600 ${Math.round(H * 0.1)}px ${FONT}`
    ctx.fillText(ramping ? `${Math.round(p.start)} → ${Math.round(p.target)}` : 'STEADY', W * 0.95, H * 0.15)
    ctx.font = `500 ${Math.round(H * 0.075)}px ${FONT}`
    ctx.globalAlpha = 0.6
    ctx.fillText(ramping ? `+${Math.round(p.step)} every ${Math.round(p.every)} bar${Math.round(p.every) > 1 ? 's' : ''}` : 'no ramp', W * 0.95, H * 0.27)
    ctx.globalAlpha = 1
    const bx = W * 0.62
    const bw = W * 0.33
    ctx.fillStyle = 'rgba(29,38,33,0.12)'
    ctx.fillRect(bx, H * 0.35, bw, H * 0.04)
    ctx.fillStyle = ON
    ctx.fillRect(bx, H * 0.35, bw * (ramping ? (led?.[COL.ramp] ?? 0) : 1), H * 0.04)

    const beats = Math.max(1, Math.round(p.beats))
    drawBeats(ctx, { x: W * 0.05, y: H * 0.47, w: W * 0.9, h: H * 0.2 }, beats, led?.[COL.beat] ?? -1, {
      on: gap ? INK : ON,
      off: 'rgba(29,38,33,0.15)',
      hollow: gap,
      flash: led?.[COL.flash],
    })
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(H * 0.09)}px ${FONT}`
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    const gapBars = Math.round(p.gap)
    ctx.fillText(gap ? 'GAP · KEEP TIME' : running ? `BAR ${Math.round(led?.[COL.bar] ?? 0) + 1}` : 'STOPPED', W * 0.05, H * 0.83)
    ctx.textAlign = 'right'
    const pn = COACH_POLY_N[Math.round(p.poly)] ?? 0
    const right = pn > 0 ? `${pn} OVER ${beats}` : gapBars > 0 ? `${Math.round(p.play)} ON · ${gapBars} OFF` : ''
    ctx.fillText(right, W * 0.95 - (pn > 0 ? H * 0.12 : 0), H * 0.83)
    if (pn > 0) {
      ctx.fillStyle = POLY
      ctx.globalAlpha = 0.25 + 0.75 * (led?.[COL.poly] ?? 0)
      ctx.beginPath()
      ctx.arc(W * 0.95 - H * 0.04, H * 0.83, H * 0.04, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} />
}
