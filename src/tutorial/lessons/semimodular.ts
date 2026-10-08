import type { Lesson } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** Semi-modular: a whole synth pre-wired in one panel, and its normals. */
export const semimodular: Lesson = {
  id: 'semimodular',
  title: 'Semi-modular: normals',
  summary: 'MONO-1 plays with no cables; patching into its jacks breaks its hidden wiring, and pulling the cable puts it back.',
  build: emptyRack,
  steps: [
    {
      text: 'A semi-modular is a whole synth in one panel, wired up inside, so it plays with no cables at all. Its jacks (the patch bay) let you break that hidden wiring and send things elsewhere. The hidden connections are called normals.',
    },
    {
      text: 'The speakers first.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'MONO-1: an oscillator, a filter, an envelope, an LFO and a VCA, already connected keys → oscillator → filter → VCA. It’s in SYSTEMS.',
      task: 'Add “MONO-1 Semi-Modular Voice” from SYSTEMS.',
      action: { kind: 'add', type: 'mono', as: 'mono' },
    },
    {
      text: 'Its VCA output is the finished sound: the one cable it needs.',
      task: 'Patch MONO-1’s VCA output into OUT’s L input.',
      action: { kind: 'connect', from: ['mono', 'vca'], to: ['out', 'l'] },
    },
    powerStep('Switch on.', 'Silence until you play.'),
    {
      text: 'The keys are wired in already: no MIDI·CV, no envelope or VCA to patch.',
      task: 'Play a few keys (A, S, D…).',
      listen: 'A complete synth voice from a single cable.',
      action: { kind: 'play', notes: [0, 3, 7, 3] },
    },
    {
      text: 'The knobs are grouped by section, left to right, in the order the sound flows. CUTOFF is the filter, as on the LADDER.',
      task: 'Turn CUTOFF down to about 400 Hz, then play.',
      listen: 'Darker and rounder.',
      target: { mod: 'mono', param: 'cutoff' },
      action: { kind: 'set', mod: 'mono', param: 'cutoff', value: 400 },
      then: [{ kind: 'play', notes: [0, 7] }],
    },
    {
      text: 'Inside, the envelope is already wired to the filter (a normal); ENV AMT sets how far it opens the filter on each note.',
      task: 'Turn ENV AMT up to about 80 %, then play.',
      listen: 'Each note now opens bright and closes: a “wow”.',
      target: { mod: 'mono', param: 'envamt' },
      action: { kind: 'set', mod: 'mono', param: 'envamt', value: 0.8 },
      then: [{ kind: 'play', notes: [0, 7] }],
    },
    {
      text: 'Inside, the envelope also opens the VCA. The VCA CV jack is where that wire arrives: patch something else in and it takes the envelope’s place. Try the LFO.',
      task: 'Patch MONO-1’s LFO output into its own VCA CV input.',
      listen: 'It pulses by itself, no keys needed: the LFO is opening the VCA now, not the envelope. Keys only change the note.',
      action: { kind: 'connect', from: ['mono', 'lfo'], to: ['mono', 'vcacv'] },
    },
    {
      text: 'The LFO’s RATE sets the pulse.',
      task: 'Turn RATE to about 6 Hz.',
      listen: 'A fast tremolo.',
      target: { mod: 'mono', param: 'lrate' },
      action: { kind: 'set', mod: 'mono', param: 'lrate', value: 6 },
    },
    {
      text: 'Pulling the cable out puts the normal back. Right-click a jack to pull its cable.',
      task: 'Right-click MONO-1’s VCA CV jack to pull the cable out.',
      listen: 'Silence until you play: the envelope is back in charge of the VCA.',
      action: { kind: 'disconnect', to: ['mono', 'vcacv'] },
    },
    {
      text: 'That’s semi-modular: playable as it comes, re-wireable a jack at a time. STUDIO-3, GROOVE-1, KIN-8 and UNDERTONE in SYSTEMS work the same way; hover any jack to see what it does.',
    },
  ],
}
