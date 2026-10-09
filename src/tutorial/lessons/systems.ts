import type { Lesson } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** GROOVE-1: a drum machine with a step grid. */
export const grooveLesson: Lesson = {
  id: 'groove',
  title: 'Drum machine: GROOVE-1',
  summary: 'Five analog drums and a 16-step grid in one panel: program a beat, swing it, add a fill.',
  build: emptyRack,
  steps: [
    {
      text: 'A drum machine is drum voices and a step sequencer in one box. GROOVE-1 has five analog drums, pads to play them, and a grid: one row per drum, sixteen steps across a bar.',
    },
    {
      text: 'The speakers first.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'It’s in SYSTEMS.',
      task: 'Add “GROOVE-1 Drum Machine” from SYSTEMS.',
      action: { kind: 'add', type: 'groove', as: 'gr' },
    },
    {
      text: 'MIX in its patch bay is all five drums together.',
      task: 'Patch GROOVE-1’s MIX into OUT’s L input.',
      action: { kind: 'connect', from: ['gr', 'mix'], to: ['out', 'l'] },
    },
    powerStep('Switch on.'),
    {
      text: 'RUN starts the sequencer. The pattern it comes with is a classic house beat: kick on every beat, snare on 2 and 4, hats between.',
      task: 'Flip RUN on.',
      listen: 'A house beat. Watch the light run along the grid.',
      target: { mod: 'gr', param: 'run' },
      action: { kind: 'set', mod: 'gr', param: 'run', value: 1 },
    },
    {
      text: 'Each lit key is a hit. The top row is the kick (BD). A kick on step 15, just before the bar ends, pushes into the next one.',
      task: 'Click step 15 on the BD row to light it.',
      listen: 'A double kick at the end of every bar.',
      action: { kind: 'step', mod: 'gr', param: 'a0', bit: 14, on: true },
    },
    {
      text: 'The CP row (clap) is empty. Claps on 5 and 13 double the snare’s backbeat.',
      task: 'Light step 5 on the CP row.',
      action: { kind: 'step', mod: 'gr', param: 'a2', bit: 4, on: true },
    },
    {
      text: 'And the second backbeat.',
      task: 'Light step 13 on the CP row.',
      listen: 'Claps layered on the snare: a fatter backbeat.',
      action: { kind: 'step', mod: 'gr', param: 'a2', bit: 12, on: true },
    },
    {
      text: 'SWING delays every second sixteenth a little, turning a straight beat into a shuffle.',
      task: 'Turn SWING up to about 40 %.',
      listen: 'The hats lope: the beat starts to bounce.',
      target: { mod: 'gr', param: 'swing' },
      action: { kind: 'set', mod: 'gr', param: 'swing', value: 0.4 },
    },
    {
      text: 'Each drum has two knobs above its pad. The kick’s DECAY is how long it booms.',
      task: 'Turn the kick’s DECAY up to about 0.9 s.',
      listen: 'A long, booming 808-style kick.',
      target: { mod: 'gr', param: 'bd_decay' },
      action: { kind: 'set', mod: 'gr', param: 'bd_decay', value: 0.9 },
    },
    {
      text: 'GROOVE-1 holds two patterns. A→B plays them in turn: B is a busier fill, so every second bar breaks out.',
      task: 'Set the PATTERN switch to A→B.',
      listen: 'Every other bar, extra kicks and a snare pickup.',
      target: { mod: 'gr', param: 'pat' },
      action: { kind: 'set', mod: 'gr', param: 'pat', value: 2 },
    },
    {
      text: 'That’s a drum machine. Its patch bay goes further: CLK out can step a sequencer in time (the Acid House rack does), and a cable into a drum’s trigger input takes it away from the grid.',
    },
  ],
}

