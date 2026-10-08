import type { Lesson } from '../types'
import { powerStep } from './common'
import { afterSequencing } from './racks'

/** 6 — Drums on the same clock, and a mixer to hear them all. */
export const drums: Lesson = {
  id: 'drums',
  title: '6 · Drums: a beat in time',
  summary: 'A kick and hi-hats driven by the same clock, all brought together in a mixer.',
  build: afterSequencing,
  steps: [
    {
      text: 'One clock can drive many things at once. Let’s add drums that play in time with your sequence. Analog drum modules are little synths too: a pulse into TRIG strikes them.',
    },
    powerStep('Switch on to hear where we left off.', 'The six-step line from lesson 5.'),
    {
      text: 'The kick drum: a low thud. It’s in DRUMS.',
      task: 'Add “Analog Kick” from DRUMS.',
      action: { kind: 'add', type: 'kick', as: 'kick' },
    },
    {
      text: 'CLOCK’s 1/4 output pulses on every beat: four kicks a bar, the classic dance-floor pulse.',
      task: 'Patch CLOCK’s 1/4 output into the kick’s TRIG input.',
      listen: 'Nothing to hear yet: the kick’s output goes nowhere. Its light blinks on each beat.',
      action: { kind: 'connect', from: ['clock', 'x1'], to: ['kick', 'trig'] },
    },
    {
      text: 'OUT hears one sound (through the MULT). To hear the synth and the drums together, a mixer adds sounds into one, each with its own level. It’s in AMPS & MIXERS.',
      task: 'Add “Mixer” from AMPS & MIXERS.',
      action: { kind: 'add', type: 'mixer', as: 'mix' },
    },
    {
      text: 'The synth goes into the mixer’s first channel. (An output can feed several inputs: the VCA still reaches the MULT too.)',
      task: 'Patch the VCA’s OUT into the mixer’s input 1.',
      listen: 'No change yet: the mixer’s output isn’t patched.',
      action: { kind: 'connect', from: ['vca', 'out'], to: ['mix', 'in1'] },
    },
    {
      text: 'Now the mix takes the synth’s place at the MULT, so OUT and the scope hear everything the mixer has.',
      task: 'Patch the mixer’s OUT into the MULT’s A input (it replaces the VCA’s cable).',
      listen: 'The line as before, now coming through the mixer.',
      action: { kind: 'connect', from: ['mix', 'out'], to: ['mult', 'a'] },
    },
    {
      text: 'Into channel 2 goes the kick.',
      task: 'Patch the kick’s OUT into the mixer’s input 2.',
      listen: 'A kick on every beat, locked to the line: the same clock drives both.',
      action: { kind: 'connect', from: ['kick', 'out'], to: ['mix', 'in2'] },
    },
    {
      text: 'DECAY is how long the kick rings. Shorter is tighter and punchier.',
      task: 'Turn the kick’s DECAY down to about 0.3 s.',
      listen: 'A shorter, punchier thump.',
      target: { mod: 'kick', param: 'decay' },
      action: { kind: 'set', mod: 'kick', param: 'decay', value: 0.3 },
    },
    {
      text: 'Hi-hats tick between the kicks. Also in DRUMS.',
      task: 'Add “Analog Hi-Hats” from DRUMS.',
      action: { kind: 'add', type: 'hats', as: 'hats' },
    },
    {
      text: 'CLOCK’s 1/16 output is four pulses a beat: a busy ticking hat.',
      task: 'Patch CLOCK’s 1/16 output into the hats’ CH input (closed hat).',
      listen: 'Nothing yet: the hats aren’t in the mix. Their light flickers along.',
      action: { kind: 'connect', from: ['clock', 'x4'], to: ['hats', 'ch'] },
    },
    {
      text: 'Hats into channel 3.',
      task: 'Patch the hats’ MIX output into the mixer’s input 3.',
      listen: 'Sixteenth-note hats on top. A little loud?',
      action: { kind: 'connect', from: ['hats', 'mix'], to: ['mix', 'in3'] },
    },
    {
      text: 'Mixing is balance: each channel’s level knob sets how loud that part is against the others.',
      task: 'Turn the mixer’s level 3 down to about 40 %.',
      listen: 'The hats sit behind the kick and the line instead of over them.',
      target: { mod: 'mix', param: 'l3' },
      action: { kind: 'set', mod: 'mix', param: 'l3', value: 0.4 },
    },
    {
      text: 'That’s a groove: one clock, a melody and two drums, balanced in a mixer. Try other CLOCK outputs into the kick (1/8 for double time, BAR for one hit a bar). Next: effects, the space around the sound.',
    },
  ],
}
