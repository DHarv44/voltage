import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { SCALES } from '../shapers'
import { rails } from '../util'
import { BOUNCE, cellId, LT_LAYERS, LT_RATE_STEPS, LT_SIZE, LTL, RANDOM } from '../../../modules/specs/lattice'
import { LayerSound } from './sounds'

/** Each layer's place in the stereo field. */
const PAN = [0.35, 0.65, 0.5, 0.42]

/** The highest lit row of a column (−1: none). */
function top(mask: number): number {
  for (let y = LT_SIZE - 1; y >= 0; y--) if ((mask >>> y) & 1) return y
  return -1
}

/** LATTICE: a master clock in 16ths (TEMPO or CLK in, gaps filled in); each
 *  layer steps at its RATE. SCORE plays the playhead's column as a chord,
 *  BOUNCE drops a ball in every column from its lit cell (a note each time it
 *  lands), RANDOM plays one lit dot at random per step. Row → scale degree
 *  (SCALE in KEY, then the layer's OCTAVE); on DRUMS, row → the kit's sound. */
export class LatticeDsp extends Dsp {
  private iClk = this.ii('clk')
  private iRun = this.ii('run')
  private iReset = this.ii('reset')
  private oLayer = [1, 2, 3, 4].map((i) => this.oi(`o${i}`))
  private oL = this.oi('l')
  private oR = this.oi('r')
  private P = { run: this.pi('run'), tempo: this.pi('tempo'), scale: this.pi('scale'), key: this.pi('key'), master: this.pi('master') }
  private L = Array.from({ length: LT_LAYERS }, (_, l) => ({
    mode: this.pi(`mode${l}`),
    snd: this.pi(`snd${l}`),
    oct: this.pi(`oct${l}`),
    len: this.pi(`len${l}`),
    rate: this.pi(`rate${l}`),
    vol: this.pi(`vol${l}`),
    cells: Int32Array.from({ length: LT_SIZE }, (_, x) => this.pi(cellId(l, x))),
  }))

  private readonly sounds = Array.from({ length: LT_LAYERS }, () => new LayerSound(this.fs, this.rng))
  /** Each layer's step count since PLAY (−1: not started). */
  private readonly count = new Float64Array(LT_LAYERS).fill(-1)
  /** BOUNCE: each column's height, and the step its ball was dropped. */
  private readonly height = Array.from({ length: LT_LAYERS }, () => new Int32Array(LT_SIZE).fill(-1))
  private readonly origin = Array.from({ length: LT_LAYERS }, () => new Float64Array(LT_SIZE))
  private readonly clkIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  private phase = 0
  private edges = 0
  private since = 0
  private period = 0
  private wasRunning = false
  private stepSamples = 0

  private restart(): void {
    this.phase = 0
    this.edges = 0
    this.count.fill(-1)
    for (const o of this.origin) o.fill(0)
  }

  /** Row (scale degree) → volts, from C3 up. */
  private volts(row: number, oct: number): number {
    const sc = SCALES[Math.round(this.p[this.P.scale])] ?? SCALES[0]
    const n = sc.length
    return (this.p[this.P.key] + 12 * Math.floor(row / n) + sc[row % n]) / 12 - 1 + oct
  }

  private note(l: number, row: number, vel: number): void {
    const L = this.L[l]
    const p = this.p
    this.sounds[l].play(Math.round(p[L.snd]), this.volts(row, p[L.oct]), row % 8, vel, Math.round(this.stepSamples * LT_RATE_STEPS[Math.round(p[L.rate])] * 0.9))
  }

