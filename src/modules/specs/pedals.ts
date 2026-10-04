import type { Control, JackSpec, ModuleSpec, PanelStyle, ParamSpec } from '../types'
import { PEDAL_BLACK, PEDAL_BLUE, PEDAL_GREEN, PEDAL_ORANGE, PEDAL_PURPLE, PEDAL_RED } from './panels'

const ON: ParamSpec = { id: 'on', label: 'ON', min: 0, max: 1, def: 1, stepped: true, options: ['BYPASS', 'ON'] }
/** Knob grid: two big on top, two small below. */
const KNOB_AT: [number, number, 'M' | 'S'][] = [
  [14, 27, 'M'],
  [36.8, 27, 'M'],
  [14, 45, 'S'],
  [36.8, 45, 'S'],
]

interface PedalDef {
  type: string
  title: string
  name: string
  tagline: string
  panel: PanelStyle
  params: ParamSpec[]
  /** Params shown as knobs, in KNOB_AT order (null = leave the slot empty). */
  knobs: (string | null)[]
  /** Extra inputs after IN (CV, gates). */
  inputs?: JackSpec[]
  /** Outputs after OUT. */
  outputs?: JackSpec[]
  leds?: number
  extra?: Control[]
}

/** A 10 HP stompbox: knobs on top, footswitch and LED in the middle,
 *  IN (+ CV) jacks at the bottom, OUT under them. */
function pedal(d: PedalDef): ModuleSpec {
  const inputs: JackSpec[] = [{ id: 'in', label: 'IN' }, ...(d.inputs ?? [])]
  const outputs: JackSpec[] = [{ id: 'out', label: 'OUT' }, ...(d.outputs ?? [])]
  const inX = inputs.length === 1 ? [12] : inputs.length === 2 ? [12, 25.4] : [9, 21, 33, 45]
  const outX = outputs.length === 1 ? [38.8] : [25.4, 38.8]
  return {
    type: d.type,
    title: d.title,
    name: d.name,
    tagline: d.tagline,
    category: 'Pedals',
    hp: 10,
    panel: d.panel,
    inputs,
    outputs,
    params: [ON, ...d.params],
    leds: d.leds,
    controls: [
      ...d.knobs.flatMap((k, i): Control[] => (k ? [{ kind: 'knob', param: k, x: KNOB_AT[i][0], y: KNOB_AT[i][1], size: KNOB_AT[i][2] }] : [])),
      ...(d.extra ?? []),
      { kind: 'stomp', param: 'on', x: 25.4, y: 75 },
      ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: inX[i], y: 97 })),
      ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: outX[i], y: 113.5 })),
    ],
  }
}

export const fuzz = pedal({
  type: 'fuzz',
  title: 'FUZZ',
  name: 'Fuzz Pedal',
  tagline: 'Two-transistor germanium fuzz: cleans up when you turn the input down; BIAS starves it into sputter',
  panel: PEDAL_RED,
  params: [
    { id: 'fuzz', label: 'FUZZ', min: 0, max: 1, def: 0.7, unit: '%' },
    { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'bias', label: 'BIAS', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'tone', label: 'TONE', min: 0, max: 1, def: 0.6, unit: '%' },
  ],
  knobs: ['fuzz', 'vol', 'bias', 'tone'],
})

export const wah = pedal({
  type: 'wah',
  title: 'WAH',
  name: 'Wah Pedal',
  tagline: 'Inductor wah: rock the treadle (drag it), or AUTO follows your playing; CV moves the treadle',
  panel: PEDAL_BLACK,
  params: [
    { id: 'pos', label: 'TREADLE', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'q', label: 'Q', min: 1, max: 12, def: 5, curve: 'exp', unit: 'x' },
    { id: 'mode', label: 'MODE', min: 0, max: 1, def: 0, stepped: true, options: ['FOOT', 'AUTO'] },
    { id: 'sens', label: 'SENS', min: 0, max: 1, def: 0.5, unit: '%' },
  ],
  knobs: [null, null, 'q', 'sens'],
  inputs: [{ id: 'cv', label: 'CV' }],
  extra: [
    { kind: 'surface', name: 'treadle', x: 5, y: 15, w: 40.8, h: 22 },
    { kind: 'switch', param: 'mode', x: 25.4, y: 45 },
  ],
})

export const octave = pedal({
  type: 'octave',
  title: 'OCTAVE',
  name: 'Octave Pedal',
  tagline: 'Rectifier octave-up (Octavia) and flip-flop octave-down (OC-2), blended with the dry signal',
  panel: PEDAL_PURPLE,
  params: [
    { id: 'up', label: 'OCT UP', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'down', label: 'OCT DOWN', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'dry', label: 'DIRECT', min: 0, max: 1, def: 0.7, unit: '%' },
    { id: 'down2', label: '2 OCT', min: 0, max: 1, def: 0, unit: '%' },
  ],
  knobs: ['up', 'down', 'dry', 'down2'],
})

export const chorus = pedal({
  type: 'chorus',
  title: 'CHORUS',
  name: 'Chorus Pedal',
  tagline: 'Bucket-brigade chorus: one BBD line swept by a triangle LFO, dry + wet in mono, or stereo spread',
  panel: PEDAL_BLUE,
  params: [
    { id: 'rate', label: 'RATE', min: 0.1, max: 8, def: 0.8, curve: 'exp', unit: 'Hz' },
    { id: 'depth', label: 'DEPTH', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.5, unit: '%' },
  ],
  knobs: ['rate', 'depth', 'mix'],
  outputs: [{ id: 'outb', label: 'OUT B' }],
})

export const echo = pedal({
  type: 'echo',
  title: 'TAPE ECHO',
  name: 'Tape Echo Pedal',
  tagline: 'Space Echo-style: three playback heads, MODE picks which, repeat rate = tape speed (it pitch-bends)',
  panel: PEDAL_GREEN,
  params: [
    { id: 'rate', label: 'REPEAT', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'fb', label: 'INTENSITY', min: 0, max: 1.15, def: 0.45, unit: '%' },
    { id: 'heads', label: 'MODE', min: 1, max: 7, def: 1, stepped: true },
    { id: 'mix', label: 'ECHO', min: 0, max: 1, def: 0.5, unit: '%' },
  ],
  knobs: ['rate', 'fb', 'heads', 'mix'],
  inputs: [{ id: 'cv', label: 'RATE' }],
})

export const lpedal = pedal({
  type: 'lpedal',
  title: 'LOOPER',
  name: 'Looper Pedal',
  tagline: 'One-switch looper: stomp to record, stomp to play, stomp to overdub; STOP and CLEAR buttons',
  panel: PEDAL_ORANGE,
  params: [{ id: 'level', label: 'LOOP', min: 0, max: 1.5, def: 1, unit: '%' }],
  knobs: ['level', null],
  leds: 3,
  extra: [
    { kind: 'button', name: 'stop', x: 30.5, y: 27, label: 'STOP', led: 1, ledColor: '#3bff6b' },
    { kind: 'button', name: 'clear', x: 43, y: 27, label: 'CLEAR' },
    { kind: 'led', index: 0, x: 25.4, y: 45, color: '#ff2a1a' },
    { kind: 'progress', x: 8, y: 52, w: 34.8, led: 2 },
  ],
})
