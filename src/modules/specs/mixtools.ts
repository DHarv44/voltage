import type { Control, ModuleSpec, ParamSpec } from '../types'
import { pct, simpleSpec } from './build'
import { BLACK, CREAM } from './panels'

const hz = (id: string, label: string, min: number, max: number, def: number): ParamSpec => ({ id, label, min, max, def, curve: 'exp', unit: 'Hz' })
const db = (id: string, label: string, def = 0, range = 18): ParamSpec => ({ id, label, min: -range, max: range, def, unit: 'dB' })
const q = (id: string, label: string): ParamSpec => ({ id, label, min: 0.3, max: 8, def: 1, curve: 'exp' })
const sec = (id: string, label: string, min: number, max: number, def: number): ParamSpec => ({ id, label, min, max, def, curve: 'exp', unit: 's' })
const stereoIn: ModuleSpec['inputs'] = [
  { id: 'l', label: 'IN L' },
  { id: 'r', label: 'IN R' },
]
const stereoOut: ModuleSpec['outputs'] = [
  { id: 'ol', label: 'L' },
  { id: 'or', label: 'R' },
]

/** EQ: four bands, their curve drawn as you turn them. */
export const peq: ModuleSpec = simpleSpec({
  type: 'peq',
  title: 'EQ',
  name: 'Parametric EQ',
  tagline: 'Four bands (low shelf, two bells, high shelf) with the curve drawn on screen; stereo',
  category: 'Amps & Mixers',
  hp: 16,
  panel: CREAM,
  params: [
    hz('lf', 'LOW', 30, 600, 100),
    db('lg', 'LOW GAIN'),
    hz('m1f', 'MID 1', 80, 4000, 400),
    db('m1g', 'MID 1 GAIN'),
    q('m1q', 'MID 1 Q'),
    hz('m2f', 'MID 2', 400, 12000, 2500),
    db('m2g', 'MID 2 GAIN'),
    q('m2q', 'MID 2 Q'),
    hz('hf', 'HIGH', 1500, 16000, 8000),
    db('hg', 'HIGH GAIN'),
    db('out', 'OUTPUT', 0, 12),
  ],
  inputs: stereoIn,
  outputs: stereoOut,
  grid: true,
  rows: [
    ['ks:lf', 'ks:m1f', 'ks:m2f', 'ks:hf'],
    ['ks:lg', 'ks:m1g', 'ks:m2g', 'ks:hg'],
    ['ks:out', 'ks:m1q', 'ks:m2q', '-'],
    ['i:l', 'i:r', 'o:ol', 'o:or'],
  ],
  top: (top, w) => [{ kind: 'surface', name: 'peq', x: 4, y: 14, w: w - 8, h: top - 15.5 - 14 } as Control],
})

/** TRANSIENT: more or less attack, more or less sustain, whatever the level. */
export const transient: ModuleSpec = simpleSpec({
  type: 'transient',
  title: 'TRANSIENT',
  name: 'Transient Shaper',
  tagline: 'Sharpens or softens the attack of each hit and brings up or tucks away its tail, at any level',
  category: 'Amps & Mixers',
  hp: 8,
  panel: BLACK,
  params: [
    { id: 'att', label: 'ATTACK', min: -1, max: 1, def: 0.4, unit: '%' },
    { id: 'sus', label: 'SUSTAIN', min: -1, max: 1, def: -0.2, unit: '%' },
    db('out', 'OUTPUT', 0, 12),
  ],
  inputs: stereoIn,
  outputs: stereoOut,
  leds: 1,
  rows: [['k:att'], ['k:sus'], ['ks:out', 'l:0'], ['i:l', 'i:r'], ['o:ol', 'o:or']],
})

/** NOISE GATE: closes below the threshold (hiss between notes, bleed, the
 *  gated-reverb snare with a KEY). */
export const ngate: ModuleSpec = simpleSpec({
  type: 'ngate',
  title: 'GATE',
  name: 'Noise Gate',
  tagline: 'Silences what falls below a threshold: hiss and bleed gone, or the gated-reverb snare from a KEY',
  category: 'Amps & Mixers',
  hp: 8,
  panel: BLACK,
  params: [
    { id: 'thr', label: 'THRESHOLD', min: -70, max: 0, def: -36, unit: 'dB' },
    { id: 'range', label: 'RANGE', min: 0, max: 80, def: 60, unit: 'dB' },
    sec('att', 'ATTACK', 0.0001, 0.05, 0.0005),
    sec('hold', 'HOLD', 0.001, 1, 0.02),
    sec('rel', 'RELEASE', 0.005, 2, 0.12),
  ],
  inputs: [...stereoIn, { id: 'key', label: 'KEY' }],
  outputs: [...stereoOut, { id: 'gate', label: 'GATE' }],
  leds: 1,
  rows: [['k:thr', 'k:range'], ['ks:att', 'ks:hold', 'ks:rel'], ['l:0'], ['i:l', 'i:r', 'i:key'], ['o:ol', 'o:or', 'o:gate']],
})

/** OTT: three bands each squashed from above and lifted from below: dense,
 *  loud, every detail up front (the EDM over-compression). */
export const ott: ModuleSpec = simpleSpec({
  type: 'ott',
  title: 'OTT',
  name: 'Multiband Upward/Downward Compressor',
  tagline: 'Three bands squashed from above and pulled up from below: the dense, in-your-face EDM sound (DEPTH to taste)',
  category: 'Amps & Mixers',
  hp: 10,
  panel: CREAM,
  params: [
    pct('depth', 'DEPTH', 0.5),
    pct('time', 'TIME', 0.5),
    pct('up', 'UPWARD', 1),
    pct('down', 'DOWNWARD', 1),
    db('lo', 'LOW', 0, 12),
    db('mid', 'MID', 0, 12),
    db('hi', 'HIGH', 0, 12),
    db('in', 'IN GAIN', 0, 12),
    db('out', 'OUT GAIN', 0, 12),
  ],
  inputs: stereoIn,
  outputs: stereoOut,
  leds: 3,
  grid: true,
  rows: [['kl:depth', '-', 'k:time'], ['ks:up', '-', 'ks:down'], ['ks:lo', 'ks:mid', 'ks:hi'], ['l:0', 'l:1', 'l:2'], ['ks:in', '-', 'ks:out'], ['i:l', 'i:r', '-'], ['o:ol', 'o:or', '-']],
})
