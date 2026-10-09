import type { Lesson, SurfaceDemo } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** The stylus drawn along the keys: A minor, up to F and back (key 0 = A3, a semitone each). */
const PHRASE = [0, 3, 5, 7, 8, 7, 5, 3]
const STYLUS: SurfaceDemo[] = [
  ...PHRASE.map((key, i) => ({ name: 'stylus', x: key, y: 0, down: true, at: i * 0.3 })),
  { name: 'stylus', x: 0, y: 0, down: false, at: PHRASE.length * 0.3 },
]

/** Harp strings (key of C: the white notes, string 14 = C4). A glissando up, then an A minor chord. */
const pluck = (s: number, at: number, vel = 0.8): SurfaceDemo => ({ name: 'pluck', x: s, y: vel, down: true, at })
const GLISS: SurfaceDemo[] = Array.from({ length: 15 }, (_, i) => pluck(7 + i, i * 0.06, 0.7))
const ARP: SurfaceDemo[] = [12, 14, 16, 19, 21, 23, 26].map((s, i) => pluck(s, i * 0.28))

/** The stylus organ. */
export const stylusLesson: Lesson = {
  id: 'stylus',
  title: 'Instruments: the stylus organ',
  summary: 'Draw a stylus along a metal keyboard: a buzzy pocket organ with a vibrato switch.',
  build: emptyRack,
  steps: [
    {
      text: 'A pocket stylus organ: a strip of metal keys you touch with a pen on a wire. Each key closes a circuit, so there are no chords, just one buzzy note at a time, and sliding along the strip slurs between them.',
    },
    {
      text: 'The speakers first.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'It’s in INSTRUMENTS.',
      task: 'Add “Stylus Organ” from INSTRUMENTS.',
      action: { kind: 'add', type: 'stylophone', as: 'st' },
    },
    {
      text: 'Its OUT is the sound.',
      task: 'Patch STYLUS’s OUT into OUT’s L input.',
      action: { kind: 'connect', from: ['st', 'out'], to: ['out', 'l'] },
    },
    powerStep('Switch on.', 'Silence until the stylus touches a key.'),
    {
      text: 'Press on the keys and drag along them: the note sounds while the stylus is down. The leftmost key is A.',
      task: 'Drag along the keys, slowly.',
      listen: 'A reedy, buzzy organ: the tone of a capacitor charging and snapping back, through a tiny speaker.',
      action: { kind: 'touch', mod: 'st', demo: STYLUS },
    },
    {
      text: 'The original had one effect: a vibrato switch that wobbles the pitch.',
      task: 'Flip VIBRATO on, then play again.',
      listen: 'A warbling wobble on every note.',
      target: { mod: 'st', param: 'vib' },
      action: { kind: 'set', mod: 'st', param: 'vib', value: 1 },
    },
    {
      text: 'OCTAVE moves the whole keyboard.',
      task: 'Set OCTAVE to LOW, then play.',
      listen: 'A growlier, bassier buzz.',
      target: { mod: 'st', param: 'octave' },
      action: { kind: 'set', mod: 'st', param: 'octave', value: 0 },
    },
    {
      text: 'Its PITCH and GATE outputs play the rest of the rack: patch them into a VCO’s 1V/OCT and an envelope’s GATE and the stylus plays your own synth.',
    },
  ],
}

/** The concert harp. */
export const harpLesson: Lesson = {
  id: 'harp',
  title: 'Instruments: the harp',
  summary: 'Pluck strings, sweep a glissando, and use the pedals to change key.',
  build: emptyRack,
  steps: [
    {
      text: 'A concert harp: 36 strings, one note each, tuned to a scale. Pluck one, or sweep across many for the harp’s famous glissando.',
    },
    {
      text: 'The speakers first.',
      task: 'Add “Audio Output” from OUTPUT.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'It’s in INSTRUMENTS.',
      task: 'Add “Concert Harp” from INSTRUMENTS.',
      action: { kind: 'add', type: 'harp', as: 'hp' },
    },
    {
      text: 'Its OUT is the sound.',
      task: 'Patch the harp’s OUT into OUT’s L input.',
      action: { kind: 'connect', from: ['hp', 'out'], to: ['out', 'l'] },
    },
    powerStep('Switch on.', 'Silence until a string is plucked.'),
    {
      text: 'Click a string to pluck it; drag across several to sweep them. Low strings on the left, high on the right.',
      task: 'Drag across the strings.',
      listen: 'A rippling glissando, every string ringing on.',
      action: { kind: 'touch', mod: 'hp', name: 'pluck', demo: GLISS },
    },
    {
      text: 'Plucked one at a time, the strings make chords and melodies. The red strings are the Cs, the blue ones the Fs, as on a real harp, so you can find your way.',
      task: 'Pluck a few strings one at a time: try A, C and E.',
      listen: 'An A minor chord, rising.',
      action: { kind: 'touch', mod: 'hp', name: 'pluck', demo: ARP },
    },
    {
      text: 'A harp is tuned to one key. Its pedals retune every string of a letter at once (all the Bs flat, say). KEY does that here.',
      task: 'Turn KEY to F, then sweep the strings.',
      listen: 'A brighter colour: every B is now B♭.',
      target: { mod: 'hp', param: 'key' },
      action: { kind: 'set', mod: 'hp', param: 'key', value: 5 },
    },
    {
      text: 'SUSTAIN is how long the strings ring.',
      task: 'Turn SUSTAIN up to about 2.5, then sweep.',
      listen: 'A shimmering wash as the strings keep ringing.',
      target: { mod: 'hp', param: 'sustain' },
      action: { kind: 'set', mod: 'hp', param: 'sustain', value: 2.5 },
    },
    {
      text: 'Its V/OCT and TRIG inputs let a sequencer play it (each note goes to the nearest string), and PITCH and GATE send what you pluck to the rest of the rack.',
    },
  ],
}
