import type { Fill } from '../../../modules/specs/combo/style'

/** Drum slots the band plays (the kit's voices and COMBO CORE's gates). */
export const K = 0
export const S = 1
export const H = 2
export const O = 3
export const R = 4
export const T = 5
export const P = 6
export const C = 7 // crash
export const X = 8 // the stick click of a count-in
export const DRUM_SLOTS = 9

/** What a fill plays on one step of the bar it fills: velocities into `hit`
 *  (cleared first), the tom it hits (0 high … 2 floor) into `tom[0]`.
 *  Returns false when the groove should play this step as usual (fills
 *  mostly take the end of the bar). */
export function fillStep(kind: Fill, step: number, steps: number, sub: number, hit: Float32Array, tom: Int8Array): boolean {
  const beat = Math.floor(step / sub)
  const beats = steps / sub
  const into = step - (beats - 2) * sub // steps into the last two beats
  hit.fill(0)
  switch (kind) {
    case 'toms': {
      if (into < 0) return false
      // down the toms, high to floor, one per step; the kick under each beat
      const n = 2 * sub
      tom[0] = Math.min(2, Math.floor((into / n) * 3))
      hit[T] = 0.55 + 0.4 * (into / n)
      if (step % sub === 0) hit[K] = 0.8
      return true
    }
    case 'snare': {
      if (beat < beats - 1) return false
      const i = step - (beats - 1) * sub
      hit[S] = 0.45 + 0.5 * (i / sub)
      if (i === 0) hit[K] = 0.8
      return true
    }
    case 'roll': {
      // the build: the whole bar on snare, 8ths then 16ths, getting louder
      const dense = step >= steps / 2 || step % 2 === 0
      if (dense) hit[S] = 0.3 + 0.65 * (step / steps)
      if (step % sub === 0) hit[K] = 0.7
      return true
    }
    case 'jazz': {
      if (into < 0) return false
      // comping into the turn: snare and toms on the off-beats, a kick to set it up
      if (step % 2 === 1 || sub === 3) {
        hit[into % 3 === 2 ? T : S] = 0.5 + 0.3 * (into / (2 * sub))
        tom[0] = 1
      }
      if (into === 2 * sub - 1) hit[K] = 0.7
      return true
    }
    case 'latin': {
      if (beat < beats - 1) return false
      // a timbale run on the high tom
      tom[0] = 0
      hit[T] = 0.55 + 0.4 * ((step - (beats - 1) * sub) / sub)
      return true
    }
    case 'hiphop': {
      if (beat < beats - 1) return false
      // the drop: no kick, hats rolling, a snare to land it
      hit[H] = 0.6
      if (step === steps - 1) hit[S] = 0.9
      return true
    }
    default:
      return false
  }
}
