import { VISION_SCENES } from '../../modules/specs/vision'
import { beat, melody, mix, toOut, voice, type Kit } from './kit'
import { GROOVES, PHRASES } from './material'
import type { Starter } from './types'

/** A VIEW's SCENE value for a scene by name (0 is = CORE). */
const view = (name: (typeof VISION_SCENES)[number]) => VISION_SCENES.indexOf(name) + 1

/** A funk band that plays a VISION tank (or CORE): the kick strikes it, the
 *  quarter notes move it in time, the bassline colours it, the drums feed it,
 *  and a QUAD LFO steers its creature round in a slow circle. Returns the
 *  tank, and the drum machine's sound for anything else that wants it. */
function funkTank(k: Kit, type: 'vision' | 'visioncore', params: Record<string, number> = {}) {
  const b = beat(k, { groove: GROOVES.funk, level: 0.85 })
  const bass = melody(k, { clock: b.clock, phrase: PHRASES.funk })
  const bv = voice(k, bass.pitch, bass.gate, { filter: { type: 'vcf', params: { cutoff: 520, res: 0.55 }, out: 'lp4' }, env: { d: 0.2, s: 0.35 } })
  const v = k.add(type, { glow: 0.85, ...params })
  k.wire([b.tr, 't1'], [v, 'trig'])
  k.wire([b.clock, 'x1'], [v, 'clk'])
  k.wire(bass.pitch, [v, 'hue'])
  k.wire(b.out, [v, 'feed'])
  const steer = k.add('qlfo', { rate: 0.06, depth: 0.8 })
  k.wire([steer, 'o1'], [v, 'x'])
  k.wire([steer, 'o2'], [v, 'y'])
  return { v, b, bass: bv.out }
}

export const VISION_STARTERS: Record<string, Starter> = {
  vision: {
    howTo:
      'A funk band plays the tank: every kick is a bell stroke, the quarter notes on CLK make it twitch and glow in time, the bassline colours it, and QUAD LFO on X / Y steers it round the tank. Turn SCENE: every scene dances to the same band. Touch the glass too.',
    build(k) {
      const { b, bass } = funkTank(k, 'vision')
      toOut(k, mix(k, [b.out, bass], [0.8, 0.65]))
    },
  },
  visioncore: {
    howTo:
      'One CORE, three VIEWs, one funk band: the jellyfish (= CORE, on OUT), the reef and the murmuration all move to the same beat and the same steering. Each VIEW has its own scene and its own jacks; the reef VIEW’s GATE plays the open hat whenever its school turns. Scroll a VIEW to zoom.',
    build(k) {
      const { v, b, bass } = funkTank(k, 'visioncore')
      const views = [0, view('REEF'), view('MURMURATION')].map((scene) => {
        const w = k.add('visionview', { scene })
        k.wire([v, 'link'], [w, 'link'])
        return w
      })
      k.wire([views[1], 'gate'], [b.hats, 'oh'])
      toOut(k, mix(k, [b.out, bass], [0.8, 0.65]))
    },
  },
  visionview: {
    howTo:
      'Two VIEWs on one CORE, each playing its own scene: RAIN’s drops (one on every beat, the shower steered by QUAD LFO) play the open hat from the VIEW’s GATE, and the FIREFLIES flash in time. Change a VIEW’s SCENE and its jacks follow.',
    build(k) {
      // a slower RATE: a few drops between the beats, not a downpour on the hat
      const { v, b, bass } = funkTank(k, 'visioncore', { scene: VISION_SCENES.indexOf('RAIN'), rate: 0.12 })
      const rain = k.add('visionview', { scene: view('RAIN') })
      const flies = k.add('visionview', { scene: view('FIREFLIES') })
      k.wire([v, 'link'], [rain, 'link'])
      k.wire([v, 'link'], [flies, 'link'])
      k.wire([rain, 'gate'], [b.hats, 'oh'])
      toOut(k, mix(k, [b.out, bass], [0.8, 0.65]))
    },
  },
}
