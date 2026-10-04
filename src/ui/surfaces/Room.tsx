import { useRef, type PointerEvent } from 'react'
import { ROOM } from '../../modules/specs/chamber'
import { actions } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

const PAD = 0.06

/** Echo chamber floor plan: drag the speaker or the mic pair. Dashed lines are
 *  the first-order wall reflections the mics hear. */
export function Room({ inst, x, y, w, h }: SurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params

  /** Room rectangle inside the canvas, keeping the floor plan's aspect. */
  const rect = (cw: number, ch: number) => {
    const aspect = ROOM.w / ROOM.d
    let rw = cw * (1 - 2 * PAD)
    let rh = rw / aspect
    if (rh > ch * (1 - 2 * PAD)) {
      rh = ch * (1 - 2 * PAD)
      rw = rh * aspect
    }
    return { x: (cw - rw) / 2, y: (ch - rh) / 2, w: rw, h: rh }
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = params.current
    ctx.fillStyle = '#1b1915'
    ctx.fillRect(0, 0, W, H)
    const r = rect(W, H)
    ctx.fillStyle = `rgb(${70 - p.damp * 30},${62 - p.damp * 20},${50})`
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeStyle = p.damp > 0.5 ? '#6b5a44' : '#d8d2c4'
    ctx.lineWidth = 3 + p.damp * 5
    ctx.strokeRect(r.x, r.y, r.w, r.h)

    const S = { x: r.x + p.sx * r.w, y: r.y + p.sy * r.h }
    const gap = ((0.2 + p.width * 2.8) / 2 / (ROOM.w * p.size)) * r.w
    const mics = [-1, 1].map((s) => ({ x: Math.min(r.x + r.w, Math.max(r.x, r.x + p.mx * r.w + s * gap)), y: r.y + p.my * r.h }))

    // First-order reflections: mirror the speaker in each wall, aim at each mic.
    ctx.setLineDash([4, 5])
    ctx.lineWidth = 1.2
    ctx.strokeStyle = 'rgba(255,214,140,0.35)'
    const images = [
      { x: 2 * r.x - S.x, y: S.y },
      { x: 2 * (r.x + r.w) - S.x, y: S.y },
      { x: S.x, y: 2 * r.y - S.y },
      { x: S.x, y: 2 * (r.y + r.h) - S.y },
    ]
    for (const m of mics)
      for (const im of images) {
        const wx = im.x === S.x ? null : im.x < r.x ? r.x : r.x + r.w
        const wy = im.y === S.y ? null : im.y < r.y ? r.y : r.y + r.h
        let hx: number
        let hy: number
        if (wx !== null) {
          const t = (wx - m.x) / (im.x - m.x)
          hx = wx
          hy = m.y + (im.y - m.y) * t
        } else {
          const t = (wy! - m.y) / (im.y - m.y)
          hx = m.x + (im.x - m.x) * t
          hy = wy!
        }
        ctx.beginPath()
        ctx.moveTo(S.x, S.y)
        ctx.lineTo(hx, hy)
        ctx.lineTo(m.x, m.y)
        ctx.stroke()
      }
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(255,214,140,0.8)'
    for (const m of mics) {
      ctx.beginPath()
      ctx.moveTo(S.x, S.y)
      ctx.lineTo(m.x, m.y)
      ctx.stroke()
    }

    // Speaker cabinet and mics.
    const u = Math.min(r.w, r.h) * 0.06
    ctx.fillStyle = '#2b2b2e'
    ctx.fillRect(S.x - u, S.y - u, u * 2, u * 2)
    ctx.fillStyle = '#9a9ea3'
    ctx.beginPath()
    ctx.arc(S.x, S.y, u * 0.7, 0, Math.PI * 2)
    ctx.fill()
    for (const m of mics) {
      ctx.fillStyle = '#d8dce0'
      ctx.beginPath()
      ctx.arc(m.x, m.y, u * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(240,230,210,0.6)'
    ctx.font = `${Math.round(H * 0.05)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText(`${(ROOM.w * p.size).toFixed(1)} × ${(ROOM.d * p.size).toFixed(1)} m`, r.x + 6, r.y + r.h - 6)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const c = e.currentTarget.getBoundingClientRect()
    const rr = rect(c.width, c.height)
    const at = (cx: number, cy: number) => ({
      fx: Math.min(1, Math.max(0, (cx - c.left - rr.x) / rr.w)),
      fy: Math.min(1, Math.max(0, (cy - c.top - rr.y) / rr.h)),
    })
    const p = params.current
    const first = at(e.clientX, e.clientY)
    // Grab whichever is closer: the speaker or the mic pair.
    const which = Math.hypot(first.fx - p.sx, first.fy - p.sy) <= Math.hypot(first.fx - p.mx, first.fy - p.my) ? 's' : 'm'
    const move = (cx: number, cy: number) => {
      const { fx, fy } = at(cx, cy)
      actions.setParams(
        [
          [inst.id, `${which}x`, fx],
          [inst.id, `${which}y`, fy],
        ],
        `${inst.id}:room`,
      )
    }
    move(e.clientX, e.clientY)
    track(
      (ev) => move(ev.clientX, ev.clientY),
      () => {},
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'move' }}
      onPointerDown={down}
    />
  )
}
