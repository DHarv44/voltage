import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { CT_BARS, CTL } from '../../modules/specs/chordtrack'
import { chordCode, chordName, QUALITIES } from '../../modules/specs/combo/chords'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const COLS = 8

/** CHORD TRACK's screen: the bars in rows of eight, each split in two (the
 *  bar's chord, and a change on its half if there is one). Click a half's
 *  top to move its root up a semitone, its bottom for the next quality;
 *  scroll on it to move the root either way; right-click to clear it (a
 *  bar's first half then holds the chord before; its second half, no change).
 *  A bar without a half-bar change gets one by clicking its right edge. */
export function ChordTrack({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const barsOf = (p: Record<string, number>) => Math.max(1, Math.min(CT_BARS, Math.round(p.bars ?? 8)))
  const grid = (bars: number) => {
    const rows = Math.ceil(bars / COLS)
    return { rows, cw: W / COLS, rh: H / Math.max(rows, 2) }
  }
  /** The chord in effect at the start of bar b (what a held bar shows). */
  const heldAt = (p: Record<string, number>, b: number, bars: number) => {
    for (let i = 0; i < bars; i++) {
      const k = (b - i + bars) % bars
      const hh = i > 0 ? Math.round(p[`h${k}`] ?? 0) : 0
      if (hh > 0) return hh - 1
      const c = Math.round(p[`c${k}`] ?? 0)
      if (c > 0) return c - 1
    }
    return -1
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const bars = barsOf(p)
    const { cw, rh } = grid(bars)
    const led = telemetry.leds[mod]
    const playing = led?.[CTL.bar] ?? -1
    const half = led?.[CTL.half] ?? 0
    ctx.fillStyle = '#16181b'
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    for (let b = 0; b < bars; b++) {
      const cx = (b % COLS) * cw
      const cy = Math.floor(b / COLS) * rh
      const c = Math.round(p[`c${b}`] ?? 0)
      const hh = Math.round(p[`h${b}`] ?? 0)
      const on = b === playing
      ctx.fillStyle = on ? '#2d3238' : '#1e2125'
      ctx.fillRect(cx + 2, cy + 2, cw - 4, rh - 4)
      if (on) {
        ctx.fillStyle = 'rgba(255,224,138,0.18)'
        ctx.fillRect(cx + 2 + (hh > 0 && half ? (cw - 4) / 2 : 0), cy + 2, hh > 0 ? (cw - 4) / 2 : cw - 4, rh - 4)
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = `${Math.round(rh * 0.16)}px ${FONT}`
      ctx.fillText(`${b + 1}`, cx + cw * 0.12, cy + rh * 0.22)
      // the bar's chord (a held bar shows what's held, dimmed)
      const first = c > 0 ? c - 1 : heldAt(p, b, bars)
      const halfW = hh > 0 ? cw / 2 : cw
      ctx.fillStyle = c > 0 ? '#ece7da' : '#5d636b'
      const t1 = c > 0 ? chordName(first) : first >= 0 ? `(${chordName(first)})` : '–'
      fitFont(ctx, t1, halfW - 10, rh * 0.34, FONT, '600')
      ctx.fillText(t1, cx + halfW / 2, cy + rh * 0.66)
      if (hh > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(cx + cw / 2, cy + rh * 0.25, 1.5 * RES, rh * 0.5)
        ctx.fillStyle = '#c9e3ea'
        const t2 = chordName(hh - 1)
        fitFont(ctx, t2, halfW - 10, rh * 0.34, FONT, '600')
        ctx.fillText(t2, cx + cw * 0.75, cy + rh * 0.66)
      }
    }
  })

  /** Which bar and half the pointer is over, and whether on the top half of the cell. */
  const at = (e: { clientX: number; clientY: number }, r: DOMRect) => {
    const fx = ((e.clientX - r.left) / r.width) * W
    const fy = ((e.clientY - r.top) / r.height) * H
    const p = live()
    const bars = barsOf(p)
    const { cw, rh } = grid(bars)
    const b = Math.floor(fy / rh) * COLS + Math.floor(fx / cw)
    if (b < 0 || b >= bars) return null
    const second = Math.round(p[`h${b}`] ?? 0) > 0 ? fx % cw >= cw / 2 : (fx % cw) >= cw * 0.8
    return { p, b, bars, second, top: fy % rh < rh / 2 }
  }

  /** Change the chord in one half: `f` gets the chord there now and returns the new one. */
  const edit = (hit: NonNullable<ReturnType<typeof at>>, f: (code: number) => number) => {
    const { p, b, bars, second } = hit
    const id = second ? `h${b}` : `c${b}`
    const cur = Math.round(p[id] ?? 0)
    const base = cur > 0 ? cur - 1 : second ? (Math.round(p[`c${b}`] ?? 0) > 0 ? Math.round(p[`c${b}`]) - 1 : heldAt(p, b, bars)) : heldAt(p, b, bars)
    actions.setParam(mod, id, f(base < 0 ? chordCode(0, 0) : base) + 1)
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const hit = at(e, e.currentTarget.getBoundingClientRect())
    if (!hit) return
    edit(hit, (c) => (hit.top ? chordCode(Math.floor(c / 16) + 1, c % 16) : chordCode(Math.floor(c / 16), ((c % 16) + 1) % QUALITIES.length)))
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const hit = at(e, e.currentTarget.getBoundingClientRect())
    if (hit) actions.setParam(mod, hit.second ? `h${hit.b}` : `c${hit.b}`, 0)
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.stopPropagation()
    const hit = at(e, e.currentTarget.getBoundingClientRect())
    if (hit) edit(hit, (c) => chordCode(Math.floor(c / 16) + (e.deltaY < 0 ? 1 : -1), c % 16))
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} onWheel={wheel} />
}
