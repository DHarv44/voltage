import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { MB_NOTES, MB_STEPS, MBL } from '../../modules/specs/musicbox'
import { actions } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
/** Strip area as a fraction of the surface width (the crank lives to the right). */
const STRIP = 0.84
const LABEL = 0.06
const ROWS = MB_NOTES.length

/** Paper strip (click a cell to punch/fill a hole) and the crank (drag round it). */
export function MusicBox({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const pos = led?.[MBL.pos] ?? 0
    const tine = led?.[MBL.tine] ?? -1
    const flash = led?.[MBL.flash] ?? 0
    ctx.fillStyle = '#2a2420'
    ctx.fillRect(0, 0, W, H)

    // The comb: one labelled tine per row, the plucked one glowing.
    const sx = W * LABEL
    const sw = W * STRIP - sx
    const rh = H / ROWS
    ctx.font = `${Math.round(rh * 0.55)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.textAlign = 'right'
    for (let r = 0; r < ROWS; r++) {
      const ry = H - (r + 1) * rh
      const lit = r === tine ? flash : 0
      ctx.fillStyle = lit > 0.05 ? `rgba(255,214,120,${0.4 + lit * 0.6})` : 'rgba(220,210,190,0.55)'
      ctx.fillText(`${NAMES[r % 7]}${4 + Math.floor(r / 7)}`, sx - 4, ry + rh * 0.72)
    }

    // Paper strip scrolling left under the comb (the comb sits at the left edge).
    ctx.fillStyle = '#efe6cf'
    ctx.fillRect(sx, 0, sw, H)
    const cw = sw / MB_STEPS
    ctx.strokeStyle = 'rgba(120,100,70,0.18)'
    ctx.lineWidth = 1
    for (let s = 0; s <= MB_STEPS; s++) {
      const gx = sx + ((((s - pos) % MB_STEPS) + MB_STEPS) % MB_STEPS) * cw
      ctx.strokeStyle = s % 4 === 0 ? 'rgba(120,100,70,0.35)' : 'rgba(120,100,70,0.14)'
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, H)
      ctx.stroke()
    }
    for (let r = 0; r < ROWS; r++) {
      const mask = params.current[`r${r}`] ?? 0
      const ry = H - (r + 0.5) * rh
      for (let s = 0; s < MB_STEPS; s++) {
        if (Math.floor(mask / 2 ** s) % 2 !== 1) continue
        const gx = sx + ((((s - pos) % MB_STEPS) + MB_STEPS) % MB_STEPS) * cw
        ctx.fillStyle = '#1d1712'
        ctx.beginPath()
        ctx.arc(gx, ry, Math.min(cw, rh) * 0.32, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = 'rgba(180,180,190,0.9)'
    ctx.fillRect(sx - 2, 0, 3, H)

    // Crank.
    const cx = W * (STRIP + (1 - STRIP) / 2)
    const cy = H * 0.5
    const R = Math.min(W * (1 - STRIP) * 0.38, H * 0.3)
    const a = (led?.[MBL.crank] ?? 0) * Math.PI * 2
    ctx.strokeStyle = '#8c8f93'
    ctx.lineWidth = R * 0.18
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#c9ccd0'
    ctx.lineWidth = R * 0.22
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.stroke()
    ctx.fillStyle = '#7a4a2a'
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(230,220,200,0.6)'
    ctx.textAlign = 'center'
    ctx.font = `${Math.round(H * 0.045)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText(params.current.motor >= 0.5 ? 'MOTOR' : 'CRANK ↻', cx, cy + R * 1.7)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    if (fx >= STRIP) {
      // Crank: clockwise drags turn it (send the increments).
      const cx = r.left + r.width * (STRIP + (1 - STRIP) / 2)
      const cy = r.top + r.height * 0.5
      let last = Math.atan2(e.clientY - cy, e.clientX - cx) / (Math.PI * 2)
      track(
        (ev) => {
          const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) / (Math.PI * 2)
          let d = a - last
          d -= Math.round(d)
          last = a
          if (d > 0) sendSurface(mod, 'crank', d, 0, true)
        },
        () => {},
      )
      return
    }
    if (fx < LABEL) return
    // Strip: punch or fill the hole under the pointer (accounting for scroll).
    const pos = telemetry.leds[mod]?.[MBL.pos] ?? 0
    const col = Math.floor(((fx - LABEL) / (STRIP - LABEL)) * MB_STEPS + pos) % MB_STEPS
    const row = Math.min(ROWS - 1, Math.max(0, ROWS - 1 - Math.floor(fy * ROWS)))
    const mask = params.current[`r${row}`] ?? 0
    const bit = 2 ** col
    const on = Math.floor(mask / bit) % 2 === 1
    actions.setParam(mod, `r${row}`, on ? mask - bit : mask + bit)
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
    />
  )
}
