import { useRef, type PointerEvent } from 'react'
import { actions, patchStore } from '../../patch/store'
import { telemetry } from '../../audio/telemetry'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const MAX_DIST = 20

/** SPACE's screen: your head from above (nose up), the sound as a dot
 *  (bigger when higher). Drag the dot to move it around and nearer or
 *  further; the rings are 1, 3 and 10 m. Where CVs move it, it follows. */
export function Space({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const cx = W / 2
  const cy = H / 2
  const R = Math.min(W, H) * 0.46
  /** Distance (m) ↔ radius: logarithmic, so near and far both have room. */
  const rad = (d: number) => (Math.log(d / 0.3) / Math.log(MAX_DIST / 0.3)) * R
  const dist = (r: number) => 0.3 * Math.pow(MAX_DIST / 0.3, Math.max(0, Math.min(1, r / R)))

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const az = led ? led[0] * 180 : p.az
    const el = led ? led[1] * 90 : p.el
    const d = led ? led[2] * MAX_DIST : p.dist
    ctx.fillStyle = '#101214'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = RES
    for (const m of [1, 3, 10]) {
      ctx.beginPath()
      ctx.arc(cx, cy, rad(m), 0, Math.PI * 2)
      ctx.stroke()
    }
    // the head: a circle, a nose, two ears
    ctx.fillStyle = '#3a3f47'
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx - R * 0.025, cy - R * 0.065)
    ctx.lineTo(cx, cy - R * 0.1)
    ctx.lineTo(cx + R * 0.025, cy - R * 0.065)
    ctx.fill()
    ctx.fillRect(cx - R * 0.085, cy - R * 0.02, R * 0.02, R * 0.04)
    ctx.fillRect(cx + R * 0.065, cy - R * 0.02, R * 0.02, R * 0.04)
    const a = (az * Math.PI) / 180
    const r = rad(d)
    const sx = cx + Math.sin(a) * r
    const sy = cy - Math.cos(a) * r
    ctx.strokeStyle = 'rgba(255,224,138,0.35)'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(sx, sy)
    ctx.stroke()
    ctx.fillStyle = '#ffe08a'
    ctx.beginPath()
    ctx.arc(sx, sy, (4 + Math.max(-40, el) / 15) * RES, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `${Math.round(H * 0.06)}px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(`${d.toFixed(1)} m · ${Math.round(el)}° up`, 4 * RES, H - 5 * RES)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const set = (px: number, py: number) => {
      const dx = ((px - rect.left) / rect.width) * W - cx
      const dy = ((py - rect.top) / rect.height) * H - cy
      actions.setParams(
        [
          [mod, 'az', (Math.atan2(dx, -dy) * 180) / Math.PI],
          [mod, 'dist', dist(Math.hypot(dx, dy))],
        ],
        `space:${mod}`,
      )
    }
    set(e.clientX, e.clientY)
    track(
      (ev) => set(ev.clientX, ev.clientY),
      () => {},
    )
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} />
}
