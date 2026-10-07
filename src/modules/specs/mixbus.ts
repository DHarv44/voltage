import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK, CREAM, GRAPHITE } from './panels'

/** The mix bus: a console with sidechain ducking, a bus compressor and a
 *  mastering strip (EQ, width, limiter). The "produced" end of a patch. */

const knob = (param: string, size: 'S' | 'M' = 'S'): Control => ({ kind: 'knob', param, x: 0, y: 0, size })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const led = (index: number, color?: string): Control => ({ kind: 'led', index, x: 0, y: 0, color })
const lvl = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0, max: 1, def, unit: '%' })

// ---- CONSOLE ----
export const CONSOLE_CH = 6
const CH = Array.from({ length: CONSOLE_CH }, (_, i) => i + 1)
const conParams: ParamSpec[] = [
  ...CH.map((n): ParamSpec => ({ id: `tone${n}`, label: 'TONE', min: -1, max: 1, def: 0, unit: '%' })),
  ...CH.map((n): ParamSpec => ({ id: `pan${n}`, label: 'PAN', min: -1, max: 1, def: 0, unit: '%' })),
  ...CH.map((n) => lvl(`snd${n}`, 'SEND', 0)),
  ...CH.map((n) => lvl(`duck${n}`, 'DUCK', 0)),
  ...CH.map((n) => lvl(`lvl${n}`, 'LEVEL', 0.7)),
  ...CH.map((n): ParamSpec => ({ id: `mute${n}`, label: 'MUTE', min: 0, max: 1, def: 0, stepped: true, options: ['ON', 'MUTE'] })),
  { id: 'rel', label: 'DUCK REL', min: 0.03, max: 1.5, def: 0.25, curve: 'exp', unit: 's' },
  lvl('ret', 'RETURN', 0.5),
  lvl('master', 'MASTER', 0.8),
]
const conIn: ModuleSpec['inputs'] = [
  ...CH.map((n) => ({ id: `in${n}`, label: `IN ${n}` })),
  { id: 'sc', label: 'DUCK IN' },
  { id: 'retL', label: 'RET L' },
  { id: 'retR', label: 'RET R' },
]
const conOut: ModuleSpec['outputs'] = [
  { id: 'send', label: 'SEND' },
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]
const CON_HP = 22
const row = (prefix: string) => CH.map((n) => knob(`${prefix}${n}`))
const conLayout = packRows(
  [
    [...row('tone'), knob('rel'), led(0, '#ff6a1a')],
    [...row('pan'), knob('ret'), null],
    [...row('snd'), knob('master'), null],
    [...row('duck'), jack('in', 'sc'), null],
    [...row('lvl'), jack('in', 'retL'), jack('in', 'retR')],
    [...CH.map((n) => sw(`mute${n}`)), jack('out', 'send'), null],
    [...CH.map((n) => jack('in', `in${n}`)), jack('out', 'l'), jack('out', 'r')],
  ],
  { params: conParams, inputs: conIn, outputs: conOut },
  CON_HP * HP_MM,
  { grid: true, maxPitch: 15 },
)

/** Six channels of TONE (a tilt EQ), PAN, SEND, DUCK and LEVEL, a mute, a
 *  stereo return and master. DUCK in (the kick, or its trigger) pulls every
 *  channel down by its own DUCK amount and lets it back up over DUCK REL:
 *  the sidechain pump, built into the desk. */
export const console_: ModuleSpec = {
  type: 'console',
  title: 'CONSOLE',
  name: 'Mixing Console',
  tagline: 'Six channels with tilt EQ, pan, send and a sidechain DUCK per channel (feed it the kick); stereo return, master',
  category: 'Amps & Mixers',
  hp: CON_HP,
  panel: BLACK,
  inputs: conIn,
  outputs: conOut,
  params: conParams,
  leds: 1,
  controls: conLayout.controls,
}

