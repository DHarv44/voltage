import { melody, toOut, type Kit } from './kit'
import type { Starter } from './types'

/** CHORD TRACK's held chords on a clock (a poly cable and its gates). */
export function heldChords(k: Kit, bpm: number) {
  const clock = k.add('clock', { bpm })
  const ct = k.add('chordtrack', { tempo: bpm })
  k.wire([clock, 'x4'], [ct, 'clk'])
  k.wire([clock, 'rst'], [ct, 'rst'])
  return { clock, notes: [ct, 'notes'] as [string, string], gate: [ct, 'gate'] as [string, string] }
}

/** DRAWBAR through ROTARY, the chords held, the speaker flipped between SLOW and FAST. */
function organRig(k: Kit): void {
  const c = heldChords(k, 88)
  const o = k.add('organ')
  k.wire(c.notes, [o, 'voct'])
  k.wire(c.gate, [o, 'gate'])
  const r = k.add('rotary')
  k.wire([o, 'out'], [r, 'in'])
  const lfo = k.add('lfo', { rate: 0.07 })
  k.wire([lfo, 'sqr'], [r, 'fast'])
  toOut(k, [r, 'l'], [r, 'r'], 0.55)
}

/** The new instruments' ready-to-play rigs. */
export const INSTRUMENT2_STARTERS: Record<string, Starter> = {
  organ: {
    howTo: 'DRAWBAR holding CHORD TRACK’s chords on the classic 888000000 with percussion, into ROTARY flipping between SLOW and FAST. Pull drawbars in and out (all 8s: full organ; 8 0 0 0 0 0 8 8 8: a bright jazz sound), try the scanner C3 against V3, push DRIVE.',
    build: organRig,
  },
  rotary: {
    howTo: 'DRAWBAR’s chords through ROTARY, a slow square wave flipping it between SLOW and FAST every few bars: listen to the horn and drum ramp up and down. Turn DRIVE for the growl, HORN · DRUM for the balance.',
    build: organRig,
  },
  wind: {
    howTo: 'BREATH playing a slow tune as a flute, into a plate: breath noise, a vibrato that grows into held notes. Turn BREATH up until it overblows an octave; switch MODEL to CLARINET for the hollow reed; TONE from soft to buzzy.',
    build(k) {
      const m = melody(k, { bpm: 70, gates: [1, 1, 1, 1, 1, 1, 1, 0] })
      const w = k.add('wind')
      k.wire(m.pitch, [w, 'voct'])
      k.wire(m.gate, [w, 'gate'])
      const plate = k.add('plate', { decay: 0.7, mix: 0.3 })
      k.wire([w, 'out'], [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'], 0.55)
    },
  },
  choir: {
    howTo: 'CHOIR singing CHORD TRACK’s chords on "ah", a slow LFO drifting the vowel towards "oh", into a long plate. Switch VOWELS to EACH NOTE and play the keys for a wordless chant; widen ENSEMBLE; SIZE from basses to trebles.',
    build(k) {
      const c = heldChords(k, 72)
      const ch = k.add('choir')
      k.wire(c.notes, [ch, 'voct'])
      k.wire(c.gate, [ch, 'gate'])
      const lfo = k.add('lfo', { rate: 0.05 })
      const at = k.add('atten', { a: 0.6 })
      k.wire([lfo, 'tri'], [at, 'a'])
      k.wire([at, 'a'], [ch, 'vcv'])
      const plate = k.add('plate', { decay: 0.85, mix: 0.35 })
      k.wire([ch, 'l'], [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'], 0.55)
    },
  },
}
