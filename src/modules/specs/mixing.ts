import type { Control, ModuleSpec, ParamSpec } from '../types'
import { ALU, BLACK } from './panels'

const CH = [1, 2, 3, 4]
const colX = (i: number) => 12 + i * 19

export const smix: ModuleSpec = {
  type: 'smix',
  title: 'STEREO',
  name: 'Stereo Mixer',
  tagline: '4 channels with level, equal-power pan and FX send; stereo return; master',
  category: 'Utilities',
  hp: 16,
  panel: BLACK,
  inputs: [...CH.map((n) => ({ id: `in${n}`, label: `IN ${n}` })), { id: 'retL', label: 'RET L' }, { id: 'retR', label: 'RET R' }],
  outputs: [
    { id: 'send', label: 'SEND' },
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  params: [
    ...CH.map((n): ParamSpec => ({ id: `lvl${n}`, label: 'LEVEL', min: 0, max: 1, def: 0.75, unit: '%' })),
    ...CH.map((n): ParamSpec => ({ id: `pan${n}`, label: 'PAN', min: -1, max: 1, def: 0, unit: '%' })),
    ...CH.map((n): ParamSpec => ({ id: `snd${n}`, label: 'SEND', min: 0, max: 1, def: 0, unit: '%' })),
    { id: 'ret', label: 'RETURN', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'master', label: 'MASTER', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  controls: [
    ...CH.flatMap((n, i): Control[] => [
      { kind: 'in', jack: `in${n}`, x: colX(i), y: 22 },
      { kind: 'knob', param: `lvl${n}`, x: colX(i), y: 38 },
      { kind: 'knob', param: `pan${n}`, x: colX(i), y: 54, size: 'S' },
      { kind: 'knob', param: `snd${n}`, x: colX(i), y: 68, size: 'S' },
    ]),
    { kind: 'in', jack: 'retL', x: 10, y: 92 },
    { kind: 'in', jack: 'retR', x: 23, y: 92 },
    { kind: 'knob', param: 'ret', x: 39, y: 91, size: 'S' },
    { kind: 'knob', param: 'master', x: 65, y: 90 },
    { kind: 'out', jack: 'send', x: 16, y: 111 },
    { kind: 'out', jack: 'l', x: 50, y: 111 },
    { kind: 'out', jack: 'r', x: 66, y: 111 },
  ],
}

export const vcamix: ModuleSpec = {
  type: 'vcamix',
  title: 'VCA×4',
  name: 'Quad VCA Mixer',
  tagline: 'Four VCAs into a mix; patching a channel output takes it out of the mix',
  category: 'Amplifiers',
  hp: 12,
  panel: ALU,
  inputs: CH.flatMap((n) => [
    { id: `in${n}`, label: `IN${n}` },
    { id: `cv${n}`, label: `CV${n}` },
  ]),
  outputs: [...CH.map((n) => ({ id: `out${n}`, label: `OUT${n}` })), { id: 'mix', label: 'MIX' }],
  params: CH.map((n): ParamSpec => ({ id: `lvl${n}`, label: `LEVEL ${n}`, min: 0, max: 1, def: 0, unit: '%' })),
  leds: 4,
  controls: [
    ...CH.flatMap((n, i): Control[] => [
      { kind: 'in', jack: `in${n}`, x: 8, y: 22 + i * 20 },
      { kind: 'in', jack: `cv${n}`, x: 19.5, y: 22 + i * 20 },
      { kind: 'knob', param: `lvl${n}`, x: 33, y: 20 + i * 20, label: '' },
      { kind: 'led', index: i, x: 41.5, y: 26 + i * 20, color: '#ff3b2f' },
      { kind: 'out', jack: `out${n}`, x: 52, y: 22 + i * 20 },
    ]),
    { kind: 'out', jack: 'mix', x: 33, y: 108 },
  ],
}
