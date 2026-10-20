import { planLanes, type LanePlan } from '../../../strudel/lanes'
import { DRUM_OUTS } from '../../../strudel/music'
import { runStrudel } from '../../../strudel/run'
import { MAX_VOICES } from '../base'
import { Schmitt } from '../cores'
import { CycleEvents } from './events'

/** Parts a piece can be split into (STRUDEL's panel shows the first six; PARTs reach them all). */
export const MAX_LANES = 16
const RETRIG_S = 0.002
const PULSE_S = 0.005
const CLK_PER_CYCLE = 16

/** The Strudel engine shared by STRUDEL and STRUDEL CORE (and read by their
 *  PARTs and DRUMS over LINK): runs the code when it arrives, queries each
 *  cycle once into flat arrays, and walks them sample by sample: drums to
 *  trigger pulses, notes to a lane's eight voices (the oldest stolen), each
 *  lane's MOD following its lpf / hpf. Everything a panel needs is a field. */
export class StrudelEngine {
  plan: LanePlan | null = null
  error = false
  pos = 0
  cycle = -1
  /** Per lane × voice: volts, velocity (V), gate (0 / 10). */
  readonly v = new Float64Array(MAX_LANES * MAX_VOICES)
  readonly vel = new Float64Array(MAX_LANES * MAX_VOICES)
  readonly gate = new Float64Array(MAX_LANES * MAX_VOICES)
  readonly mod = new Float32Array(MAX_LANES)
  readonly laneLit = new Float32Array(MAX_LANES)
  readonly drum = new Float64Array(DRUM_OUTS.length)
  readonly drumLit = new Float32Array(DRUM_OUTS.length)
  clk = 0
  bar = 0
  private readonly events = new CycleEvents()
  private code = ''
  private parts = MAX_LANES
  private cursor = 0
  private wasRun = false
  private readonly ends = new Float64Array(MAX_LANES * MAX_VOICES).fill(-1)
  private readonly starts = new Float64Array(MAX_LANES * MAX_VOICES)
  private readonly low = new Int32Array(MAX_LANES * MAX_VOICES)
  private readonly modTarget = new Float32Array(MAX_LANES).fill(-1)
  private readonly drumPulse = new Int32Array(DRUM_OUTS.length)
  private readonly clkIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  private since = 0
  private period = 0
  private edges = 0
  private clkPulse = 0
  private barPulse = 0
  private lastStep = -1

  constructor(private readonly fs: number) {}

  /** Split the piece into this many parts (the rest share the last); re-plans when it changes. */
  setParts(n: number): void {
    const parts = Math.max(1, Math.min(MAX_LANES, Math.round(n)))
    if (parts === this.parts) return
    this.parts = parts
    if (this.code) this.setCode(this.code)
  }

  /** Run new code. Returns the tempo it set (cycles a minute), or null. */
  setCode(code: string): number | null {
    this.code = code
    const r = runStrudel(code)
    this.error = !!r.error
    if (r.error) return null
    this.plan = planLanes(r, this.parts)
    if (this.cycle >= 0) {
      this.events.fill(this.plan, this.cycle)
      const frac = this.pos - this.cycle
      this.cursor = this.events.n
      for (let i = 0; i < this.events.n; i++)
        if (this.events.t[i] > frac) {
          this.cursor = i
          break
        }
    }
    return r.cpsSet ? r.cps * 60 : null
  }

  get laneCount(): number {
    return this.plan ? (this.plan.byName ? this.plan.names.length : this.plan.pats.length) : 0
  }

  laneName(l: number): string {
    return this.plan?.names[l] ?? ''
  }

  private restart(): void {
    this.cycle = -1
    this.pos = 0
    this.edges = 0
    this.ends.fill(-1)
  }

  private voiceFor(l: number): number {
    const base = l * MAX_VOICES
    let v = -1
    let oldest = Infinity
    for (let k = 0; k < MAX_VOICES; k++) {
      if (this.ends[base + k] < this.pos) return k
      if (this.starts[base + k] < oldest) {
        oldest = this.starts[base + k]
        v = k
      }
    }
    this.low[base + v] = Math.round(RETRIG_S * this.fs)
    return v
  }

  private fire(i: number, gateFrac: number, oct: number): void {
    const ev = this.events
    const d = ev.drum[i]
    if (d >= 0) {
      this.drumPulse[d] = Math.round(PULSE_S * this.fs)
      this.drumLit[d] = 1
      return
    }
    const l = ev.lane[i]
    if (l >= MAX_LANES) return
    const v = this.voiceFor(l)
    const k = l * MAX_VOICES + v
    if (this.ends[k] >= this.pos - 0.0005) this.low[k] = Math.round(RETRIG_S * this.fs)
    this.ends[k] = this.pos + ev.dur[i] * gateFrac
    this.starts[k] = this.pos
    this.v[k] = (ev.note[i] - 60) / 12 + oct
    this.vel[k] = ev.vel[i] * 10
    if (ev.mod[i] >= 0) this.modTarget[l] = ev.mod[i]
    this.laneLit[l] = 1
  }

  /** One sample. CLK's 16 pulses make a cycle when `ext`; else `cpm` does. */
  tick(run: boolean, cpm: number, gateFrac: number, oct: number, ext: boolean, clkV: number, rstV: number): void {
    if ((run && !this.wasRun) || this.rstIn.rise(rstV)) this.restart()
    this.wasRun = run
    this.since++
    if (ext && this.clkIn.rise(clkV)) {
      if (this.since > 8) this.period = this.since
      this.since = 0
      if (run) this.pos = this.edges++ / CLK_PER_CYCLE
    } else if (run) {
      if (!ext) this.pos += cpm / 60 / this.fs
      else if (this.period > 0) this.pos = Math.min(this.pos + 1 / (CLK_PER_CYCLE * this.period), this.edges / CLK_PER_CYCLE)
    }
    const c = Math.floor(this.pos)
    if (run && c !== this.cycle) {
      this.cycle = c
      if (this.plan) this.events.fill(this.plan, c)
      else this.events.n = 0
      this.cursor = 0
      this.barPulse = Math.round(PULSE_S * this.fs)
    }
    if (run && this.plan) {
      const frac = this.pos - this.cycle
      const ev = this.events
      while (this.cursor < ev.n && ev.t[this.cursor] <= frac) this.fire(this.cursor++, gateFrac, oct)
      const step = Math.floor(frac * CLK_PER_CYCLE)
      if (step !== this.lastStep) {
        this.lastStep = step
        this.clkPulse = Math.round(PULSE_S * this.fs)
      }
    }
    for (let k = 0; k < MAX_LANES * MAX_VOICES; k++) {
      const on = run && this.ends[k] > this.pos && this.low[k] <= 0
      if (this.low[k] > 0) this.low[k]--
      this.gate[k] = on ? 10 : 0
    }
    for (let l = 0; l < MAX_LANES; l++) {
      if (this.modTarget[l] >= 0) this.mod[l] += (this.modTarget[l] - this.mod[l]) * 0.002
      this.laneLit[l] *= 0.9995
    }
    for (let d = 0; d < DRUM_OUTS.length; d++) {
      this.drum[d] = this.drumPulse[d] > 0 ? 10 : 0
      if (this.drumPulse[d] > 0) this.drumPulse[d]--
      this.drumLit[d] *= 0.999
    }
    this.clk = this.clkPulse > 0 ? 10 : 0
    this.bar = this.barPulse > 0 ? 10 : 0
    if (this.clkPulse > 0) this.clkPulse--
    if (this.barPulse > 0) this.barPulse--
  }
}
