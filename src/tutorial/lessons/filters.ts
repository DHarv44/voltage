import type { Lesson } from '../types'
import { powerStep } from './common'
import { afterFirstSound } from './racks'

/** 2 — filters: cutoff and resonance (subtractive synthesis). */
export const filters: Lesson = {
  id: 'filters',
  title: '2 · Filters shape the tone',
  summary: 'Low-pass filter: cutoff, resonance, the classic sweep.',
  build: afterFirstSound,
  steps: [
    {
      text: 'Picking up where lesson 1 left off: the VCO goes through the MULT to your speakers and the scope. Every wave but the sine is full of harmonics. A filter takes some of them away.',
    },
    powerStep('Switch on to hear where we left off.', 'The thin, nasal pulse from the end of lesson 1.'),
    {
      text: 'The LADDER is a low-pass filter: it lets low frequencies through and takes the highs away. It’s in FILTERS.',
      task: 'Add “Ladder Filter” from FILTERS.',
      action: { kind: 'add', type: 'vcf', as: 'vcf' },
    },
    {
      text: 'Filters show off best on low notes.',
      task: 'Turn the VCO’s FREQ down to −1.',
      listen: 'The pulse drops an octave.',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: -1 },
    },
    {
      text: 'CUTOFF is where the filter starts cutting. Close it most of the way, so the first thing through it is gentle.',
      task: 'Turn the filter’s CUTOFF down to about 200 Hz.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 200 },
    },
    {
      text: 'The filter goes between the oscillator and the MULT, so its output takes the VCO’s place in the MULT.',
      task: 'Patch the filter’s 24dB output into the MULT’s A input (it replaces the VCO’s cable).',
      listen: 'Silence: nothing is going into the filter yet.',
      action: { kind: 'connect', from: ['vcf', 'lp4'], to: ['mult', 'a'] },
    },
    {
      text: 'Now the brightest wave, the sawtooth, into the filter.',
      task: 'Patch the VCO’s SAW into the filter’s IN.',
      listen: 'A dark, muffled buzz — like music through a wall. The scope wave is smooth and round.',
      action: { kind: 'connect', from: ['vco', 'saw'], to: ['vcf', 'in'] },
    },
    {
      text: 'Open the filter and the harmonics come back. Heads-up: it gets bright.',
      task: 'Turn CUTOFF up to about 8 kHz.',
      listen: 'The full bright buzz of the raw saw; the scope shows the sharp ramp again.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 8000 },
    },
    {
      text: 'Bring it back to somewhere in between.',
      task: 'Turn CUTOFF down to about 1 kHz.',
      listen: 'Warmer: some buzz, but the top edge is gone.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 1000 },
    },
    {
      text: 'RESONANCE feeds the filter back into itself, boosting the frequencies right at the cutoff.',
      task: 'Turn RESONANCE up to about 85 %.',
      listen: 'A whistling, ringing edge appears on top of the tone.',
      target: { mod: 'vcf', param: 'res' },
      action: { kind: 'set', mod: 'vcf', param: 'res', value: 0.85 },
    },
    {
      text: 'Now sweep the cutoff with the resonance up: that ringing peak slides through the harmonics one by one.',
      task: 'Turn CUTOFF slowly down to about 250 Hz.',
      listen: 'The classic squelchy “wow” of acid basslines and synth leads.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 250 },
    },
    {
      text: 'Oscillators make harmonics, filters carve them away: that’s subtractive synthesis, how most analog synths work. But the sound never stops — next, notes that start and stop.',
    },
  ],
}
