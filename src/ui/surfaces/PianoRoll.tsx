import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { PR_ROWS, PR_SHOWN, PR_SLOTS, PR_STEPS_PER_BAR, PRL } from '../../modules/specs/pianoroll'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'
import { drawLanes, editLanes, freeSlot, noteColor, PED_H, VEL_H, type RollGeom, type RollNote } from './pianoRollLanes'

const SHOWN = PR_SHOWN
const KEYS = 0.06
const BLACK = [1, 3, 6, 8, 10]
const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"

/** PIANO ROLL's screen. Click an empty cell for a note (drag right to make it
 *  longer), drag a note to move it, drag its right end to resize, right-click
 *  to delete; scroll to see higher or lower. Below: the velocity lane (drag a
 *  note's bar up or down, or across several) and the pedal lane (click to put
 *  the pedal down or lift it, drag to paint). */
export function PianoRoll({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const lastLen = useRef(2)

  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const notes = (p: Record<string, number>): RollNote[] => {
    const out: RollNote[] = []
    for (let i = 0; i < PR_SLOTS; i++) {
      const s = Math.round(p[`s${i}`] ?? -1)
      if (s >= 0) out.push({ i, s, l: Math.round(p[`l${i}`] ?? 1), n: Math.round(p[`n${i}`] ?? 0), v: p[`v${i}`] ?? 0.85 })
    }
    return out
  }
  const geometry = (p: Record<string, number>): RollGeom => {
    const steps = Math.max(1, Math.round(p.bars ?? 4)) * PR_STEPS_PER_BAR
    const gx = W * KEYS
    const gh = H * (1 - VEL_H - PED_H)
    const vh = H * VEL_H
    return { steps, gx, sw: (W - gx) / steps, rh: gh / SHOWN, view: Math.round(p.view ?? 15), gh, vy: gh, vh, py: gh + vh, ph: H - gh - vh }
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const g = geometry(p)
    const { steps, gx, sw, rh, view, gh } = g
    const led = telemetry.leds[mod]
    const step = led?.[PRL.step] ?? -1
    ctx.fillStyle = '#14171b'
    ctx.fillRect(0, 0, W, H)
    // rows: black keys darker, C rows named
    for (let r = 0; r < SHOWN; r++) {
      const n = view + r
      const ry = gh - (r + 1) * rh
      const black = BLACK.includes(n % 12)
      ctx.fillStyle = black ? '#101215' : '#1a1e23'
      ctx.fillRect(gx, ry, W - gx, rh)
      ctx.fillStyle = black ? '#2a2d31' : '#d9d6cc'
      ctx.fillRect(0, ry + 1, gx - 2, rh - 2)
      if (n % 12 === 0) {
        ctx.fillStyle = '#5a6068'
        ctx.font = `${Math.round(rh * 0.7)}px ${FONT}`
        ctx.textAlign = 'right'
        ctx.fillText(`C${Math.floor(n / 12) + 2}`, gx - 4, ry + rh * 0.78)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(gx, ry + rh - 1, W - gx, 1)
      }
    }
    const list = notes(p)
    drawLanes(ctx, g, W, list, p)
    // steps, beats, bars (down through the lanes too)
    for (let s = 0; s <= steps; s++) {
      ctx.fillStyle = s % PR_STEPS_PER_BAR === 0 ? 'rgba(255,255,255,0.28)' : s % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'
      ctx.fillRect(gx + s * sw, 0, s % 4 === 0 ? 2 : 1, H)
    }
    // the notes (sounding ones lit)
    const sounding = new Set<number>()
    for (let k = 0; k < 8; k++) if ((led?.[PRL.voice0 + k] ?? -1) >= 0) sounding.add(led![PRL.voice0 + k])
    for (const nt of list) {
      if (nt.s >= steps) continue
      const r = nt.n - view
      if (r < 0 || r >= SHOWN) continue
      const on = step >= nt.s && step < nt.s + nt.l && sounding.has(nt.n)
      ctx.fillStyle = on ? '#ffe08a' : noteColor(nt.v)
      const nx = gx + nt.s * sw + 1
      const nw = Math.min(nt.l, steps - nt.s) * sw - 2
      ctx.fillRect(nx, gh - (r + 1) * rh + 1, nw, rh - 2)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(nx + nw - 3, gh - (r + 1) * rh + 1, 3, rh - 2) // the handle to resize
    }
    if (step >= 0) {
      ctx.fillStyle = 'rgba(255,224,138,0.8)'
      ctx.fillRect(gx + step * sw, 0, 2, H)
    }
  })

  /** Where the pointer is on the canvas, in canvas pixels. */
  const pos = (e: { clientX: number; clientY: number }, r: DOMRect) => ({ fx: ((e.clientX - r.left) / r.width) * W, fy: ((e.clientY - r.top) / r.height) * H })
  /** Which step and row the pointer is over (row as a note number). */
  const at = (e: { clientX: number; clientY: number }, r: DOMRect, g: RollGeom) => {
    const { fx, fy } = pos(e, r)
    return { step: Math.floor((fx - g.gx) / g.sw), stepF: (fx - g.gx) / g.sw, note: g.view + Math.floor((g.gh - fy) / g.rh), inGrid: fx >= g.gx && fy < g.gh }
  }
  const hit = (list: RollNote[], step: number, note: number) => list.filter((nt) => nt.n === note && step >= nt.s && step < nt.s + nt.l).pop()

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const p = live()
    const g = geometry(p)
    const start = pos(e, r)
    if (start.fy >= g.gh) {
      if (start.fx >= g.gx) editLanes(mod, live, notes, g, (ev) => pos(ev, r), start)
      return
    }
    const a = at(e, r, g)
    if (!a.inGrid || a.step < 0 || a.step >= g.steps || a.note < 0 || a.note >= PR_ROWS) return
    const list = notes(p)
    let nt = hit(list, a.step, a.note)
    let mode: 'move' | 'size' = 'move'
    if (!nt) {
      // a new note in the first empty slot
      const free = freeSlot(p)
      if (free < 0) return
      nt = { i: free, s: a.step, l: lastLen.current, n: a.note, v: 0.85 }
      actions.setParams([[mod, `s${free}`, nt.s], [mod, `l${free}`, nt.l], [mod, `n${free}`, nt.n], [mod, `v${free}`, nt.v]], `pianoroll-${mod}-${free}`)
      mode = 'size'
    } else if (a.stepF > nt.s + nt.l - 0.4) mode = 'size'
    const from = { ...nt }
    const key = `pianoroll-${mod}-${from.i}`
    track(
      (ev) => {
        const b = at(ev, r, g)
        if (mode === 'size') {
          const l = Math.max(1, Math.min(g.steps - from.s, Math.ceil(b.stepF) - from.s))
          lastLen.current = l
          actions.setParams([[mod, `l${from.i}`, l]], key)
        } else {
          const s = Math.max(0, Math.min(g.steps - 1, from.s + b.step - a.step))
          const n = Math.max(0, Math.min(PR_ROWS - 1, from.n + b.note - a.note))
          actions.setParams([[mod, `s${from.i}`, s], [mod, `n${from.i}`, n]], key)
        }
      },
      () => {},
    )
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const p = live()
    const g = geometry(p)
    const a = at(e, e.currentTarget.getBoundingClientRect(), g)
    if (!a.inGrid) return
    const nt = hit(notes(p), a.step, a.note)
    if (nt) actions.setParam(mod, `s${nt.i}`, -1)
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.stopPropagation()
    const v = Math.round(live().view ?? 15)
    actions.setParam(mod, 'view', Math.max(0, Math.min(PR_ROWS - SHOWN, v + (e.deltaY < 0 ? 1 : -1))))
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
      onContextMenu={context}
      onWheel={wheel}
    />
  )
}
