import { BOUNCE, cellId, LT_COLORS, LT_LAYERS, LT_SIZE, LTL, RANDOM, SCORE } from '../../../modules/specs/lattice'

/** A note's light spreading out across the grid. */
interface Ripple {
  x: number
  y: number
  t: number
  color: string
}
const SPEED = 11 // cells per second
const LIFE = 0.9
const MAX = 64

/** Watches the engine's LEDs for notes (a new SCORE column, a new RANDOM dot,
 *  a ball landing) and keeps the ripples they start. One per module face. */
export class Ripples {
  readonly list: Ripple[] = []
  private readonly col = new Float32Array(LT_LAYERS).fill(-1)
  private readonly rnd = new Float32Array(LT_LAYERS * 2).fill(-1)
  private readonly ball = new Float32Array(LT_LAYERS * LT_SIZE).fill(-1)

  private add(x: number, y: number, t: number, color: string): void {
    if (this.list.length >= MAX) this.list.shift()
    this.list.push({ x, y, t, color })
  }

  update(p: Record<string, number>, led: ArrayLike<number> | undefined, now: number): void {
    while (this.list.length && now - this.list[0].t > LIFE) this.list.shift()
    if (!led) return
    for (let l = 0; l < LT_LAYERS; l++) {
      const b = l * LTL.block
      const mode = Math.round(p[`mode${l}`])
      const color = LT_COLORS[l]
      const col = led[b + LTL.col]
      if (mode === SCORE && col >= 0 && col !== this.col[l]) {
        const mask = Math.round(p[cellId(l, col)] ?? 0)
        for (let y = 0; y < LT_SIZE; y++) if ((mask >>> y) & 1) this.add(col, y, now, color)
      }
      this.col[l] = col
      const rx = led[b + LTL.rx]
      const ry = led[b + LTL.ry]
      if (mode === RANDOM && rx >= 0 && (rx !== this.rnd[l * 2] || ry !== this.rnd[l * 2 + 1])) this.add(rx, ry, now, color)
      this.rnd[l * 2] = rx
      this.rnd[l * 2 + 1] = ry
      for (let x = 0; x < LT_SIZE; x++) {
        const y = led[b + LTL.balls + x]
        const was = this.ball[l * LT_SIZE + x]
        if (mode === BOUNCE && was > 0.35 && y <= 0.35 && y >= 0) this.add(x, 0, now, color)
        this.ball[l * LT_SIZE + x] = y
      }
    }
  }

  /** How much ripple light falls on cell (x, y) now, 0..1, and whose colour. */
  at(x: number, y: number, now: number): { v: number; color: string } {
    let v = 0
    let color = '#ffffff'
    for (const r of this.list) {
      const age = now - r.t
      const d = Math.hypot(x - r.x, y - r.y)
      const ring = Math.max(0, 1 - Math.abs(d - age * SPEED) / 0.9) * (1 - age / LIFE)
      const core = d < 0.5 ? Math.max(0, 1 - age / 0.25) : 0
      const s = Math.max(ring * 0.7, core)
      if (s > v) {
        v = s
        color = r.color
      }
    }
    return { v: Math.min(1, v), color }
  }
}
