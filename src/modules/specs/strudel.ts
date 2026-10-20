import type { Control, ModuleSpec } from '../types'
import { opts, simpleSpec } from './build'
import { BLACK } from './panels'
import { DRUM_OUTS } from '../../strudel/music'

export const ST_LANES = 6
/** LEDs: the cycle (fractional), an error flag, each lane's activity, each drum's flash. */
export const STL = { cycle: 0, error: 1, lane0: 2, drum0: 2 + ST_LANES } as const
export const laneOut = (l: number, what: 'v' | 'g' | 'vel' | 'mod') => `${what}${l + 1}`

const lanes = Array.from({ length: ST_LANES }, (_, l) => l)

/** STRUDEL: live code from strudel.cc running in the rack. The code is on
 *  the panel (type in it: it runs as you change it). Each layer of the
 *  piece's top-level stack is a LANE with poly V/OCT, GATE and VEL, and a
 *  MOD CV carrying its lpf/hpf; drum sounds (bd, sd, hh, oh, cp, rim, toms,
 *  cymbals) fire their own triggers whichever lane they're in. LINK feeds
 *  STRUDEL PARTs (parts beyond the sixth too) and STRUDEL DRUMS. Explore ▸
 *  From Strudel builds the voices and effects to go with a piece. */
export const strudel: ModuleSpec = simpleSpec({
  type: 'strudel',
  title: 'STRUDEL',
  name: 'Strudel Live Code',
  tagline: 'Runs strudel.cc / Tidal pattern code in the rack: six lanes of poly notes with a MOD CV each, eight drum triggers; type in it and it follows',
  category: 'Sequencers',
  hp: 60,
  panel: BLACK,
  params: [
    { id: 'cpm', label: 'CYCLES / MIN', min: 10, max: 120, def: 30, unit: 'bpm' },
    opts('run', 'PLAY', ['STOP', 'PLAY'], 1),
    { id: 'gate', label: 'GATE', min: 0.1, max: 1, def: 0.8, unit: '%' },
    { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  ],
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    ...lanes.flatMap((l) => [
      { id: laneOut(l, 'v'), label: `V/OCT ${l + 1}`, poly: true },
      { id: laneOut(l, 'g'), label: `GATE ${l + 1}`, poly: true },
      { id: laneOut(l, 'vel'), label: `VEL ${l + 1}`, poly: true },
    ]),
    ...lanes.map((l) => ({ id: laneOut(l, 'mod'), label: `MOD ${l + 1}` })),
    ...DRUM_OUTS.map((d) => ({ id: d, label: d.toUpperCase() })),
    { id: 'clko', label: 'CLK' },
    { id: 'baro', label: 'CYCLE' },
    { id: 'link', label: 'LINK' },
  ],
  leds: STL.drum0 + DRUM_OUTS.length,
  rows: [
    ['k:cpm', 's:run', 'ks:gate', 'ks:oct', 'l:0', ...lanes.map((l) => `l:${STL.lane0 + l}`), 'o:link'],
    [...lanes.flatMap((l) => [`o:${laneOut(l, 'v')}`, `o:${laneOut(l, 'g')}`, `o:${laneOut(l, 'vel')}`])],
    ['i:clk', 'i:rst', ...lanes.map((l) => `o:${laneOut(l, 'mod')}`), ...DRUM_OUTS.map((d) => `o:${d}`), 'o:clko', 'o:baro'],
  ],
  top: (top, w) => [{ kind: 'surface', name: 'strudel', x: 4, y: 14, w: w - 8, h: top - 15.5 - 14 } as Control],
})
