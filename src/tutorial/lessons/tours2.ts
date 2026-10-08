import type { Lesson } from '../types'
import { powerStep } from './common'
import { presetRack } from './tours'

/** Jellyfish Dream: the creature is the composer. */
export const jellyTour: Lesson = {
  id: 'tour-jelly',
  title: 'Tour: Jellyfish Dream',
  summary: 'A creature plays the music: its pulses clock a melody, its sway shapes the sound, the notes colour it.',
  build: presetRack('jelly-dream', { tank: 'vision', turing: 'turing', quant: 'quant', wave: 'wave', func: 'func', plate: 'plate' }),
  steps: [
    {
      text: 'Nothing in this rack is a sequencer you program. A jellyfish plays it: every module listens to the creature in the VISION tank, and the tank listens back.',
    },
    powerStep('Switch on.', 'Slow bell-like notes, one each time the jellyfish pulses.'),
    {
      text: 'Each time the jellyfish’s bell contracts, VISION sends a pulse from GATE. That pulse is the clock for the whole piece. RATE is how fast the creature lives.',
      task: 'Turn VISION’s RATE up to about 60 %.',
      listen: 'It swims faster, so the notes come more often.',
      target: { mod: 'tank', param: 'rate' },
      action: { kind: 'set', mod: 'tank', param: 'rate', value: 0.6 },
    },
    {
      text: 'TURING makes the melody: a loop of random notes that repeats, with a chance (CHANGE) that each note is swapped for a new one as it comes round. Low CHANGE: a phrase that slowly evolves.',
      task: 'Turn CHANGE down to zero.',
      listen: 'The phrase locks: the same eight notes go round and round.',
      target: { mod: 'turing', param: 'change' },
      action: { kind: 'set', mod: 'turing', param: 'change', value: 0 },
    },
    {
      text: 'Random voltages aren’t notes yet. QUANT snaps each one to the nearest note of a scale: here DORIAN, a minor scale with a bright sixth.',
      target: { mod: 'quant', param: 'scale' },
    },
    {
      text: 'WAVE is a wavetable oscillator: it morphs through eight waves. VISION’s SWAY output (the tentacles’ swing) is patched to its WAVE CV, so the tone changes as the jellyfish drifts.',
      target: { mod: 'wave', param: 'wamt' },
    },
    {
      text: 'FUNC shapes each note’s volume: it rises and falls once per pulse. FALL is how long a note takes to fade.',
      task: 'Turn FUNC’s FALL up to about 5 s.',
      listen: 'The notes overlap into a slow wash.',
      target: { mod: 'func', param: 'fall' },
      action: { kind: 'set', mod: 'func', param: 'fall', value: 5 },
    },
    {
      text: 'And the tank listens back: the melody’s pitch goes to its HUE input, so every note re-colours the jellyfish, once round the colour wheel per octave.',
      target: { mod: 'tank', jack: 'hue', dir: 'in' },
    },
    {
      text: 'Click in the tank to touch the water: the jellyfish reacts, and so does the music. Any VISION creature can drive a rack like this.',
    },
  ],
}

