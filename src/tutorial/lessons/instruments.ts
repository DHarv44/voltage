import type { Lesson, SurfaceDemo } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** A hand gliding over the theremin: up a phrase and back, then away. */
const WAVE: SurfaceDemo[] = [
  ...[0.3, 0.36, 0.42, 0.5, 0.56, 0.5, 0.44, 0.38].map((x, i) => ({ name: 'hand', x, y: 0.25, down: true, at: i * 0.35 })),
  { name: 'hand', x: 0, y: 1, down: false, at: 3 },
]

/** Press a chord button (OMNICHORD: column = root, row = MAJ / MIN / 7TH), let go. */
const chord = (root: number, type: number, at: number, len = 0.4): SurfaceDemo[] => [
  { name: 'chord', x: root, y: type, down: true, at },
  { name: 'chord', x: root, y: type, down: false, at: at + len },
]
/** A finger swept up the strum plate. */
const strum = (at: number): SurfaceDemo[] => [
  ...Array.from({ length: 14 }, (_, i) => ({ name: 'strum', x: i / 13, y: 0, down: true, at: at + i * 0.05 })),
  { name: 'strum', x: 0, y: 0, down: false, at: at + 0.75 },
]
const A = 6
const F = 2
const G = 4
const MAJ = 0
const MIN = 1

/** The theremin: played without touching. */
export const thereminLesson: Lesson = {
  id: 'theremin',
  title: 'Instruments: the theremin',
  summary: 'Play pitch and volume with the pointer alone, then snap it in tune.',
  build: emptyRack,
  steps: [
    {
      text: 'Some modules are instruments you play with the pointer, no keyboard needed. The theremin was the first electronic instrument: you play it without touching it, one hand near a rod for pitch, the other near a loop for volume.',
    },
    {
      text: 'The speakers first.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'It’s in INSTRUMENTS.',
      task: 'Add “Theremin” from INSTRUMENTS.',
      action: { kind: 'add', type: 'theremin', as: 'th' },
    },
    {
      text: 'Its OUT is the sound.',
      task: 'Patch the theremin’s OUT into OUT’s L input.',
      action: { kind: 'connect', from: ['th', 'out'], to: ['out', 'l'] },
    },
    powerStep('Switch on.', 'Silence until a hand comes near.'),
    {
      text: 'The dark panel is the space between the antennas. Further right is nearer the pitch rod (higher); further down is nearer the volume loop (quieter). Just hover: no clicking.',
      task: 'Move the pointer slowly over the theremin’s panel.',
      listen: 'The famous swooping, singing tone, sliding between every pitch.',
      action: { kind: 'touch', mod: 'th', demo: WAVE },
    },
    {
      text: 'Real thereminists hit notes by ear. SNAP pulls each pitch toward the nearest semitone, so it’s easier to play in tune.',
      task: 'Turn SNAP up to about 80 %, then play again.',
      listen: 'Notes now settle onto real pitches; the swoops between them remain.',
      target: { mod: 'th', param: 'snap' },
      action: { kind: 'set', mod: 'th', param: 'snap', value: 0.8 },
    },
    {
      text: 'TIMBRE goes from the pure, flute-like original to a reedier, brighter tone.',
      task: 'Turn TIMBRE up to about 80 %, then play.',
      listen: 'Brighter and more nasal, like a voice or a cello.',
      target: { mod: 'th', param: 'timbre' },
      action: { kind: 'set', mod: 'th', param: 'timbre', value: 0.8 },
    },
    {
      text: 'Its PITCH, VOL and GATE outputs are voltages too: patch PITCH into any oscillator’s 1V/OCT and VOL into a VCA, and your hand plays that synth.',
    },
  ],
}

/** The omnichord: chord buttons and a strum plate. */
export const omnichordLesson: Lesson = {
  id: 'omnichord',
  title: 'Instruments: the omnichord',
  summary: 'Press a chord, strum the plate: an electronic autoharp with its own bass.',
  build: emptyRack,
  steps: [
    {
      text: 'The omnichord is an electronic autoharp: press a chord button with one hand, strum the plate with the other. Each chord brings its own bass and pad.',
    },
    {
      text: 'The speakers first.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'It’s in INSTRUMENTS.',
      task: 'Add “Omnichord” from INSTRUMENTS.',
      action: { kind: 'add', type: 'omnichord', as: 'om' },
    },
    {
      text: 'OUT carries everything: bass, chord pad and the strummed harp.',
      task: 'Patch the omnichord’s OUT into OUT’s L input.',
      action: { kind: 'connect', from: ['om', 'out'], to: ['out', 'l'] },
    },
    powerStep('Switch on.', 'Silence until you press a chord.'),
    {
      text: 'The buttons on the left are chords: each column a root note, the rows major, minor and seventh. Holding one plays its bass and a soft pad.',
      task: 'Press and hold the A minor button (column A, MIN row).',
      listen: 'A low bass and a soft A minor chord, for as long as you hold it.',
      action: { kind: 'touch', mod: 'om', name: 'chord', demo: chord(A, MIN, 0, 1.6) },
    },
    {
      text: 'The plate on the right is the harp: sweep across it and it plays the last chord’s notes one by one, low at the bottom, high at the top.',
      task: 'Drag up across the strum plate.',
      listen: 'A rippling harp run through the chord. It remembers the last chord you pressed.',
      action: { kind: 'touch', mod: 'om', name: 'strum', demo: strum(0) },
    },
    {
      text: 'Chord, strum, next chord: A minor, F major, G major and back is the shape of countless songs.',
      task: 'Play F major, then G major, strumming each.',
      listen: 'A whole progression from two hands.',
      action: { kind: 'touch', mod: 'om', name: 'chord', demo: [...chord(F, MAJ, 0), ...strum(0.5), ...chord(G, MAJ, 1.5), ...strum(2), ...chord(A, MIN, 3), ...strum(3.5)] },
    },
    {
      text: 'SUSTAIN is how long each harp note rings.',
      task: 'Turn SUSTAIN up to about 3 s, then strum.',
      listen: 'The strums overlap into a shimmering wash.',
      target: { mod: 'om', param: 'sustain' },
      action: { kind: 'set', mod: 'om', param: 'sustain', value: 3 },
    },
    {
      text: 'Its NOTES output is the chord on a poly cable, and PITCH the harp’s note: play a polysynth or a sequence from it. Other played instruments are in INSTRUMENTS: the stylophone, harp, music box, tanpura and more.',
    },
  ],
}
