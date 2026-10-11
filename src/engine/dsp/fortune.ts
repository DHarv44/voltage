import { Dsp } from './base'
import { Schmitt } from './cores'

const SCALES = [
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 4, 7, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
]
const LOOP_MAX = 16
const PULSE_S = 0.005

/** FORTUNE: a clock (its own RATE, or CLK) with JITTER; on each tick a coin
 *  weighted by COIN sends it to T1 or T2. Each tick also draws X1–X3: a
 *  random number shaped by SPREAD (narrow to wide) and BIAS (low to high),
 *  then STEPS (smooth, stepped, then snapped to the SCALE's notes over two
 *  octaves). DÉJÀ VU: the chance each tick replays what was drawn LOOP ticks
 *  ago instead of drawing anew (at full, a locked loop; past the middle the
 *  coin tosses repeat too). Y is a slow smoothed random. */
export class FortuneDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iD = this.ii('dcv')
  private readonly iS = this.ii('scv')
  private readonly O = { t1: this.oi('t1'), t2: this.oi('t2'), t3: this.oi('t3'), x1: this.oi('x1'), x2: this.oi('x2'), x3: this.oi('x3'), y: this.oi('y') }
  private readonly P = Object.fromEntries(['rate', 'tbias', 'jitter', 'deja', 'loop', 'spread', 'xbias', 'steps', 'scale'].map((id) => [id, this.pi(id)])) as Record<string, number>
  private readonly tOuts = Int32Array.of(this.O.t1, this.O.t2, this.O.t3)
  private readonly clk = new Schmitt()
  /** The last LOOP_MAX draws per channel (0..1) and coin tosses, and where in them we are. */
  private readonly hist = new Float64Array(LOOP_MAX * 3)
  private readonly coins = new Uint8Array(LOOP_MAX)
  private pos = 0
  private ph = 0
  private wait = 0
  private readonly pulse = new Int32Array(3)
  private readonly x = new Float64Array(3)
  private readonly glided = new Float64Array(3)
  private y = 0
  private yTarget = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    for (let i = 0; i < this.hist.length; i++) this.hist[i] = this.rng.next()
  }

  /** A fresh draw, shaped: SPREAD squeezes it to the middle or flings it to the ends, BIAS skews it. */
  private draw(spread: number, bias: number): number {
    // the sum of uniforms is near-normal; narrow spread averages more of them
    const n = 1 + Math.round((1 - spread) * 5)
    let u = 0
    for (let i = 0; i < n; i++) u += this.rng.next()
    u /= n
    const g = Math.pow(4, (0.5 - bias) * 2)
    return Math.pow(Math.max(0, Math.min(1, u)), g)
  }

  /** Shape a 0..1 value by STEPS into volts (0–2 V: two octaves). */
  private shape(v: number, steps: number, k: number): number {
    if (steps < 0.33) {
      const t = 1 - steps * 3
      this.glided[k] += (v - this.glided[k]) * (t > 0.99 ? 1 : 1 - t)
      return this.glided[k] * 2
    }
    if (steps < 0.66) return (Math.round(v * 24) / 24) * 2
    const sc = SCALES[Math.round(this.p[this.P.scale])] ?? SCALES[0]
    const semis = v * 24
    const oct = Math.floor(semis / 12)
    const pc = semis - oct * 12
    let best = sc[0]
    for (const s of sc) if (Math.abs(s - pc) < Math.abs(best - pc)) best = s
    return (oct * 12 + best) / 12
  }

  private tock(): void {
    const p = this.p
    const P = this.P
    const loop = Math.round(p[P.loop])
    const deja = Math.max(0, Math.min(1, p[P.deja] + (this.patched[this.iD] ? this.in[this.iD] / 10 : 0)))
    const spread = Math.max(0, Math.min(1, p[P.spread] + (this.patched[this.iS] ? this.in[this.iS] / 10 : 0)))
    this.pos = (this.pos + 1) % loop
    const replay = this.rng.next() < deja
    // the coin, replayed only past the middle of DÉJÀ VU
    if (!(replay && deja > 0.5)) this.coins[this.pos] = this.rng.next() < p[P.tbias] ? 1 : 0
    this.pulse[this.coins[this.pos] ? 0 : 1] = Math.round(PULSE_S * this.fs)
    this.pulse[2] = Math.round(PULSE_S * this.fs)
    for (let k = 0; k < 3; k++) {
      const i = this.pos * 3 + k
      if (!replay) this.hist[i] = this.draw(spread, p[P.xbias])
      this.x[k] = this.shape(this.hist[i], p[P.steps], k)
    }
    this.yTarget = this.rng.next() * 10
  }

  tick(): void {
    const p = this.p
    const P = this.P
    if (this.patched[this.iClk]) {
      if (this.clk.rise(this.in[this.iClk])) this.wait = Math.round(this.rng.next() * p[P.jitter] * 0.05 * this.fs) + 1
    } else {
      this.ph += p[P.rate] / this.fs
      if (this.ph >= 1) {
        this.ph -= 1
        // JITTER: the tick lands up to a third of a period late
        this.wait = Math.round(this.rng.next() * p[P.jitter] * (0.33 / p[P.rate]) * this.fs) + 1
      }
    }
    if (this.wait > 0 && --this.wait === 0) this.tock()
    for (let k = 0; k < 3; k++) {
      this.out[this.tOuts[k]] = this.pulse[k] > 0 ? 10 : 0
      this.led[k] = this.pulse[k] > 0 ? 1 : this.led[k] * 0.999
      if (this.pulse[k] > 0) this.pulse[k]--
    }
    this.out[this.O.x1] = this.x[0]
    this.out[this.O.x2] = this.x[1]
    this.out[this.O.x3] = this.x[2]
    this.y += (this.yTarget - this.y) * (1 / (0.5 * this.fs))
    this.out[this.O.y] = this.y
  }
}
