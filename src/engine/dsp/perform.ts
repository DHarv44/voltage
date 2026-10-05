import { MACROS, SCENE_SLOTS, SCENEL } from '../../modules/specs/perform'
import { Dsp } from './base'
import { Schmitt } from './cores'

/** SCENES: turns the CV inputs into requests the page carries out (the page
 *  owns the knobs). LED want = slot asked for, count bumps on each request. */
export class ScenesDsp extends Dsp {
  private readonly iScene = this.ii('scene')
  private readonly iNext = this.ii('next')
  private readonly next = new Schmitt()
  private want = -1
  private count = 0

  tick(): void {
    if (this.patched[this.iScene]) {
      const s = Math.min(SCENE_SLOTS - 1, Math.max(0, Math.floor((this.in[this.iScene] / 10) * SCENE_SLOTS)))
      if (s !== this.want) {
        this.want = s
        this.count++
      }
    }
    if (this.next.rise(this.in[this.iNext])) {
      this.want = -2 // "next stored scene"
      this.count++
    }
    this.led[SCENEL.want] = this.want
    this.led[SCENEL.count] = this.count
  }
}

/** MACRO: each macro's CV (as a 0..1 offset) for the page, which adds it to
 *  the knob and applies the result. */
export class MacroDsp extends Dsp {
  private readonly iCv = Array.from({ length: MACROS }, (_, i) => this.ii(`cv${i + 1}`))

  tick(): void {
    for (let i = 0; i < MACROS; i++) this.led[i] = this.in[this.iCv[i]] / 10
  }
}

/** ACCIDENT: counts TRIG edges for the page (which does the rolling). */
export class AccidentDsp extends Dsp {
  private readonly iTrig = this.ii('trig')
  private readonly trig = new Schmitt()
  private count = 0

  tick(): void {
    if (this.trig.rise(this.in[this.iTrig])) this.count++
    this.led[0] = this.count
  }
}
