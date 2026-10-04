import type { ModuleSpec } from '../types'
import { AMP } from './panels'

const R1 = [14, 33, 50, 67]

/** Valve guitar amp and speaker cabinet. Two triode preamp stages (asymmetric,
 *  with coupling caps between), a passive tone stack, a push-pull power stage
 *  whose supply sags under load, then the cabinet: speaker resonance,
 *  cone break-up and the mic (centre = bright, edge = dark). DI skips the cab. */
export const amp: ModuleSpec = {
  type: 'amp',
  title: 'VALVE AMP',
  name: 'Valve Amp + Cabinet',
  tagline: 'Two triode stages, tone stack, sagging push-pull power amp, then a miked 1×12 or 4×12 cabinet',
  category: 'Pedals',
  hp: 16,
  panel: AMP,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'gcv', label: 'GAIN' },
  ],
  outputs: [
    { id: 'out', label: 'CAB' },
    { id: 'di', label: 'DI' },
  ],
  params: [
    { id: 'gain', label: 'GAIN', min: 0, max: 1, def: 0.45, unit: '%' },
    { id: 'bass', label: 'BASS', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'mid', label: 'MIDDLE', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'treble', label: 'TREBLE', min: 0, max: 1, def: 0.55, unit: '%' },
    { id: 'presence', label: 'PRESENCE', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'master', label: 'MASTER', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'sag', label: 'SAG', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'mic', label: 'MIC', min: 0, max: 1, def: 0.3, unit: '%' },
    { id: 'cab', label: 'CAB', min: 0, max: 2, def: 2, stepped: true, options: ['OFF', '1×12', '4×12'] },
  ],
  controls: [
    { kind: 'knob', param: 'gain', x: R1[0], y: 28, size: 'L' },
    ...['bass', 'mid', 'treble'].map((param, i) => ({ kind: 'knob' as const, param, x: R1[i + 1], y: 28 })),
    ...['presence', 'master', 'sag', 'mic'].map((param, i) => ({ kind: 'knob' as const, param, x: R1[i], y: 52, size: 'S' as const })),
    { kind: 'switch', param: 'cab', x: 40.6, y: 74 },
    { kind: 'in', jack: 'in', x: 12, y: 99 },
    { kind: 'in', jack: 'gcv', x: 26, y: 99 },
    { kind: 'out', jack: 'di', x: 52, y: 113.5 },
    { kind: 'out', jack: 'out', x: 69, y: 113.5 },
  ],
}