  /** A layer's step `n`: what it plays depends on its mode. */
  private step(l: number, n: number): void {
    const L = this.L[l]
    const p = this.p
    const mode = Math.round(p[L.mode])
    const led = this.led
    const b = l * LTL.block
    if (mode === BOUNCE) {
      for (let x = 0; x < LT_SIZE; x++) {
        const h = top(p[L.cells[x]])
        if (h !== this.height[l][x]) {
          this.height[l][x] = h
          this.origin[l][x] = n
        }
        if (h < 0) continue
        const k = n - this.origin[l][x]
        if (h === 0 || k % (2 * h) === h) this.note(l, x, 0.8)
      }
      return
    }
    if (mode === RANDOM) {
      let lit = 0
      for (let x = 0; x < LT_SIZE; x++) for (let m = p[L.cells[x]]; m; m &= m - 1) lit++
      if (!lit) return
      let pick = Math.floor(this.rng.next() * lit)
      for (let x = 0; x < LT_SIZE; x++)
        for (let y = 0; y < LT_SIZE; y++) {
          if (((p[L.cells[x]] >>> y) & 1) === 0 || pick-- !== 0) continue
          this.note(l, y, 0.75)
          led[b + LTL.rx] = x
          led[b + LTL.ry] = y
        }
      return
    }
    // SCORE: the column under the playhead, as a chord (quieter the fuller it is)
    const x = n % Math.max(1, Math.round(p[L.len]))
    const mask = p[L.cells[x]]
    let notes = 0
    for (let m = mask; m; m &= m - 1) notes++
    for (let y = 0; y < LT_SIZE; y++) if ((mask >>> y) & 1) this.note(l, y, 0.85 / Math.sqrt(notes))
  }

  tick(): void {
    const { P } = this
    const i = this.in
    const p = this.p
    const external = this.patched[this.iClk] === 1
    const running = this.patched[this.iRun] ? i[this.iRun] > 1.2 : p[P.run] >= 0.5
    if ((running && !this.wasRunning) || this.rstIn.rise(i[this.iReset])) this.restart()
    this.wasRunning = running

    this.since++
    const edge = this.clkIn.rise(i[this.iClk])
    this.stepSamples = (15 / p[P.tempo]) * this.fs
    if (external) {
      if (edge) {
        if (this.since > 8 && this.since < this.fs * 4) this.period = this.since
        this.since = 0
        if (running) this.phase = this.edges++
      } else if (running && this.edges > 0 && this.period > 0) this.phase = Math.min(this.phase + 1 / this.period, this.edges - 1e-9)
      if (this.period > 0) this.stepSamples = this.period
    } else if (running) this.phase += p[P.tempo] / 15 / this.fs
    const live = running && (!external || this.edges > 0)

    let outL = 0
    let outR = 0
    const led = this.led
    for (let l = 0; l < LT_LAYERS; l++) {
      const L = this.L[l]
      const per = LT_RATE_STEPS[Math.round(p[L.rate])]
      const at = this.phase / per
      if (live && Math.floor(at) !== this.count[l]) {
        this.count[l] = Math.floor(at)
        this.step(l, this.count[l])
      }
      const b = l * LTL.block
      const mode = Math.round(p[L.mode])
      led[b + LTL.col] = live && mode === 0 ? this.count[l] % Math.max(1, Math.round(p[L.len])) : -1
      // ball heights, moving smoothly between steps
      for (let x = 0; x < LT_SIZE; x++) {
        const h = this.height[l][x]
        if (mode !== BOUNCE || h < 0 || !live) led[b + LTL.balls + x] = mode === BOUNCE ? top(p[L.cells[x]]) : -1
        else led[b + LTL.balls + x] = h === 0 ? 0 : Math.abs(((((at - this.origin[l][x]) % (2 * h)) + 2 * h) % (2 * h)) - h)
      }
      if (mode !== RANDOM) led[b + LTL.rx] = -1
      const y = this.sounds[l].step(Math.round(p[L.snd])) * p[L.vol]
      this.out[this.oLayer[l]] = y * 5
      outL += y * Math.sqrt(1 - PAN[l])
      outR += y * Math.sqrt(PAN[l])
    }
    const g = 6 * p[P.master]
    this.out[this.oL] = rails(Math.tanh(outL * 0.8) * g)
    this.out[this.oR] = rails(Math.tanh(outR * 0.8) * g)
  }
}
