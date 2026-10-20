import { SCL } from '../../../modules/specs/strudelFamily'
import { DRUM_OUTS } from '../../../strudel/music'
import type { ModuleSpec } from '../../../modules/types'
import { Dsp, MAX_VOICES } from '../base'
import { MAX_LANES, StrudelEngine } from './engine'
import { clampCpm, runHost, StrudelDsp, type StrudelHost, type StrudelTransport } from './index'

/** STRUDEL CORE: the engine with nothing on its panel but the code and the
 *  transport; PARTs and DRUMS take its notes over LINK. */
export class StrudelCoreDsp extends Dsp implements StrudelHost {
  readonly engine: StrudelEngine
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
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
    this.out[this.oClk] = e.clk
    this.out[this.oBar] = e.bar
    this.led[SCL.cycle] = this.p[this.P.run] >= 0.5 ? e.pos : -1
    this.led[SCL.error] = e.error ? 1 : 0
    this.led[SCL.parts] = e.laneCount
  }
}

/** The engine a peripheral's LINK leads to (a STRUDEL or a STRUDEL CORE), if any. */
function hostOf(d: Dsp, iLink: number): StrudelEngine | null {
  const m = d.srcMod[iLink]
  return m instanceof StrudelCoreDsp || m instanceof StrudelDsp ? m.engine : null
}

/** STRUDEL PART: one part of the linked piece on poly V/OCT, GATE, VEL and its filter CV. */
export class StrudelPartDsp extends Dsp {
  private readonly iLink = this.ii('link')
  private readonly oV = this.oi('v')
  private readonly oG = this.oi('g')
  private readonly oVel = this.oi('vel')
  private readonly oMod = this.oi('mod')
  private readonly pLane = this.pi('lane')

  link(): void {
    const m = this.srcMod[this.iLink]
    this.deps = m instanceof StrudelCoreDsp || m instanceof StrudelDsp ? [m] : null
  }

  tick(): void {
    const e = hostOf(this, this.iLink)
    const l = Math.max(0, Math.min(MAX_LANES - 1, Math.round(this.p[this.pLane]) - 1))
    const base = l * MAX_VOICES
    for (let v = 0; v < MAX_VOICES; v++) {
      this.pout(this.oV, v, e ? e.v[base + v] : 0)
      this.pout(this.oG, v, e ? e.gate[base + v] : 0)
      this.pout(this.oVel, v, e ? e.vel[base + v] : 0)
    }
    this.chans[this.oV] = MAX_VOICES
    this.chans[this.oG] = MAX_VOICES
    this.chans[this.oVel] = MAX_VOICES
    this.out[this.oMod] = e ? e.mod[l] : 0
    this.led[0] = e ? e.laneLit[l] : 0
    this.led[1] = e && l < e.laneCount ? 1 : 0
  }
}

/** STRUDEL DRUMS: the linked piece's drum sounds as triggers. */
export class StrudelDrumsDsp extends Dsp {
  private readonly iLink = this.ii('link')
  private readonly oDrum = Int32Array.from(DRUM_OUTS, (d) => this.oi(d))

  link(): void {
    const m = this.srcMod[this.iLink]
    this.deps = m instanceof StrudelCoreDsp || m instanceof StrudelDsp ? [m] : null
  }

  tick(): void {
    const e = hostOf(this, this.iLink)
    for (let d = 0; d < DRUM_OUTS.length; d++) {
      this.out[this.oDrum[d]] = e ? e.drum[d] : 0
      this.led[d] = e ? e.drumLit[d] : 0
    }
  }
}
