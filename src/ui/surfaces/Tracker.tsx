import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { SOUND_NAMES } from '../../modules/specs/sampling'
import { cellId, hex, noteName, packCell, TK_CH, TK_ORDER, TK_PATTERNS, TK_ROWS, TK_SAMPLES, TKRL, unpackCell } from '../../modules/specs/tracker'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const FONT = "'Courier New', monospace"
const LETTERS = ['A', 'B', 'C', 'D']
const HEAD = 0.14
const ROWNUM_W = 0.07
/** Rows on screen (the playing or cursor row kept in the middle). */
const SHOWN = 15
/** A channel column's parts (fractions of its width): note, sample, effect. */
const PARTS = [0, 0.42, 0.66, 1]

/** TRACKER's screen: the pattern top to bottom, the row playing (or, editing,
 *  the cursor) held in the middle; along the top the pattern tabs, the order
 *  list and the sample new notes get. Click a cell to put the cursor there;
 *  scroll on its note (Shift: octaves), sample or effect (Shift: the effect
 *  letter, else its value); right-click to clear it. Click an order slot to
 *  step its pattern; scroll the sample to choose it. */
export function Tracker({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const head = H * HEAD
  const rw = W * ROWNUM_W
  const colW = (W - rw) / TK_CH
  const rh = (H - head) / SHOWN

  /** What the screen shows now: the pattern and the row in the middle. */
  const view = (p: Record<string, number>) => {
    const led = telemetry.leds[mod]
    const editing = (p.rec ?? 0) >= 0.5
    const playing = (led?.[TKRL.row] ?? -1) >= 0
    const pat = editing || !playing ? Math.round(p.edpat ?? 0) : (led?.[TKRL.pat] ?? 0)
    const mid = editing || !playing ? Math.round(p.cur ?? 0) : (led?.[TKRL.row] ?? 0)
    return { pat, mid, editing, playRow: playing && pat === (led?.[TKRL.pat] ?? -1) ? (led?.[TKRL.row] ?? -1) : -1 }
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const { pat, mid, editing, playRow } = view(p)
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#0a0e22'
    ctx.fillRect(0, 0, W, H)
    ctx.font = `700 ${Math.round(head * 0.42)}px ${FONT}`
    ctx.textBaseline = 'middle'
    // the header: pattern tabs, order list, the sample being entered
    for (let t = 0; t < TK_PATTERNS; t++) {
      ctx.fillStyle = t === pat ? '#ffcc4d' : '#283060'
      ctx.fillRect(4 + t * head * 0.9, 4, head * 0.8, head - 8)
      ctx.fillStyle = t === pat ? '#0a0e22' : '#aab4ff'
      ctx.textAlign = 'center'
      ctx.fillText(LETTERS[t], 4 + t * head * 0.9 + head * 0.4, head / 2)
    }
    const len = Math.round(p.len ?? 1)
    const ox = 4 + TK_PATTERNS * head * 0.9 + head * 0.4
    for (let i = 0; i < TK_ORDER; i++) {
      const on = i < len
      ctx.fillStyle = i === (led?.[TKRL.ord] ?? -1) && on ? '#5dff8a' : on ? '#3a4690' : '#141936'
      ctx.fillRect(ox + i * head * 0.62, 6, head * 0.56, head - 12)
      if (on) {
        ctx.fillStyle = '#e8ecff'
        ctx.fillText(LETTERS[Math.round(p[`o${i}`] ?? 0)], ox + i * head * 0.62 + head * 0.28, head / 2)
      }
    }
    const smp = Math.round(p.edsmp ?? 1)
    ctx.textAlign = 'right'
    ctx.fillStyle = editing ? '#ff6b6b' : '#aab4ff'
    ctx.fillText(`${editing ? 'REC ' : ''}${hex(smp, 2)} ${smp <= SOUND_NAMES.length ? SOUND_NAMES[smp - 1] : 'YOURS'}`, W - 6, head / 2)
    // the rows
    ctx.font = `700 ${Math.round(rh * 0.66)}px ${FONT}`
    for (let k = 0; k < SHOWN; k++) {
      const row = mid - Math.floor(SHOWN / 2) + k
      if (row < 0 || row >= TK_ROWS) continue
      const ry = head + k * rh
      if (row === playRow) {
        ctx.fillStyle = '#25306e'
        ctx.fillRect(0, ry, W, rh)
      } else if (k === Math.floor(SHOWN / 2)) {
        ctx.fillStyle = '#161c44'
        ctx.fillRect(0, ry, W, rh)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = row % 4 === 0 ? '#ffcc4d' : '#6c76b8'
      ctx.fillText(hex(row, 2), 6, ry + rh / 2)
      for (let c = 0; c < TK_CH; c++) {
        const cx = rw + c * colW
        const cell = unpackCell(p[cellId(pat, row, c)] ?? 0)
        if (editing && row === Math.round(p.cur ?? 0) && c === Math.round(p.curch ?? 0)) {
          ctx.strokeStyle = '#ff6b6b'
          ctx.lineWidth = 1.5 * RES
          ctx.strokeRect(cx + 2, ry + 1, colW - 4, rh - 2)
        }
        ctx.fillStyle = cell.note ? '#e8ecff' : '#3a4370'
        ctx.fillText(noteName(cell.note), cx + colW * 0.04, ry + rh / 2)
        ctx.fillStyle = cell.smp ? '#7fd0ff' : '#3a4370'
        ctx.fillText(cell.smp ? hex(cell.smp, 2) : '..', cx + colW * PARTS[1], ry + rh / 2)
        ctx.fillStyle = cell.fx || cell.fxp ? '#c69bff' : '#3a4370'
        ctx.fillText(cell.fx || cell.fxp ? `${hex(cell.fx, 1)}${hex(cell.fxp, 2)}` : '...', cx + colW * PARTS[2], ry + rh / 2)
      }
    }
    // each channel's level, a bar under its header
    for (let c = 0; c < TK_CH; c++) {
      ctx.fillStyle = '#5dff8a'
      ctx.fillRect(rw + c * colW + 4, head - 4, (colW - 8) * Math.min(1, (led?.[TKRL.level0 + c] ?? 0) * 1.5), 3)
    }
  })

  /** Where the pointer is: a header slot, or a cell and which part of it. */
  const at = (e: { clientX: number; clientY: number }, r: DOMRect) => {
    const fx = ((e.clientX - r.left) / r.width) * W
    const fy = ((e.clientY - r.top) / r.height) * H
    if (fy < head) {
      const tab = Math.floor((fx - 4) / (head * 0.9))
      if (tab >= 0 && tab < TK_PATTERNS) return { kind: 'tab' as const, i: tab }
      const ox = 4 + TK_PATTERNS * head * 0.9 + head * 0.4
      const o = Math.floor((fx - ox) / (head * 0.62))
      if (o >= 0 && o < TK_ORDER) return { kind: 'order' as const, i: o }
      return { kind: 'sample' as const, i: 0 }
    }
    if (fx < rw) return null
    const p = live()
    const { pat, mid } = view(p)
    const row = mid - Math.floor(SHOWN / 2) + Math.floor((fy - head) / rh)
    if (row < 0 || row >= TK_ROWS) return null
    const c = Math.min(TK_CH - 1, Math.floor((fx - rw) / colW))
    const f = (fx - rw - c * colW) / colW
    return { kind: 'cell' as const, pat, row, c, part: f < PARTS[1] ? 0 : f < PARTS[2] ? 1 : 2 }
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const a = at(e, e.currentTarget.getBoundingClientRect())
    if (!a) return
    const p = live()
    if (a.kind === 'tab') actions.setParam(mod, 'edpat', a.i)
    else if (a.kind === 'order') {
      if (a.i < Math.round(p.len ?? 1)) actions.setParam(mod, `o${a.i}`, (Math.round(p[`o${a.i}`] ?? 0) + 1) % TK_PATTERNS)
      else actions.setParam(mod, 'len', a.i + 1)
    } else if (a.kind === 'cell') actions.setParams([[mod, 'cur', a.row], [mod, 'curch', a.c], [mod, 'edpat', a.pat]], `tracker-cur-${mod}`)
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const a = at(e, e.currentTarget.getBoundingClientRect())
    if (a?.kind === 'cell') actions.setParam(mod, cellId(a.pat, a.row, a.c), 0)
    else if (a?.kind === 'order' && a.i > 0) actions.setParam(mod, 'len', a.i)
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const a = at(e, e.currentTarget.getBoundingClientRect())
    if (!a) return
    e.stopPropagation()
    const d = e.deltaY < 0 ? 1 : -1
    const p = live()
    if (a.kind === 'sample') {
      actions.setParam(mod, 'edsmp', Math.max(1, Math.min(TK_SAMPLES, Math.round(p.edsmp ?? 1) + d)))
      return
    }
    if (a.kind !== 'cell') return
    const id = cellId(a.pat, a.row, a.c)
    const cell = unpackCell(p[id] ?? 0)
    if (a.part === 0) cell.note = Math.max(1, Math.min(96, (cell.note || 49) + d * (e.shiftKey ? 12 : 1)))
    else if (a.part === 1) cell.smp = Math.max(0, Math.min(TK_SAMPLES, cell.smp + d))
    else if (e.shiftKey) cell.fx = (cell.fx + d + 16) % 16
    else cell.fxp = (cell.fxp + d + 256) % 256
    actions.setParam(mod, id, packCell(cell))
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} onWheel={wheel} />
}
