import { VS, VS_EXTRA } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** Chladni plate modes (m, n), in order of rising frequency (∝ m² + n²). */
export const PLATE_MODES: [number, number][] = []
for (let m = 1; m <= 7; m++) for (let n = m + 1; n <= 8; n++) PLATE_MODES.push([m, n])
PLATE_MODES.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2))

/** A Chladni plate. Sand on a vibrating plate is shaken off wherever it moves
 *  and settles on the still lines: the plate's mode shape. The pitch picks the
 *  mode — RATE, plus HUE as V/oct, one mode per semitone — and FEED's level is
 *  how hard it's driven (unpatched: steady). Change the note and watch the sand
 *  jump into a new figure. GATE on each new mode, LIGHT = drive, GROW = mode
 *  number, SWAY = the plate's buzz. */
export class Cymatics implements Creature {
  private mode = -1
  private gate = 0
  private ph = 0

  constructor(_rng: Rng) {}

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    // RATE knob spans the modes; HUE input adds semitones of V/oct.
    const idx = Math.round(Math.log2(i.rate / 0.05) * 4.6 + i.hueV * 12)
    const mode = Math.min(PLATE_MODES.length - 1, Math.max(0, idx))
    if (mode !== this.mode) {
      this.mode = mode
      this.gate = 0.012
    }
    this.gate = Math.max(0, this.gate - dt)
    const drive = i.feedPatched ? Math.min(1, i.feed / 4) : 0.7
    this.ph = (this.ph + dt * 7) % 1
    const [m, n] = PLATE_MODES[mode]
    const light = Math.max(0, Math.min(1.5, i.glow * drive + i.glowCv / 10))
    o.gate = this.gate > 0 ? 10 : 0
    o.light = Math.min(10, light * 10)
    o.grow = (mode / (PLATE_MODES.length - 1)) * 10
    o.sway = Math.sin(this.ph * Math.PI * 2) * drive * 5
    led[VS.action] = drive
    led[VS.glow] = light
    led[VS.hue] = (i.hue + i.hueV) % 1
    led[VS.gate] = this.gate > 0 ? 1 : 0
    led[VS_EXTRA] = m
    led[VS_EXTRA + 1] = n
    led[VS_EXTRA + 2] = mode
  }
}
