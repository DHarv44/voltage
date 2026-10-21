import type { Control, ModuleSpec } from '../types'
import { opts, simpleSpec } from './build'
import { BLACK } from './panels'
import { DRUM_OUTS } from '../../strudel/music'

/** STRUDEL CORE's LEDs: the cycle, an error flag, how many parts the piece has. */
export const SCL = { cycle: 0, error: 1, parts: 2 } as const
/** Parts a PART can pick (the engine's lane count). */
export const SP_PARTS = 16
/** How many parts CORE splits a piece into unless told otherwise. */
export const SP_DEFAULT_PARTS = 12

const transport = [
  { id: 'cpm', label: 'CYCLES / MIN', min: 10, max: 120, def: 30, unit: 'bpm' as const },
  opts('run', 'PLAY', ['STOP', 'PLAY'], 1),
  { id: 'gate', label: 'GATE', min: 0.1, max: 1, def: 1, unit: '%' as const },
  { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  { id: 'parts', label: 'PARTS', min: 1, max: SP_PARTS, def: SP_DEFAULT_PARTS, stepped: true },
]

const SLOTS = ['a', 'b', 'c', 'd'] as const
/** STRUDEL PARTS ×4's jack for slot s (0–3) and kind. */
export const slotOut = (s: number, kind: 'v' | 'g' | 'vel' | 'mod') => `${kind}${SLOTS[s]}`
export const slotParam = (s: number) => `p${SLOTS[s]}`

/** STRUDEL CORE: the code and the transport, nothing else on the panel.
 *  Patch LINK into STRUDEL PARTs (one per part of the piece, up to twelve)
 *  and a STRUDEL DRUMS; they take their notes and triggers from here. */
export const strudelcore: ModuleSpec = simpleSpec({
  type: 'strudelcore',
  title: 'STRUDEL CORE',
  name: 'Strudel Core',
  tagline: 'The Strudel engine alone: code screen, transport and LINK; STRUDEL PARTs and STRUDEL DRUMS on the LINK play the parts',
  category: 'Sequencers',
  hp: 30,
  panel: BLACK,
  params: transport,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    { id: 'clko', label: 'CLK' },
    { id: 'baro', label: 'CYCLE' },
    { id: 'link', label: 'LINK' },
  ],
  leds: 3,
  rows: [['k:cpm', 's:run', 'ks:gate', 'ks:oct', 'ks:parts', 'l:0'], ['i:clk', 'i:rst', 'o:clko', 'o:baro', 'o:link']],
  top: (top, w) => [{ kind: 'surface', name: 'strudel', x: 4, y: 14, w: w - 8, h: top - 15.5 - 14 } as Control],
})

/** STRUDEL PART: one part of the linked piece (by number; its sound is named on the screen). */
export const strudelpart: ModuleSpec = simpleSpec({
  type: 'strudelpart',
  title: 'STRUDEL PART',
  name: 'Strudel Part',
  tagline: 'One part of a linked STRUDEL or STRUDEL CORE: poly V/OCT, GATE, VEL and its lpf / hpf as a CV; add one per part',
  category: 'Sequencers',
  hp: 8,
  panel: BLACK,
  params: [{ id: 'lane', label: 'PART', min: 1, max: SP_PARTS, def: 1, stepped: true }],
  inputs: [{ id: 'link', label: 'LINK' }],
  outputs: [
    { id: 'v', label: 'V/OCT', poly: true },
    { id: 'g', label: 'GATE', poly: true },
    { id: 'vel', label: 'VEL', poly: true },
    { id: 'mod', label: 'MOD' },
  ],
  leds: 2,
  rows: [['kl:lane'], ['l:0', 'l:1'], ['i:link'], ['o:v', 'o:g'], ['o:vel', 'o:mod']],
  top: (top, w) => [{ kind: 'surface', name: 'strudelpart', x: 3, y: 14, w: w - 6, h: top - 15.5 - 14 } as Control],
})

/** STRUDEL PARTS ×4: four parts of the linked piece on one panel. */
export const strudelparts: ModuleSpec = simpleSpec({
  type: 'strudelparts',
  title: 'STRUDEL PARTS ×4',
  name: 'Strudel Parts ×4',
  tagline: 'Four parts of a linked STRUDEL or STRUDEL CORE on one panel, each with poly V/OCT, GATE, VEL and its filter CV',
  category: 'Sequencers',
  hp: 16,
  panel: BLACK,
  params: SLOTS.map((s, i) => ({ id: slotParam(i), label: `PART ${s.toUpperCase()}`, min: 1, max: SP_PARTS, def: i + 1, stepped: true })),
  inputs: [{ id: 'link', label: 'LINK' }],
  outputs: SLOTS.flatMap((s, i) => [
    { id: slotOut(i, 'v'), label: `V/OCT ${s.toUpperCase()}`, poly: true },
    { id: slotOut(i, 'g'), label: `GATE ${s.toUpperCase()}`, poly: true },
    { id: slotOut(i, 'vel'), label: `VEL ${s.toUpperCase()}`, poly: true },
    { id: slotOut(i, 'mod'), label: `MOD ${s.toUpperCase()}` },
  ]),
  leds: 4,
  rows: [
    SLOTS.map((_, i) => `ks:${slotParam(i)}:${SLOTS[i].toUpperCase()}`),
    ...SLOTS.map((_, i) => [`o:${slotOut(i, 'v')}`, `o:${slotOut(i, 'g')}`, `o:${slotOut(i, 'vel')}`, `o:${slotOut(i, 'mod')}`]),
    ['i:link', 'l:0', 'l:1', 'l:2', 'l:3'],
  ],
  top: (top, w) => (top > 30 ? [{ kind: 'surface', name: 'strudelparts', x: 3, y: 14, w: w - 6, h: top - 15.5 - 14 } as Control] : []),
})

/** STRUDEL DRUMS: the linked piece's drum sounds as triggers. */
export const strudeldrums: ModuleSpec = simpleSpec({
  type: 'strudeldrums',
  title: 'STRUDEL DRUMS',
  name: 'Strudel Drums',
  tagline: 'The drum sounds of a linked STRUDEL or STRUDEL CORE (bd, sd, hh, oh, cp, rim, toms, cymbals) as triggers',
  category: 'Sequencers',
  hp: 10,
  panel: BLACK,
  params: [],
  inputs: [{ id: 'link', label: 'LINK' }],
  outputs: DRUM_OUTS.map((d) => ({ id: d, label: d.toUpperCase() })),
  leds: DRUM_OUTS.length,
  rows: [['i:link'], DRUM_OUTS.slice(0, 4).map((_, i) => `l:${i}`), DRUM_OUTS.slice(0, 4).map((d) => `o:${d}`), DRUM_OUTS.slice(4).map((_, i) => `l:${i + 4}`), DRUM_OUTS.slice(4).map((d) => `o:${d}`)],
})
