import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { STRIKE_INSTRUMENTS, STRIKEL, type StrikeNote } from '../../modules/specs/strike'
import { PX } from '../geometry'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const label = (semi: number) => `${NAMES[((semi % 12) + 12) % 12]}${Math.floor(semi / 12) + 4}`

/** Note shape in canvas pixels (tines are tall bars, pan fields ellipses). */
function shape(n: StrikeNote, kalimba: boolean, W: number, H: number) {
  if (kalimba) {
    const len = 0.32 + (28 - n.semi) / 28 * 0.42
    return { cx: n.x * W, cy: H * 0.08 + (len * H) / 2, rx: W * 0.018, ry: (len * H) / 2 }
  }
  return { cx: n.x * W, cy: n.y * H, rx: n.r * H * 1.15, ry: n.r * H * 0.85 }
}

/** Instrument face: click a note to strike it. */
export function Strike({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const which = useRef(0)
  which.current = Math.round(inst.params.inst)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const i = which.current
    const ins = STRIKE_INSTRUMENTS[i]
    const kal = i === 2
    const led = telemetry.leds[mod]
    const lit = led?.[STRIKEL.note] ?? -1
    const flash = led?.[STRIKEL.flash] ?? 0
    ctx.fillStyle = '#121214'
    ctx.fillRect(0, 0, W, H)
    if (kal) {
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#8a5a32')
      g.addColorStop(1, '#5a3a1e')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(W * 0.03, H * 0.04, W * 0.94, H * 0.92, 14)
      ctx.fill()
      ctx.fillStyle = '#2a1a0e'
      ctx.beginPath()
      ctx.arc(W * 0.5, H * 0.82, H * 0.08, 0, Math.PI * 2)
      ctx.fill()
    } else {
      const g = ctx.createRadialGradient(W * 0.45, H * 0.4, H * 0.05, W * 0.5, H * 0.5, H * 0.5)
      g.addColorStop(0, i === 0 ? '#5a6068' : '#e6e8ea')
      g.addColorStop(1, i === 0 ? '#22262b' : '#8a8f95')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(W * 0.5, H * 0.5, H * 0.48 * 0.62 * (W / H), H * 0.48, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.textAlign = 'center'
    ins.notes.forEach((n, k) => {
      const s = shape(n, kal, W, H)
      const on = k === lit ? flash : 0
      ctx.fillStyle = kal ? `rgb(${200 + on * 55},${200 + on * 40},${205})` : i === 0 ? `rgba(20,24,28,${0.55 - on * 0.3})` : `rgba(120,126,134,${0.6})`
      ctx.beginPath()
      if (kal) ctx.roundRect(s.cx - s.rx, s.cy - s.ry, s.rx * 2, s.ry * 2, s.rx)
      else ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2)
      ctx.fill()
      if (on > 0.02) {
        ctx.strokeStyle = `rgba(255,214,120,${on})`
        ctx.lineWidth = 3
        ctx.stroke()
      }
      ctx.fillStyle = kal ? 'rgba(40,30,20,0.8)' : i === 0 ? 'rgba(220,226,232,0.65)' : 'rgba(30,32,36,0.75)'
      ctx.font = `${Math.round(H * (kal ? 0.032 : 0.04))}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(label(n.semi), s.cx, kal ? s.cy + s.ry + H * 0.04 : s.cy + H * 0.014)
    })
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const py = ((e.clientY - r.top) / r.height) * H
    const i = which.current
    let best = -1
    let vel = 0
    STRIKE_INSTRUMENTS[i].notes.forEach((n, k) => {
      const s = shape(n, i === 2, W, H)
      const d = Math.hypot((px - s.cx) / s.rx, (py - s.cy) / s.ry)
      if (d <= 1.15 && (best < 0 || 1 - d / 1.15 > vel)) {
        best = k
        vel = 1 - d / 1.15
      }
    })
    if (best < 0) return // missed every note: let the panel drag
    e.stopPropagation()
    e.preventDefault()
    sendSurface(mod, 'hit', best, 0.45 + vel * 0.55, true)
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
