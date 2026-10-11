import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { AU_LANES, AU_MAX_BARS, AU_NAMES, AU_POINTS, AU_RES, AUL, auT, auV } from '../../modules/specs/automation'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const COLORS = ['#ff8fd1', '#8fd8ff', '#ffd27a', '#a6ff9a']
const LABEL_W = 0.05
/** New points and drags land on the beat (4 sixteenths) unless Shift is held. */
const SNAP = 4

interface Pt {
  i: number
  t: number
  v: number
}

/** AUTOMATION's screen: the song left to right (bar numbers along the top),
 *  four lanes, each a line through its points; the playhead. Click a lane to
 *  add a point there (on the beat; Shift for any 16th), drag a point to move
 *  it, right-click a point to delete it. */
export function Automation({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const gx = W * LABEL_W
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const steps = (p: Record<string, number>) => Math.max(1, Math.min(AU_MAX_BARS, Math.round(p.bars ?? 32))) * 16
  const top = H * 0.08
  const lh = (H - top) / AU_LANES
  const points = (p: Record<string, number>, l: number): Pt[] => {
    const out: Pt[] = []
    for (let i = 0; i < AU_POINTS; i++) {
      const t = Math.round(p[auT(l, i)] ?? -1)
      if (t >= 0) out.push({ i, t, v: (p[auV(l, i)] ?? 0) / AU_RES })
    }
    return out.sort((a, b) => a.t - b.t)
  }
  const px = (t: number, n: number) => gx + (t / n) * (W - gx)
  const py = (l: number, v: number) => top + l * lh + lh * 0.9 - v * lh * 0.8

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const n = steps(p)
    const bars = n / 16
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#140d14'
    ctx.fillRect(0, 0, W, H)
    // bars: a line each, numbered every 4 (or every 8, 16 when crowded)
    const every = bars <= 32 ? 4 : bars <= 64 ? 8 : 16
    ctx.font = `${Math.round(top * 0.75)}px ${FONT}`
    ctx.textAlign = 'left'
    for (let b = 0; b <= bars; b++) {
      const bx = px(b * 16, n)
      ctx.fillStyle = b % every === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)'
      ctx.fillRect(bx, top, 1, H - top)
      if (b % every === 0 && b < bars) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.fillText(`${b + 1}`, bx + 3, top * 0.85)
      }
    }
    for (let l = 0; l < AU_LANES; l++) {
      const y0 = top + l * lh
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(gx, y0 + lh - 1, W - gx, 1)
      ctx.fillStyle = COLORS[l]
      ctx.font = `700 ${Math.round(lh * 0.32)}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(AU_NAMES[l], gx / 2, y0 + lh * 0.6)
      const pts = points(p, l)
      if (!pts.length) continue
      ctx.strokeStyle = COLORS[l]
      ctx.lineWidth = Math.max(1.5, lh * 0.035)
      ctx.beginPath()
      ctx.moveTo(gx, py(l, pts[0].v))
      for (const q of pts) ctx.lineTo(px(q.t, n), py(l, q.v))
      ctx.lineTo(W, py(l, pts[pts.length - 1].v))
      ctx.stroke()
      ctx.fillStyle = COLORS[l]
      for (const q of pts) {
        ctx.beginPath()
        ctx.arc(px(q.t, n), py(l, q.v), Math.max(3, lh * 0.06), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const pos = led?.[AUL.pos] ?? -1
    if (pos >= 0) {
      ctx.fillStyle = 'rgba(255,224,138,0.85)'
      ctx.fillRect(px(pos, n), top, 2 * RES, H - top)
    }
  })

  /** Where the pointer is: lane, time (16ths, snapped unless Shift), value. */
  const where = (e: { clientX: number; clientY: number; shiftKey: boolean }, r: DOMRect, n: number) => {
    const fx = ((e.clientX - r.left) / r.width) * W
    const fy = ((e.clientY - r.top) / r.height) * H
    const l = Math.max(0, Math.min(AU_LANES - 1, Math.floor((fy - top) / lh)))
    const raw = ((fx - gx) / (W - gx)) * n
    const snap = e.shiftKey ? 1 : SNAP
    const t = Math.max(0, Math.min(n - 1, Math.round(raw / snap) * snap))
    const v = Math.max(0, Math.min(1, (top + l * lh + lh * 0.9 - fy) / (lh * 0.8)))
    return { fx, fy, l, t, v }
  }
  /** The point under the pointer in lane l, if any (within a few pixels). */
  const near = (p: Record<string, number>, l: number, fx: number, fy: number, n: number) =>
    points(p, l).find((q) => Math.hypot(px(q.t, n) - fx, py(l, q.v) - fy) < 8 * RES)

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const p = live()
    const n = steps(p)
    const a = where(e, r, n)
    if (a.fx < gx || a.fy < top) return
    let hit = near(p, a.l, a.fx, a.fy, n)
    if (!hit) {
      // a new point in the lane's first free slot (a point already at this time moves instead)
      const same = points(p, a.l).find((q) => q.t === a.t)
      let i = same?.i ?? -1
      for (let k = 0; k < AU_POINTS && i < 0; k++) if (Math.round(p[auT(a.l, k)] ?? -1) < 0) i = k
      if (i < 0) return
      actions.setParams([[mod, auT(a.l, i), a.t], [mod, auV(a.l, i), Math.round(a.v * AU_RES)]], `automation-${mod}-${a.l}-${i}`)
      hit = { i, t: a.t, v: a.v }
    }
    const i = hit.i
    const l = a.l
    track(
      (ev) => {
        const b = where(ev, r, n)
        const v = Math.max(0, Math.min(1, (top + l * lh + lh * 0.9 - b.fy) / (lh * 0.8)))
        actions.setParams([[mod, auT(l, i), b.t], [mod, auV(l, i), Math.round(v * AU_RES)]], `automation-${mod}-${l}-${i}`)
      },
      () => {},
    )
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const p = live()
    const n = steps(p)
    const a = where(e, r, n)
    const hit = near(p, a.l, a.fx, a.fy, n)
    if (hit) actions.setParam(mod, auT(a.l, hit.i), -1)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} />
}
