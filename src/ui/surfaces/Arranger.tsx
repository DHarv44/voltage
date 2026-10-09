import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { AR_PARTS, AR_PATTERNS, AR_SECTIONS, ARL } from '../../modules/specs/arranger'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const COLORS = ['#e8a33d', '#4fc6d6', '#c86bd8', '#7fd36b']
/** Blocks take the top of the screen, the part lanes the rest. */
const BLOCK_H = 0.42
/** The "+" tab on the right (adds a section). */
const PLUS_W = 0.06

/** ARRANGER's screen: the song as a row of blocks (width = bars). Click a
 *  block to change its pattern letter, drag its right edge for more or fewer
 *  bars, right-click to remove it, + to add one; click a lane cell to bring
 *  that part in or out of the section. */
export function Arranger({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params

  /** Each section's x span (canvas pixels). */
  const layout = (p: Record<string, number>) => {
    const len = Math.max(1, Math.min(AR_SECTIONS, Math.round(p.len ?? 1)))
    const bars = Array.from({ length: len }, (_, k) => Math.max(1, Math.round(p[`b${k}`] ?? 4)))
    const total = bars.reduce((a, b) => a + b, 0)
    const room = W * (1 - (len < AR_SECTIONS ? PLUS_W : 0))
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
    const sec = led?.[ARL.section] ?? -1
    const step = led?.[ARL.step] ?? -1
    ctx.fillStyle = '#121417'
    ctx.fillRect(0, 0, W, H)
    const bh = H * BLOCK_H
    const lh = (H - bh) / AR_PARTS
    spans.forEach((s, k) => {
      const pat = Math.round(p[`p${k}`] ?? 0)
      const parts = Math.round(p[`m${k}`] ?? 0)
      const playing = k === sec
      ctx.fillStyle = COLORS[pat]
      ctx.globalAlpha = playing ? 1 : 0.7
      ctx.fillRect(s.x0 + 2, 3, s.x1 - s.x0 - 4, bh - 6)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#121417'
      ctx.textAlign = 'center'
      fitFont(ctx, AR_PATTERNS[pat], s.x1 - s.x0 - 6, bh * 0.5, FONT, '600')
      ctx.fillText(AR_PATTERNS[pat], (s.x0 + s.x1) / 2, bh * 0.55)
      fitFont(ctx, `${s.bars} bars`, s.x1 - s.x0 - 6, bh * 0.2, FONT)
      ctx.fillText(`${s.bars} bar${s.bars > 1 ? 's' : ''}`, (s.x0 + s.x1) / 2, bh * 0.85)
      for (let g = 0; g < AR_PARTS; g++) {
        const on = (parts & (1 << g)) !== 0
        ctx.fillStyle = on ? (playing ? '#f2f0e8' : '#8d939a') : '#1e2227'
        ctx.fillRect(s.x0 + 2, bh + g * lh + 2, s.x1 - s.x0 - 4, lh - 4)
      }
    })
    // part names along the left of the lanes
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = `${Math.round(lh * 0.5)}px ${FONT}`
    for (let g = 0; g < AR_PARTS; g++) ctx.fillText(`${g + 1}`, 6, bh + g * lh + lh * 0.68)
    if (len < AR_SECTIONS) {
      ctx.fillStyle = '#2a2f35'
      ctx.fillRect(room + 2, 3, W - room - 4, bh - 6)
      ctx.fillStyle = '#c9ced4'
      ctx.textAlign = 'center'
      ctx.font = `600 ${Math.round(bh * 0.5)}px ${FONT}`
      ctx.fillText('+', (room + W) / 2, bh * 0.66)
    }
    if (sec >= 0 && sec < spans.length) {
      const px = spans[sec].x0 + (Math.max(0, step) / 16) * perBar
      ctx.fillStyle = '#ffe08a'
      ctx.fillRect(px, 0, 2, H)
    }
  })

  const where = (e: { clientX: number; clientY: number }, r: DOMRect) => ({ fx: ((e.clientX - r.left) / r.width) * W, fy: ((e.clientY - r.top) / r.height) * H })

  /** Section k's three params as written into slot `to`. */
  const copyInto = (p: Record<string, number>, from: number, to: number): [string, string, number][] => [
    [mod, `b${to}`, p[`b${from}`] ?? 4],
    [mod, `p${to}`, p[`p${from}`] ?? 0],
    [mod, `m${to}`, p[`m${from}`] ?? 0],
  ]

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const { fx, fy } = where(e, r)
    const p = live()
    const { len, spans, perBar, room } = layout(p)
    if (fx > room) {
      if (len < AR_SECTIONS) actions.setParams([[mod, 'len', len + 1], ...copyInto(p, len - 1, len)], `arranger-add-${mod}`)
      return
    }
    const k = spans.findIndex((s) => fx >= s.x0 && fx < s.x1)
    if (k < 0) return
    const bh = H * BLOCK_H
    if (fy >= bh) {
      const g = Math.min(AR_PARTS - 1, Math.floor((fy - bh) / ((H - bh) / AR_PARTS)))
      actions.setParam(mod, `m${k}`, Math.round(p[`m${k}`] ?? 0) ^ (1 << g))
      return
    }
    const s = spans[k]
    if (fx > s.x1 - 10 * RES) {
      // drag the right edge: more or fewer bars
      const start = s.bars
      track(
        (ev) => {
          const d = Math.round((where(ev, r).fx - fx) / perBar)
          actions.setParams([[mod, `b${k}`, Math.max(1, Math.min(16, start + d))]], `arranger-bars-${mod}-${k}`)
        },
        () => {},
      )
      return
    }
    actions.setParam(mod, `p${k}`, (Math.round(p[`p${k}`] ?? 0) + 1) % AR_PATTERNS.length)
  }

  // right-click a block: remove it (the ones after move up)
  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const p = live()
    const { len, spans } = layout(p)
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    const k = spans.findIndex((s) => fx >= s.x0 && fx < s.x1)
    if (k < 0 || len <= 1 || fy >= H * BLOCK_H) return
    const ups: [string, string, number][] = [[mod, 'len', len - 1]]
    for (let j = k; j < len - 1; j++) ups.push(...copyInto(p, j + 1, j))
    actions.setParams(ups, `arranger-remove-${mod}`)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} />
}
