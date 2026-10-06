import { hpOf } from '../modules/size'
import { fits, railHp } from './layout'
import type { Patch } from './types'

/** Row edits as pure functions on a patch (the store commits them). */

/** The rack without row `row` (the rows below move up), or null if it can't
 *  be done. Its modules either go (`delete`, with their cables) or move to
 *  free space in the other rows (`move`: nearest rows first, biggest panels
 *  first; null if they don't all fit). The last row is never removed. */
export function withoutRow(p: Patch, row: number, keep: 'move' | 'delete'): Patch | null {
  if (p.rows <= 1 || row < 0 || row >= p.rows) return null
  const inRow = p.modules.filter((m) => m.row === row)
  let next: Patch = { ...p, modules: p.modules.filter((m) => m.row !== row) }
  if (keep === 'delete') {
    const gone = new Set(inRow.map((m) => m.id))
    next.cables = p.cables.filter((c) => !gone.has(c.from.mod) && !gone.has(c.to.mod))
  } else {
    const order = Array.from({ length: p.rows }, (_, r) => r)
      .filter((r) => r !== row)
      .sort((a, b) => Math.abs(a - row) - Math.abs(b - row) || a - b)
    for (const m of [...inRow].sort((a, b) => hpOf(b) - hpOf(a))) {
      const w = hpOf(m)
      let spot: { row: number; hp: number } | null = null
      for (const r of order) {
        // try the same position first, then scan the row from the left
        if (fits(next, r, m.hp, w)) spot = { row: r, hp: m.hp }
        for (let hp = 0; !spot && hp + w <= railHp(p); hp++) if (fits(next, r, hp, w)) spot = { row: r, hp }
        if (spot) break
      }
      if (!spot) return null
      next = { ...next, modules: [...next.modules, { ...m, row: spot.row, hp: spot.hp }] }
    }
  }
  return {
    ...next,
    rows: p.rows - 1,
    modules: next.modules.map((m) => (m.row > row ? { ...m, row: m.row - 1 } : m)),
  }
}
