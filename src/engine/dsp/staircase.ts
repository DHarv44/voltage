import { SC_STAGES } from '../../modules/specs/seq2'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'

/** Each SCALE's notes (semitones in the octave). */
const SCALES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 3, 5, 7, 10],
  [0, 3, 5, 6, 7, 10],
]
const GATE_FRAC = 0.5

/** STAIRCASE: the clock's pulses climb the stages; a stage lasts its PULSES.
 *  Its gate: REST (silent), FIRST (one gate at the start), EACH (one per
 *  pulse: ratchets), HOLD (one gate tied through the whole stage). SLIDE
 *  glides into the stage's note. Notes snap to the SCALE. */
export class StaircaseDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iTr = this.ii('trans')
  private readonly oPitch = this.oi('pitch')
  private readonly oGate = this.oi('gate')
  private readonly oEos = this.oi('eos')
  private readonly P = { p0: this.pi('p0'), len: this.pi('len'), dir: this.pi('dir'), scale: this.pi('scale'), glide: this.pi('glide'), tempo: this.pi('tempo'), run: this.pi('run') }
  private readonly clock: PocketClock
  private stage = -1
  private pulse = 0
  private dir = 1
  private gateLeft = 0
  private holding = false
  private goal = 0
  private pitch = 0
  private sliding = false
  private eos = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.clock = new PocketClock(16, this.fs)
  }

  private param(stage: number, k: number): number {
    return this.p[this.P.p0 + stage * 4 + k]
  }

  /** The stage's note, snapped to the scale (volts). */
  private note(stage: number): number {
    const sc = SCALES[Math.round(this.p[this.P.scale])] ?? SCALES[0]
    const n = Math.round(this.param(stage, 0))
    const oct = Math.floor(n / 12)
    const pc = n - oct * 12
    let best = sc[0]
    for (const s of sc) if (Math.abs(s - pc) < Math.abs(best - pc)) best = s
    return (oct * 12 + best) / 12
  }

  private nextStage(): void {
    const len = Math.max(1, Math.round(this.p[this.P.len]))
    const d = Math.round(this.p[this.P.dir])
    const was = this.stage
    if (this.stage < 0) this.stage = d === 1 ? len - 1 : 0
    else if (d === 0) this.stage = (this.stage + 1) % len
    else if (d === 1) this.stage = (this.stage - 1 + len) % len
    else if (d === 3) this.stage = Math.floor(this.rng.next() * len)
    else if (len > 1) {
      if (this.stage + this.dir >= len || this.stage + this.dir < 0) this.dir = -this.dir
      this.stage += this.dir
    } else this.stage = 0
    if (this.stage >= len) this.stage = 0
    if (was >= 0 && ((d === 0 && this.stage === 0) || (d === 1 && this.stage === len - 1))) this.eos = Math.round(0.005 * this.fs)
  }

  tick(): void {
    const p = this.p
    const running = p[this.P.run] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.P.tempo], 0, this.in[this.iRst])
    if (c.restarted || !running) {
      this.stage = -1
      this.pulse = 0
      this.holding = false
      this.gateLeft = 0
    }
    if (stepped) {
      if (this.stage < 0 || ++this.pulse >= Math.round(this.param(this.stage, 1))) {
        this.nextStage()
        this.pulse = 0
        this.goal = this.note(this.stage)
        this.sliding = this.param(this.stage, 3) >= 0.5
        if (!this.sliding) this.pitch = this.goal
      }
      const g = Math.round(this.param(this.stage, 2))
      const len = Math.round(c.stepLen * this.fs * GATE_FRAC)
      this.holding = g === 3
      if (g === 2 || (g === 1 && this.pulse === 0)) this.gateLeft = len
      else if (g === 3) this.gateLeft = 0
    }
    if (this.sliding) this.pitch += (this.goal - this.pitch) * (1 - Math.exp(-1 / (p[this.P.glide] * 0.3 * this.fs)))
    const g = this.stage >= 0 && (this.gateLeft > 0 || this.holding)
    if (this.gateLeft > 0) this.gateLeft--
    this.out[this.oPitch] = this.pitch + (this.patched[this.iTr] ? this.in[this.iTr] : 0)
    this.out[this.oGate] = g ? 10 : 0
    this.out[this.oEos] = this.eos > 0 ? 10 : 0
    if (this.eos > 0) this.eos--
    for (let s = 0; s < SC_STAGES; s++) this.led[s] = s === this.stage ? 1 : 0
  }
}
