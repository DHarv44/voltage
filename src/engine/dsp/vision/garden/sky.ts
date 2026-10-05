import { SKY_TOD } from '../../../../modules/specs/garden'

/** A day, in units at RATE 0.4 Hz (~6½ minutes; a flower lives through
 *  about a quarter of one). */
const DAY = 160
/** How fast the clock runs when it's catching up to a newly chosen sky (days
 *  per second): a quick time-lapse rather than a jump. */
const CATCH_UP = 0.12

/** The garden's clock: CYCLE runs day and night round; the fixed skies hold a
 *  time of day. Changing sky runs the clock forward to it. */
export class Sky {
  tod = 0.765

  step(dt: number, speed: number, setting: number): void {
    const want = SKY_TOD[setting] ?? -1
    if (want < 0) {
      this.tod = (this.tod + (dt * speed) / DAY) % 1
      return
    }
    const ahead = (want - this.tod + 1) % 1
    if (ahead < 0.0005 || ahead > 0.9995) this.tod = want
    else this.tod = (this.tod + Math.min(ahead, dt * CATCH_UP)) % 1
  }
}
