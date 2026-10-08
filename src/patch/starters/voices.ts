import { chords, toOut } from './kit'
import type { Starter } from './types'

/** The complete poly voices: each plays the kind of part it's famous for. */
export const VOICE_STARTERS: Record<string, Starter> = {
  fm4: {
    howTo:
      'FM-4’s electric piano comping slow chords through a chorus. Turn BRIGHT (FM’s filter knob) and DECAY; step VOICE through BELL, BRASS, ORGAN. Unpatch GATE to play it from your keys.',
    build(k) {
      const c = chords(k, { bpm: 76, mood: 0.55 })
      const fm = k.add('fm4', { voice: 0, detune: 0.35, level: 0.75 })
      const ens = k.add('ensemble', { rate: 0.6, depth: 0.35, mix: 0.45 })
      k.wire(c.notes, [fm, 'voct'])
      k.wire(c.gate, [fm, 'gate'])
      k.wire([fm, 'out'], [ens, 'in'])
      toOut(k, [ens, 'l'], [ens, 'r'], 0.5)
    },
  },
  swarm: {
    howTo:
      'SWARM stabbing trance chords on an off-beat rhythm, a slow LFO opening its filter. Turn DETUNE (it opens up fast past halfway), SPREAD and MIX; raise ATTACK and RELEASE for a pad.',
    build(k) {
      const c = chords(k, { bpm: 128, mood: 0.3 })
      // the stab rhythm: a gate on these eighths of the bar
      const p: Record<string, number> = { len: 8 }
      ;[1, 0, 1, 1, 0, 1, 1, 0].forEach((g, i) => {
        p[`s${i + 1}`] = 0
        p[`g${i + 1}`] = g
      })
      const stabs = k.add('seq8', p)
      k.wire([c.clock, 'x2'], [stabs, 'clk'])
      const sw = k.add('swarm', { detune: 0.5, spread: 0.85, sub: 0.25, cutoff: 3200, res: 0.2, cvamt: 0.35, att: 0.003, rel: 0.22, level: 0.7 })
      const lfo = k.add('lfo', { rate: 0.07 })
      k.wire(c.notes, [sw, 'voct'])
      k.wire([stabs, 'gate'], [sw, 'gate'])
      k.wire([lfo, 'tri'], [sw, 'cut'])
      toOut(k, [sw, 'l'], [sw, 'r'], 0.55)
    },
  },
}
