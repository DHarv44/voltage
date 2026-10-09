import type { ModuleSpec } from '../../modules/types'
import { AR_PARTS, AR_SECTIONS, ARL } from '../../modules/specs/arranger'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'

const STEPS_PER_BAR = 16
const PULSE_S = 0.005

/** ARRANGER: counts 16ths through the song. PAT holds the section's pattern
 *  (centre of its 2.5 V band) and switches to the next section's on the last
 *  16th before it, so pattern modules cue it for the bar; the PART gates and
 *  SECTION switch on the bar itself. */
export class ArrangerDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oPat = this.oi('pat')
  private readonly oSec = this.oi('sec')
  private readonly oG0 = this.oi('g1')
  private readonly oChg = this.oi('chg')
  private readonly oEnd = this.oi('end')
  private readonly oBar = this.oi('bar')
  private readonly pTempo = this.pi('tempo')
  private readonly pLen = this.pi('len')
  private readonly pLoop = this.pi('loop')
  private readonly pRun = this.pi('run')
  private readonly pB0 = this.pi('b0')
  private readonly clock: PocketClock
  private section = -1
  private step = -1
  private done = false
  private chg = 0
  private end = 0
  private bar = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(STEPS_PER_BAR, fs)
  }

  private bars(k: number): number {
    return Math.max(1, Math.round(this.p[this.pB0 + k * 3]))
  }

  private advance(): void {
    const len = Math.max(1, Math.min(AR_SECTIONS, Math.round(this.p[this.pLen])))
    const pulse = Math.round(PULSE_S * this.fs)
    if (this.done) return
    this.step++
    if (this.section < 0 || this.section >= len || this.step >= this.bars(this.section) * STEPS_PER_BAR) {
      this.step = 0
      this.section++
      if (this.section >= len) {
        this.end = pulse
        if (this.p[this.pLoop] >= 0.5) this.section = 0
        else {
          this.done = true
          this.section = len - 1
          return
        }
      }
      this.chg = pulse
    }
    if (this.step % STEPS_PER_BAR === 0) this.bar = pulse
  }

  tick(): void {
    const p = this.p
    const running = p[this.pRun] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], 0, this.in[this.iRst])
    if (c.restarted || !running) {
      this.section = -1
      this.step = -1
      this.done = false
    }
    if (stepped) this.advance()
    const len = Math.max(1, Math.min(AR_SECTIONS, Math.round(p[this.pLen])))
    const k = this.section < 0 ? 0 : Math.min(this.section, len - 1)
    // on the last 16th of a section, PAT already says what comes next
    const last = this.section >= 0 && !this.done && this.step === this.bars(k) * STEPS_PER_BAR - 1
    const next = k + 1 >= len ? (p[this.pLoop] >= 0.5 ? 0 : k) : k + 1
    const pat = Math.round(p[this.pB0 + (last ? next : k) * 3 + 1])
    this.out[this.oPat] = pat * 2.5 + 1.25
    this.out[this.oSec] = (k * 10) / AR_SECTIONS
    const parts = this.section < 0 || this.done ? 0 : Math.round(p[this.pB0 + k * 3 + 2])
    for (let g = 0; g < AR_PARTS; g++) this.out[this.oG0 + g] = parts & (1 << g) ? 10 : 0
    this.out[this.oChg] = this.chg > 0 ? 10 : 0
    this.out[this.oEnd] = this.end > 0 ? 10 : 0
    this.out[this.oBar] = this.bar > 0 ? 10 : 0
    if (this.chg > 0) this.chg--
    if (this.end > 0) this.end--
    if (this.bar > 0) this.bar--
    this.led[ARL.section] = this.done ? -1 : this.section
    this.led[ARL.step] = this.step
  }
}
