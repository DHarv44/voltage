import { COACH_POLY_N, COL, METL, SUBDIV_N } from '../../modules/specs/metronomes'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { CLICK_SOUNDS, ClickVoice } from './clickVoice'
import { Schmitt } from './cores'

const FLASH_DECAY = 0.9994
const pulse = (fs: number) => Math.round(0.003 * fs)

/** METRONOME: a position in beats, from its own TEMPO or CLK (16ths, the gaps
 *  between edges filled in so triplets land right); each new click (beat or
 *  subdivision) strikes the voice, beat 1 higher and louder by ACCENT. Taps
 *  on the screen set TEMPO from the average of the last few. */
export class MetronomeDsp extends Dsp {
  private iClk = this.ii('clk')
  private iRun = this.ii('run')
  private iRst = this.ii('rst')
  private oBeat = this.oi('beat')
  private oBar = this.oi('bar')
  private oSub = this.oi('sub')
  private oRst = this.oi('rsto')
  private oOut = this.oi('out')
  private P = { bpm: this.pi('bpm'), beats: this.pi('beats'), sub: this.pi('sub'), sound: this.pi('sound'), accent: this.pi('accent'), level: this.pi('level'), run: this.pi('run') }
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private readonly voice = new ClickVoice(this.fs)
  /** Position in beats since the start. */
  private phase = 0
  private last = -1
  private edges = 0
  private since = 0
  /** Samples per 16th at CLK. */
  private period = 0
  private wasRunning = false
  private rstOut = 0
  // tap tempo
  private tapped = false
  private taps = 0
  private tapSince = 0
  private tapAvg = 0

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'tap' && ev.down) this.tapped = true
  }

  private tap(): void {
    const iv = this.tapSince
    this.tapSince = 0
    if (this.taps > 0 && iv < this.fs * 3) {
      const n = Math.min(this.taps, 4)
      this.tapAvg = this.taps === 1 ? iv : (this.tapAvg * (n - 1) + iv) / n
      const bpm = (60 * this.fs) / this.tapAvg
      if (bpm >= 20 && bpm <= 300) this.writeParam(this.P.bpm, Math.round(bpm * 10) / 10)
      this.taps++
    } else this.taps = 1 // a fresh start
  }

  tick(): void {
    const { P, p, fs } = this
    const i = this.in
    this.tapSince++
    if (this.tapped) {
      this.tapped = false
      this.tap()
    }
    const running = this.patched[this.iRun] ? i[this.iRun] > 1.2 : p[P.run] >= 0.5
    if ((running && !this.wasRunning) || this.rst.rise(i[this.iRst])) {
      this.phase = 0
      this.last = -1
      this.edges = 0
      this.rstOut = pulse(fs)
    }
    this.wasRunning = running

    const external = this.patched[this.iClk] === 1
    this.since++
    if (external) {
      if (this.clk.rise(i[this.iClk])) {
        if (this.since > 8 && this.since < fs * 4) this.period = this.since
        this.since = 0
        if (running) this.phase = this.edges++ / 4
      } else if (running && this.edges > 0 && this.period > 0) this.phase = Math.min(this.phase + 1 / (4 * this.period), this.edges / 4 - 1e-9)
    } else if (running) this.phase += p[P.bpm] / 60 / fs

    const live = running && (!external || this.edges > 0)
    const n = SUBDIV_N[Math.round(p[P.sub])] ?? 1
    const beats = Math.max(1, Math.round(p[P.beats]))
    if (live) {
      const idx = Math.floor(this.phase * n)
      if (idx !== this.last) {
        this.last = idx
        const s = CLICK_SOUNDS[Math.round(p[P.sound])] ?? CLICK_SOUNDS[0]
        const acc = p[P.accent]
        if (idx % n !== 0) this.voice.strike(s, 0.35, 0.85)
        else if ((idx / n) % beats === 0) this.voice.strike(s, 1, 1 + 0.5 * acc)
        else this.voice.strike(s, 1 - 0.45 * acc, 1)
        this.led[METL.flash] = 1
      }
    }
    const frac = this.phase - Math.floor(this.phase)
    const sub = this.phase * n
    const inBar = Math.floor(this.phase) % beats
    this.out[this.oBeat] = live && frac < 0.5 ? 10 : 0
    this.out[this.oBar] = live && inBar === 0 && frac < 0.5 ? 10 : 0
    this.out[this.oSub] = live && sub - Math.floor(sub) < 0.5 ? 10 : 0
    this.out[this.oRst] = this.rstOut > 0 ? 10 : 0
    if (this.rstOut > 0) this.rstOut--
    this.out[this.oOut] = this.voice.next() * p[P.level] * 5
    this.led[METL.beat] = live ? inBar : -1
    this.led[METL.flash] *= FLASH_DECAY
    this.led[METL.bpm] = external && this.period > 0 ? (15 * fs) / this.period : 0
  }
}

