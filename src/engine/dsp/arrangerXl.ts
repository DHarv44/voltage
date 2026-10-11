import type { ModuleSpec } from '../../modules/types'
import { XL_FADE_BARS, XL_FIELDS, XL_PARTS, XL_SECTIONS, XLL } from '../../modules/specs/arrangerXl'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'

const STEPS_PER_BAR = 16
const PULSE_S = 0.005
const FIELDS = XL_FIELDS.length
const [B, P, M, X, T, S, C] = [0, 1, 2, 3, 4, 5, 6]
const FADE = 1
const BUILD = 2
const DROP = 3
/** A part switching on or off still glides this long (no clicks). */
const SNAP_S = 0.004

/** ARRANGER XL: counts 16ths through the song (its own clock at each
 *  section's tempo, or CLK). PAT changes a 16th early so pattern modules cue
 *  it for the bar; gates, levels, KEY and SCENE change on the bar. A FADE
 *  section glides its parts in (and the section before it glides out the
 *  parts it drops) over FADE bars; before a BUILD or DROP, FILL and RAMP mark
 *  the last bar, and before a DROP its last beat falls silent. */
export class ArrangerXlDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly O = {
    clko: this.oi('clko'),
    rsto: this.oi('rsto'),
    bar: this.oi('bar'),
    chg: this.oi('chg'),
    end: this.oi('end'),
    pat: this.oi('pat'),
    sec: this.oi('sec'),
    scene: this.oi('scene'),
    trans: this.oi('trans'),
    fill: this.oi('fill'),
    ramp: this.oi('ramp'),
    g0: this.oi('g1'),
    l0: this.oi('l1'),
  }
  private readonly pTempo = this.pi('tempo')
  private readonly pLen = this.pi('len')
  private readonly pFade = this.pi('fade')
  private readonly pLoop = this.pi('loop')
  private readonly pRun = this.pi('run')
  private readonly pS0 = this.pi('b0')
  private readonly clock: PocketClock
  private section = -1
  private step = -1
  private sinceStep = 0
  private done = false
  private chg = 0
  private end = 0
  private bar = 0
  private scene = 0
  private readonly level = new Float64Array(XL_PARTS)

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(STEPS_PER_BAR, fs)
  }

  private f(k: number, field: number): number {
    return Math.round(this.p[this.pS0 + k * FIELDS + field])
  }

  private len(): number {
    return Math.max(1, Math.min(XL_SECTIONS, Math.round(this.p[this.pLen])))
  }

  private stepsIn(k: number): number {
    return Math.max(1, this.f(k, B)) * STEPS_PER_BAR
  }

  /** The section after k (−1: the song ends there). */
  private nextOf(k: number): number {
    return k + 1 < this.len() ? k + 1 : this.p[this.pLoop] >= 0.5 ? 0 : -1
  }

  private advance(): void {
    if (this.done) return
    const pulse = Math.round(PULSE_S * this.fs)
    this.step++
    this.sinceStep = 0
    if (this.section < 0 || this.section >= this.len() || this.step >= this.stepsIn(this.section)) {
      this.step = 0
      const next = this.section < 0 ? 0 : this.nextOf(this.section)
      if (this.section >= 0 && next <= this.section) this.end = pulse
      if (next < 0) {
        this.done = true
        return
      }
      this.section = next
      this.chg = pulse
    }
    if (this.step % STEPS_PER_BAR === 0) this.bar = pulse
  }

  tick(): void {
    const p = this.p
    const running = p[this.pRun] >= 0.5
    const c = this.clock
    const k = this.section < 0 ? 0 : Math.min(this.section, this.len() - 1)
    const tempo = this.f(k, T) > 0 ? this.f(k, T) : p[this.pTempo]
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], tempo, 0, this.in[this.iRst])
    if (c.restarted || !running) {
      this.section = -1
      this.step = -1
      this.done = false
    }
    if (stepped) this.advance()
    this.sinceStep++
    const o = this.out
    o[this.O.clko] = c.clkSample()
    o[this.O.rsto] = c.rstSample()
    const on = this.section >= 0 && !this.done
    const cur = this.section < 0 ? 0 : Math.min(this.section, this.len() - 1)
    const steps = this.stepsIn(cur)
    const next = this.nextOf(cur)
    const nextX = next >= 0 ? this.f(next, X) : -1
    const lastBar = on && this.step >= steps - STEPS_PER_BAR
    // where in the last bar we are, smoothly (for RAMP)
    const stepS = Math.max(1, c.stepLen * this.fs)
    const intoBar = lastBar ? (this.step - (steps - STEPS_PER_BAR) + Math.min(1, this.sinceStep / stepS)) / STEPS_PER_BAR : 0
    const gap = on && nextX === DROP && this.step >= steps - 4
    o[this.O.fill] = lastBar && next >= 0 ? 10 : 0
    o[this.O.ramp] = lastBar && nextX >= BUILD ? 10 * Math.min(1, intoBar) : 0
    // PAT, a 16th early
    const early = on && this.step === steps - 1 && next >= 0 ? next : cur
    o[this.O.pat] = this.f(early, P) * 2.5 + 1.25
    o[this.O.sec] = (cur * 10) / XL_SECTIONS
    o[this.O.trans] = this.f(cur, S) / 12
    const sc = this.f(cur, C)
    if (on && sc > 0) this.scene = ((sc - 0.5) * 10) / 8
    o[this.O.scene] = this.scene
    // the parts: gates on the bar; levels glide on a fade
    const mask = on ? this.f(cur, M) : 0
    const nextMask = next >= 0 ? this.f(next, M) : 0
    const fadeSteps = Math.round((XL_FADE_BARS[Math.round(p[this.pFade])] ?? 1) * STEPS_PER_BAR)
    const fadingIn = on && this.f(cur, X) === FADE && this.step < fadeSteps
    const fadingOut = on && nextX === FADE && this.step >= steps - fadeSteps
    const slow = 10 / (fadeSteps * stepS)
    const snap = 10 / (SNAP_S * this.fs)
    for (let g = 0; g < XL_PARTS; g++) {
      const bit = 1 << g
      const inNow = (mask & bit) !== 0 && !gap
      const leaving = fadingOut && (nextMask & bit) === 0
      const target = inNow && !leaving ? 10 : 0
      const rate = fadingIn || leaving ? slow : snap
      const l = this.level[g]
      this.level[g] = target > l ? Math.min(target, l + rate) : Math.max(target, l - rate)
      o[this.O.g0 + g] = inNow ? 10 : 0
      o[this.O.l0 + g] = this.level[g]
    }
    o[this.O.chg] = this.chg > 0 ? 10 : 0
    o[this.O.end] = this.end > 0 ? 10 : 0
    o[this.O.bar] = this.bar > 0 ? 10 : 0
    if (this.chg > 0) this.chg--
    if (this.end > 0) this.end--
    if (this.bar > 0) this.bar--
    this.led[XLL.section] = on ? this.section : -1
    this.led[XLL.step] = this.step
    this.led[XLL.bpm] = tempo
  }
}