/** Poly Strings: the polyphony lesson, grown up. */
export const stringsTour: Lesson = {
  id: 'tour-strings',
  title: 'Tour: Poly Strings',
  summary: 'A six-voice string pad: two envelopes per voice, then the string-machine chorus and a plate.',
  build: presetRack('poly-strings', { keys: 'polycv', vcf: 'pvcf', envF: 'padsr#1', envA: 'padsr#2', ens: 'ensemble', plate: 'plate' }),
  steps: [
    {
      text: 'A string pad in the style of the 70s string machines: six voices, a slow swell, a chorus that makes one oscillator per note sound like a section.',
    },
    powerStep('Switch on.', 'Silence until you play.'),
    {
      text: 'POLY·CV hands each key its own voice (six here).',
      task: 'Hold A, E and G together.',
      listen: 'A C minor chord that swells in and lingers after you let go.',
      target: { mod: 'keys', param: 'voices' },
      action: { kind: 'play', notes: [0, 3, 7], spacing: 0, hold: 2.5 },
    },
    {
      text: 'Each voice has two envelopes. The first opens its own filter: a slow ATTACK means the chord starts dark and brightens.',
      task: 'Turn the first P-ADSR’s ATTACK up to about 1.5 s, then play a chord.',
      listen: 'Each chord blooms from dull to bright.',
      target: { mod: 'envF', param: 'a' },
      action: { kind: 'set', mod: 'envF', param: 'a', value: 1.5 },
      then: [{ kind: 'play', notes: [5, 8, 12], spacing: 0, hold: 3 }],
    },
    {
      text: 'The second envelope is each voice’s volume. RELEASE is the tail after you let go.',
      target: { mod: 'envA', param: 'r' },
    },
    {
      text: 'P-LADDER is one filter per voice; CUTOFF sets where it rests between notes.',
      task: 'Turn CUTOFF down to about 500 Hz, then play.',
      listen: 'Softer, more distant strings.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 500 },
      then: [{ kind: 'play', notes: [0, 3, 7], spacing: 0, hold: 2.5 }],
    },
    {
      text: 'ENSEMBLE is the string machine’s secret: three delayed copies, each slowly wobbling in pitch, so one note becomes a shimmering section.',
      task: 'Turn ENSEMBLE’s MIX up to about 90 %, then play.',
      listen: 'Wider and lusher, gently shimmering.',
      target: { mod: 'ens', param: 'mix' },
      action: { kind: 'set', mod: 'ens', param: 'mix', value: 0.9 },
      then: [{ kind: 'play', notes: [-2, 2, 5], spacing: 0, hold: 2.5 }],
    },
    {
      text: 'The plate puts it in a hall. Now play chords slowly and let them ring into each other.',
      target: { mod: 'plate', param: 'mix' },
    },
  ],
}

/** West Coast: folding a sine instead of filtering a saw. */
export const westTour: Lesson = {
  id: 'tour-west',
  title: 'Tour: West Coast',
  summary: 'Random notes from sample & hold, and a sine folded brighter by its own envelope: the Buchla way.',
  build: presetRack('west-coast', { sh: 'sh', quant: 'quant', fold: 'fold', env: 'adsr', spring: 'spring', scope: 'scope' }),
  steps: [
    {
      text: 'Two schools of synthesis. East coast: start bright (a saw) and take away with a filter. West coast: start pure (a sine) and add harmonics by folding it. This rack is west coast.',
    },
    powerStep('Switch on: it plays itself.', 'Bright plucked notes wandering at random.'),
    {
      text: 'S&H (sample and hold) grabs whatever voltage is at its input on each clock pulse and holds it. With nothing patched in, it samples noise: a new random voltage every eighth note.',
      target: { mod: 'sh', jack: 'trig', dir: 'in' },
    },
    {
      text: 'An attenuator narrows the random range, and QUANT snaps it to DORIAN: random, but always in key.',
      target: { mod: 'quant', param: 'scale' },
    },
    {
      text: 'FOLD folds the sine back on itself whenever it would pass a limit, again and again: each fold adds harmonics. FOLDS sets how hard it’s pushed.',
      task: 'Turn FOLDS up to about 3.',
      listen: 'Brighter and more metallic, like a struck bar. Watch the scope: the sine grows ripples.',
      target: { mod: 'fold', param: 'fold' },
      action: { kind: 'set', mod: 'fold', param: 'fold', value: 3 },
    },
    {
      text: 'The envelope drives the folder too (FOLD’s CV), so each note starts bright and mellows as it fades, like a real plucked string. This is what a low-pass gate does on a Buchla.',
      target: { mod: 'fold', param: 'cv' },
    },
    {
      text: 'DECAY is how long each pluck rings.',
      task: 'Turn the envelope’s DECAY up to about 0.6 s.',
      listen: 'Longer notes that bloom and fade, overlapping in the spring.',
      target: { mod: 'env', param: 'd' },
      action: { kind: 'set', mod: 'env', param: 'd', value: 0.6 },
    },
    {
      text: 'The spring reverb adds the drip. Try SYMMETRY on FOLD for a hollower tone, or LPG in FILTERS for the real west-coast “bongo”.',
      target: { mod: 'spring', param: 'mix' },
    },
  ],
}
