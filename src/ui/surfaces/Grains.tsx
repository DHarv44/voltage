import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { GRL, MAX_GRAINS, WAVE_BINS } from '../../modules/specs/ambient'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"

/** GRAINS' screen: the last four seconds as a waveform, now on the right,
 *  oldest on the left; every grain a glowing dot where it is playing (its
 *  size its level); FROZEN when the memory is held. */
export function Grains({ inst, x, y, w, h }: SurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[inst.id]
    const params = patchStore.get().modules.find((m) => m.id === inst.id)?.params ?? inst.params
    const frozen = (params.freeze ?? 0) >= 0.5
    ctx.fillStyle = '#081014'
    ctx.fillRect(0, 0, W, H)
    const head = led?.[GRL.head] ?? 0
    // age 0 (now) at the right edge … 1 (four seconds ago) at the left
    const xOf = (pos: number) => {
      let age = head - pos
      if (age < 0) age += 1
      return W * (0.98 - 0.96 * age)
    }
    const mid = H * 0.55
    ctx.fillStyle = frozen ? 'rgba(160,200,255,0.55)' : 'rgba(79,198,214,0.45)'
    const bw = (W * 0.96) / WAVE_BINS
    for (let b = 0; b < WAVE_BINS; b++) {
      const v = Math.min(1, led?.[GRL.wave + b] ?? 0)
      const bx = xOf((b + 0.5) / WAVE_BINS)
      const bh = Math.max(1, v * H * 0.38)
      ctx.fillRect(bx - bw * 0.4, mid - bh, bw * 0.8, bh * 2)
    }
    // where POSITION points (with SPRAY's spread around it)
    const pos = params.pos ?? 0.25
    const spray = params.spray ?? 0
    ctx.fillStyle = 'rgba(255,210,122,0.12)'
    const px0 = W * (0.98 - 0.96 * Math.min(1, pos + spray / 2))
    const px1 = W * (0.98 - 0.96 * Math.max(0, pos - spray / 2))
    ctx.fillRect(px0, H * 0.12, Math.max(2, px1 - px0), H * 0.86)
    // the grains
    for (let g = 0; g < MAX_GRAINS; g++) {
      const gp = led?.[GRL.pos + g] ?? -1
      if (gp < 0) continue
      const a = led?.[GRL.amp + g] ?? 0
      const gy = mid + Math.sin(g * 2.39996) * H * 0.3 // scattered up and down so they don't stack
      ctx.globalAlpha = 0.25 + 0.75 * a
      ctx.fillStyle = '#ffd27a'
      ctx.beginPath()
      ctx.arc(xOf(gp), gy, H * (0.025 + 0.05 * a), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.font = `600 ${Math.round(H * 0.12)}px ${FONT}`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(232,230,223,0.55)'
    ctx.fillText('4 s AGO', W * 0.02, H * 0.03)
    ctx.textAlign = 'right'
    ctx.fillStyle = frozen ? '#a0c8ff' : 'rgba(232,230,223,0.55)'
    ctx.fillText(frozen ? 'FROZEN' : 'NOW', W * 0.98, H * 0.03)
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
