import { SPECS } from '../../modules'
import { hpOf } from '../../modules/size'
import { placeWithPush, railHp } from '../../patch/layout'
import type { ModuleInst, Patch } from '../../patch/types'
import { GAP, HP_PX, ROW_PX, SIDE, rackHeight, rackWidth, type Placement, type Pt } from '../geometry'

/** An in-progress drag: where the dragged (or incoming) panel will land, and the
 *  neighbour slides that will happen on drop. Nothing is committed until then. */
export interface DragPreview {
  /** Module being moved; null for a new module dragged in from the library. */
  id: string | null
  type: string
  row: number
  hp: number
  /** Raw drop position, re-used on commit so the store resolves identically. */
  targetHp: number
  moves: Record<string, number>
}

/** Snap a rack-space point (minus the grab offset) to a row / HP slot.
 *  Row may equal `rows`, meaning "a new row below". */
export function slotAt(pt: Pt, grabX: number, grabY: number, rows: number): { row: number; hp: number } {
  const hp = Math.round((pt.x - grabX - SIDE) / HP_PX)
  const row = Math.max(0, Math.min(rows, Math.round((pt.y - grabY - GAP) / (ROW_PX + GAP))))
  return { row, hp }
}

export function resolve(base: Patch, id: string | null, type: string, row: number, hp: number): DragPreview | null {
  // a module being moved keeps its own (possibly resized) width
  const m = id ? base.modules.find((x) => x.id === id) : undefined
  const pl = placeWithPush(base, row, hp, m ? hpOf(m) : SPECS[type].hp, id ?? undefined)
  return pl ? { id, type, row, hp: pl.hp, targetHp: hp, moves: pl.moves } : null
}

/** Preview for a library drag: the panel is held by its centre. Null when off-rack. */
export function libraryPreview(type: string, pt: Pt, base: Patch): DragPreview | null {
  if (pt.x < 0 || pt.y < 0 || pt.x > rackWidth(railHp(base)) || pt.y > rackHeight(base.rows + 1)) return null
  const w = SPECS[type].hp * HP_PX
  const { row, hp } = slotAt(pt, w / 2, ROW_PX / 2, base.rows)
  return resolve(base, null, type, row, hp)
}

/** Where a module is drawn, given an in-progress drag. Only the dragged panel
 *  moves; neighbours stay put (overlapped) and slide aside on drop. */
export function placementOf(m: ModuleInst, pv: DragPreview | null): Placement {
  if (pv && m.id === pv.id) return { row: pv.row, hp: pv.hp }
  return m
}
