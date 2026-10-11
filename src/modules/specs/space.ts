import type { Control, ModuleSpec } from '../types'
import { opts, pct, simpleSpec } from './build'
import { BLACK } from './panels'

/** SPACE: put a sound somewhere around your head (headphones). */
export const space: ModuleSpec = simpleSpec({
  type: 'space',
  title: 'SPACE',
  name: '3D Binaural Panner',
  tagline: 'Places a sound around your head for headphones: in front, behind, above, near or far; the ear-to-ear delay, head shadow, ear shape, distance and Doppler as it moves',
  category: 'Amps & Mixers',
  hp: 14,
  panel: BLACK,
  params: [
    { id: 'az', label: 'AROUND', min: -180, max: 180, def: 40 },
    { id: 'el', label: 'HEIGHT', min: -40, max: 90, def: 0 },
    { id: 'dist', label: 'DISTANCE', min: 0.3, max: 20, def: 2, curve: 'exp' },
    pct('room', 'ROOM', 0.2),
    opts('doppler', 'DOPPLER', ['OFF', 'ON'], 1),
  ],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'azcv', label: 'AROUND CV' },
    { id: 'elcv', label: 'HEIGHT CV' },
    { id: 'dcv', label: 'DIST CV' },
  ],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  leds: 3,
  rows: [['k:az', 'k:el', 'k:dist'], ['ks:room', 's:doppler'], ['i:in', 'i:azcv', 'i:elcv', 'i:dcv'], ['o:l', 'o:r']],
  top: (top, w) => [{ kind: 'surface', name: 'space', x: 4, y: 14, w: w - 8, h: top - 15.5 - 14 } as Control],
})
