import type { Control, ModuleSpec, ParamSpec } from '../types'
import { BLACK } from './panels'

const CH = ['a', 'b']
const chParams = (c: string): ParamSpec[] => [
  { id: `${c}trim`, label: 'TRIM', min: 0, max: 2, def: 1, unit: 'x' },
  { id: `${c}hi`, label: 'HI', min: 0, max: 1.5, def: 1, unit: 'x' },
  { id: `${c}mid`, label: 'MID', min: 0, max: 1.5, def: 1, unit: 'x' },
  { id: `${c}lo`, label: 'LOW', min: 0, max: 1.5, def: 1, unit: 'x' },
  { id: `${c}filter`, label: 'FILTER', min: -1, max: 1, def: 0, unit: '%' },
  { id: `${c}fader`, label: 'FADER', min: 0, max: 1, def: 0.85, unit: '%' },
]
const COL = { a: 10, b: 91.6 }

/** Two-channel DJ mixer. Per channel: trim, a three-band isolator EQ (turn a
 *  band fully down to kill it), a one-knob filter (left low-pass, right
 *  high-pass, resonant at the extremes) and an up-fader. The crossfader blends
 *  A and B: SMOOTH for mixing, CUT for scratching (opens almost instantly). */
export const djmix: ModuleSpec = {
  type: 'djmix',
  title: 'DJ MIXER',
  name: 'DJ Mixer',
  tagline: 'Two channels: trim, kill EQ, one-knob filter, faders and a crossfader with a scratch curve',
  category: 'Amps & Mixers',
  hp: 20,
  panel: BLACK,
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'xcv', label: 'X-CV' },
  ],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  params: [
    ...chParams('a'),
    ...chParams('b'),
    { id: 'xfade', label: 'CROSSFADER', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'curve', label: 'CURVE', min: 0, max: 1, def: 0, stepped: true, options: ['SMOOTH', 'CUT'] },
    { id: 'master', label: 'MASTER', min: 0, max: 1.5, def: 1, unit: 'x' },
  ],
  leds: 2,
  controls: [
    ...CH.flatMap((c): Control[] => {
      const x = COL[c as 'a' | 'b']
      return [
        { kind: 'knob', param: `${c}trim`, x, y: 24, size: 'S' },
        { kind: 'knob', param: `${c}hi`, x, y: 39, size: 'S' },
        { kind: 'knob', param: `${c}mid`, x, y: 53, size: 'S' },
        { kind: 'knob', param: `${c}lo`, x, y: 67, size: 'S' },
        { kind: 'knob', param: `${c}filter`, x, y: 83, size: 'S' },
      ]
    }),
    { kind: 'surface', name: 'djfaders', x: 19, y: 17, w: 63.6, h: 74 },
    { kind: 'switch', param: 'curve', x: 50, y: 101 },
    { kind: 'knob', param: 'master', x: 63, y: 104, size: 'S' },
    { kind: 'in', jack: 'a', x: 10, y: 113 },
    { kind: 'in', jack: 'b', x: 23, y: 113 },
    { kind: 'in', jack: 'xcv', x: 36, y: 113 },
    { kind: 'out', jack: 'l', x: 78, y: 113.5 },
    { kind: 'out', jack: 'r', x: 91.6, y: 113.5 },
  ],
}
