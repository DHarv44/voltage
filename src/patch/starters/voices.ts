import { chords, rollOnFm, toOut } from './kit'
import type { Starter } from './types'

/** The complete poly voices: each plays the kind of part it's famous for. */
export const VOICE_STARTERS: Record<string, Starter> = {
  fm4: {
    howTo:
      'FM-4’s electric piano playing four bars from a PIANO ROLL (Am, F, C, G under a melody), each note at its own velocity (soft ones round, hard ones bark), swept from speaker to speaker by PANNER like a stage piano’s tremolo. Turn BRIGHT (FM’s filter knob) and DECAY; step VOICE through BELL, BRASS, ORGAN; draw your own notes on the roll. Unpatch GATE to play it from your keys; a sustain pedal (MIDI, or a gate on SUS) holds the notes.',
    build: (k) => void rollOnFm(k),
  },
  stage: {
    howTo:
      'STAGE’s tine piano playing four bars from a PIANO ROLL (Am, F, C, G under a melody), panning speaker to speaker on its own tremolo. Notes drawn softer ring round and bell-like, harder ones bark: drag a note’s bar in the roll’s VEL lane. The roll’s PEDAL lane works the sustain pedal (SUS). Turn VOICING and BELL; switch MODEL to REED for the nasal bite. Unpatch GATE to play it from your keys.',
    build(k) {
      const pr = k.add('pianoroll')
      const ep = k.add('stage', { voicing: 0.5, trem: 0.45, rate: 4.2 })
      k.wire([pr, 'pitch'], [ep, 'voct'])
      k.wire([pr, 'gate'], [ep, 'gate'])
      k.wire([pr, 'vel'], [ep, 'vel'])
      k.wire([pr, 'ped'], [ep, 'sus'])
      toOut(k, [ep, 'l'], [ep, 'r'], 0.6)
    },
  },
  grand: {
    howTo:
      'GRAND playing four bars from a PIANO ROLL (Am, F, C, G under a melody), each note at the velocity drawn on the roll. Try MODEL (GRAND, UPRIGHT, HONKY), BRIGHT and UNISON. The roll’s PEDAL lane works the sustain pedal (the free strings ring along); its VEL lane sets how hard each note is struck. A gate on SOFT is the una corda. Unpatch GATE to play it from your keys.',
    build(k) {
      const pr = k.add('pianoroll')
      const gp = k.add('grand')
      k.wire([pr, 'pitch'], [gp, 'voct'])
      k.wire([pr, 'gate'], [gp, 'gate'])
      k.wire([pr, 'vel'], [gp, 'vel'])
      k.wire([pr, 'ped'], [gp, 'sus'])
      toOut(k, [gp, 'l'], [gp, 'r'], 0.6)
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
