import { laneOut, ST_LANES, STL } from '../../../modules/specs/strudel'
import { DRUM_OUTS } from '../../../strudel/music'
import type { ModuleSpec } from '../../../modules/types'
import { Dsp, MAX_VOICES } from '../base'
import { StrudelEngine } from './engine'

/** The transport knobs STRUDEL and STRUDEL CORE share (`parts` is CORE's; STRUDEL has its six). */
export interface StrudelTransport {
  cpm: number
  run: number
  gate: number
  oct: number
  parts?: number
}

/** What a LINK peripheral needs from whichever it's patched to. */
export interface StrudelHost {
  engine: StrudelEngine
}

/** Advance a host's engine from its knobs and jacks (one place for both panels). */
export function runHost(d: Dsp, engine: StrudelEngine, P: StrudelTransport, iClk: number, iRst: number): void {
  const p = d.p
  engine.setParts(P.parts === undefined ? ST_LANES : p[P.parts])
  engine.tick(p[P.run] >= 0.5, p[P.cpm], p[P.gate], Math.round(p[P.oct]), d.patched[iClk] === 1, d.in[iClk], d.in[iRst])
}

/** The tempo the code set, kept within the knob's range. */
export const clampCpm = (cpm: number): number => Math.max(10, Math.min(120, cpm))

/** STRUDEL: see the spec. The engine, with the first six lanes and the drums on its own jacks. */
export class StrudelDsp extends Dsp implements StrudelHost {
  readonly engine: StrudelEngine
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oV = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'v')))
  private readonly oG = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'g')))
  private readonly oVel = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'vel')))
  private readonly oMod = Int32Array.from({ length: ST_LANES }, (_, l) => this.oi(laneOut(l, 'mod')))
  private readonly oDrum = Int32Array.from(DRUM_OUTS, (d) => this.oi(d))
  private readonly oClk = this.oi('clko')
  private readonly oBar = this.oi('baro')
  private readonly P: StrudelTransport = { cpm: this.pi('cpm'), run: this.pi('run'), gate: this.pi('gate'), oct: this.pi('oct') }

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.engine = new StrudelEngine(fs)
  }

  setText(code: string): void {
    const cpm = this.engine.setCode(code)
    if (cpm !== null) this.writeParam(this.P.cpm, clampCpm(cpm))
  }

  tick(): void {
    runHost(this, this.engine, this.P, this.iClk, this.iRst)
    const e = this.engine
    for (let l = 0; l < ST_LANES; l++) {
      const base = l * MAX_VOICES
      for (let v = 0; v < MAX_VOICES; v++) {
        this.pout(this.oV[l], v, e.v[base + v])
        this.pout(this.oG[l], v, e.gate[base + v])
        this.pout(this.oVel[l], v, e.vel[base + v])
      }
      this.chans[this.oV[l]] = MAX_VOICES
      this.chans[this.oG[l]] = MAX_VOICES
      this.chans[this.oVel[l]] = MAX_VOICES
      this.out[this.oMod[l]] = e.mod[l]
      this.led[STL.lane0 + l] = e.laneLit[l]
    }
    for (let d = 0; d < DRUM_OUTS.length; d++) {
      this.out[this.oDrum[d]] = e.drum[d]
      this.led[STL.drum0 + d] = e.drumLit[d]
    }
    this.out[this.oClk] = e.clk
    this.out[this.oBar] = e.bar
    this.led[STL.cycle] = this.p[this.P.run] >= 0.5 ? e.pos : -1
    this.led[STL.error] = e.error ? 1 : 0
  }
}