/** LOCKSTEP: a groovebox's tracks, patterns and mutes. */
export const lockstepLesson: Lesson = {
  id: 'lockstep',
  title: 'Groovebox: LOCKSTEP',
  summary: 'Four FM tracks on one box: pick a track, add notes, mute for a breakdown, change pattern on the bar.',
  build: emptyRack,
  steps: [
    {
      text: 'A groovebox is a drum machine and synths with their sequencer, built for playing live. LOCKSTEP has four tracks (kick, bass, hats, bell), each its own FM synth with sixteen steps.',
    },
    {
      text: 'The speakers first.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'It’s in SYSTEMS.',
      task: 'Add “LOCKSTEP FM Groovebox” from SYSTEMS.',
      action: { kind: 'add', type: 'lockstep', as: 'ls' },
    },
    {
      text: 'It plays in stereo: L…',
      task: 'Patch LOCKSTEP’s L into OUT’s L input.',
      action: { kind: 'connect', from: ['ls', 'l'], to: ['out', 'l'] },
    },
    {
      text: '…and R.',
      task: 'Patch LOCKSTEP’s R into OUT’s R input.',
      action: { kind: 'connect', from: ['ls', 'r'], to: ['out', 'r'] },
    },
    powerStep('Switch on.'),
    {
      text: 'Everything is on its face. ▶ PLAY starts it.',
      task: 'Press ▶ PLAY on LOCKSTEP’s face.',
      listen: 'Kick, a lazy bassline, hats and a bell. The screen shows all four tracks’ steps.',
      target: { mod: 'ls', param: 'run' },
      action: { kind: 'set', mod: 'ls', param: 'run', value: 1 },
    },
    {
      text: 'T1–T4 pick the track the step keys and knobs work on.',
      task: 'Press T2 (the bass).',
      listen: 'The step keys now show the bass line.',
      target: { mod: 'ls', param: 'trk' },
      action: { kind: 'set', mod: 'ls', param: 'trk', value: 1 },
    },
    {
      text: 'Click a step key to add a note there.',
      task: 'Click step key 9.',
      listen: 'An extra bass note on the third beat.',
      action: { kind: 'step', mod: 'ls', param: 'tr1', bit: 8, on: true },
    },
    {
      text: 'The pages (FM, AMP, FX…) change what the four knobs do. FX holds the filter.',
      task: 'Press the FX page button.',
      target: { mod: 'ls', param: 'page' },
      action: { kind: 'set', mod: 'ls', param: 'page', value: 2 },
    },
    {
      text: 'The first knob on FX is the bass’s CUTOFF.',
      task: 'Turn CUTOFF up to about 75 %.',
      listen: 'A brighter, buzzier bass.',
      target: { mod: 'ls', param: 'k1_8' },
      action: { kind: 'set', mod: 'ls', param: 'k1_8', value: 0.75 },
    },
    {
      text: 'Live, you build tension by taking parts out. Hold a track button (or right-click it) to mute it.',
      task: 'Hold T1 (or right-click it) to mute the kick.',
      listen: 'The kick drops out: a breakdown.',
      target: { mod: 'ls', param: 'mute0' },
      action: { kind: 'set', mod: 'ls', param: 'mute0', value: 1 },
    },
    {
      text: 'And bring it back for the drop.',
      task: 'Hold (or right-click) T1 again.',
      listen: 'Kick back in.',
      target: { mod: 'ls', param: 'mute0' },
      action: { kind: 'set', mod: 'ls', param: 'mute0', value: 0 },
    },
    {
      text: 'A–D are four patterns. A new one waits for the end of the bar, so changes always land on the beat.',
      task: 'Press B.',
      listen: 'B blinks, then at the bar a busier variation takes over.',
      target: { mod: 'ls', param: 'pat' },
      action: { kind: 'set', mod: 'ls', param: 'pat', value: 1 },
    },
    {
      text: 'CHAIN plays patterns in turn, a bar each (A A B C to start with): an arrangement.',
      task: 'Tap CHAIN.',
      listen: 'The groove, the groove, the variation, the breakdown, and round again.',
      target: { mod: 'ls', param: 'chon' },
      action: { kind: 'set', mod: 'ls', param: 'chon', value: 1 },
    },
    {
      text: 'Its signature trick is the parameter lock: right-click a step to pick it, then turn a knob, and that knob changes on that step only. Try it on a hat for an open one.',
    },
  ],
}