/** COACH: its own tempo, which climbs (or falls) STEP bpm every EVERY bars
 *  from START to TARGET; PLAY bars of click then GAP bars of silence; POLY
 *  even clicks per bar against the beat. Gates and 1/16 keep going through
 *  the gaps (only the click goes quiet). */
export class CoachDsp extends Dsp {
  private iRun = this.ii('run')
  private iRst = this.ii('rst')
  private oX4 = this.oi('x4')
  private oBeat = this.oi('beat')
  private oBar = this.oi('bar')
  private oPoly = this.oi('poly')
  private oRst = this.oi('rsto')
  private oOut = this.oi('out')
  private P = {
    start: this.pi('start'), target: this.pi('target'), step: this.pi('step'), every: this.pi('every'), sound: this.pi('sound'),
    beats: this.pi('beats'), play: this.pi('play'), gap: this.pi('gap'), poly: this.pi('poly'), level: this.pi('level'), run: this.pi('run'),
  }
  private readonly rst = new Schmitt()
  private readonly voice = new ClickVoice(this.fs)
  private readonly polyVoice = new ClickVoice(this.fs)
  private phase = 0
  private bpm = 90
  private last = -1
  private inBar = 0
  private bar = 0
  private polyLast = -1
  private polyGate = 0
  private wasRunning = false
  private rstOut = 0

  private restart(): void {
    this.phase = 0
    this.last = -1
    this.inBar = 0
    this.bar = 0
    this.polyLast = -1
    this.bpm = this.p[this.P.start]
    this.rstOut = pulse(this.fs)
  }

  /** In a silent bar of the gap click. */
  private quiet(): boolean {
    const play = Math.max(1, Math.round(this.p[this.P.play]))
    const gap = Math.round(this.p[this.P.gap])
    return gap > 0 && this.bar % (play + gap) >= play
  }

  tick(): void {
    const { P, p, fs } = this
    const i = this.in
    const running = this.patched[this.iRun] ? i[this.iRun] > 1.2 : p[P.run] >= 0.5
    if ((running && !this.wasRunning) || this.rst.rise(i[this.iRst])) this.restart()
    this.wasRunning = running
    if (!running) this.bpm = p[P.start]

    const beats = Math.max(1, Math.round(p[P.beats]))
    if (running) {
      this.phase += this.bpm / 60 / fs
      const idx = Math.floor(this.phase)
      if (idx !== this.last) {
        // a new beat; a new bar every BEATS, and the ramp moves on the bar
        if (this.last >= 0 && ++this.inBar >= beats) {
          this.inBar = 0
          this.bar++
          const step = Math.round(p[P.step])
          if (step > 0 && this.bar % Math.max(1, Math.round(p[P.every])) === 0) {
            const target = p[P.target]
            this.bpm = this.bpm < target ? Math.min(target, this.bpm + step) : Math.max(target, this.bpm - step)
          }
        }
        this.last = idx
        if (!this.quiet()) {
          const s = CLICK_SOUNDS[Math.round(p[P.sound])] ?? CLICK_SOUNDS[1]
          this.voice.strike(s, this.inBar === 0 ? 1 : 0.6, this.inBar === 0 ? 1.5 : 1)
          this.led[COL.flash] = 1
        }
      }
      // POLY: N even clicks across the bar
      const pn = COACH_POLY_N[Math.round(p[P.poly])] ?? 0
      if (pn > 0) {
        const pos = (this.inBar + (this.phase - idx)) / beats
        const k = this.bar * pn + Math.floor(pos * pn)
        if (k !== this.polyLast) {
          this.polyLast = k
          this.polyGate = Math.round(0.01 * fs)
          if (!this.quiet()) {
            this.polyVoice.strike(CLICK_SOUNDS[2], 0.55, 1.25)
            this.led[COL.poly] = 1
          }
        }
      }
    }
    const frac = this.phase - Math.floor(this.phase)
    const x4 = this.phase * 4
    this.out[this.oX4] = running && x4 - Math.floor(x4) < 0.5 ? 10 : 0
    this.out[this.oBeat] = running && frac < 0.5 ? 10 : 0
    this.out[this.oBar] = running && this.inBar === 0 && frac < 0.5 ? 10 : 0
    this.out[this.oPoly] = this.polyGate > 0 ? 10 : 0
    if (this.polyGate > 0) this.polyGate--
    this.out[this.oRst] = this.rstOut > 0 ? 10 : 0
    if (this.rstOut > 0) this.rstOut--
    this.out[this.oOut] = (this.voice.next() + this.polyVoice.next()) * p[P.level] * 5

    const start = p[P.start]
    const target = p[P.target]
    this.led[COL.bpm] = this.bpm
    this.led[COL.bar] = this.bar
    this.led[COL.beat] = running ? this.inBar : -1
    this.led[COL.gap] = running && this.quiet() ? 1 : 0
    this.led[COL.flash] *= FLASH_DECAY
    this.led[COL.poly] *= FLASH_DECAY
    this.led[COL.ramp] = target === start ? 1 : Math.max(0, Math.min(1, (this.bpm - start) / (target - start)))
  }
}
