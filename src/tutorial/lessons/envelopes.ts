import type { Lesson } from '../types'
import { powerStep } from './common'
import { afterFilters } from './racks'

/** 3 — VCA + envelope: notes with a shape. */
export const envelopes: Lesson = {
  id: 'envelopes',
  title: '3 · Envelopes: notes that start and stop',
  summary: 'Gates, the ADSR envelope and the VCA; play from your keyboard.',
  build: afterFilters,
  steps: [
    {
      text: 'Lesson 2 left a squelchy drone that never stops. Real notes begin and end. Three new modules do that: a keyboard interface, a VCA (a volume control a voltage can turn) and an envelope (the voltage that turns it).',
    },
    powerStep('Switch on to hear where we left off.', 'The resonant drone from the end of lesson 2.'),
    {
      text: 'First, calm the filter down for playing notes.',
      task: 'Turn the filter’s RESONANCE down to about 15 %.',
      listen: 'The ringing whistle fades away.',
      target: { mod: 'vcf', param: 'res' },
      action: { kind: 'set', mod: 'vcf', param: 'res', value: 0.15 },
    },
    {
      text: 'And open it a little.',
      task: 'Turn CUTOFF up to about 1.2 kHz.',
      listen: 'A warm, rounded buzz.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 1200 },
    },
    {
      text: 'MIDI·CV turns your computer keyboard (or a MIDI keyboard) into voltages: which note you pressed, and whether a key is held. It’s in I/O.',
      task: 'Add “MIDI to CV” from I/O.',
      action: { kind: 'add', type: 'midi', as: 'midi' },
    },
    {
      text: 'Its 1V/OCT output is the pitch of the key you press: each volt up is one octave up. Into the VCO’s 1V/OCT input, it chooses the note.',
      task: 'Patch MIDI·CV’s 1V/OCT into the VCO’s 1V/OCT input.',
      listen: 'No change until you play: the drone just follows the last key pressed.',
      action: { kind: 'connect', from: ['midi', 'pitch'], to: ['vco', 'voct'] },
    },
    {
      text: 'The VCA (voltage-controlled amplifier) lets sound through only as far as a voltage opens it. It’s in AMPLIFIERS.',
      task: 'Add “Amplifier” from AMPLIFIERS.',
      action: { kind: 'add', type: 'vca', as: 'vca' },
    },
    {
      text: 'It goes after the filter, just before the MULT: its output takes the filter’s place there.',
      task: 'Patch the VCA’s OUT into the MULT’s A input (it replaces the filter’s cable).',
      listen: 'Silence: nothing is going into the VCA yet.',
      action: { kind: 'connect', from: ['vca', 'out'], to: ['mult', 'a'] },
    },
    {
      text: 'Now the filtered sound into the VCA.',
      task: 'Patch the filter’s 24dB output into the VCA’s IN.',
      listen: 'Still silent: the VCA is closed (its LEVEL is at zero) until a voltage opens it.',
      action: { kind: 'connect', from: ['vcf', 'lp4'], to: ['vca', 'in'] },
    },
    {
      text: 'The envelope (ADSR) makes that voltage: it rises when a key goes down and falls when it comes up. It’s in MODULATION.',
      task: 'Add “Envelope” from MODULATION.',
      action: { kind: 'add', type: 'adsr', as: 'adsr' },
    },
    {
      text: 'While you hold a key, MIDI·CV’s GATE output is “on” (10 V). That’s what starts the envelope.',
      task: 'Patch MIDI·CV’s GATE into the ADSR’s GATE input.',
      action: { kind: 'connect', from: ['midi', 'gate'], to: ['adsr', 'gate'] },
    },
    {
      text: 'The envelope’s output rises and falls with each note. Into the VCA’s CV, it becomes the note’s volume shape.',
      task: 'Patch the ADSR’s ENV into the VCA’s CV input.',
      action: { kind: 'connect', from: ['adsr', 'env'], to: ['vca', 'cv'] },
    },
    {
      text: 'Now it plays like an instrument.',
      task: 'Play a few notes on your computer keyboard: keys A S D F G H J K.',
      listen: 'Each note starts when you press and stops when you let go — watch the scope too.',
      action: { kind: 'play', notes: [0, 4, 7, 12], spacing: 0.4, hold: 0.3 },
    },
    {
      text: 'ATTACK is how long a note takes to swell up to full volume.',
      task: 'Turn ATTACK up to about 1.2 s, then play a note and hold it.',
      listen: 'The note fades in slowly, like bowed strings.',
      target: { mod: 'adsr', param: 'a' },
      action: { kind: 'set', mod: 'adsr', param: 'a', value: 1.2 },
      then: [{ kind: 'play', notes: [0], hold: 2 }],
      thenNote: 'Playing a note for you: listen to the slow swell.',
    },
    {
      text: 'RELEASE is how long the note takes to fade after the key comes up.',
      task: 'Turn RELEASE up to about 2 s, then play a note.',
      listen: 'The note lingers and fades after the key is let go.',
      target: { mod: 'adsr', param: 'r' },
      action: { kind: 'set', mod: 'adsr', param: 'r', value: 2 },
      then: [{ kind: 'play', notes: [7], hold: 1 }],
      thenNote: 'Playing a note for you: listen to it fade out.',
    },
    {
      text: 'A pluck is the opposite: an instant attack, then a quick fall to nothing. First, the instant attack.',
      task: 'Turn ATTACK all the way down.',
      target: { mod: 'adsr', param: 'a' },
      action: { kind: 'set', mod: 'adsr', param: 'a', value: 0.002 },
    },
    {
      text: 'SUSTAIN is the level a held note settles at. At zero, every note dies away even while you hold the key.',
      task: 'Turn SUSTAIN down to 0, then play a few notes.',
      listen: 'Plucky, percussive notes — the DECAY knob sets how long the pluck rings.',
      target: { mod: 'adsr', param: 's' },
      action: { kind: 'set', mod: 'adsr', param: 's', value: 0 },
      then: [{ kind: 'play', notes: [0, 7, 12, 7], spacing: 0.3, hold: 0.25 }],
      thenNote: 'Playing a few notes for you: listen to the pluck.',
    },
    {
      text: 'Attack, Decay, Sustain, Release: ADSR. Gate in, shape out — and that shape can open a VCA or, just as well, sweep a filter. Play with the four knobs, then on to the last lesson: modulation.',
    },
  ],
}
