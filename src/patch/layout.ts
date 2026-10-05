import { hpOf } from '../modules/size'
import type { Patch } from './types'

/** A standard 104 HP Eurorack row. */
export const ROW_HP = 104
/** The rail widths real cases come in (right-click a rail, or the top bar). */
export const RAIL_SIZES = [84, 104, 126, 168]

/** This rack's rail width in HP. */
export const railHp = (p: Pick<Patch, 'rail'>): number => p.rail ?? ROW_HP

/** The narrowest rail every module still fits on (its rightmost panel edge). */
export const usedHp = (p: Patch): number => p.modules.reduce((m, x) => Math.max(m, x.hp + hpOf(x)), 0)

export function fits(p: Patch, row: number, hp: number, width: number, ignoreId?: string): boolean {
  if (row < 0 || row >= p.rows || hp < 0 || hp + width > railHp(p)) return false
  return p.modules.every((m) => {
    if (m.id === ignoreId || m.row !== row) return true
    const w = hpOf(m)
    return hp + width <= m.hp || m.hp + w <= hp
  })
}

export function findSlot(p: Patch, width: number): { row: number; hp: number } | null {
  for (let row = 0; row < p.rows; row++)
    for (let hp = 0; hp + width <= railHp(p); hp++) if (fits(p, row, hp, width)) return { row, hp }
  return null
}

export interface PushPlacement {
  /** Final left edge of the placed panel. */
  hp: number
  /** New left edges of neighbours that had to slide (same row). */
  moves: Record<string, number>
}

/** Place a `width`-HP panel at `hp` in `row`, sliding neighbours out of the way.
 *  Every left/right split of the row's panels is tried (panels keep their order);
 *  the winner lands the panel closest to where it was dropped, then shoves the
 *  neighbours least. Returns null if the row lacks the total room. */
export function placeWithPush(p: Patch, row: number, hp: number, width: number, ignoreId?: string): PushPlacement | null {
  const others = p.modules
    .filter((m) => m.row === row && m.id !== ignoreId)
    .map((m) => ({ id: m.id, hp: m.hp, w: hpOf(m) }))
    .sort((a, b) => a.hp - b.hp)
  const rail = railHp(p)
  if (others.reduce((s, m) => s + m.w, width) > rail) return null

  const target = Math.round(hp)
  let best: PushPlacement | null = null
  let bestCost = Infinity
  for (let k = 0; k <= others.length; k++) {
    const left = others.slice(0, k)
    const right = others.slice(k)
    const leftW = left.reduce((s, m) => s + m.w, 0)
    const rightW = right.reduce((s, m) => s + m.w, 0)
    // Each group must still fit between the panel and its wall.
    const x = Math.max(leftW, Math.min(rail - width - rightW, target))
    const moves: Record<string, number> = {}
    let shove = 0
    let cur = x + width
    for (const m of right) {
      const nh = Math.max(m.hp, cur)
      if (nh !== m.hp) moves[m.id] = nh
      shove += nh - m.hp
      cur = nh + m.w
    }
    cur = x
    for (let i = left.length - 1; i >= 0; i--) {
      const m = left[i]
      const nh = Math.min(m.hp, cur - m.w)
      if (nh !== m.hp) moves[m.id] = nh
      shove += m.hp - nh
      cur = nh
    }
    const cost = Math.abs(x - target) * 1000 + shove
    if (cost < bestCost) {
      bestCost = cost
      best = { hp: x, moves }
    }
  }
  return best
}
