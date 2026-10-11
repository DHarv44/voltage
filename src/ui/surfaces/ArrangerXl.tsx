import { useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { XL_FIELDS, XL_MAX_BARS, XL_NAMES, XL_PARTS, XL_PATTERNS, XL_SECTIONS, XL_TRANSITIONS, XLL, xlId } from '../../modules/specs/arrangerXl'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const COLORS = ['#e8a33d', '#4fc6d6', '#c86bd8', '#7fd36b']
const LANE_COLORS = ['#e8a33d', '#d0d4da', '#c86bd8', '#4fc6d6', '#7fd36b', '#e06a5a', '#f2d16b', '#8aa0ff']
const BLOCK_H = 0.3
const DETAIL_H = 0.2
const PLUS_W = 0.04

/** The selected section's fields in the strip along the bottom. */
interface Field {
  label: string
  id: (typeof XL_FIELDS)[number]
  min: number
  max: number
  show: (v: number) => string
}
const FIELDS_SHOWN: Field[] = [
  { label: 'NAME', id: 'n', min: 0, max: XL_NAMES.length - 1, show: (v) => XL_NAMES[v] },
  { label: 'BARS', id: 'b', min: 1, max: XL_MAX_BARS, show: (v) => `${v}` },
  { label: 'PATTERN', id: 'p', min: 0, max: XL_PATTERNS.length - 1, show: (v) => XL_PATTERNS[v] },
  { label: 'START', id: 'x', min: 0, max: XL_TRANSITIONS.length - 1, show: (v) => XL_TRANSITIONS[v] },
  { label: 'TEMPO', id: 't', min: 0, max: 220, show: (v) => (v > 0 ? `${v}` : 'MAIN') },
  { label: 'KEY', id: 's', min: -12, max: 12, show: (v) => (v === 0 ? '±0' : v > 0 ? `+${v}` : `${v}`) },
  { label: 'SCENE', id: 'c', min: 0, max: 8, show: (v) => (v > 0 ? `${v}` : '—') },
]

/** ARRANGER XL's screen: the song as named blocks (width = bars) over eight
 *  part lanes, and the selected section's settings along the bottom. Click
 *  a block to select it, drag its right edge for its length, right-click to
 *  remove it, + to add one; click a lane cell to bring a part in or out.
 *  In the strip, click a field's left or right half (or scroll on it) to
 *  step it down or up. */
export function ArrangerXl({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const [sel, setSel] = useState(0)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const val = (p: Record<string, number>, f: (typeof XL_FIELDS)[number], k: number) => Math.round(p[xlId(f, k)] ?? 0)
  const bh = H * BLOCK_H
  const dh = H * DETAIL_H
  const lh = (H - bh - dh) / XL_PARTS

  const layout = (p: Record<string, number>) => {
    const len = Math.max(1, Math.min(XL_SECTIONS, Math.round(p.len ?? 1)))
    const bars = Array.from({ length: len }, (_, k) => Math.max(1, val(p, 'b', k)))
    const total = bars.reduce((a, b) => a + b, 0)
    const room = W * (1 - (len < XL_SECTIONS ? PLUS_W : 0))
    const perBar = room / total
    let at = 0
    const spans = bars.map((b) => {
      const s = { x0: at * perBar, x1: (at + b) * perBar, bars: b }
      at += b
      return s
    })
    return { len, spans, perBar, room }
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const { len, spans, perBar, room } = layout(p)
    const led = telemetry.leds[mod]
    const sec = led?.[XLL.section] ?? -1
    const step = led?.[XLL.step] ?? -1
    const k0 = Math.min(sel, len - 1)
    ctx.fillStyle = '#121417'
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    spans.forEach((s, k) => {
      const pat = val(p, 'p', k)
      const parts = val(p, 'm', k)
      const xw = s.x1 - s.x0
      ctx.globalAlpha = k === sec ? 1 : 0.72
      ctx.fillStyle = COLORS[pat] ?? COLORS[0]
      ctx.fillRect(s.x0 + 1.5, 3, xw - 3, bh - 6)
      ctx.globalAlpha = 1
      // how it starts: a fade ramp, a build's rise, a drop's gap
      const tr = val(p, 'x', k)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      if (tr === 1) {
        ctx.beginPath()
        ctx.moveTo(s.x0 + 1.5, bh - 3)
        ctx.lineTo(s.x0 + Math.min(xw * 0.3, perBar), 3)
        ctx.lineTo(s.x0 + 1.5, 3)
        ctx.fill()
      } else if (tr >= 2) ctx.fillRect(s.x0 + 1.5, 3, Math.max(3, perBar * (tr === 3 ? 0.2 : 0.1)), bh - 6)
      if (k === k0) {
        ctx.strokeStyle = '#f2f0e8'
        ctx.lineWidth = 2 * RES
        ctx.strokeRect(s.x0 + 2, 4, xw - 4, bh - 8)
      }
      ctx.fillStyle = '#121417'
      const name = val(p, 'n', k) > 0 ? XL_NAMES[val(p, 'n', k)] : XL_PATTERNS[pat]
      fitFont(ctx, name, xw - 8, bh * 0.36, FONT, '600')
      ctx.fillText(name, (s.x0 + s.x1) / 2, bh * 0.5)
      fitFont(ctx, `${s.bars}`, xw - 8, bh * 0.24, FONT)
      ctx.fillText(`${s.bars}`, (s.x0 + s.x1) / 2, bh * 0.82)
      for (let g = 0; g < XL_PARTS; g++) {
        const on = (parts & (1 << g)) !== 0
        ctx.fillStyle = on ? LANE_COLORS[g] : '#1d2126'
        ctx.globalAlpha = on ? (k === sec ? 1 : 0.6) : 1
        ctx.fillRect(s.x0 + 1.5, bh + g * lh + 1.5, xw - 3, lh - 3)
      }
      ctx.globalAlpha = 1
    })
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `${Math.round(lh * 0.6)}px ${FONT}`
    for (let g = 0; g < XL_PARTS; g++) ctx.fillText(`${g + 1}`, 5, bh + g * lh + lh * 0.75)
    if (len < XL_SECTIONS) {
      ctx.fillStyle = '#2a2f35'
      ctx.fillRect(room + 2, 3, W - room - 4, bh - 6)
      ctx.fillStyle = '#c9ced4'
      ctx.textAlign = 'center'
      ctx.font = `600 ${Math.round(bh * 0.45)}px ${FONT}`
      ctx.fillText('+', (room + W) / 2, bh * 0.66)
    }
    if (sec >= 0 && sec < spans.length) {
      ctx.fillStyle = '#ffe08a'
      ctx.fillRect(spans[sec].x0 + (Math.max(0, step) / 16) * perBar, 0, 2 * RES, H - dh)
    }
    // the selected section's settings
    const fw = W / FIELDS_SHOWN.length
    const top = H - dh
    ctx.fillStyle = '#0c0d0f'
    ctx.fillRect(0, top, W, dh)
    ctx.textAlign = 'center'
    FIELDS_SHOWN.forEach((f, i) => {
      const cx = fw * i + fw / 2
      ctx.fillStyle = '#5f666e'
      ctx.font = `${Math.round(dh * 0.26)}px ${FONT}`
      ctx.fillText(i === 0 ? `${f.label} · ${k0 + 1}` : f.label, cx, top + dh * 0.34)
      ctx.fillStyle = '#e8e4da'
      const v = f.show(val(p, f.id, k0))
      fitFont(ctx, v, fw - 10, dh * 0.42, FONT, '600')
      ctx.fillText(v, cx, top + dh * 0.82)
    })
  })

  const where = (e: { clientX: number; clientY: number }, r: DOMRect) => ({ fx: ((e.clientX - r.left) / r.width) * W, fy: ((e.clientY - r.top) / r.height) * H })
  /** Section `from`'s params, written into slot `to`. */
  const copyInto = (p: Record<string, number>, from: number, to: number): [string, string, number][] => XL_FIELDS.map((f) => [mod, xlId(f, to), p[xlId(f, from)] ?? 0])

  /** Step the selected section's field i by d. */
  const nudge = (i: number, d: number) => {
    const p = live()
    const k = Math.min(sel, Math.max(0, Math.round(p.len ?? 1) - 1))
    const f = FIELDS_SHOWN[i]
    const id = xlId(f.id, k)
    let v = Math.round(p[id] ?? 0) + d
    if (f.id === 't' && v > 0 && v < 40) v = d > 0 ? 40 : 0 // tempo: MAIN, then 40 …
    actions.setParam(mod, id, Math.max(f.min, Math.min(f.max, v)))
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const { fx, fy } = where(e, r)
    const p = live()
    const { len, spans, perBar, room } = layout(p)
    if (fy >= H - dh) {
      const fw = W / FIELDS_SHOWN.length
      const i = Math.min(FIELDS_SHOWN.length - 1, Math.floor(fx / fw))
      nudge(i, fx - i * fw < fw / 2 ? -1 : 1)
      return
    }
    if (fx > room && fy < bh) {
      if (len < XL_SECTIONS) {
        actions.setParams([[mod, 'len', len + 1], ...copyInto(p, len - 1, len)], `arrangerxl-add-${mod}`)
        setSel(len)
      }
      return
    }
    const k = spans.findIndex((s) => fx >= s.x0 && fx < s.x1)
    if (k < 0) return
    if (fy >= bh) {
      const g = Math.min(XL_PARTS - 1, Math.floor((fy - bh) / lh))
      actions.setParam(mod, xlId('m', k), val(p, 'm', k) ^ (1 << g))
      return
    }
    setSel(k)
    const s = spans[k]
    if (fx > s.x1 - 10 * RES) {
      const start = s.bars
      track(
        (ev) => {
          const d = Math.round((where(ev, r).fx - fx) / perBar)
          actions.setParams([[mod, xlId('b', k), Math.max(1, Math.min(XL_MAX_BARS, start + d))]], `arrangerxl-bars-${mod}-${k}`)
        },
        () => {},
      )
    }
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const p = live()
    const { len, spans } = layout(p)
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    const k = spans.findIndex((s) => fx >= s.x0 && fx < s.x1)
    if (k < 0 || len <= 1 || fy >= bh) return
    const ups: [string, string, number][] = [[mod, 'len', len - 1]]
    for (let j = k; j < len - 1; j++) ups.push(...copyInto(p, j + 1, j))
    actions.setParams(ups, `arrangerxl-remove-${mod}`)
    setSel(Math.max(0, Math.min(sel, len - 2)))
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy < H - dh) return
    e.stopPropagation()
    nudge(Math.min(FIELDS_SHOWN.length - 1, Math.floor(fx / (W / FIELDS_SHOWN.length))), e.deltaY < 0 ? 1 : -1)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} onWheel={wheel} />
}
