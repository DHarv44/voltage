import type { Lesson } from '../types'
import { emptyRack, powerStep, volumeStep } from './common'

/** 4 — LFO modulation: wah and vibrato. */
export const modulation: Lesson = {
  id: 'modulation',
  title: '4 · Modulation: movement',
  summary: 'An LFO moving the filter (wah) and the pitch (vibrato).',
  build: emptyRack,
  steps: [
    {
      text: 'Modulation means one module turning another module’s knob for you. We’ll build a filtered oscillator, then add an LFO to move it.',
    },
    {
      text: 'The sound source.',
      task: 'Add “Oscillator” from SOURCES.',
      action: { kind: 'add', type: 'vco', as: 'vco' },
    },
    {
      text: 'A filter for the LFO to move (you met it in lesson 2).',
      task: 'Add “Ladder Filter” from FILTERS.',
      action: { kind: 'add', type: 'vcf', as: 'vcf' },
    },
    {
      text: 'An LFO (low-frequency oscillator) is an oscillator that vibrates too slowly to hear — under about 20 times a second. Too slow for a tone, perfect for movement. It’s in MODULATION.',
      task: 'Add “Low-Frequency Oscillator” from MODULATION.',
      action: { kind: 'add', type: 'lfo', as: 'lfo' },
    },
    {
      text: 'And the output.',
      task: 'Add “Audio Output” from I/O.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    volumeStep(),
    powerStep('Switch on (silent for now).'),
    {
      text: 'The filtered sound goes to your speakers.',
      task: 'Patch the filter’s 24dB output into OUT’s L input.',
      action: { kind: 'connect', from: ['vcf', 'lp4'], to: ['out', 'l'] },
    },
    {
      text: 'A low note, so the movement is easy to hear (and gentle).',
      task: 'Turn the VCO’s FREQ down to −1.',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: -1 },
    },
    {
      text: 'Now the sawtooth into the filter.',
      task: 'Patch the VCO’s SAW into the filter’s IN.',
      listen: 'A warm, filtered buzz — steady, nothing moving yet.',
      action: { kind: 'connect', from: ['vco', 'saw'], to: ['vcf', 'in'] },
    },
    {
      text: 'A little resonance makes the filter’s movement easier to hear.',
      task: 'Turn the filter’s RESONANCE up to about 50 %.',
      listen: 'A slightly vocal edge on the tone.',
      target: { mod: 'vcf', param: 'res' },
      action: { kind: 'set', mod: 'vcf', param: 'res', value: 0.5 },
    },
    {
      text: 'The filter’s CV input lets a voltage move its cutoff — as if a hand were turning the CUTOFF knob.',
      task: 'Patch the LFO’s TRI output into the filter’s CV input.',
      listen: 'No change yet: the filter’s CV AMT knob is at zero.',
      action: { kind: 'connect', from: ['lfo', 'tri'], to: ['vcf', 'cv'] },
    },
    {
      text: 'CV AMT sets how far the LFO moves the cutoff.',
      task: 'Turn the filter’s CV AMT up to about 70 %.',
      listen: 'A rhythmic wah-wah, about once a second, as the filter opens and closes.',
      target: { mod: 'vcf', param: 'cv' },
      action: { kind: 'set', mod: 'vcf', param: 'cv', value: 0.7 },
    },
    {
      text: 'RATE is the LFO’s speed.',
      task: 'Turn the LFO’s RATE up to about 6 Hz.',
      listen: 'A fast bubbling wobble.',
      target: { mod: 'lfo', param: 'rate' },
      action: { kind: 'set', mod: 'lfo', param: 'rate', value: 6 },
    },
    {
      text: 'Slow movements feel like breathing.',
      task: 'Turn RATE down to about 0.3 Hz.',
      listen: 'The tone slowly opens and closes over several seconds.',
      target: { mod: 'lfo', param: 'rate' },
      action: { kind: 'set', mod: 'lfo', param: 'rate', value: 0.3 },
    },
    {
      text: 'The same LFO can move the pitch too: that’s vibrato. An output can feed more than one input.',
      task: 'Patch the LFO’s TRI into the VCO’s FM input as well.',
      listen: 'No change yet: the VCO’s FM knob is at zero.',
      action: { kind: 'connect', from: ['lfo', 'tri'], to: ['vco', 'fm'] },
    },
    {
      text: 'FM is how much the incoming voltage bends the pitch. Vibrato needs only a little.',
      task: 'Turn the VCO’s FM up to about 6 %.',
      listen: 'The pitch slowly wavers up and down along with the wah. (Try RATE around 5 Hz for a singer’s vibrato.)',
      target: { mod: 'vco', param: 'fm' },
      action: { kind: 'set', mod: 'vco', param: 'fm', value: 0.06 },
    },
    {
      text: 'That’s modulation: any output can turn any knob that has a CV input. Oscillators, filters, envelopes, VCAs and modulation — you now know the building blocks of every synth in this rack.',
    },
  ],
}
