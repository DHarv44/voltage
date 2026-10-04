import { SPECS } from '../modules'
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

function jackControl(type: string, jack: string, dir: 'in' | 'out'): JackControl | undefined {
  return SPECS[type]?.controls.find((c): c is JackControl => c.kind === dir && c.jack === jack)
}

export function jackPos(m: ModuleInst, jack: string, dir: 'in' | 'out', at?: Placement): Pt | null {
  const c = jackControl(m.type, jack, dir)
  if (!c) return null
  return { x: moduleLeft(at?.hp ?? m.hp) + c.x * PX, y: rowTop(at?.row ?? m.row) + c.y * PX }
}

export function nearestJack(p: Patch, pt: Pt, radius: number): JackHit | null {
  let best: JackHit | null = null
  let bestD = radius * radius
  for (const m of p.modules) {
    for (const c of SPECS[m.type].controls) {
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
