import type { ModuleSpec } from '../types'
import { CREAM } from './panels'

export const BOWLL = {
  /** Loudness of the fundamental 0..1 and rubbing speed (rev/s). */
  level: 0,
  rub: 1,
  chatter: 2,
} as const

/** Singing bowl. Circle the rim with the pointer to bow it (stick-slip
 *  friction locks onto the bowl's lowest mode and builds the tone slowly; go
 *  too fast and it chatters), or click the middle to strike it. Each mode is a
 *  slightly split pair, so the tone beats ("wah-wah"); WATER lowers the pitch
 *  and makes it waver. RUB CV bows it from the rack. */
export const bowl: ModuleSpec = {
  type: 'bowl',
  title: 'SINGING BOWL',
  name: 'Singing Bowl',
  tagline: 'Bow the rim (circle it) or strike it; beating mode pairs, chatter if you rub too fast, water',
  category: 'Sources',
  hp: 14,
  panel: CREAM,
  inputs: [
    { id: 'strike', label: 'STRIKE' },
    { id: 'rub', label: 'RUB' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'env', label: 'ENV' },
  ],
  params: [
    { id: 'pitch', label: 'SIZE', min: 120, max: 800, def: 260, curve: 'exp', unit: 'Hz' },
    { id: 'water', label: 'WATER', min: 0, max: 1, def: 0, unit: '%' },
    { id: 'decay', label: 'RING', min: 3, max: 40, def: 14, curve: 'exp', unit: 's' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  leds: 3,
  controls: [
    { kind: 'surface', name: 'bowl', x: 5, y: 15, w: 61, h: 54 },
    // knobs share the jacks' columns (12 / 26 / 44 / 58)
    ...['pitch', 'water', 'decay', 'level'].map((param, i) => ({ kind: 'knob' as const, param, x: [12, 26, 44, 58][i], y: 80, size: 'S' as const })),
    { kind: 'in', jack: 'strike', x: 12, y: 104 },
    { kind: 'in', jack: 'rub', x: 26, y: 104 },
    { kind: 'out', jack: 'env', x: 44, y: 113.5 },
    { kind: 'out', jack: 'out', x: 58, y: 113.5 },
  ],
}
