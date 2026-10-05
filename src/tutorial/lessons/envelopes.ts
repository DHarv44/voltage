import type { Lesson } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** 3 — VCA + envelope: notes with a shape. */
export const envelopes: Lesson = {
  id: 'envelopes',
  title: '3 · Envelopes: notes that start and stop',
  summary: 'Gates, the ADSR envelope and the VCA; play from your keyboard.',
  build: emptyRack,
  steps: [
    {
      text: 'So far the sound never stops. Real notes begin and end. Two new modules do that: a VCA, a volume control a voltage can turn, and an envelope, which makes that voltage rise and fall for each note.',
    },
    {
      text: 'First, something to play with. MIDI·CV turns your computer keyboard (or a MIDI keyboard) into voltages: which note you pressed, and whether a key is held.',
      task: 'Add “MIDI to CV” from I/O.',
      action: { kind: 'add', type: 'midi', as: 'midi' },
    },
    {
      text: 'The oscillator makes the tone.',
      task: 'Add “Oscillator” from SOURCES.',
      action: { kind: 'add', type: 'vco', as: 'vco' },
    },
    {
      text: 'The VCA (voltage-controlled amplifier) will sit between the oscillator and the output, letting sound through only as far as a voltage opens it. It’s in AMPLIFIERS.',
      task: 'Add “Amplifier” from AMPLIFIERS.',
      action: { kind: 'add', type: 'vca', as: 'vca' },
    },
    {
      text: 'The envelope (ADSR) makes the voltage that opens the VCA: it rises when a key goes down and falls when it comes up. It’s in MODULATION.',
      task: 'Add “Envelope” from MODULATION.',
      action: { kind: 'add', type: 'adsr', as: 'adsr' },
    },
    {
      text: 'And the output.',
      task: 'Add “Audio Output” from I/O.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    powerStep('Switch on (silent for now).'),
    {
      text: 'MIDI·CV’s 1V/OCT output is the pitch of the key you press: each volt up is one octave up. Into the VCO’s 1V/OCT input, it chooses the note.',
      task: 'Patch MIDI·CV’s 1V/OCT into the VCO’s 1V/OCT input.',
      action: { kind: 'connect', from: ['midi', 'pitch'], to: ['vco', 'voct'] },
    },
    {
      text: 'The tone goes into the VCA. We’ll use the gentle triangle wave.',
      task: 'Patch the VCO’s TRI into the VCA’s IN.',
      action: { kind: 'connect', from: ['vco', 'tri'], to: ['vca', 'in'] },
    },
    {
      text: 'And the VCA goes to your speakers.',
      task: 'Patch the VCA’s OUT into OUT’s L input.',
      listen: 'Silence: the VCA is closed (its LEVEL is at zero) until a voltage opens it.',
      action: { kind: 'connect', from: ['vca', 'out'], to: ['out', 'l'] },
    },
    {
      text: 'While you hold a key, MIDI·CV’s GATE output is “on” (10 V). That’s what starts the envelope.',
      task: 'Patch MIDI·CV’s GATE into the ADSR’s GATE input.',
      action: { kind: 'connect', from: ['midi', 'gate'], to: ['adsr', 'gate'] },
    },
    {
      text: 'The envelope’s output is a voltage that rises and falls. Into the VCA’s CV, it becomes the note’s volume shape.',
      task: 'Patch the ADSR’s ENV into the VCA’s CV input.',
      action: { kind: 'connect', from: ['adsr', 'env'], to: ['vca', 'cv'] },
    },
    {
      text: 'Now it plays like an instrument.',
      task: 'Play a few notes on your computer keyboard: keys A S D F G H J K.',
      listen: 'Each note starts when you press and stops when you let go.',
      action: { kind: 'play', notes: [0, 4, 7, 12], spacing: 0.4, hold: 0.3 },
    },
    {
      text: 'ATTACK is how long a note takes to swell up to full volume.',
      task: 'Turn ATTACK up to about 1.2 s — I’ll play a note for you when you’re there.',
      listen: 'The note fades in slowly, like bowed strings.',
      target: { mod: 'adsr', param: 'a' },
      action: { kind: 'set', mod: 'adsr', param: 'a', value: 1.2 },
      then: [{ kind: 'play', notes: [0], hold: 2 }],
      thenNote: 'Playing a note for you: listen to the slow swell.',
    },
    {
      text: 'RELEASE is how long the note takes to fade after the key comes up.',
      task: 'Turn RELEASE up to about 2 s — I’ll play a note for you.',
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
      task: 'Turn SUSTAIN down to 0 — I’ll play a few notes for you.',
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
