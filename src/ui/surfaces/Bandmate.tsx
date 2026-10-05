import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { BAND_ROWS, BANDL } from '../../modules/specs/bandmate'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

/** The bar the drummer is playing (brighter = harder), the playhead, and FILL. */
export function Bandmate({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const step = led?.[BANDL.step] ?? -1
    const fill = (led?.[BANDL.fill] ?? 0) > 0.5
    ctx.fillStyle = '#16120f'
    ctx.fillRect(0, 0, W, H)
    const lw = W * 0.1
    const cw = (W - lw) / 16
    const rh = H / BAND_ROWS.length
    ctx.font = `${Math.round(rh * 0.5)}px Bahnschrift, 'Arial Narrow', sans-serif`
    BAND_ROWS.forEach((name, r) => {
      ctx.fillStyle = 'rgba(241,236,226,0.55)'
      ctx.fillText(name, 4, r * rh + rh * 0.68)
      for (let s = 0; s < 16; s++) {
        const v = led?.[BANDL.grid + r * 16 + s] ?? 0
        ctx.fillStyle = v > 0 ? `rgba(255,${120 + v * 80},${40 + v * 40},${0.25 + v * 0.75})` : s % 4 === 0 ? '#2a2420' : '#211c18'
        ctx.fillRect(lw + s * cw + 1, r * rh + 2, cw - 2, rh - 4)
      }
    })
    if (step >= 0) {
      ctx.strokeStyle = fill ? '#ff6a1a' : 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 2
      ctx.strokeRect(lw + step * cw, 1, cw, H - 2)
    }
    if (fill) {
      ctx.fillStyle = '#ff6a1a'
      ctx.textAlign = 'right'
      ctx.font = `600 ${Math.round(rh * 0.6)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText('FILL', W - 6, rh * 0.7)
      ctx.textAlign = 'left'
    }
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
