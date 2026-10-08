import type { UiEvent } from '../../protocol'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { swungPos } from '../lockstep/tables'
import { SCALES } from '../shapers'
import { rails } from '../util'
import {
  BOUNCE,
  cellId,
  DRAW,
  drawId,
  drawLenId,
  HOLD,
  LT_BAR,
  LT_DRAW,
  LT_LAYERS,
  LT_OUTS,
  LT_PAGE_LED,
  LT_PAGE_VOLTS,
  LT_PAGES,
  LT_RATE_STEPS,
  LT_SIZE,
  LTL,
  RANDOM,
  SCORE,
  SOLO,
} from '../../../modules/specs/latticeDefs'
import { LayerSound } from './sounds'
import { TraceRecorder } from './trace'

/** Each layer's place in the stereo field. */
const PAN = [0.35, 0.65, 0.5, 0.42, 0.25, 0.75, 0.58, 0.45]
/** A note played by hand rings this long at most (until the finger lifts). */
const SOLO_HOLD_S = 20

/** The highest lit row of a column (−1: none). */
function top(mask: number): number {
  for (let y = LT_SIZE - 1; y >= 0; y--) if ((mask >>> y) & 1) return y
  return -1
}

/** LATTICE: a master clock in 16ths (TEMPO or CLK in, gaps filled in); each
 *  layer steps at its RATE, swung by its SWING. SCORE plays the playhead's
 *  column as a chord, BOUNCE drops a ball in every column from its lit cell
 *  (a note each time it lands), RANDOM plays one lit dot at random per step,
 *  HOLD holds every lit dot (struck again each LOOP), SOLO plays what the
 *  hand presses, DRAW loops a traced path. Row → scale degree (SCALE in KEY,
 *  then the layer's OCTAVE); on DRUMS, row → the kit's sound. */
export class LatticeDsp extends Dsp {
  private iClk = this.ii('clk')
  private iRun = this.ii('run')
  private iReset = this.ii('reset')
  private oLayer = Array.from({ length: LT_OUTS }, (_, k) => this.oi(`o${k + 1}`))
  private oL = this.oi('l')
  private oR = this.oi('r')
  private iPage = this.ii('page')
  private P = { run: this.pi('run'), tempo: this.pi('tempo'), scale: this.pi('scale'), key: this.pi('key'), master: this.pi('master'), page: this.pi('page') }
  /** Each layer's settings, and per page its lights ([page][column]) and trace. */
  private L = Array.from({ length: LT_LAYERS }, (_, l) => ({
    mode: this.pi(`mode${l}`),
    snd: this.pi(`snd${l}`),
    oct: this.pi(`oct${l}`),
    len: this.pi(`len${l}`),
    rate: this.pi(`rate${l}`),
    vol: this.pi(`vol${l}`),
    swing: this.pi(`swing${l}`),
    cells: LT_PAGES.map((_, pg) => Int32Array.from({ length: LT_SIZE }, (_, x) => this.pi(cellId(l, x, pg)))),
    dlen: Int32Array.from(LT_PAGES, (_, pg) => this.pi(drawLenId(l, pg))),
    draw: LT_PAGES.map((_, pg) => Int32Array.from({ length: LT_DRAW }, (_, i) => this.pi(drawId(l, i, pg)))),
  }))
  /** The page playing, and where the current bar began (a new page waits for the next). */
  private pg = 0
  private bar = 0

