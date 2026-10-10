import { pedalAt, PR_SLOTS, PR_STEPS_PER_BAR } from '../../modules/specs/pianoroll'
import { actions } from '../../patch/store'
import { track } from '../pointer'

/** Under the grid: the velocity lane, then the sustain pedal lane (as
 *  fractions of the screen's height). */
export const VEL_H = 0.15
export const PED_H = 0.07

export interface RollGeom {
  steps: number
  /** Where the grid starts across, a step's width, a row's height. */
  gx: number
  sw: number
  rh: number
  view: number
  /** The grid's height; the lanes below it. */
  gh: number
  vy: number
  vh: number
  py: number
  ph: number
}

export interface RollNote {
  i: number
  s: number
  l: number
  n: number
  v: number
}

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
export const noteColor = (v: number) => `hsl(${200 - v * 40}, 70%, ${38 + v * 22}%)`

/** Draw the two lanes: each note's velocity as a bar at its start, and the
 *  steps where the pedal is down. */
export function drawLanes(ctx: CanvasRenderingContext2D, g: RollGeom, W: number, notes: RollNote[], p: Record<string, number>): void {
  ctx.fillStyle = '#0e1013'
  ctx.fillRect(0, g.vy, W, g.vh + g.ph)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(0, g.vy, W, 1)
  ctx.fillRect(0, g.py, W, 1)
  ctx.fillStyle = '#6b7178'
  ctx.font = `${Math.round(g.ph * 0.6)}px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText('VEL', g.gx - 4, g.vy + g.ph * 0.8)
  ctx.fillText('PEDAL', g.gx - 4, g.py + g.ph * 0.75)
  const bw = Math.max(3, g.sw * 0.35)
  for (const nt of notes) {
    if (nt.s >= g.steps) continue
    const bh = Math.max(2, nt.v * (g.vh - 6))
    ctx.fillStyle = noteColor(nt.v)
    ctx.fillRect(g.gx + nt.s * g.sw + 1, g.vy + g.vh - 2 - bh, bw, bh)
  }
  ctx.fillStyle = 'rgba(232,163,61,0.75)'
  // down steps join into one bar; a lifted step shows as a gap
  for (let s = 0; s < g.steps; s++) if (pedalAt(p[`p${Math.floor(s / PR_STEPS_PER_BAR)}`] ?? 0, s)) ctx.fillRect(g.gx + s * g.sw, g.py + 3, g.sw + 0.5, g.ph - 6)
}

/** A press in the lanes: drag across the velocity lane to set the velocity
 *  of the notes starting under the pointer (a chord all at once), or click
 *  the pedal lane to put it down or lift it and drag to paint that along. */
export function editLanes(
  mod: string,
  live: () => Record<string, number>,
  notes: (p: Record<string, number>) => RollNote[],
  g: RollGeom,
  where: (e: { clientX: number; clientY: number }) => { fx: number; fy: number },
  start: { fx: number; fy: number },
): void {
  const stepOf = (fx: number) => Math.max(0, Math.min(g.steps - 1, Math.floor((fx - g.gx) / g.sw)))
  if (start.fy < g.py) {
    const key = `pianoroll-vel-${mod}`
    const set = (at: { fx: number; fy: number }) => {
      const s = stepOf(at.fx)
      const v = Math.max(0.05, Math.min(1, (g.vy + g.vh - 2 - at.fy) / (g.vh - 6)))
      const hits = notes(live()).filter((nt) => nt.s === s)
      if (hits.length) actions.setParams(hits.map((nt) => [mod, `v${nt.i}`, Math.round(v * 100) / 100]), key)
    }
    set(start)
    track((ev) => set(where(ev)), () => {})
    return
  }
  // the pedal: the first click decides down or up, the drag paints it
  const first = stepOf(start.fx)
  const p0 = live()
  const down = !pedalAt(p0[`p${Math.floor(first / PR_STEPS_PER_BAR)}`] ?? 0, first)
  const key = `pianoroll-ped-${mod}`
  const paint = (s: number) => {
    const id = `p${Math.floor(s / PR_STEPS_PER_BAR)}`
    const bits = Math.round(live()[id] ?? 0)
    const bit = 1 << s % PR_STEPS_PER_BAR
    const next = down ? bits | bit : bits & ~bit
    if (next !== bits) actions.setParams([[mod, id, next]], key)
  }
  paint(first)
  let last = first
  track((ev) => {
    const s = stepOf(where(ev).fx)
    for (let k = Math.min(last, s); k <= Math.max(last, s); k++) paint(k)
    last = s
  }, () => {})
}

/** A note slot that's free (for a new note), or −1. */
export const freeSlot = (p: Record<string, number>): number => {
  for (let i = 0; i < PR_SLOTS; i++) if (Math.round(p[`s${i}`] ?? -1) < 0) return i
  return -1
}
