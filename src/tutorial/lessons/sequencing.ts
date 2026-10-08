import type { Lesson } from '../types'
import { powerStep } from './common'
import { afterModulation } from './racks'

/** 5 — CLOCK and SEQ-8: the rack plays by itself. */
export const sequencing: Lesson = {
  id: 'sequencing',
  title: '5 · Sequencing: the rack plays itself',
  summary: 'A clock keeps time; a step sequencer plays a line of notes on the synth you built.',
  build: afterModulation,
  steps: [
    {
      text: 'Lesson 4 left a drone with a slowly moving filter. Now the rack will play by itself: a clock keeps time, and a sequencer plays a row of notes in step with it, instead of your keyboard.',
    },
    powerStep('Switch on to hear where we left off.', 'The breathing, wah-ing drone from lesson 4.'),
    {
      text: 'First close the VCA again, so each note is shaped by the envelope instead of droning.',
      task: 'Turn the VCA’s LEVEL down to zero.',
      listen: 'Silence until a note plays: plucks again (try a key).',
      target: { mod: 'vca', param: 'gain' },
      action: { kind: 'set', mod: 'vca', param: 'gain', value: 0 },
    },
    {
      text: 'A clock is a steady stream of pulses: the tempo. Everything that should play in time listens to it. It’s in SEQUENCERS.',
      task: 'Add “Master Clock” from SEQUENCERS.',
      action: { kind: 'add', type: 'clock', as: 'clock' },
    },
    {
      text: 'A step sequencer holds a row of notes, one per knob, and moves to the next one on every clock pulse. SEQ-8 has eight. Also in SEQUENCERS.',
      task: 'Add “8-Step Sequencer” from SEQUENCERS.',
      action: { kind: 'add', type: 'seq8', as: 'seq' },
    },
    {
      text: 'CLOCK has outputs at different speeds: 1/4 is every beat, 1/8 twice a beat, 1/16 four times. The sequencer takes a step on each pulse it gets.',
      task: 'Patch CLOCK’s 1/8 output into SEQ-8’s CLOCK input.',
      listen: 'Nothing new to hear yet, but watch SEQ-8’s red lights: one step per pulse, round and round.',
      action: { kind: 'connect', from: ['clock', 'x2'], to: ['seq', 'clk'] },
    },
    {
      text: 'The sequencer’s GATE goes high on each step, like a key going down. Into the envelope, it replaces the keyboard’s gate.',
      task: 'Patch SEQ-8’s GATE into the envelope’s GATE input (it replaces the keyboard’s cable).',
      listen: 'A note on every step, all on the same pitch: the sequencer isn’t choosing notes yet.',
      action: { kind: 'connect', from: ['seq', 'gate'], to: ['adsr', 'gate'] },
    },
    {
      text: 'Its CV output is the current step’s knob, as a pitch voltage. Into the VCO’s 1V/OCT, it chooses the note, just as the keyboard did.',
      task: 'Patch SEQ-8’s CV into the VCO’s 1V/OCT input (it replaces the keyboard’s cable).',
      listen: 'A melody: eight notes going round. Each knob is one note.',
      action: { kind: 'connect', from: ['seq', 'cv'], to: ['vco', 'voct'] },
    },
    {
      text: 'The step knobs are in volts: one volt is an octave, so a semitone is about 0.083 V (QUANT on SEMI snaps them to exact notes).',
      task: 'Turn step 4’s knob up to about 0.67 V (8 semitones up: the minor sixth).',
      listen: 'The fourth note jumps up to a darker, sadder note.',
      target: { mod: 'seq', param: 's4' },
      action: { kind: 'set', mod: 'seq', param: 's4', value: 0.6667 },
    },
    {
      text: 'Each step has a gate switch: OFF makes that step a rest.',
      task: 'Flip step 6’s gate switch to OFF.',
      listen: 'A gap in the line: rests make melodies breathe.',
      target: { mod: 'seq', param: 'g6' },
      action: { kind: 'set', mod: 'seq', param: 'g6', value: 0 },
    },
    {
      text: 'LENGTH sets how many steps go round before starting again.',
      task: 'Turn LENGTH down to 6.',
      listen: 'A shorter loop of six eighth-notes: it feels like it’s in three now.',
      target: { mod: 'seq', param: 'len' },
      action: { kind: 'set', mod: 'seq', param: 'len', value: 6 },
    },
    {
      text: 'The clock is the conductor: change its tempo and everything that follows it changes too.',
      task: 'Turn CLOCK’s TEMPO up to about 140 BPM.',
      listen: 'The whole line speeds up together.',
      target: { mod: 'clock', param: 'bpm' },
      action: { kind: 'set', mod: 'clock', param: 'bpm', value: 140 },
    },
    {
      text: 'That’s sequencing: a clock for time, a sequencer for notes, both just voltages into the synth you built by hand. The LFO from lesson 4 is still moving the filter under it all. Next: drums on the same clock.',
    },
  ],
}
