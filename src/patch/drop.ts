import { hpOf } from '../modules/size'
import { railHp, type PushPlacement } from './layout'
import type { Patch } from './types'

/** A neighbour has to be covered this much (of its width, or of the dropped
 *  panel's if that's narrower) before it gives way; less and it's a near
 *  miss: the dropped panel settles beside it instead. */
const GIVE_WAY = 0.6
/** A gap this small (HP) beside a dropped panel closes up: it snaps flush. */
const SNAP = 3

interface Slot {
  id: string
  hp: number
  w: number
}

/** Where a panel dropped at `hp` in `row` lands, and who moves:
 *  - it fits there: it lands there (flush to a neighbour a hair away);
 *  - it only clips a neighbour (under GIVE_WAY): nobody moves, it settles in
 *    the nearest place it fits, flush beside what it clipped;
 *  - moving along its own row and mostly covering the panel it was touching:
 *    the two swap places, nothing else moves;
 *  - otherwise it goes in between (by where its middle is), flush to the
 *    panel on its left, and only the panels in its way slide along, as far
 *    as they must. Returns null if the row lacks the room. */
export function placeDrop(p: Patch, row: number, hp: number, width: number, ignoreId?: string): PushPlacement | null {
  const rail = railHp(p)
  const others: Slot[] = p.modules
    .filter((m) => m.row === row && m.id !== ignoreId)
    .map((m) => ({ id: m.id, hp: m.hp, w: hpOf(m) }))
    .sort((a, b) => a.hp - b.hp)
  if (others.reduce((s, m) => s + m.w, width) > rail) return null
  const target = Math.max(0, Math.min(rail - width, Math.round(hp)))
  const free = (x: number) => x >= 0 && x + width <= rail && others.every((m) => x + width <= m.hp || m.hp + m.w <= x)

  // 1. room right there
  if (free(target)) return { hp: snap(target, width, others, rail), moves: {} }

  // how much of each panel it's over
  let most = 0
  let over: Slot | null = null
  for (const m of others) {
    const cover = Math.min(target + width, m.hp + m.w) - Math.max(target, m.hp)
    if (cover <= 0) continue
    const share = cover / Math.min(m.w, width)
    if (share > most) {
      most = share
      over = m
    }
  }

  // 2. a near miss: settle beside it without moving anyone
  if (most < GIVE_WAY) {
    // (only somewhere close: a free spot across the row isn't where you meant)
    const reach = Math.max(width, over ? over.w : 0)
    let best = -1
    for (let d = 1; d <= reach; d++) {
      if (free(target - d)) best = target - d
      else if (free(target + d)) best = target + d
      if (best >= 0) break
    }
    if (best >= 0) return { hp: snap(best, width, others, rail), moves: {} }
  }

  // 3. along its own row, onto the panel it was touching: swap the two
  const self = ignoreId ? p.modules.find((m) => m.id === ignoreId) : undefined
  if (self && self.row === row && over && most >= GIVE_WAY) {
    if (over.hp === self.hp + width) return { hp: self.hp + over.w, moves: { [over.id]: self.hp } }
    if (over.hp + over.w === self.hp) return { hp: over.hp, moves: { [over.id]: over.hp + width } }
  }

  // 4. in between, by where its middle is: flush to the left, push the rest along
  const mid = target + width / 2
  const k = others.filter((m) => m.hp + m.w / 2 < mid).length
  const left = others.slice(0, k)
  const right = others.slice(k)
  const leftEnd = left.length ? left[left.length - 1].hp + left[left.length - 1].w : 0
  const rightW = right.reduce((s, m) => s + m.w, 0)
  // going in front of a panel it's over: take that panel's place (no hole left in front)
  let x = Math.max(leftEnd, right.length ? Math.min(target, right[0].hp) : target)
  if (x + width + rightW > rail) x = rail - width - rightW // no room to the right: back up (pushing left)
  const moves: Record<string, number> = {}
  let cur = x + width
  for (const m of right) {
    const nh = Math.max(m.hp, cur)
    if (nh !== m.hp) moves[m.id] = nh
    cur = nh + m.w
  }
  cur = x
  for (let i = left.length - 1; i >= 0; i--) {
    const m = left[i]
    const nh = Math.min(m.hp, cur - m.w)
    if (nh !== m.hp) moves[m.id] = nh
    cur = nh
  }
  return { hp: x, moves }
}

/** Close a sliver of a gap beside a panel at x: flush to the neighbour (or the
 *  rail's end) within SNAP, if that spot is free. */
function snap(x: number, width: number, others: Slot[], rail: number): number {
  let leftEnd = 0
  let rightStart = rail
  for (const m of others) {
    if (m.hp + m.w <= x) leftEnd = Math.max(leftEnd, m.hp + m.w)
    else if (m.hp >= x + width) rightStart = Math.min(rightStart, m.hp)
  }
  const gl = x - leftEnd
  const gr = rightStart - (x + width)
  if (gl > 0 && gl <= SNAP && (gl <= gr || gr > SNAP)) return leftEnd
  if (gr > 0 && gr <= SNAP) return rightStart - width
  return x
}
