import { useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { CD_MAX_BARS, CD_SEGMENTS, CDL } from '../../modules/specs/conductor'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const STRIP_H = 0.26

interface Field {
  label: string
  id: 'b' | 'f' | 'e' | 'm'
  min: number
  max: number
  step: number
  show: (v: number) => string
}
const FIELDS: Field[] = [
  { label: 'BARS', id: 'b', min: 1, max: CD_MAX_BARS, step: 1, show: (v) => `${v}` },
  { label: 'FROM', id: 'f', min: 30, max: 240, step: 1, show: (v) => `${v}` },
  { label: 'TO', id: 'e', min: 0, max: 240, step: 1, show: (v) => (v > 0 ? `${v}` : 'STEADY') },
  { label: 'METER', id: 'm', min: 2, max: 7, step: 1, show: (v) => `${v}/4` },
]

/** CONDUCTOR's screen: the tempo map as a line across the bars (a ramp
 *  slopes), each segment's meter over it, the playhead and the tempo now;
 *  below, the selected segment's settings. Click a segment to select it;
 *  click a setting's left or right half (or scroll on it) to step it. */
export function Conductor({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const [sel, setSel] = useState(0)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const plotH = H * (1 - STRIP_H)

  const segs = (p: Record<string, number>) => {
    const len = Math.max(1, Math.min(CD_SEGMENTS, Math.round(p.len ?? 1)))
    const out: { b: number; f: number; e: number; m: number; at: number }[] = []
    let at = 0
    for (let k = 0; k < len; k++) {
      const s = { b: Math.round(p[`b${k}`] ?? 4), f: Math.round(p[`f${k}`] ?? 120), e: Math.round(p[`e${k}`] ?? 0), m: Math.round(p[`m${k}`] ?? 4), at }
      out.push(s)
      at += s.b
    }
    return { list: out, total: Math.max(1, at) }
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const { list, total } = segs(p)
    const k0 = Math.min(sel, list.length - 1)
    const led = telemetry.leds[mod]
    const bpms = list.flatMap((s) => [s.f, s.e || s.f])
    const lo = Math.min(...bpms) - 10
    const hi = Math.max(...bpms) + 10
    const bx = (bar: number) => (bar / total) * W
    const by = (bpm: number) => plotH * 0.9 - ((bpm - lo) / (hi - lo)) * plotH * 0.7
    ctx.fillStyle = '#1b1712'
    ctx.fillRect(0, 0, W, H)
    list.forEach((s, k) => {
      const x0 = bx(s.at)
      const x1 = bx(s.at + s.b)
      if (k === k0) {
        ctx.fillStyle = 'rgba(255,224,138,0.08)'
        ctx.fillRect(x0, 0, x1 - x0, plotH)
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(x0, 0, 1.5 * RES, plotH)
      ctx.fillStyle = s.m === 4 ? 'rgba(255,255,255,0.45)' : '#ffcf70'
      ctx.textAlign = 'center'
      fitFont(ctx, `${s.m}/4`, x1 - x0 - 4, plotH * 0.13, FONT, '600')
      ctx.fillText(`${s.m}/4`, (x0 + x1) / 2, plotH * 0.15)
      ctx.strokeStyle = '#ffb347'
      ctx.lineWidth = 2.5 * RES
      ctx.beginPath()
      ctx.moveTo(x0, by(s.f))
      ctx.lineTo(x1, by(s.e || s.f))
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = `${Math.round(plotH * 0.09)}px ${FONT}`
      ctx.textAlign = 'left'
      ctx.fillText(`${s.f}`, x0 + 3, by(s.f) - 4)
    })
    const seg = led?.[CDL.seg] ?? -1
    if (seg >= 0 && seg < list.length) {
      const s = list[seg]
      const pos = s.at + (led![CDL.bar] + (led![CDL.beat] + 0.5) / s.m)
      ctx.fillStyle = '#ffe08a'
      ctx.fillRect(bx(pos), 0, 2 * RES, plotH)
      ctx.textAlign = 'right'
      ctx.font = `600 ${Math.round(plotH * 0.13)}px ${FONT}`
      ctx.fillText(`${Math.round(led![CDL.bpm])} BPM`, W - 6, plotH * 0.15)
    }
    // the selected segment's settings
    const fw = W / (FIELDS.length + 1)
    ctx.fillStyle = '#0e0c0a'
    ctx.fillRect(0, plotH, W, H - plotH)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffcf70'
    fitFont(ctx, `SEGMENT ${k0 + 1}`, fw - 8, (H - plotH) * 0.36, FONT, '700')
    ctx.fillText(`SEGMENT ${k0 + 1}`, fw / 2, plotH + (H - plotH) * 0.62)
    FIELDS.forEach((f, i) => {
      const cx = fw * (i + 1) + fw / 2
      ctx.fillStyle = '#6d655a'
      ctx.font = `${Math.round((H - plotH) * 0.24)}px ${FONT}`
      ctx.fillText(f.label, cx, plotH + (H - plotH) * 0.32)
      ctx.fillStyle = '#efe6d8'
      const v = f.show(Math.round(p[`${f.id}${k0}`] ?? 0))
      fitFont(ctx, v, fw - 10, (H - plotH) * 0.4, FONT, '600')
      ctx.fillText(v, cx, plotH + (H - plotH) * 0.8)
    })
  })

  const where = (e: { clientX: number; clientY: number }, r: DOMRect) => ({ fx: ((e.clientX - r.left) / r.width) * W, fy: ((e.clientY - r.top) / r.height) * H })
  const nudge = (i: number, d: number) => {
    const p = live()
    const k = Math.min(sel, Math.max(0, Math.round(p.len ?? 1) - 1))
    const f = FIELDS[i]
    const id = `${f.id}${k}`
    let v = Math.round(p[id] ?? 0) + d * f.step
    if (f.id === 'e' && v > 0 && v < 30) v = d > 0 ? 30 : 0 // TO: STEADY, then 30 …
    actions.setParam(mod, id, Math.max(f.min, Math.min(f.max, v)))
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy >= plotH) {
      const fw = W / (FIELDS.length + 1)
      const i = Math.floor(fx / fw) - 1
      if (i >= 0 && i < FIELDS.length) nudge(i, fx - (i + 1) * fw < fw / 2 ? -1 : 1)
      return
    }
    const { list, total } = segs(live())
    const bar = (fx / W) * total
    const k = list.findIndex((s) => bar >= s.at && bar < s.at + s.b)
    if (k >= 0) setSel(k)
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy < plotH) return
    e.stopPropagation()
    const i = Math.floor(fx / (W / (FIELDS.length + 1))) - 1
    if (i >= 0 && i < FIELDS.length) nudge(i, e.deltaY < 0 ? 1 : -1)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onWheel={wheel} />
}
