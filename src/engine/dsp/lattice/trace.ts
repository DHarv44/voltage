import { LT_DRAW } from '../../../modules/specs/lattice'

/** DRAW's recorder: while a finger traces on a DRAW layer, one cell per step
 *  of that layer (whatever is under the finger then; off the lights, a rest),
 *  timed from the moment the finger went down. */
export class TraceRecorder {
  /** The layer being drawn (−1: none). */
  layer = -1
  /** The cell under the finger (column × 16 + row), −1 off the lights. */
  cell = -1
  len = 0
  /** Cells as stored (0 = a rest). */
  readonly buf = new Int32Array(LT_DRAW)
  private phase = 0
  private last = -1

  /** The finger goes down: its cell is the trace's first step (play it now). */
  begin(layer: number, cell: number): void {
    this.layer = layer
    this.cell = cell
    this.buf[0] = cell + 1
    this.len = 1
    this.phase = 0
    this.last = 0
  }

  /** Move on `steps` of the layer; on a new step, keep the cell under the
   *  finger and return it to be played (−1: nothing to play now). */
  advance(steps: number): number {
    const k = Math.floor(this.phase)
    this.phase += steps
    if (k === this.last || this.len >= LT_DRAW) return -1
    this.last = k
    this.buf[this.len++] = this.cell + 1
    return this.cell
  }

  get full(): boolean {
    return this.len >= LT_DRAW
  }
}