  private readonly sounds = Array.from({ length: LT_LAYERS }, () => new LayerSound(this.fs, this.rng))
  /** Each layer's step count since PLAY (−1: not started). */
  private readonly count = new Float64Array(LT_LAYERS).fill(-1)
  /** BOUNCE: each column's height, and the step its ball was dropped. */
  private readonly height = Array.from({ length: LT_LAYERS }, () => new Int32Array(LT_SIZE).fill(-1))
  private readonly origin = Array.from({ length: LT_LAYERS }, () => new Float64Array(LT_SIZE))
  /** HOLD: the dots already sounding this loop, per column. */
  private readonly held = Array.from({ length: LT_LAYERS }, () => new Int32Array(LT_SIZE))
  /** DRAW: the step its loop starts from; SOLO: notes played (for the ripples). */
  private readonly drawFrom = new Float64Array(LT_LAYERS)
  private readonly solos = new Float64Array(LT_LAYERS)
  private readonly rec = new TraceRecorder()
  private readonly masks = new Int32Array(LT_SIZE)
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
    this.drawFrom.fill(0)
    for (const o of this.origin) o.fill(0)
    for (const h of this.held) h.fill(0)
    this.bar = 0
    this.pg = this.cued()
  }

  /** The page picked (by the buttons or PAGE in). */
  private cued(): number {
    return Math.max(0, Math.min(LT_PAGES.length - 1, Math.round(this.p[this.P.page])))
  }

  /** A new page from the next step: HOLD strikes its dots afresh, traces start over. */
  private turnTo(pg: number): void {
    this.pg = pg
    for (const h of this.held) h.fill(0)
    for (let l = 0; l < LT_LAYERS; l++) this.drawFrom[l] = this.count[l] + 1
  }

  /** The hand on the lights: SOLO plays, DRAW records (x: layer × 16 + column,
   *  y: row, −1 off the lights). */
  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    const l = Math.floor(ev.x / LT_SIZE)
    if (l < 0 || l >= LT_LAYERS) return
    const col = ev.x % LT_SIZE
    if (ev.name === 'solo') {
      this.sounds[l].releaseAll()
      if (!ev.down || ev.y < 0) return
      this.note(l, ev.y, 0.35 + (0.6 * col) / (LT_SIZE - 1), SOLO_HOLD_S * this.fs)
      this.show(l, col, ev.y)
      this.solos[l]++
    } else if (ev.name === 'draw') {
      const cell = ev.y < 0 ? -1 : col * LT_SIZE + ev.y
      if (!ev.down) {
        if (this.rec.layer === l) this.finish()
      } else if (this.rec.layer !== l) {
        this.rec.begin(l, cell)
        if (cell >= 0) {
          this.note(l, ev.y, 0.8)
          this.show(l, col, ev.y)
        }
      } else this.rec.cell = cell
    }
  }

  /** The trace is done: keep it on the page picked (and light its cells),
   *  loop it from the next step. */
  private finish(): void {
    const l = this.rec.layer
    const L = this.L[l]
    const pg = this.cued()
    const { buf, len } = this.rec
    this.masks.fill(0)
    for (let i = 0; i < LT_DRAW; i++) {
      const v = i < len ? buf[i] : 0
      this.writeParam(L.draw[pg][i], v)
      if (v > 0) this.masks[Math.floor((v - 1) / LT_SIZE)] |= 1 << (v - 1) % LT_SIZE
    }
    this.writeParam(L.dlen[pg], len)
    for (let x = 0; x < LT_SIZE; x++) this.writeParam(L.cells[pg][x], this.masks[x])
    this.drawFrom[l] = this.count[l] + 1
    this.rec.layer = -1
  }

  private show(l: number, x: number, y: number): void {
    const b = l * LTL.block
    this.led[b + LTL.rx] = x
    this.led[b + LTL.ry] = y
  }

  /** Row (scale degree) → volts, from C3 up. */
  private volts(row: number, oct: number): number {
    const sc = SCALES[Math.round(this.p[this.P.scale])] ?? SCALES[0]
    const n = sc.length
    return (this.p[this.P.key] + 12 * Math.floor(row / n) + sc[row % n]) / 12 - 1 + oct
  }

  private stepOf(l: number): number {
    return this.stepSamples * LT_RATE_STEPS[Math.round(this.p[this.L[l].rate])]
  }

  private note(l: number, row: number, vel: number, hold = this.stepOf(l) * 0.9): void {
    const L = this.L[l]
    const p = this.p
    this.sounds[l].play(Math.round(p[L.snd]), this.volts(row, p[L.oct]), row % 8, vel, Math.round(hold))
  }

  /** A layer's step `n`: what it plays depends on its mode. */
  private step(l: number, n: number): void {
    const L = this.L[l]
    const p = this.p
    const mode = Math.round(p[L.mode])
    const cells = L.cells[this.pg]
    if (mode === BOUNCE) {
      for (let x = 0; x < LT_SIZE; x++) {
        const h = top(p[cells[x]])
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
      for (let x = 0; x < LT_SIZE; x++) for (let m = p[cells[x]]; m; m &= m - 1) lit++
      if (!lit) return
      let pick = Math.floor(this.rng.next() * lit)
      for (let x = 0; x < LT_SIZE; x++)
        for (let y = 0; y < LT_SIZE; y++) {
          if (((p[cells[x]] >>> y) & 1) === 0 || pick-- !== 0) continue
          this.note(l, y, 0.75)
          this.show(l, x, y)
        }
      return
    }
    const len = Math.max(1, Math.round(p[L.len]))
    if (mode === HOLD) {
      // each loop strikes every lit dot, held to the loop's end; dots lit meanwhile join in
      const k = n % len
      const hold = this.stepOf(l) * (len - k)
      for (let x = 0; x < LT_SIZE; x++) {
        const mask = p[cells[x]]
        const fresh = k === 0 ? mask : mask & ~this.held[l][x]
        this.held[l][x] = mask
        for (let y = 0; y < LT_SIZE; y++) if ((fresh >>> y) & 1) this.note(l, y, 0.55, hold)
      }
      return
    }
    if (mode === DRAW) {
      const dl = Math.round(p[L.dlen[this.pg]])
      if (this.rec.layer === l || dl === 0) return
      const i = (((n - this.drawFrom[l]) % dl) + dl) % dl
      const v = p[L.draw[this.pg][i]]
      if (v <= 0) return
      const c = v - 1
      this.note(l, c % LT_SIZE, 0.8)
      this.show(l, Math.floor(c / LT_SIZE), c % LT_SIZE)
      return
    }
    if (mode !== SCORE) return // SOLO: played by hand
    // SCORE: the column under the playhead, as a chord (quieter the fuller it is)
    const x = n % len
    const mask = p[cells[x]]
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

    // PAGE in picks the page (the face follows); a new page waits for the bar
    if (this.patched[this.iPage]) {
      const want = Math.max(0, Math.min(LT_PAGES.length - 1, Math.floor(i[this.iPage] / LT_PAGE_VOLTS)))
      if (want !== Math.round(p[P.page])) this.writeParam(P.page, want)
    }
    const want = this.cued()
    if (running) {
      while (this.phase - this.bar >= LT_BAR) {
        this.bar += LT_BAR
        if (want !== this.pg) this.turnTo(want)
      }
    } else if (want !== this.pg) this.turnTo(want)
    this.led[LT_PAGE_LED] = this.pg

    // DRAW: the trace in progress takes a cell each step of its layer
    const r = this.rec.layer
    if (r >= 0) {
      const c = this.rec.advance(1 / this.stepOf(r))
      if (c >= 0) {
        this.note(r, c % LT_SIZE, 0.8)
        this.show(r, Math.floor(c / LT_SIZE), c % LT_SIZE)
      }
      if (this.rec.full) this.finish()
    }

    let outL = 0
    let outR = 0
    const led = this.led
    for (let l = 0; l < LT_LAYERS; l++) {
      const L = this.L[l]
      const per = LT_RATE_STEPS[Math.round(p[L.rate])]
      const at = swungPos(this.phase / per, p[L.swing])
      if (live && Math.floor(at) !== this.count[l]) {
        this.count[l] = Math.floor(at)
        this.step(l, this.count[l])
      }
      const b = l * LTL.block
      const mode = Math.round(p[L.mode])
      const len = Math.max(1, Math.round(p[L.len]))
      led[b + LTL.col] = mode === SOLO ? this.solos[l] : live && (mode === SCORE || mode === HOLD) ? this.count[l] % len : -1
      // ball heights, moving smoothly between steps
      for (let x = 0; x < LT_SIZE; x++) {
        const h = this.height[l][x]
        if (mode !== BOUNCE || h < 0 || !live) led[b + LTL.balls + x] = mode === BOUNCE ? top(p[L.cells[this.pg][x]]) : -1
        else led[b + LTL.balls + x] = h === 0 ? 0 : Math.abs(((((at - this.origin[l][x]) % (2 * h)) + 2 * h) % (2 * h)) - h)
      }
      if (mode !== RANDOM && mode !== SOLO && mode !== DRAW) led[b + LTL.rx] = -1
      const y = this.sounds[l].step(Math.round(p[L.snd])) * p[L.vol]
      if (l < LT_OUTS) this.out[this.oLayer[l]] = y * 5
      outL += y * Math.sqrt(1 - PAN[l])
      outR += y * Math.sqrt(PAN[l])
    }
    const g = 6 * p[P.master]
    this.out[this.oL] = rails(Math.tanh(outL * 0.8) * g)
    this.out[this.oR] = rails(Math.tanh(outR * 0.8) * g)
  }
}
