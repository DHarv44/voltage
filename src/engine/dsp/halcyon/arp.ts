const MAX_NOTES = 32

/** The arpeggiator: the chord it's given (sorted, low to high) stepped UP,
 *  U&D (no repeated ends) or DOWN across one to three octaves, on its own
 *  rate or each CLK edge. Allocates nothing while running. */
export class HcArp {
  readonly notes = new Int16Array(MAX_NOTES)
  count = 0
  /** The note to play now (MIDI), set when `fired`. */
  note = -1
  fired = false
  private idx = -1
  private dir = 1
  private ph = 1

  /** Take a chord (only when it changed): copied and sorted in place. */
  setChord(src: ArrayLike<number>, n: number): void {
    const c = Math.min(n, MAX_NOTES)
    let same = c === this.count
    for (let i = 0; i < c && same; i++) same = this.notes[i] === src[i]
    if (same) return
    for (let i = 0; i < c; i++) this.notes[i] = src[i]
    for (let i = 1; i < c; i++) {
      const v = this.notes[i]
      let j = i - 1
      while (j >= 0 && this.notes[j] > v) {
        this.notes[j + 1] = this.notes[j]
        j--
      }
      this.notes[j + 1] = v
    }
    if (this.count === 0) {
      // a fresh chord starts on the beat
      this.idx = -1
      this.dir = 1
      this.ph = 1
    }
    this.count = c
  }

  clear(): void {
    this.count = 0
  }

  /** One sample. `clk` true on a CLK edge (null: run on `rate`). */
  step(rate: number, clk: boolean | null, mode: number, range: number, fs: number): void {
    this.fired = false
    if (this.count === 0) return
    let go: boolean
    if (clk !== null) go = clk
    else {
      this.ph += rate / fs
      go = this.ph >= 1
      if (go) this.ph -= Math.floor(this.ph)
    }
    if (!go) return
    const len = this.count * range
    if (mode === 0) this.idx = (this.idx + 1) % len
    else if (mode === 2) this.idx = this.idx <= 0 ? len - 1 : this.idx - 1
    else if (len === 1) this.idx = 0
    else {
      let next = this.idx + this.dir
      if (next >= len || next < 0) {
        this.dir = -this.dir
        next = this.idx + this.dir
      }
      this.idx = Math.max(0, Math.min(len - 1, next))
    }
    if (this.idx >= len) this.idx = 0
    this.note = this.notes[this.idx % this.count] + 12 * Math.floor(this.idx / this.count)
    this.fired = true
  }
}
