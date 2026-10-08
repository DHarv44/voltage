import type { Lesson } from '../types'
import { powerStep } from './common'
import { afterEnvelopes } from './racks'

/** 4 — LFO modulation: wah and vibrato. */
export const modulation: Lesson = {
  id: 'modulation',
  title: '4 · Modulation: movement',
  summary: 'An LFO moving the filter (wah) and the pitch (vibrato).',
  build: afterEnvelopes,
  steps: [
    {
      text: 'Your rack now plays plucks from the keyboard. Modulation means one module turning another module’s knob for you. To hear movement, we first need a sound that keeps going.',
    },
    powerStep('Switch on (silent until you play: the envelope only opens the VCA for a note).'),
    {
      text: 'The VCA’s LEVEL opens it by hand; the envelope adds on top. Open it partway for a steady drone.',
      task: 'Turn the VCA’s LEVEL up to about 80 %.',
      listen: 'A steady tone, without pressing a key. Playing keys still changes the note.',
      target: { mod: 'vca', param: 'gain' },
      action: { kind: 'set', mod: 'vca', param: 'gain', value: 0.8 },
    },
    {
      text: 'A little resonance makes the filter’s movement easier to hear.',
      task: 'Turn the filter’s RESONANCE up to about 50 %.',
      listen: 'A slightly vocal edge on the tone.',
      target: { mod: 'vcf', param: 'res' },
      action: { kind: 'set', mod: 'vcf', param: 'res', value: 0.5 },
    },
    {
      text: 'An LFO (low-frequency oscillator) vibrates too slowly to hear — under about 20 times a second. Too slow for a tone, perfect for movement. It’s in ENVELOPES & LFOS.',
      task: 'Add “Low-Frequency Oscillator” from ENVELOPES & LFOS.',
      action: { kind: 'add', type: 'lfo', as: 'lfo' },
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
      text: 'The same LFO can move the pitch too: that’s vibrato. One output can feed several inputs.',
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
      text: 'That’s modulation: any output can turn any knob that has a CV input. Oscillators, filters, envelopes, VCAs and modulation: you now know the building blocks of every synth in this rack. Next: let the rack play by itself.',
    },
  ],
}
