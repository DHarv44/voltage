import { BACKBEAT, beat, bits, FOUR, Kit, voice, type Jack } from '../starters/kit'
import { GROOVES } from '../starters/material'
import type { Patch } from '../types'

/** A SEQ-8 that only gates, on these steps (every note the same: the pitch
 *  comes from elsewhere). */
function rhythm(k: Kit, gates: number[]): string {
  const p: Record<string, number> = { len: gates.length }
  gates.forEach((g, i) => {
    p[`s${i + 1}`] = 0
    p[`g${i + 1}`] = g
  })
  return k.add('seq8', p)
}

/** The mix every dance track has: drums on 1, the bass and the music on 2
 *  and 3 ducking under the kick (the pump), the music sent to a plate. */
function pumpMix(k: Kit, drums: Jack, bass: Jack, music: Jack, kick: Jack, duck: [number, number], send: number): void {
  const c = k.add('console', { lvl1: 0.85, lvl2: 0.8, duck2: duck[0], lvl3: 0.6, duck3: duck[1], snd3: send, pan3: 0, rel: 0.2, ret: 0.55 })
  const plate = k.add('plate', { decay: 0.75, damp: 0.5, mix: 1 })
  k.wire(drums, [c, 'in1'])
  k.wire(bass, [c, 'in2'])
  k.wire(music, [c, 'in3'])
  k.wire(kick, [c, 'sc'])
  k.wire([c, 'send'], [plate, 'in'])
  k.wire([plate, 'l'], [c, 'retL'])
  k.wire([plate, 'r'], [c, 'retR'])
  const master = k.add('master', { drive: 6, low: 1.5, high: 1 })
  k.wire([c, 'l'], [master, 'l'])
  k.wire([c, 'r'], [master, 'r'])
  const out = k.add('output', { vol: 1 })
  k.wire([master, 'l'], [out, 'l'])
  k.wire([master, 'r'], [out, 'r'])
}

/** Trance at 138: four on the floor, off-beat hats, a supersaw stabbing the
 *  off-beats through a slowly breathing filter, a rolling 16th bass on the
 *  chord roots, everything but the drums pumping under the kick. A minor. */
export function trance(): Patch {
  const k = new Kit(104)
  const b = beat(k, { groove: { kick: FOUR, snare: BACKBEAT, hat: bits(2, 6, 10, 14), accent: FOUR, bpm: 138 }, level: 0.8, snare: { tone: 0.3, snappy: 0.8 } })
  const prog = k.add('progression', { key: 9, mode: 1, mood: 0.25, bars: 2 })
  k.wire([b.clock, 'bar'], [prog, 'clk'])
  const stabs = rhythm(k, [0, 1, 0, 1, 0, 1, 0, 1])
  k.wire([b.clock, 'x2'], [stabs, 'clk'])
  const saw = k.add('swarm', { detune: 0.55, spread: 0.9, sub: 0.1, cutoff: 3600, res: 0.2, cvamt: 0.35, att: 0.003, rel: 0.2, level: 0.6 })
  k.wire([prog, 'notes'], [saw, 'voct'])
  k.wire([stabs, 'gate'], [saw, 'gate'])
  const sweep = k.add('lfo', { rate: 0.05 })
  k.wire([sweep, 'tri'], [saw, 'cut'])
  const roll = rhythm(k, [0, 1, 1, 1, 0, 1, 1, 1])
  k.wire([b.clock, 'x4'], [roll, 'clk'])
  const bass = voice(k, [prog, 'root'], [roll, 'gate'], {
    osc: { type: 'vco', params: { coarse: -2 }, out: 'saw' },
    filter: { type: 'vcf', params: { cutoff: 420, res: 0.35 }, out: 'lp4' },
    env: { a: 0.002, d: 0.09, s: 0.3, r: 0.04 },
  })
  pumpMix(k, b.out, bass.out, [saw, 'l'], [b.tr, 't1'], [0.85, 0.7], 0.45)
  return k.build()
}

/** Deep house at 122 with a little swing: the house groove, electric-piano
 *  chord stabs on the off-beats, a deep syncopated bass on the roots, the
 *  pump from the kick, a plate. D minor, sevenths. */
export function deepHouse(): Patch {
  const k = new Kit(104)
  const b = beat(k, { groove: GROOVES.house, swing: 0.12, level: 0.75, hats: { chd: 0.03 } })
  const prog = k.add('progression', { key: 2, mode: 1, mood: 0.65, bars: 2 })
  k.wire([b.clock, 'bar'], [prog, 'clk'])
  const stabs = rhythm(k, [0, 1, 0, 0, 0, 1, 0, 1])
  k.wire([b.clock, 'x2'], [stabs, 'clk'])
  const keys = k.add('fm4', { voice: 0, bright: 0.6, decay: 0.35, detune: 0.3, level: 0.7 })
  k.wire([prog, 'notes'], [keys, 'voct'])
  k.wire([stabs, 'gate'], [keys, 'gate'])
  const groove = rhythm(k, [1, 0, 0, 1, 0, 0, 1, 0])
  k.wire([b.clock, 'x2'], [groove, 'clk'])
  const bass = voice(k, [prog, 'root'], [groove, 'gate'], {
    osc: { type: 'vco', params: { coarse: -2 }, out: 'tri' },
    filter: { type: 'vcf', params: { cutoff: 300, res: 0.2 }, out: 'lp4' },
    env: { a: 0.004, d: 0.3, s: 0.5, r: 0.12 },
  })
  pumpMix(k, b.out, bass.out, [keys, 'out'], [b.tr, 't1'], [0.75, 0.55], 0.4)
  return k.build()
}
