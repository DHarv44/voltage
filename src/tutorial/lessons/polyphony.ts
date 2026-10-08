import type { Lesson } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** Polyphony: one voice per key, on poly cables. */
export const polyphony: Lesson = {
  id: 'polyphony',
  title: 'Polyphony: chords',
  summary: 'Poly cables carry a voice per key: build a small polysynth and play chords.',
  build: emptyRack,
  steps: [
    {
      text: 'Everything so far played one note at a time (monophonic). A polyphonic synth gives every key you hold its own voice: its own oscillator, envelope and VCA. In VOLTAGE one poly cable carries up to eight voices at once; poly cables are drawn thicker.',
    },
    {
      text: 'First, the speakers.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'POLY·CV is the keyboard interface again, but it hands each held key to a voice of its own: its outputs are poly. It’s in POLYPHONIC, like everything in this lesson.',
      task: 'Add “Polyphonic MIDI to CV” from POLYPHONIC.',
      action: { kind: 'add', type: 'polycv', as: 'keys' },
    },
    {
      text: 'P-VCO is one oscillator per voice. Each drifts a little on its own, as real analog voices do.',
      task: 'Add “Polyphonic Oscillator” from POLYPHONIC.',
      action: { kind: 'add', type: 'pvco', as: 'osc' },
    },
    {
      text: 'The poly pitch cable gives every voice its own note.',
      task: 'Patch POLY·CV’s 1V/OCT into P-VCO’s 1V/OCT.',
      listen: 'Nothing to hear yet.',
      action: { kind: 'connect', from: ['keys', 'pitch'], to: ['osc', 'voct'] },
    },
    {
      text: 'P-ADSR is one envelope per voice, each opened by its own key.',
      task: 'Add “Polyphonic Envelope” from POLYPHONIC.',
      action: { kind: 'add', type: 'padsr', as: 'env' },
    },
    {
      text: 'The poly gate: each voice’s key down and key up.',
      task: 'Patch POLY·CV’s GATE into P-ADSR’s GATE.',
      action: { kind: 'connect', from: ['keys', 'gate'], to: ['env', 'gate'] },
    },
    {
      text: 'P-VCA is one VCA per voice.',
      task: 'Add “Polyphonic VCA” from POLYPHONIC.',
      action: { kind: 'add', type: 'pvca', as: 'vca' },
    },
    {
      text: 'The sine wave is the gentlest sound to start with.',
      task: 'Patch P-VCO’s SIN output into P-VCA’s IN.',
      action: { kind: 'connect', from: ['osc', 'sin'], to: ['vca', 'in'] },
    },
    {
      text: 'And each voice’s envelope opens its own VCA.',
      task: 'Patch P-ADSR’s ENV into P-VCA’s CV.',
      action: { kind: 'connect', from: ['env', 'env'], to: ['vca', 'cv'] },
    },
    {
      text: 'Speakers take one sound, not eight. POLY MIX adds the voices of a poly cable into one (SUM).',
      task: 'Add “Poly Sum / Split / Merge” from POLYPHONIC.',
      action: { kind: 'add', type: 'polymix', as: 'mix' },
    },
    {
      text: 'The voices in…',
      task: 'Patch P-VCA’s OUT into POLY MIX’s POLY IN.',
      action: { kind: 'connect', from: ['vca', 'out'], to: ['mix', 'in'] },
    },
    {
      text: '…and their sum out to the speakers.',
      task: 'Patch POLY MIX’s SUM into OUT’s L input.',
      action: { kind: 'connect', from: ['mix', 'sum'], to: ['out', 'l'] },
    },
    powerStep('Switch on.', 'Silence until you play.'),
    {
      text: 'Your computer keyboard plays notes: A is C, the keys along that row are the white notes and the row above the black ones.',
      task: 'Hold A, E and G together (C, E♭ and G: a C minor chord).',
      listen: 'A chord: three notes at once. Watch POLY·CV’s lights: one per voice in use.',
      action: { kind: 'play', notes: [0, 3, 7], spacing: 0, hold: 1.6 },
    },
    {
      text: 'VOICES is how many notes can sound at once. Hold more keys than that and the oldest note is taken for the new one (voice stealing).',
      task: 'Turn POLY·CV’s VOICES down to 2, then play the chord again.',
      listen: 'Only two of the three notes sound.',
      target: { mod: 'keys', param: 'voices' },
      action: { kind: 'set', mod: 'keys', param: 'voices', value: 2 },
      then: [{ kind: 'play', notes: [0, 3, 7], spacing: 0, hold: 1.4 }],
    },
    {
      text: 'Back to plenty of voices.',
      task: 'Turn VOICES up to 6.',
      target: { mod: 'keys', param: 'voices' },
      action: { kind: 'set', mod: 'keys', param: 'voices', value: 6 },
    },
    {
      text: 'A slow attack and a long release turn plucked chords into a pad, the way string sections swell.',
      task: 'Turn P-ADSR’s ATTACK up to about 0.6 s, then play a chord.',
      listen: 'The chord swells in instead of starting at once.',
      target: { mod: 'env', param: 'a' },
      action: { kind: 'set', mod: 'env', param: 'a', value: 0.6 },
      then: [{ kind: 'play', notes: [0, 3, 7], spacing: 0, hold: 2 }],
    },
    {
      text: 'And let it fade out slowly.',
      task: 'Turn RELEASE up to about 2 s, then play a chord and let go.',
      listen: 'The chord lingers and dies away after you let go.',
      target: { mod: 'env', param: 'r' },
      action: { kind: 'set', mod: 'env', param: 'r', value: 2 },
      then: [{ kind: 'play', notes: [5, 8, 12], spacing: 0, hold: 1.5 }],
    },
    {
      text: 'That’s a polysynth: the same blocks as before, one per voice, on poly cables. P-LADDER adds a filter per voice. FM-4 and SWARM in POLYPHONIC are whole polysynths in one module, playable straight from the keys.',
    },
  ],
}
