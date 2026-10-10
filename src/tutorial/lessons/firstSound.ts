import type { Lesson } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** 1 — oscillators: pitch and timbre. */
export const firstSound: Lesson = {
  id: 'first-sound',
  title: '1 · Your first sound',
  summary: 'Oscillators: pitch, octaves and wave shapes (timbre).',
  build: emptyRack,
  steps: [
    {
      text: 'This is your rack: an empty case. A modular synth is built from separate modules, each doing one job, joined with patch cables. The list on the left is every module you can add. Let’s build the simplest instrument there is, one piece at a time.',
    },
    {
      text: 'Every synth sound starts with an oscillator: a circuit that vibrates back and forth hundreds of times a second. Ours is the VCO (voltage-controlled oscillator), in the OSCILLATORS section of the list.',
      task: 'Click “Oscillator” in the module list (or drag it into the rack).',
      action: { kind: 'add', type: 'vco', as: 'vco' },
    },
    {
      text: 'Vibrations are only sound once they reach your speakers. The OUT module is the rack’s connection to your speakers or headphones — nothing is heard without it. It’s in the OUTPUT section.',
      task: 'Add “Audio Output” from the OUTPUT section.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep('Before we make any sound, protect your ears: OUT’s VOLUME starts fairly high. Knobs turn with the scroll wheel over them (up = clockwise), or by dragging up and down.'),
    {
      text: 'A scope lets you see sound: it draws a voltage over time, so you can watch the shape of each wave while you hear it. It’s in VISUALS.',
      task: 'Add “Oscilloscope” from the VISUALS section.',
      action: { kind: 'add', type: 'scope', as: 'scope' },
    },
    {
      text: 'We want the oscillator in two places at once: your speakers and the scope. A MULT (multiple) copies one signal to several outputs — whatever goes into its A input comes out of each of the jacks below it.',
      task: 'Add “Buffered Multiple” from CV TOOLS.',
      action: { kind: 'add', type: 'mult', as: 'mult' },
    },
    {
      text: 'Tip: you can move any module by dragging its panel (not a knob or jack); drag it well over its neighbour and the two swap; just clipping one leaves it be. Arrange them however you like.',
    },
    powerStep('Now switch the rack on (nothing will sound yet: nothing is connected).'),
    {
      text: 'Patch cables carry signals between modules. Outputs are the jacks on dark plates; inputs are the plain ones. A cable always goes from an output to an input.',
      task: 'Drag a cable from the MULT’s first output to OUT’s L input.',
      listen: 'Still silent: the MULT has nothing in it yet. (OUT plays its L input in both speakers while R is empty.)',
      action: { kind: 'connect', from: ['mult', 'a1'], to: ['out', 'l'] },
    },
    {
      text: 'The second copy goes to the scope.',
      task: 'Drag a cable from the MULT’s second output to the SCOPE’s CH1 input.',
      action: { kind: 'connect', from: ['mult', 'a2'], to: ['scope', 'ch1'] },
    },
    {
      text: 'Now feed the oscillator into the MULT. We’ll start with a soft wave: the triangle.',
      task: 'Patch the VCO’s TRI output into the MULT’s A input.',
      listen: 'A soft, slightly reedy hum — and a zig-zag on the scope: the voltage rising and falling.',
      action: { kind: 'connect', from: ['vco', 'tri'], to: ['mult', 'a'] },
    },
    {
      text: 'FREQ sets how fast it vibrates — the pitch. One octave down is exactly half as many vibrations per second.',
      task: 'Turn FREQ down to −1.',
      listen: 'The same tone, an octave lower and rounder. The waves on the scope spread out.',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: -1 },
    },
    {
      text: 'And up: twice as many vibrations, an octave higher than where we started.',
      task: 'Turn FREQ up to +1.',
      listen: 'Higher and brighter; the waves squeeze together. (Next we bring it back down.)',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: 1 },
    },
    {
      text: 'Back to the middle before we change the wave shape.',
      task: 'Turn FREQ back to 0 (double-click a knob to reset it).',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: 0 },
    },
    {
      text: 'The shape of the wave is its timbre — why a flute and a violin sound different on the same note. The triangle has a few quiet harmonics (extra tones at 3×, 5×, 7× the pitch). The sawtooth has every harmonic, loud — the brightest, buzziest wave, and the raw material of most synth sounds. Heads-up: it’s loud.',
      task: 'Patch SAW into the MULT’s A input (a new cable replaces the old one).',
      listen: 'Bright and buzzy, like a brass section. The scope shows a ramp.',
      action: { kind: 'connect', from: ['vco', 'saw'], to: ['mult', 'a'] },
    },
    {
      text: 'A pulse wave has only the odd harmonics. (Its WIDTH knob changes how long it stays up versus down: narrower is thinner and more nasal.)',
      task: 'Patch PULSE into the MULT’s A input.',
      listen: 'Hollow and woody, like a clarinet. The scope shows a square.',
      action: { kind: 'connect', from: ['vco', 'sqr'], to: ['mult', 'a'] },
    },
    {
      text: 'And the gentlest of all: the sine, a single pure frequency with no harmonics at all.',
      task: 'Patch SIN into the MULT’s A input.',
      listen: 'A soft, pure hum, like a flute or a tuning fork. The scope shows a smooth curve.',
      action: { kind: 'connect', from: ['vco', 'sin'], to: ['mult', 'a'] },
    },
    {
      text: 'One last skill: to unplug, drag a cable out of an input, or right-click a jack to pull all its cables. Ctrl+Z undoes anything.',
    },
    {
      text: 'You built an instrument from nothing: an oscillator (FREQ for pitch, wave shape for timbre), a splitter, a scope and an output. Next lesson: filters, which carve those harmonics away.',
    },
  ],
}
