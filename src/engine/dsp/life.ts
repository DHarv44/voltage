import type { ModuleSpec } from '../../modules/types'
import { LIFE_H, LIFE_W, LIFEL } from '../../modules/specs/life'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { SCALES } from './shapers'

const GATE_S = 0.008
/** Glider and R-pentomino: something to watch from the first bar. */
const SEED: [number, number][] = [
  [1, 1], [2, 2], [0, 3], [1, 3], [2, 3],
  [10, 3], [11, 3], [9, 4], [10, 4], [10, 5],
]

export class LifeDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iReseed = this.ii('reseed')
  private readonly pRate = this.pi('rate')
  private readonly pScale = this.pi('scale')
  private readonly pDensity = this.pi('density')
  private grid = new Uint8Array(LIFE_W * LIFE_H)
  private next = new Uint8Array(LIFE_W * LIFE_H)
  private readonly clk = new Schmitt()
  private readonly reseedIn = new Schmitt()
  private col = -1
  private ph = 1
  private readonly gate = new Int32Array(LIFE_H)
  private eoc = 0
  private pitch = 0
  private pop = 0
  /** The grid changed since the display last saw it. */
  private dirty = true

  /** Copy the grid to the display and count the population (only on change). */
  private publish(): void {
    let pop = 0
    for (let i = 0; i < this.grid.length; i++) {
      pop += this.grid[i]
      this.led[LIFEL.cells + i] = this.grid[i]
    }
    this.pop = pop
    this.dirty = false
  }

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    for (const [x, y] of SEED) this.grid[y * LIFE_W + x] = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'cell' && ev.down) {
      const i = Math.round(ev.y) * LIFE_W + Math.round(ev.x)
      if (i >= 0 && i < this.grid.length) this.grid[i] ^= 1
      this.dirty = true
    } else if (ev.kind === 'button' && ev.name === 'reseed' && ev.down) this.reseed()
  }

  private reseed(): void {
    const d = this.p[this.pDensity]
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = this.rng.next() < d ? 1 : 0
    this.dirty = true
  }

  /** One generation on a torus (edges wrap). */
  private evolve(): void {
    const g = this.grid
    const n = this.next
    for (let y = 0; y < LIFE_H; y++)
      for (let x = 0; x < LIFE_W; x++) {
        let c = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue
            c += g[((y + dy + LIFE_H) % LIFE_H) * LIFE_W + ((x + dx + LIFE_W) % LIFE_W)]
          }
        const alive = g[y * LIFE_W + x]
        n[y * LIFE_W + x] = c === 3 || (alive && c === 2) ? 1 : 0
      }
    this.grid = n
    this.next = g
    this.dirty = true
  }

  private advance(): void {
    this.col++
    if (this.col >= LIFE_W) {
      this.col = 0
      this.evolve()
      this.eoc = Math.round(GATE_S * this.fs)
    }
    const scale = SCALES[Math.round(this.p[this.pScale])] ?? SCALES[0]
    let top = -1
    for (let r = 0; r < LIFE_H; r++)
      if (this.grid[r * LIFE_W + this.col]) {
        this.gate[r] = Math.round(GATE_S * this.fs)
        top = r
      }
    if (top >= 0) {
      // row 0 is the top of the grid = the highest note
      const deg = LIFE_H - 1 - top
      this.pitch = Math.floor(deg / scale.length) + scale[deg % scale.length] / 12
    }
  }

  tick(): void {
    if (this.reseedIn.rise(this.in[this.iReseed])) this.reseed()
    if (this.patched[this.iClk]) {
      if (this.clk.rise(this.in[this.iClk])) this.advance()
    } else {
      this.ph += this.p[this.pRate] / this.fs
      if (this.ph >= 1) {
        this.ph -= 1
        this.advance()
      }
    }
    const o = this.out
    for (let r = 0; r < LIFE_H; r++) {
      o[r] = this.gate[r] > 0 ? 10 : 0
      if (this.gate[r] > 0) this.gate[r]--
    }
    if (this.dirty) this.publish()
    o[LIFE_H] = this.pitch
    o[LIFE_H + 1] = Math.min(10, (this.pop / (LIFE_W * LIFE_H)) * 25)
    o[LIFE_H + 2] = this.eoc > 0 ? 10 : 0
    if (this.eoc > 0) this.eoc--
    this.led[LIFEL.col] = this.col
  }
}
