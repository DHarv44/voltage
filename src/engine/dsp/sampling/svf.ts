/** A resonant low-pass (TPT state-variable), its coefficient redone only when
 *  the cutoff or resonance moves. */
export class LowpassSvf {
  private s1 = 0
  private s2 = 0
  private g = 0.5
  private k = 1.4
  private f = -1
  private q = -1

  constructor(private readonly fs: number) {}

  set(cutoff: number, res: number): void {
    if (cutoff === this.f && res === this.q) return
    this.f = cutoff
    this.q = res
    this.g = Math.tan((Math.PI * Math.min(cutoff, this.fs * 0.45)) / this.fs)
    this.k = 2 - 2 * Math.min(0.98, res)
  }

  run(x: number): number {
    const g = this.g
    const hp = (x - (this.k + g) * this.s1 - this.s2) / (1 + g * (this.k + g))
    const bp = g * hp + this.s1
    this.s1 = g * hp + bp
    const lp = g * bp + this.s2
    this.s2 = g * bp + lp
    return lp
  }
}
