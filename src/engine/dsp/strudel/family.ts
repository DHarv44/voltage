import { SCL, slotOut, slotParam } from '../../../modules/specs/strudelFamily'
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
  private readonly P: StrudelTransport = { cpm: this.pi('cpm'), run: this.pi('run'), gate: this.pi('gate'), oct: this.pi('oct'), parts: this.pi('parts') }

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.engine = new StrudelEngine(fs)
    this.engine.setParts(this.p[this.P.parts!])
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

/** A part's jacks on a peripheral: poly V/OCT, GATE, VEL and its MOD. */
interface LaneOuts {
  v: number
  g: number
  vel: number
  mod: number
}

/** A peripheral on a host's LINK: runs after it, and can put any of its lanes on a set of jacks. */
abstract class LinkedDsp extends Dsp {
  protected readonly iLink = this.ii('link')

  link(): void {
    const m = this.srcMod[this.iLink]
    this.deps = m instanceof StrudelCoreDsp || m instanceof StrudelDsp ? [m] : null
  }

  protected host(): StrudelEngine | null {
    return hostOf(this, this.iLink)
  }

  /** Put part `lane` (1-based) of the host (or silence) on the jacks; returns its lit level. */
  protected emitLane(e: StrudelEngine | null, lane: number, o: LaneOuts): number {
    const l = Math.max(0, Math.min(MAX_LANES - 1, Math.round(lane) - 1))
    const base = l * MAX_VOICES
    for (let v = 0; v < MAX_VOICES; v++) {
      this.pout(o.v, v, e ? e.v[base + v] : 0)
      this.pout(o.g, v, e ? e.gate[base + v] : 0)
      this.pout(o.vel, v, e ? e.vel[base + v] : 0)
    }
    this.chans[o.v] = MAX_VOICES
    this.chans[o.g] = MAX_VOICES
    this.chans[o.vel] = MAX_VOICES
    this.out[o.mod] = e ? e.mod[l] : 0
    return e ? e.laneLit[l] : 0
  }
}

/** STRUDEL PART: one part of the linked piece on poly V/OCT, GATE, VEL and its filter CV. */
export class StrudelPartDsp extends LinkedDsp {
  private readonly o: LaneOuts = { v: this.oi('v'), g: this.oi('g'), vel: this.oi('vel'), mod: this.oi('mod') }
  private readonly pLane = this.pi('lane')

  tick(): void {
    const e = this.host()
    this.led[0] = this.emitLane(e, this.p[this.pLane], this.o)
    this.led[1] = e && Math.round(this.p[this.pLane]) <= e.laneCount ? 1 : 0
  }
}

/** STRUDEL PARTS ×4: four parts on one panel. */
export class StrudelPartsDsp extends LinkedDsp {
  private readonly o: LaneOuts[] = [0, 1, 2, 3].map((s) => ({ v: this.oi(slotOut(s, 'v')), g: this.oi(slotOut(s, 'g')), vel: this.oi(slotOut(s, 'vel')), mod: this.oi(slotOut(s, 'mod')) }))
  private readonly pLane = Int32Array.from([0, 1, 2, 3], (s) => this.pi(slotParam(s)))

  tick(): void {
    const e = this.host()
    for (let s = 0; s < 4; s++) this.led[s] = this.emitLane(e, this.p[this.pLane[s]], this.o[s])
  }
}

/** STRUDEL DRUMS: the linked piece's drum sounds as triggers. */
export class StrudelDrumsDsp extends LinkedDsp {
  private readonly oDrum = Int32Array.from(DRUM_OUTS, (d) => this.oi(d))

  tick(): void {
    const e = this.host()
    for (let d = 0; d < DRUM_OUTS.length; d++) {
      this.out[this.oDrum[d]] = e ? e.drum[d] : 0
      this.led[d] = e ? e.drumLit[d] : 0
    }
  }
}