// ---- GLUE ----
export const GLUE_RATIOS = ['2:1', '4:1', '10:1']
export const GLUE_RATIO_X = [2, 4, 10]
export const GLUE_ATTACKS = ['0.1', '0.3', '1', '3', '10', '30']
export const GLUE_ATTACK_MS = [0.1, 0.3, 1, 3, 10, 30]
export const GLUE_RELEASES = ['0.1', '0.3', '0.6', '1.2', 'AUTO']
export const GLUE_RELEASE_S = [0.1, 0.3, 0.6, 1.2, -1]
/** Gain-reduction meter LEDs light at these dB. */
export const GLUE_METER = [1, 3, 6, 10, 15]
const glueParams: ParamSpec[] = [
  { id: 'thresh', label: 'THRESHOLD', min: -40, max: 0, def: -12, unit: 'dB' },
  { id: 'ratio', label: 'RATIO', min: 0, max: 2, def: 1, stepped: true, options: GLUE_RATIOS },
  { id: 'att', label: 'ATTACK ms', min: 0, max: 5, def: 3, stepped: true, options: GLUE_ATTACKS },
  { id: 'rel', label: 'RELEASE s', min: 0, max: 4, def: 4, stepped: true, options: GLUE_RELEASES },
  { id: 'makeup', label: 'MAKEUP', min: 0, max: 24, def: 4, unit: 'dB' },
  lvl('mix', 'MIX', 1),
  { id: 'schp', label: 'SC FILTER', min: 0, max: 1, def: 1, stepped: true, options: ['OFF', 'HPF'] },
]
const glueIn: ModuleSpec['inputs'] = [
  { id: 'l', label: 'IN L' },
  { id: 'r', label: 'IN R' },
  { id: 'sc', label: 'KEY' },
]
const glueOut: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  { id: 'gr', label: 'GR' },
]
const GLUE_HP = 12
const glueLayout = packRows(
  [
    GLUE_METER.map((_, i) => led(i, i < 3 ? '#3bff6b' : i < 4 ? '#ffd23b' : '#ff3b2f')),
    [knob('thresh', 'M'), knob('ratio', 'M')],
    [knob('att', 'M'), knob('rel', 'M')],
    [knob('makeup'), knob('mix'), sw('schp')],
    [jack('in', 'l'), jack('in', 'r'), jack('in', 'sc')],
    [jack('out', 'l'), jack('out', 'r'), jack('out', 'gr')],
  ],
  { params: glueParams, inputs: glueIn, outputs: glueOut },
  GLUE_HP * HP_MM,
  { maxPitch: 18 },
)

/** A stereo bus compressor in the SSL tradition: VCA gain cell, stereo-linked,
 *  stepped attack and release (AUTO follows the music), soft knee. KEY takes
 *  the sidechain (normalled to the input; the SC filter keeps bass from
 *  pumping it), GR puts the gain reduction out as CV (0–10 V for 0–20 dB). */
export const glue: ModuleSpec = {
  type: 'glue',
  title: 'GLUE',
  name: 'Bus Compressor',
  tagline: 'Stereo bus compressor: threshold, ratio, stepped attack/release with AUTO, makeup, mix; KEY sidechain, GR out as CV',
  category: 'Amps & Mixers',
  hp: GLUE_HP,
  panel: GRAPHITE,
  inputs: glueIn,
  outputs: glueOut,
  params: glueParams,
  leds: GLUE_METER.length,
  controls: glueLayout.controls,
}

// ---- MASTER ----
const masterParams: ParamSpec[] = [
  { id: 'low', label: 'LOW', min: -12, max: 12, def: 0, unit: 'dB' },
  { id: 'mid', label: 'MID', min: -12, max: 12, def: 0, unit: 'dB' },
  { id: 'freq', label: 'MID FREQ', min: 200, max: 6000, def: 1200, curve: 'exp', unit: 'Hz' },
  { id: 'high', label: 'HIGH', min: -12, max: 12, def: 0, unit: 'dB' },
  { id: 'width', label: 'WIDTH', min: 0, max: 2, def: 1, unit: 'x' },
  { id: 'drive', label: 'DRIVE', min: 0, max: 18, def: 3, unit: 'dB' },
  { id: 'ceiling', label: 'CEILING', min: -12, max: 0, def: -1, unit: 'dB' },
  { id: 'release', label: 'RELEASE', min: 0.01, max: 1, def: 0.15, curve: 'exp', unit: 's' },
]
const masterIn: ModuleSpec['inputs'] = [
  { id: 'l', label: 'IN L' },
  { id: 'r', label: 'IN R' },
]
const masterOut: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]
const MASTER_HP = 12
const masterLayout = packRows(
  [
    [led(0, '#ff3b2f'), led(1, '#ffd23b'), led(2, '#3bff6b')],
    [knob('low'), knob('mid'), knob('freq')],
    [knob('high'), knob('width'), null],
    [knob('drive', 'M'), knob('ceiling', 'M'), knob('release')],
    [jack('in', 'l'), jack('in', 'r'), null],
    [jack('out', 'l'), jack('out', 'r'), null],
  ],
  { params: masterParams, inputs: masterIn, outputs: masterOut },
  MASTER_HP * HP_MM,
  { grid: true, maxPitch: 17 },
)

/** The last thing before OUT: three-band EQ (low and high shelves, a sweepable
 *  mid), mid/side WIDTH (0 = mono, 2 = twice as wide), then DRIVE into a
 *  look-ahead limiter that holds peaks under CEILING. The LEDs show how hard
 *  it's limiting. R is normalled to L. */
export const master: ModuleSpec = {
  type: 'master',
  title: 'MASTER',
  name: 'Mastering Strip',
  tagline: 'Three-band EQ, stereo width and a look-ahead limiter: the last stop before OUT',
  category: 'Amps & Mixers',
  hp: MASTER_HP,
  panel: CREAM,
  inputs: masterIn,
  outputs: masterOut,
  params: masterParams,
  leds: 3,
  controls: masterLayout.controls,
}
