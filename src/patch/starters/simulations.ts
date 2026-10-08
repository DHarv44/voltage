import { mix, toOut, voice, type Jack, type Kit } from './kit'
import { drums, inKey } from './control'
import type { Starter } from './types'

/** A sound that a simulation's x / gate plays: notes in key on a pluck. */
function played(k: Kit, pitch: Jack, gate: Jack) {
  const h = k.add('harp', { sustain: 1.2 })
  k.wire(inKey(k, pitch, 0.12), [h, 'voct'])
  k.wire(gate, [h, 'trig'])
  const p = k.add('plate', { mix: 0.3 })
  k.wire([h, 'out'], [p, 'in'])
  toOut(k, [p, 'l'], [p, 'r'])
}

/** Simulations that make music: physics and biology driving notes and drums. */
export const SIMULATION_STARTERS: Record<string, Starter> = {
  bounce: {
    howTo: 'Balls bouncing in a box play the drums. Turn GRAVITY; kick the box.',
    build(k) {
      const b = k.add('bounce')
      toOut(k, drums(k, [b, 'g1'], [b, 'g2'], [b, 'g3']))
    },
  },
  tumbler: {
    howTo: 'Balls tumbling in a spinning drum play a handpan: each wall is a note. Turn SPIN and SIDES; drag the drum.',
    build(k) {
      const t = k.add('tumbler')
      const s = k.add('strike', { decay: 1.4 })
      k.wire([t, 'pitch'], [s, 'voct'])
      k.wire([t, 'trig'], [s, 'trig'])
      k.wire([t, 'vel'], [s, 'vel'])
      const p = k.add('plate', { mix: 0.3 })
      k.wire([s, 'out'], [p, 'in'])
      toOut(k, [p, 'l'], [p, 'r'])
    },
  },
  orbit: {
    howTo: 'Planets crossing a line play notes; where they cross picks the note. Turn SPEED.',
    build(k) {
      const o = k.add('orbit')
      played(k, [o, 'y'], [o, 'g1'])
    },
  },
  life: {
    howTo: 'The Game of Life plays a melody from its living cells. Reseed it by clicking.',
    build(k) {
      const c = k.add('clock', { bpm: 100 })
      const l = k.add('life', { scale: 3 })
      k.wire([c, 'x2'], [l, 'clk'])
      const h = k.add('harp')
      k.wire([l, 'pitch'], [h, 'voct'])
      k.wire([c, 'x2'], [h, 'trig'])
      toOut(k, [h, 'out'])
    },
  },
  flock: {
    howTo: 'A flock of birds steers the notes (X) and the filter (SPREAD). Drag to lead them.',
    build(k) {
      const c = k.add('clock', { bpm: 104 })
      const f = k.add('flock')
      toOut(k, voice(k, inKey(k, [f, 'x'], 0.15), [c, 'x2'], { filterCv: [f, 'spread'] }).out)
    },
  },
  chaos: {
    howTo: 'A double pendulum plays: its swing picks notes, its crossings trigger them. Kick it.',
    build(k) {
      // fast and energetic, so the pendulum flips (and plays) from the first second
      const c = k.add('chaos', { energy: 0.95, rate: 1.6 })
      played(k, [c, 'x'], [c, 'gate'])
    },
  },
  ecosystem: {
    howTo: 'Foxes and rabbits: the rabbit count picks notes, booms and crashes hit the drums.',
    build(k) {
      const c = k.add('clock', { bpm: 96 })
      const e = k.add('ecosystem', { rate: 1 })
      const h = k.add('harp')
      k.wire(inKey(k, [e, 'prey'], 0.1), [h, 'voct'])
      k.wire([c, 'x2'], [h, 'trig'])
      const d = drums(k, [e, 'boom'], [e, 'crash'])
      toOut(k, mix(k, [[h, 'out'], d], [0.7, 0.7]))
    },
  },
}
