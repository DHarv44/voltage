import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { PR_ROWS, PR_SHOWN, PR_SLOTS, PR_STEPS_PER_BAR, PRL } from '../../modules/specs/pianoroll'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

const SHOWN = PR_SHOWN
const KEYS = 0.06
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const BLACK = [1, 3, 6, 8, 10]
const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"

interface Note {
  i: number
  s: number
  l: number
  n: number
  v: number
}

/** PIANO ROLL's screen. Click an empty cell for a note (drag right to make it
 *  longer), drag a note to move it, drag its right end to resize, right-click
 *  to delete; scroll to see higher or lower. */
export function PianoRoll({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const lastLen = useRef(2)

  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const notes = (p: Record<string, number>): Note[] => {
    const out: Note[] = []
    for (let i = 0; i < PR_SLOTS; i++) {
      const s = Math.round(p[`s${i}`] ?? -1)
      if (s >= 0) out.push({ i, s, l: Math.round(p[`l${i}`] ?? 1), n: Math.round(p[`n${i}`] ?? 0), v: p[`v${i}`] ?? 0.85 })
    }
    return out
  }
  const geometry = (p: Record<string, number>) => {
    const steps = Math.max(1, Math.round(p.bars ?? 4)) * PR_STEPS_PER_BAR
    const gx = W * KEYS
    return { steps, gx, sw: (W - gx) / steps, rh: H / SHOWN, view: Math.round(p.view ?? 15) }
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const { steps, gx, sw, rh, view } = geometry(p)
    const led = telemetry.leds[mod]
    const step = led?.[PRL.step] ?? -1
    ctx.fillStyle = '#14171b'
    ctx.fillRect(0, 0, W, H)
    // rows: black keys darker, C rows named
    for (let r = 0; r < SHOWN; r++) {
      const n = view + r
      const ry = H - (r + 1) * rh
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
    // steps, beats, bars
    for (let s = 0; s <= steps; s++) {
      ctx.fillStyle = s % PR_STEPS_PER_BAR === 0 ? 'rgba(255,255,255,0.28)' : s % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'
      ctx.fillRect(gx + s * sw, 0, s % 4 === 0 ? 2 : 1, H)
    }
    // the notes (sounding ones lit)
    const sounding = new Set<number>()
    for (let k = 0; k < 8; k++) if ((led?.[PRL.voice0 + k] ?? -1) >= 0) sounding.add(led![PRL.voice0 + k])
    for (const nt of notes(p)) {
      if (nt.s >= steps) continue
      const r = nt.n - view
      if (r < 0 || r >= SHOWN) continue
      const on = step >= nt.s && step < nt.s + nt.l && sounding.has(nt.n)
      ctx.fillStyle = on ? '#ffe08a' : `hsl(${200 - nt.v * 40}, 70%, ${38 + nt.v * 22}%)`
      const nx = gx + nt.s * sw + 1
      const nw = Math.min(nt.l, steps - nt.s) * sw - 2
      ctx.fillRect(nx, H - (r + 1) * rh + 1, nw, rh - 2)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(nx + nw - 3, H - (r + 1) * rh + 1, 3, rh - 2) // the handle to resize
    }
    if (step >= 0) {
      ctx.fillStyle = 'rgba(255,224,138,0.8)'
      ctx.fillRect(gx + step * sw, 0, 2, H)
    }
  })

  /** Which step and row the pointer is over (row as a note number). */
  const at = (e: { clientX: number; clientY: number }, r: DOMRect, g: ReturnType<typeof geometry>) => {
    const fx = ((e.clientX - r.left) / r.width) * W
    const fy = ((e.clientY - r.top) / r.height) * H
    return { step: Math.floor((fx - g.gx) / g.sw), stepF: (fx - g.gx) / g.sw, note: g.view + Math.floor((H - fy) / g.rh), inGrid: fx >= g.gx }
  }
  const hit = (list: Note[], step: number, note: number) => list.filter((nt) => nt.n === note && step >= nt.s && step < nt.s + nt.l).pop()

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const p = live()
    const g = geometry(p)
    const a = at(e, r, g)
    if (!a.inGrid || a.step < 0 || a.step >= g.steps || a.note < 0 || a.note >= PR_ROWS) return
    const list = notes(p)
    let nt = hit(list, a.step, a.note)
    let mode: 'move' | 'size' = 'move'
    if (!nt) {
      // a new note in the first empty slot
      let free = -1
      for (let i = 0; i < PR_SLOTS && free < 0; i++) if (Math.round(p[`s${i}`] ?? -1) < 0) free = i
      if (free < 0) return
      nt = { i: free, s: a.step, l: lastLen.current, n: a.note, v: 0.85 }
      actions.setParams([[mod, `s${free}`, nt.s], [mod, `l${free}`, nt.l], [mod, `n${free}`, nt.n], [mod, `v${free}`, nt.v]], `pianoroll-${mod}-${free}`)
      mode = 'size'
    } else if (a.stepF > nt.s + nt.l - 0.4) mode = 'size'
    const start = { ...nt }
    const key = `pianoroll-${mod}-${start.i}`
    track(
      (ev) => {
        const b = at(ev, r, g)
        if (mode === 'size') {
          const l = Math.max(1, Math.min(g.steps - start.s, Math.ceil(b.stepF) - start.s))
          lastLen.current = l
          actions.setParams([[mod, `l${start.i}`, l]], key)
        } else {
          const s = Math.max(0, Math.min(g.steps - 1, start.s + b.step - a.step))
          const n = Math.max(0, Math.min(PR_ROWS - 1, start.n + b.note - a.note))
          actions.setParams([[mod, `s${start.i}`, s], [mod, `n${start.i}`, n]], key)
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
