import { VISION_SCENES } from '../../modules/specs/vision'
import { beat, melody, mix, toOut, voice, type Kit } from './kit'
import { GROOVES, PHRASES } from './material'
import type { Starter } from './types'

/** A VIEW's SCENE value for a scene by name (0 is = CORE). */
const view = (name: (typeof VISION_SCENES)[number]) => VISION_SCENES.indexOf(name) + 1

/** Screens go in first, alone on the top row: everything else starts on the
 *  row below, so the only cables that reach them come up to their jacks at
 *  the bottom and none hangs across the glass. */
function screens(k: Kit, add: () => string[]): string[] {
  const ids = add()
  k.newRow()
  return ids
}

/** A funk band that plays a VISION tank (or CORE) `v`: the kick strikes it,
 *  the quarter notes move it in time, the bassline colours it, the drums feed
 *  it, and a QUAD LFO steers its creature round in a slow circle. Returns the
 *  drums and the bass. */
function funkBand(k: Kit, v: string) {
  const b = beat(k, { groove: GROOVES.funk, level: 0.85 })
  const bass = melody(k, { clock: b.clock, phrase: PHRASES.funk })
  const bv = voice(k, bass.pitch, bass.gate, { filter: { type: 'vcf', params: { cutoff: 520, res: 0.55 }, out: 'lp4' }, env: { d: 0.2, s: 0.35 } })
  k.wire([b.tr, 't1'], [v, 'trig'])
  k.wire([b.clock, 'x1'], [v, 'clk'])
  k.wire(bass.pitch, [v, 'hue'])
  k.wire(b.out, [v, 'feed'])
  const steer = k.add('qlfo', { rate: 0.06, depth: 0.8 })
  k.wire([steer, 'o1'], [v, 'x'])
  k.wire([steer, 'o2'], [v, 'y'])
  return { b, bass: bv.out }
}

/** A CORE (on the second row, with the band) linked to `views`. */
function coreFor(k: Kit, views: string[], params: Record<string, number> = {}): string {
  const core = k.add('visioncore', { glow: 0.85, ...params })
  for (const w of views) k.wire([core, 'link'], [w, 'link'])
  return core
}

export const VISION_STARTERS: Record<string, Starter> = {
  vision: {
    howTo:
      'A funk band plays the tank: every kick is a bell stroke, the quarter notes on CLK make it twitch and glow in time, the bassline colours it, and QUAD LFO on X / Y steers it round the tank. Turn SCENE: every scene dances to the same band. Touch the glass too.',
    build(k) {
      const [v] = screens(k, () => [k.add('vision', { glow: 0.85 })])
      const { b, bass } = funkBand(k, v)
      toOut(k, mix(k, [b.out, bass], [0.8, 0.65]))
    },
  },
  visioncore: {
    howTo:
      'One CORE, three VIEWs, one funk band: the jellyfish (= CORE, on OUT), the reef and the murmuration all move to the same beat and the same steering. Each VIEW has its own scene and its own jacks; the reef VIEW’s GATE plays the open hat whenever its school turns. Scroll a VIEW to zoom.',
    build(k) {
      const views = screens(k, () => [0, view('REEF'), view('MURMURATION')].map((scene) => k.add('visionview', { scene })))
      const { b, bass } = funkBand(k, coreFor(k, views))
      k.wire([views[1], 'gate'], [b.hats, 'oh'])
      toOut(k, mix(k, [b.out, bass], [0.8, 0.65]))
    },
  },
  visionview: {
    howTo:
      'Two VIEWs on one CORE, each playing its own scene: RAIN’s drops (one on every beat, the shower steered by QUAD LFO) play the open hat from the VIEW’s GATE, and the FIREFLIES flash in time. Change a VIEW’s SCENE and its jacks follow.',
    build(k) {
      const [rain, flies] = screens(k, () => [k.add('visionview', { scene: view('RAIN') }), k.add('visionview', { scene: view('FIREFLIES') })])
      // a slower RATE: a few drops between the beats, not a downpour on the hat
      const { b, bass } = funkBand(k, coreFor(k, [rain, flies], { scene: VISION_SCENES.indexOf('RAIN'), rate: 0.12 }))
      k.wire([rain, 'gate'], [b.hats, 'oh'])
      toOut(k, mix(k, [b.out, bass], [0.8, 0.65]))
    },
  },
}
