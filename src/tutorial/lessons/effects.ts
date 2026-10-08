import type { Lesson } from '../types'
import { powerStep } from './common'
import { afterDrums } from './racks'

/** 7 — An echo on the synth, a reverb on everything. */
export const effects: Lesson = {
  id: 'effects',
  title: '7 · Effects: echo and space',
  summary: 'A tape echo on the synth line and a plate reverb on the whole mix; where an effect goes changes what it touches.',
  build: afterDrums,
  steps: [
    {
      text: 'Effects put sounds in a space. Two classics: an echo (a delay that repeats what it hears) and a reverb (a room’s reflections). Where you patch an effect decides what it touches.',
    },
    powerStep('Switch on to hear where we left off.', 'The groove from lesson 6: the line, kick and hats.'),
    {
      text: 'The tape echo records what goes in and plays it back a moment later, fading each time round. We’ll put it on the synth only, so the drums stay tight. It’s in EFFECTS.',
      task: 'Add “Tape Echo” from EFFECTS.',
      action: { kind: 'add', type: 'tape', as: 'tape' },
    },
    {
      text: 'The synth into the echo first.',
      task: 'Patch the VCA’s OUT into the tape echo’s IN.',
      listen: 'No change yet: the echo’s output isn’t heard.',
      action: { kind: 'connect', from: ['vca', 'out'], to: ['tape', 'in'] },
    },
    {
      text: 'Then the echo takes the synth’s place in the mixer. Its OUT is the dry sound with the echoes mixed in.',
      task: 'Patch the tape echo’s OUT into the mixer’s input 1 (it replaces the VCA’s cable).',
      listen: 'Each note now repeats and fades. The kick and hats stay dry.',
      action: { kind: 'connect', from: ['tape', 'out'], to: ['mix', 'in1'] },
    },
    {
      text: 'TIME is the gap between repeats. Matched to the tempo, echoes fall into the groove instead of blurring it.',
      task: 'Turn the echo’s TIME to about 0.32 s (a dotted eighth at 140 BPM).',
      listen: 'The repeats land between the notes: a rolling, interlocking line.',
      target: { mod: 'tape', param: 'time' },
      action: { kind: 'set', mod: 'tape', param: 'time', value: 0.32 },
    },
    {
      text: 'REPEATS is the feedback: how much of each echo goes round again. Past about 100 % it builds up instead of fading, so go gently.',
      task: 'Turn REPEATS up to about 60 %.',
      listen: 'A longer trail of echoes behind every note.',
      target: { mod: 'tape', param: 'fb' },
      action: { kind: 'set', mod: 'tape', param: 'fb', value: 0.6 },
    },
    {
      text: 'A reverb on the whole mix puts every part in the same room, which glues them together. It’s in EFFECTS too.',
      task: 'Add “Plate Reverb” from EFFECTS.',
      action: { kind: 'add', type: 'plate', as: 'plate' },
    },
    {
      text: 'This time the effect goes after the mixer, so everything passes through it.',
      task: 'Patch the mixer’s OUT into the reverb’s IN.',
      listen: 'No change yet: the reverb isn’t heard.',
      action: { kind: 'connect', from: ['mix', 'out'], to: ['plate', 'in'] },
    },
    {
      text: 'Its L output into the MULT, so OUT hears the room.',
      task: 'Patch the reverb’s L output into the MULT’s A input (it replaces the mixer’s cable).',
      listen: 'The whole groove in a bright room: even the kick has a tail.',
      action: { kind: 'connect', from: ['plate', 'l'], to: ['mult', 'a'] },
    },
    {
      text: 'MIX is how much room you hear against the dry sound. A little goes a long way.',
      task: 'Turn the reverb’s MIX down to about 20 %.',
      listen: 'The parts sound together in one space, but still clear and punchy.',
      target: { mod: 'plate', param: 'mix' },
      action: { kind: 'set', mod: 'plate', param: 'mix', value: 0.2 },
    },
    {
      text: 'You built a whole track by hand: oscillator, filter, envelope and VCA; an LFO; a clock, a sequencer and drums; a mixer, an echo and a reverb. Every module in the library is one of these ideas, or several. Right-click any module in the list and choose “Add ready-to-play” to hear what it’s for.',
    },
  ],
}
