/** Comb lengths (ms) for each side, a little different so the room is wide;
 *  then two allpasses to diffuse it. A small live room, Freeverb-style. */
const COMBS_L = [11.3, 13.7, 16.1, 18.9]
const COMBS_R = [11.9, 14.3, 15.7, 19.6]
const APS = [3.1, 1.3]

class Comb {
  private readonly buf: Float32Array
  private at = 0
  private lp = 0
  constructor(n: number) {
    this.buf = new Float32Array(Math.max(1, n))
  }
  run(x: number, fb: number, damp: number): number {
    const y = this.buf[this.at]
    this.lp = y + (this.lp - y) * damp
    this.buf[this.at] = x + this.lp * fb
    this.at = (this.at + 1) % this.buf.length
    return y
  }
}

class Allpass {
  private readonly buf: Float32Array
  private at = 0
  constructor(n: number) {
    this.buf = new Float32Array(Math.max(1, n))
  }
  run(x: number): number {
    const b = this.buf[this.at]
    this.buf[this.at] = x + b * 0.5
    this.at = (this.at + 1) % this.buf.length
    return b - x
  }
}

/** The room the kit is played in: a short, dark, stereo tail. `size` 0..1
 *  sets how long it rings (a tight booth … a big live room). */
export class DrumRoom {
  private readonly cl: Comb[]
  private readonly cr: Comb[]
  private readonly al: Allpass[]
  private readonly ar: Allpass[]
  l = 0
  r = 0

  constructor(fs: number) {
    const n = (ms: number) => Math.round((ms / 1000) * fs)
    this.cl = COMBS_L.map((ms) => new Comb(n(ms)))
    this.cr = COMBS_R.map((ms) => new Comb(n(ms)))
    this.al = APS.map((ms) => new Allpass(n(ms)))
    this.ar = APS.map((ms) => new Allpass(n(ms * 1.13)))
  }

  /** Feed one sample; the room's left and right are in l / r. */
  step(x: number, size: number): void {
    const fb = 0.62 + 0.26 * size
    const damp = 0.45
    let l = 0
    let r = 0
    for (let i = 0; i < 4; i++) {
      l += this.cl[i].run(x, fb, damp)
      r += this.cr[i].run(x, fb, damp)
    }
    for (let i = 0; i < 2; i++) {
      l = this.al[i].run(l)
      r = this.ar[i].run(r)
    }
    this.l = l * 0.25
    this.r = r * 0.25
  }
}
