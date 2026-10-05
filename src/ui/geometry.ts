import { controlsOf } from '../modules/size'
import { HP_MM, PANEL_H_MM, type JackControl } from '../modules/types'
import { ROW_HP } from '../patch/layout'
import type { JackRef, ModuleInst, Patch } from '../patch/types'

/** Rack-space pixels per panel millimetre (before zoom). */
export const PX = 3.2
/** Wooden case cheek width. */
export const SIDE = 22
/** Frame between rows. */
export const GAP = 14
export const HP_PX = HP_MM * PX
export const ROW_PX = PANEL_H_MM * PX

/** Eurorack mounting (Doepfer A-100 spec): screws 3 mm in from the top and
 *  bottom edges; the first 7.5 mm from the left, the second 7.5 + (HP − 3)·5.08.
 *  The rails' holes sit on the same 1 HP grid, so every screw meets a hole. */
export const SCREW_Y_MM = 3
export const SCREW_X0_MM = 7.5
/** Phase of the rail hole grid from a row's left edge (mm). */
export const RAIL_PHASE_MM = SCREW_X0_MM % HP_MM

/** Screw x positions (mm from the panel's left edge) for a panel this wide. */
export function screwHoles(hp: number): number[] {
  if (hp >= 6) return [SCREW_X0_MM, SCREW_X0_MM + (hp - 3) * HP_MM]
  // Narrow panels take one screw on the grid hole nearest their centre.
  const k = Math.round((hp * HP_MM) / 2 / HP_MM - RAIL_PHASE_MM / HP_MM)
  return [RAIL_PHASE_MM + Math.max(0, Math.min(hp - 1, k)) * HP_MM]
}

export const moduleLeft = (hp: number) => SIDE + hp * HP_PX
export const rowTop = (row: number) => GAP + row * (ROW_PX + GAP)
export const rackWidth = () => SIDE * 2 + ROW_HP * HP_PX
export const rackHeight = (rows: number) => rowTop(rows)

export interface Pt {
  x: number
  y: number
}

export interface JackHit extends JackRef, Pt {
  dir: 'in' | 'out'
}

export type Placement = { row: number; hp: number }

function jackControl(m: ModuleInst, jack: string, dir: 'in' | 'out'): JackControl | undefined {
  return controlsOf(m).find((c): c is JackControl => c.kind === dir && c.jack === jack)
}

export function jackPos(m: ModuleInst, jack: string, dir: 'in' | 'out', at?: Placement): Pt | null {
  const c = jackControl(m, jack, dir)
  if (!c) return null
  return { x: moduleLeft(at?.hp ?? m.hp) + c.x * PX, y: rowTop(at?.row ?? m.row) + c.y * PX }
}

export function nearestJack(p: Patch, pt: Pt, radius: number): JackHit | null {
  let best: JackHit | null = null
  let bestD = radius * radius
  for (const m of p.modules) {
    for (const c of controlsOf(m)) {
      if (c.kind !== 'in' && c.kind !== 'out') continue
      const x = moduleLeft(m.hp) + c.x * PX
      const y = rowTop(m.row) + c.y * PX
      const d = (x - pt.x) ** 2 + (y - pt.y) ** 2
      if (d < bestD) {
        bestD = d
        best = { mod: m.id, jack: c.jack, dir: c.kind, x, y }
      }
    }
  }
  return best
}
