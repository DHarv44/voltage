import { DRUM_OUTS } from '../../../strudel/music'
import { silence, stack, type Pattern } from '../../../strudel/pattern'
import { runStrudel } from '../../../strudel/run'
import { laneOut, ST_LANES, STL } from '../../../modules/specs/strudel'
import { Dsp, MAX_VOICES } from '../base'
import { Schmitt } from '../cores'
import { CycleEvents } from './events'

const RETRIG_S = 0.002
const PULSE_S = 0.005
const CLK_PER_CYCLE = 16

/** STRUDEL: see the spec. The code is run when it arrives (setText); each
 *  cycle its lanes are queried once into flat arrays, and tick walks them:
 *  drums to their triggers, notes to a lane's eight voices (the oldest
 *  stolen), each lane's MOD CV following its lpf / hpf. */
export class StrudelDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oV = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'v')))
  private readonly oG = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'g')))
  private readonly oVel = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'vel')))
  private readonly oMod = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'mod')))
  private readonly oDrum = Int32Array.from(DRUM_OUTS, (d) => this.oi(d))
  private readonly oClk = this.oi('clko')
  private readonly oBar = this.oi('baro')
  private readonly P = { cpm: this.pi('cpm'), run: this.pi('run'), gate: this.pi('gate'), oct: this.pi('oct') }
  private lanes: Pattern[] = []
  private readonly events = new CycleEvents()
  private cursor = 0
  private cycle = -1
  private pos = 0
  private wasRun = false
  private error = false
  /** Per lane × voice: the end (cycles), the start, a retrigger gap. */
  private readonly ends = new Float64Array(ST_LANES * MAX_VOICES).fill(-1)
  private readonly starts = new Float64Array(ST_LANES * MAX_VOICES)
  private readonly low = new Int32Array(ST_LANES * MAX_VOICES)
  private readonly modTarget = new Float32Array(ST_LANES).fill(-1)
  private readonly modNow = new Float32Array(ST_LANES)
  private readonly drumPulse = new Int32Array(DRUM_OUTS.length)
  private readonly laneLit = new Float32Array(ST_LANES)
  private readonly clkIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  private since = 0
  private period = 0
  private edges = 0
  private clkPulse = 0
  private barPulse = 0

  setText(code: string): void {
    const r = runStrudel(code)
    this.error = !!r.error
    if (r.error) return
    const layers = r.pattern.layers ?? [r.pattern]
    this.lanes = layers.length <= ST_LANES ? layers : [...layers.slice(0, ST_LANES - 1), stack(layers.slice(ST_LANES - 1))]
    while (this.lanes.length < ST_LANES) this.lanes.push(silence)
    // the code's tempo onto the knob (so the panel agrees); a cycle is a bar
    if (r.cpsSet) this.writeParam(this.P.cpm, Math.max(10, Math.min(120, r.cps * 60)))
    if (this.cycle >= 0) this.events.fill(this.lanes, this.cycle)
    this.cursor = this.events.n
    for (let i = 0; i < this.events.n; i++) if (this.events.t[i] > this.pos - this.cycle) {
      this.cursor = i
      break
    }
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

  private fire(i: number): void {
    const ev = this.events
    const d = ev.drum[i]
    if (d >= 0) {
      this.drumPulse[d] = Math.round(PULSE_S * this.fs)
      this.led[STL.drum0 + d] = 1
      return
    }
    const l = ev.lane[i]
    const v = this.voiceFor(l)
    const k = l * MAX_VOICES + v
    if (this.ends[k] >= this.pos - 0.0005) this.low[k] = Math.round(RETRIG_S * this.fs)
    this.ends[k] = this.pos + ev.dur[i] * this.p[this.P.gate]
    this.starts[k] = this.pos
    this.polyOut[this.oV[l]]![v] = (ev.note[i] - 60) / 12 + Math.round(this.p[this.P.oct])
    this.polyOut[this.oVel[l]]![v] = ev.vel[i] * 10
    if (ev.mod[i] >= 0) this.modTarget[l] = ev.mod[i]
    this.laneLit[l] = 1
  }

  tick(): void {
    const p = this.p
    const run = p[this.P.run] >= 0.5
    if ((run && !this.wasRun) || this.rstIn.rise(this.in[this.iRst])) this.restart()
    this.wasRun = run
    // the clock: cycles per minute, or CLK's 16 pulses a cycle with the gaps filled in
    const ext = this.patched[this.iClk] === 1
    this.since++
    if (ext && this.clkIn.rise(this.in[this.iClk])) {
      if (this.since > 8) this.period = this.since
      this.since = 0
      if (run) this.pos = this.edges++ / CLK_PER_CYCLE
    } else if (run) {
      if (!ext) this.pos += p[this.P.cpm] / 60 / this.fs
      else if (this.period > 0) this.pos = Math.min(this.pos + 1 / (CLK_PER_CYCLE * this.period), this.edges / CLK_PER_CYCLE)
    }
    const c = Math.floor(this.pos)
    if (run && c !== this.cycle) {
      this.cycle = c
      this.events.fill(this.lanes, c)
      this.cursor = 0
      this.barPulse = Math.round(PULSE_S * this.fs)
    }
    if (run && this.lanes.length) {
      const frac = this.pos - this.cycle
      const ev = this.events
      while (this.cursor < ev.n && ev.t[this.cursor] <= frac) this.fire(this.cursor++)
      const step = Math.floor(frac * CLK_PER_CYCLE)
      if (step !== this.lastStep) {
        this.lastStep = step
        this.clkPulse = Math.round(PULSE_S * this.fs)
      }
    }
    for (let l = 0; l < ST_LANES; l++) {
      const base = l * MAX_VOICES
      for (let v = 0; v < MAX_VOICES; v++) {
        const on = run && this.ends[base + v] > this.pos && this.low[base + v] <= 0
        if (this.low[base + v] > 0) this.low[base + v]--
        this.pout(this.oG[l], v, on ? 10 : 0)
        if (v === 0) {
          this.out[this.oV[l]] = this.polyOut[this.oV[l]]![0]
          this.out[this.oVel[l]] = this.polyOut[this.oVel[l]]![0]
        }
      }
      this.chans[this.oV[l]] = MAX_VOICES
      this.chans[this.oG[l]] = MAX_VOICES
      this.chans[this.oVel[l]] = MAX_VOICES
      if (this.modTarget[l] >= 0) this.modNow[l] += (this.modTarget[l] - this.modNow[l]) * 0.002
      this.out[this.oMod[l]] = this.modNow[l]
      this.laneLit[l] *= 0.9995
      this.led[STL.lane0 + l] = this.laneLit[l]
    }
    for (let d = 0; d < DRUM_OUTS.length; d++) {
      this.out[this.oDrum[d]] = this.drumPulse[d] > 0 ? 10 : 0
      if (this.drumPulse[d] > 0) this.drumPulse[d]--
      this.led[STL.drum0 + d] *= 0.999
    }
    this.out[this.oClk] = this.clkPulse > 0 ? 10 : 0
    this.out[this.oBar] = this.barPulse > 0 ? 10 : 0
    if (this.clkPulse > 0) this.clkPulse--
    if (this.barPulse > 0) this.barPulse--
    this.led[STL.cycle] = run ? this.pos : -1
    this.led[STL.error] = this.error ? 1 : 0
  }

  private lastStep = -1
}
