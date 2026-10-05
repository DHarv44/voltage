import type { Lesson } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** 2 — filters: cutoff and resonance (subtractive synthesis). */
export const filters: Lesson = {
  id: 'filters',
  title: '2 · Filters shape the tone',
  summary: 'Low-pass filter: cutoff, resonance, the classic sweep.',
  build: emptyRack,
  steps: [
    {
      text: 'Last time the sawtooth was bright and buzzy: it’s full of harmonics. A filter takes some of them away. You’ll build this patch from an empty case again — it’s good practice.',
    },
    {
      text: 'First the sound source: an oscillator, from SOURCES.',
      task: 'Add “Oscillator” from SOURCES.',
      action: { kind: 'add', type: 'vco', as: 'vco' },
    },
    {
      text: 'The LADDER is a low-pass filter: it lets low frequencies through and takes the highs away. It’s in FILTERS.',
      task: 'Add “Ladder Filter” from FILTERS.',
      action: { kind: 'add', type: 'vcf', as: 'vcf' },
    },
    {
      text: 'The output, so you can hear it.',
      task: 'Add “Audio Output” from I/O.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    {
      text: 'And a scope, to watch the filter smooth the wave.',
      task: 'Add “Oscilloscope” from UTILITIES.',
      action: { kind: 'add', type: 'scope', as: 'scope' },
    },
    powerStep('Switch on (still silent: nothing is connected).'),
    {
      text: 'The filter’s 24dB output is the filtered sound. Send it to your speakers.',
      task: 'Patch the filter’s 24dB output into OUT’s L input.',
      listen: 'Still silent: the filter has nothing going into it yet.',
      action: { kind: 'connect', from: ['vcf', 'lp4'], to: ['out', 'l'] },
    },
    {
      text: 'One output can feed several inputs — no MULT needed. Drag a second cable from the same jack.',
      task: 'Patch the filter’s 24dB output into the SCOPE’s CH1 too.',
      action: { kind: 'connect', from: ['vcf', 'lp4'], to: ['scope', 'ch1'] },
    },
    {
      text: 'Filters show off best on low notes, and we’ll start gently: drop the oscillator an octave.',
      task: 'Turn the VCO’s FREQ down to −1.',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: -1 },
    },
    {
      text: 'CUTOFF is where the filter starts cutting. Close it most of the way before the saw goes in.',
      task: 'Turn the filter’s CUTOFF down to about 200 Hz.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 200 },
    },
    {
      text: 'Now the sawtooth, through the filter.',
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
      text: 'Oscillators make harmonics, filters carve them away: that’s subtractive synthesis, how most analog synths work. Next: making notes start and stop.',
    },
  ],
}
