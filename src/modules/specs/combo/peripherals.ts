import { packRows } from '../../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../../types'
import { AMP, GRAPHITE } from '../panels'
import { COMBO_PARTS } from './params'

const jin = (jack: string): Control => ({ kind: 'in', jack, x: 0, y: 0 })
const jout = (jack: string): Control => ({ kind: 'out', jack, x: 0, y: 0 })
const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })

/** FOOTSWITCH's lights and LOOPER's (as on COMBO: each part's loop state,
 *  then the LOOPER button's light). */
export const FSL = { band: 0, loop: 1, part: 2 } as const
export const LPL = { loops: 0, button: COMBO_PARTS } as const

// ---- FOOTSWITCH ----

const FS_OUT: ModuleSpec['outputs'] = [
  { id: 'gband', label: 'BAND' },
  { id: 'gloop', label: 'LOOPER' },
  { id: 'gpart', label: 'PART' },
]
const FS_W = 16 * HP_MM
const fsLayout = packRows([[jin('link')], FS_OUT.map((j) => jout(j.id))], { params: [], inputs: [{ id: 'link', label: 'LINK' }], outputs: FS_OUT }, FS_W)
/** The three stomps, big, across the panel (pads 0 BAND, 1 LOOPER, 2 PART). */
export const FS_STOMPS = ['band', 'loop', 'part']
const stomps: Control[] = [
  { kind: 'pad', index: 0, x: FS_W * 0.2, y: 40, size: 15, label: 'BAND', sub: 'hold: forget', led: FSL.band },
  { kind: 'pad', index: 1, x: FS_W * 0.5, y: 40, size: 15, label: 'LOOPER', sub: 'rec · dub', led: FSL.loop },
  { kind: 'pad', index: 2, x: FS_W * 0.8, y: 40, size: 15, label: 'PART ▶', sub: 'next part', led: FSL.part },
]

/** Three footswitches for a COMBO or COMBO CORE, patched by LINK: BAND
 *  (teach, finish, stop; hold to forget), LOOPER (record, overdub, play, on
 *  every linked looper) and PART (the next part, at the end of this one).
 *  Each stomp is a gate out too. */
export const combofs: ModuleSpec = {
  type: 'combofs',
  title: 'FOOTSWITCH',
  name: 'Combo Footswitch',
  tagline: 'Three stomps for a linked COMBO: BAND (teach, stop; hold to forget), LOOPER, PART (cue the next part); gates out',
  category: 'Controllers',
  hp: 16,
  panel: GRAPHITE,
  inputs: [{ id: 'link', label: 'LINK' }],
  outputs: FS_OUT,
  params: [],
  leds: 3,
  controls: [...stomps, ...fsLayout.controls],
}

// ---- LOOPER ----

const LP_PARAMS: ParamSpec[] = [
  { id: 'loopl', label: 'LOOP', min: 0, max: 1.5, def: 1, unit: '%' },
  { id: 'dry', label: 'DRY', min: 0, max: 1, def: 1, unit: '%' },
  { id: 'stretch', label: 'LOOP TEMPO', min: 0, max: 1, def: 1, stepped: true, options: ['TAPE', 'STRETCH'] },
  ...Array.from({ length: COMBO_PARTS }, (_, i): ParamSpec => ({ id: `lt${i}`, label: `LOOP ${i + 1} TEMPO`, min: 0, max: 300, def: 0 })),
]
const LP_IN: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'link', label: 'LINK' },
  { id: 'loop', label: 'LOOP' },
]
const LP_OUT: ModuleSpec['outputs'] = [
  { id: 'out', label: 'OUT' },
  { id: 'mix', label: 'MIX' },
]
const LP_W = 14 * HP_MM
const lpLayout = packRows(
  [
    [knob('loopl'), knob('dry'), { kind: 'switch', param: 'stretch', x: 0, y: 0 }],
    [
      { kind: 'button', name: 'loop', x: 0, y: 0, label: 'LOOPER', led: LPL.button, ledColor: '#ff4a3a' },
      { kind: 'button', name: 'undo', x: 0, y: 0, label: 'UNDO' },
      { kind: 'button', name: 'clear', x: 0, y: 0, label: 'CLEAR' },
    ],
    Array.from({ length: COMBO_PARTS }, (_, i): Control => ({ kind: 'led', index: LPL.loops + i, x: 0, y: 0, color: '#ff4a3a' })),
    LP_IN.map((j) => jin(j.id)),
    LP_OUT.map((j) => jout(j.id)),
  ],
  { params: LP_PARAMS, inputs: LP_IN, outputs: LP_OUT },
  LP_W,
  { gap: 2.4 },
)

/** A looper for a COMBO or COMBO CORE, patched by LINK: a loop for each
 *  song part, one pass of it, kept in time with the band (STRETCH keeps a
 *  loop's pitch when the tempo moves, TAPE varispeeds it). Unlinked, a plain
 *  free looper. Add several: rhythm on one, a lead on another. */
export const combolooper: ModuleSpec = {
  type: 'combolooper',
  title: 'LOOPER',
  name: 'Combo Looper',
  tagline: 'A loop per song part for a linked COMBO, locked to the band; overdub, undo; STRETCH or TAPE when the tempo moves',
  category: 'Effects',
  hp: 14,
  panel: AMP,
  inputs: LP_IN,
  outputs: LP_OUT,
  params: LP_PARAMS,
  leds: COMBO_PARTS + 1,
  controls: lpLayout.controls,
}
