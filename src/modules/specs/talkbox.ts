import type { ModuleSpec } from '../types'
import { PEDAL_BLACK } from './panels'

/** Vowels along the mouth's front-back path (VOWEL 0 → 1). */
export const TALK_VOWELS = ['U', 'O', 'A', 'E', 'I']

/** Talk box. The sound is piped into a mouth: drag on the mouth to shape it
 *  (left-right = vowel U-O-A-E-I, up-down = jaw open), or drive VOWEL and OPEN
 *  with CV. Three vocal-tract formants plus the tube's own resonance. */
export const talkbox: ModuleSpec = {
  type: 'talkbox',
  title: 'TALK BOX',
  name: 'Talk Box',
  tagline: 'Make your synth talk: drag the mouth (vowel × jaw) or CV it; formant vocal tract + tube',
  category: 'Pedals',
  hp: 12,
  panel: PEDAL_BLACK,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'vowel', label: 'VOWEL' },
    { id: 'open', label: 'OPEN' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'vowel', label: 'VOWEL', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'open', label: 'OPEN', min: 0, max: 1, def: 0.7, unit: '%' },
    { id: 'reso', label: 'RESO', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'tube', label: 'TUBE', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1.5, def: 1, unit: '%' },
  ],
  controls: [
    { kind: 'surface', name: 'mouth', x: 5, y: 15, w: 50.96, h: 42 },
    { kind: 'knob', param: 'reso', x: 15, y: 70, size: 'S' },
    { kind: 'knob', param: 'tube', x: 30.5, y: 70, size: 'S' },
    { kind: 'knob', param: 'level', x: 46, y: 70, size: 'S' },
    { kind: 'in', jack: 'in', x: 12, y: 96 },
    { kind: 'in', jack: 'vowel', x: 30.5, y: 96 },
    { kind: 'in', jack: 'open', x: 49, y: 96 },
    { kind: 'out', jack: 'out', x: 30.5, y: 113.5 },
  ],
}
