import { COMBO_PARTS } from '../../../modules/specs/combo/params'
import { FS_STOMPS, FSL, LPL } from '../../../modules/specs/combo/peripherals'
import type { ModuleSpec } from '../../../modules/types'
import type { UiEvent } from '../../protocol'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { ComboCoreDsp } from './coreDsp'
import { L_DUB, L_NONE, L_PLAY, L_REC, PartLooper } from './partLooper'

/** FOOTSWITCH: three stomps that work the COMBO (or CORE) on its LINK. */
export class ComboFsDsp extends Dsp {
  private readonly iLink = this.ii('link')
  private readonly down = new Uint8Array(3)

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'pad' || ev.index < 0 || ev.index > 2) return
    this.down[ev.index] = ev.down ? 1 : 0
    const core = this.srcMod[this.iLink]
    if (core instanceof ComboCoreDsp) core.footswitch(FS_STOMPS[ev.index], ev.down)
  }

  tick(): void {
    for (let k = 0; k < 3; k++) this.out[k] = this.down[k] ? 10 : 0
    const core = this.srcMod[this.iLink]
    const c = core instanceof ComboCoreDsp ? core : null
    this.led[FSL.band] = c && c.band.playing ? 0.35 + 0.65 * (1 - (c.band.pos % 1)) : this.down[0]
    this.led[FSL.loop] = this.down[1]
    this.led[FSL.part] = c && c.band.cued >= 0 ? 1 : this.down[2]
  }
}

/** LOOPER: a loop for each part of the band on its LINK (see PartLooper);
 *  unlinked, a free looper on one loop. */
export class ComboLooperDsp extends Dsp {
  private readonly looper: PartLooper
  private readonly iIn = this.ii('in')
  private readonly iLink = this.ii('link')
  private readonly iLoop = this.ii('loop')
  private readonly pLoop = this.pi('loopl')
  private readonly pDry = this.pi('dry')
  private readonly pStretch = this.pi('stretch')
  private readonly pLt = Array.from({ length: COMBO_PARTS }, (_, i) => this.pi(`lt${i}`))
  private readonly loopIn = new Schmitt()
  private seen = -1

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.looper = new PartLooper(fs)
  }

  private core(): ComboCoreDsp | null {
    const c = this.srcMod[this.iLink]
    return c instanceof ComboCoreDsp ? c : null
  }

  private part(): number {
    return this.core()?.loopPart() ?? 0
  }

  private press(): void {
    const c = this.core()
    const p = this.part()
    const beats = c ? c.partBeats(p) : 0
    const samples = c && c.band.playing && beats > 0 ? Math.round(((beats * 60) / Math.max(1, c.bpmNow)) * this.fs) : 0
    if (this.looper.press(p, samples, c ? c.bpmNow : 0)) this.save(p)
  }

  private save(p: number): void {
    const d = this.looper.data(p)
    if (!d) return
    this.bufferOut.push({ slot: p, rate: this.fs, data: d })
    this.writeParam(this.pLt[p], this.looper.bpm[p])
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'button' || !ev.down) return
    const p = this.part()
    if (ev.name === 'loop') this.press()
    else if (ev.name === 'undo' && this.looper.undo(p)) this.save(p)
    else if (ev.name === 'clear') {
      this.looper.clear(p)
      this.bufferOut.push({ slot: p, rate: this.fs, data: new Float32Array(0) })
      this.writeParam(this.pLt[p], 0)
    }
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot >= 0 && slot < COMBO_PARTS && rate === this.fs) this.looper.load(slot, data, this.p[this.pLt[slot]])
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    const d = this.looper.data(slot)
    return d ? { rate: this.fs, data: d.slice() } : null
  }

  tick(): void {
    const c = this.core()
    if (this.loopIn.rise(this.in[this.iLoop])) this.press()
    // the FOOTSWITCH's LOOPER stomp (counted on the core)
    if (c) {
      if (this.seen < 0) this.seen = c.loopPresses
      else if (c.loopPresses !== this.seen) {
        this.seen = c.loopPresses
        this.press()
      }
    }
    const p = this.part()
    const beats = c ? c.partBeats(p) : 0
    const phase = c && c.band.playing && beats > 0 ? Math.max(0, Math.min(0.999999, c.band.pos / beats)) : -1
    const x = this.in[this.iIn]
    const loop = this.looper.step(p, x, phase, c ? c.bpmNow : 0, this.p[this.pStretch] >= 0.5) * this.p[this.pLoop]
    if (this.looper.closed >= 0) {
      this.save(this.looper.closed)
      this.looper.closed = -1
    }
    this.out[0] = loop
    this.out[1] = x * this.p[this.pDry] + loop
    for (let i = 0; i < COMBO_PARTS; i++) this.led[LPL.loops + i] = this.looper.state[i] === L_NONE ? 0 : this.looper.state[i] === L_REC ? 1 : 0.5
    const st = this.looper.state[p]
    this.led[LPL.button] = st === L_REC ? 1 : st === L_DUB ? 0.8 : st === L_PLAY ? 0.4 : 0
  }
}
