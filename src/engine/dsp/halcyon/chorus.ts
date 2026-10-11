import { DelayLine } from '../delayLine'

/** The chorus modes: LFO rate (Hz) and sweep (ms either side of the centre).
 *  I is slow and wide, II faster and wider, I+II both buttons: fast and
 *  shallow, nearly a vibrato. */
const MODES = [
  { rate: 0, depth: 0 },
  { rate: 0.513, depth: 1.6 },
  { rate: 0.863, depth: 1.9 },
  { rate: 9.75, depth: 0.25 },
]
const CENTRE_MS = 3.4

/** The stereo bucket-brigade chorus: one line read at two taps swept by a
 *  triangle and its inverse, each through the BBD's filters (and its faint
 *  hiss), added to the dry sound on its side. */
export class BbdChorus {
  l = 0
  r = 0
  private readonly line: DelayLine
  private readonly ms: number
  private ph = 0
  private la = 0
  private la2 = 0
  private ra = 0
  private ra2 = 0
  private hiss = 0x1234567

  constructor(private readonly fs: number) {
    this.ms = fs / 1000
    this.line = new DelayLine(Math.ceil((CENTRE_MS + 3) * this.ms))
  }

  run(x: number, mode: number): void {
    if (mode <= 0) {
      this.l = x
      this.r = x
      return
    }
    const m = MODES[mode] ?? MODES[1]
    // the faint noise a BBD adds (a tiny LCG, no allocation)
    this.hiss = (Math.imul(this.hiss, 1103515245) + 12345) & 0x7fffffff
    const n = (this.hiss / 0x7fffffff - 0.5) * 0.0012
    this.line.write(x + n)
    this.ph = (this.ph + m.rate / this.fs) % 1
    const tri = this.ph < 0.5 ? this.ph * 4 - 1 : 3 - this.ph * 4
    const a = this.line.tapHermite((CENTRE_MS + tri * m.depth) * this.ms)
    const b = this.line.tapHermite((CENTRE_MS - tri * m.depth) * this.ms)
    // the BBD's anti-alias and reconstruction filters (~9 kHz)
    const k = 0.66
    this.la += (a - this.la) * k
    this.la2 += (this.la - this.la2) * k
    this.ra += (b - this.ra) * k
    this.ra2 += (this.ra - this.ra2) * k
    this.l = (x + this.la2) * 0.75
    this.r = (x + this.ra2) * 0.75
  }
}
