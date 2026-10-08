import { hasId, LANE, MOTION_BARS, MOTION_LANES, MOTION_POINTS, MOTION_RES, MOTL, pointId } from '../../modules/specs/motion'
import type { ModuleSpec } from '../../modules/types'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'

const STEPS_PER_BAR = 16

/** MOTION: the clock and the four lanes (see the spec). The page finds the
 *  knob a lane learns and streams its position here while recording ('arm',
 *  then 'val' events); the engine owns time, so the loop lands on the beat. */
export class MotionDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly pTempo = this.pi('tempo')
  private readonly pBars = this.pi('bars')
  private readonly pSmooth = this.pi('smooth')
  private readonly pHas = Int32Array.from({ length: MOTION_LANES }, (_, l) => this.pi(hasId(l)))
  private readonly pPoint = Int32Array.from({ length: MOTION_LANES * MOTION_POINTS }, (_, k) => this.pi(pointId(Math.floor(k / MOTION_POINTS), k % MOTION_POINTS)))
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  /** Position in 16th-note steps. */
  private pos = 0
  private steps = 0
  private since = 0
  private period = 0
  private readonly state = new Uint8Array(MOTION_LANES)
  private readonly live = new Float64Array(MOTION_LANES)
  /** Recording: how much of the loop is done (0..1), and the slot being written. */
  private readonly done = new Float64Array(MOTION_LANES)
  private readonly slot = new Int32Array(MOTION_LANES).fill(-1)
  private readonly outV = new Float64Array(MOTION_LANES)
  private lastPh = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.period = fs / 8
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    const l = Math.round(ev.x)
    if (l < 0 || l >= MOTION_LANES) return
    if (ev.name === 'arm') {
      if (ev.down) this.state[l] = LANE.armed
      else if (this.state[l] !== LANE.playing) this.state[l] = this.p[this.pHas[l]] >= 0.5 ? LANE.playing : LANE.empty
    } else if (ev.name === 'val') {
      this.live[l] = Math.min(1, Math.max(0, ev.y))
      if (this.state[l] === LANE.armed) {
        this.state[l] = LANE.recording
        this.done[l] = 0
        this.slot[l] = -1
      }
    } else if (ev.name === 'clear') {
      this.state[l] = LANE.empty
      this.writeParam(this.pHas[l], 0)
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    // time: 16ths from CLK (between edges, interpolated by the last period), else TEMPO
    if (this.patched[this.iClk]) {
      this.since++
      if (this.clk.rise(this.in[this.iClk])) {
        if (this.since > 8) this.period = this.since
        this.since = 0
        this.steps++
      }
      this.pos = this.steps + Math.min(0.999, this.since / this.period)
    } else {
      this.pos += (p[this.pTempo] / 60) * 4 / fs
      this.steps = Math.floor(this.pos)
    }
    if (this.rst.rise(this.in[this.iRst])) {
      this.pos = this.steps = 0
      this.since = 0
    }
    const len = Number(MOTION_BARS[Math.round(p[this.pBars])]) * STEPS_PER_BAR
    if (this.pos >= len * 64) {
      // keep the counter small; the loop position is unchanged
      this.pos -= len * 64
      this.steps -= len * 64
    }
    const ph = (this.pos % len) / len
    let dph = ph - this.lastPh
    if (dph < 0) dph += 1
    this.lastPh = ph

    const k = 1 - Math.exp(-1 / ((0.002 + p[this.pSmooth] * p[this.pSmooth] * 0.25) * fs))
    for (let l = 0; l < MOTION_LANES; l++) {
      let st = this.state[l]
      const has = p[this.pHas[l]] >= 0.5
      if (st === LANE.empty && has) st = this.state[l] = LANE.playing // loaded with the patch
      if (st === LANE.playing && !has) st = this.state[l] = LANE.empty
      let target = 0
      if (st === LANE.recording) {
        target = this.live[l]
        const s = Math.min(MOTION_POINTS - 1, Math.floor(ph * MOTION_POINTS))
        if (s !== this.slot[l]) {
          this.slot[l] = s
          this.writeParam(this.pPoint[l * MOTION_POINTS + s], Math.round(this.live[l] * MOTION_RES))
        }
        this.done[l] += dph
        if (this.done[l] >= 1) {
          this.writeParam(this.pHas[l], 1)
          this.state[l] = LANE.playing
        }
      } else if (has) {
        // straight lines between the points, round the loop
        const x = ph * MOTION_POINTS
        const i = Math.floor(x)
        const a = p[this.pPoint[l * MOTION_POINTS + i]]
        const b = p[this.pPoint[l * MOTION_POINTS + ((i + 1) % MOTION_POINTS)]]
        target = (a + (b - a) * (x - i)) / MOTION_RES
      } else target = this.outV[l]
      this.outV[l] += (target - this.outV[l]) * (st === LANE.recording ? 1 : k)
      this.out[l] = this.outV[l] * 10
      this.led[MOTL.value + l] = this.outV[l]
      this.led[MOTL.state + l] = this.state[l]
    }
    this.led[MOTL.head] = ph
  }
}
