import type { ModuleSpec, ParamSpec } from '../types'
import { SAND } from './panels'

export const POCKET_SOUNDS = ['KICK', 'SNARE', 'CLAP', 'HAT', 'OPEN', 'TOM', 'BLIP', 'ZAP']
export const POCKET_STEPS = 16
export const POCKETL = { step: 0, hit0: 1 } as const

const DEFAULT_MASKS = [0x1111, 0x1010, 0, 0x5555, 0x8080, 0, 0x0c48, 0]
const n = POCKET_SOUNDS.length

/** Per-step parameter locks: −1 = not locked (use the sound's knob). */
const LOCKS: ParamSpec[] = Array.from({ length: n * POCKET_STEPS * 2 }, (_, k) => {
  const ab = k % 2 === 0 ? 'a' : 'b'
  const s = Math.floor(k / 2 / POCKET_STEPS)
  const i = Math.floor(k / 2) % POCKET_STEPS
  return { id: `l${ab}${s}_${i}`, label: `LOCK ${ab.toUpperCase()} ${s + 1}.${i + 1}`, min: -1, max: 1, def: -1, stepped: true }
})

/** Pocket groovebox (a calculator-sized drum machine): eight sounds, 16 steps, and
 *  parameter locks. WRITE on: the 16 buttons toggle steps of the selected
 *  sound. WRITE off: buttons 1–8 play and select sounds. Knobs A (pitch) and
 *  B (decay) set the selected sound; right-click a step (in WRITE) to lock A/B
 *  for just that step (it lights), double-click a knob to clear the lock. */
export const pocket: ModuleSpec = {
  type: 'pocket',
  title: 'POCKET',
  name: 'Pocket Groovebox',
  tagline: 'Calculator-sized groovebox: 8 sounds, 16 steps, per-step parameter locks, swing',
  category: 'Systems',
  hp: 16,
  panel: SAND,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'clko', label: 'CLK' },
    { id: 'rsto', label: 'RST' },
  ],
  params: [
    { id: 'tempo', label: 'BPM', min: 60, max: 200, def: 112, unit: 'bpm' },
    { id: 'swing', label: 'SWING', min: 0, max: 0.5, def: 0.08, unit: '%' },
    { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.8, unit: '%' },
    { id: 'sel', label: 'SOUND', min: 0, max: n - 1, def: 0, stepped: true, options: POCKET_SOUNDS },
    { id: 'run', label: 'PLAY', min: 0, max: 1, def: 0, stepped: true, options: ['STOP', 'PLAY'] },
    { id: 'write', label: 'WRITE', min: 0, max: 1, def: 1, stepped: true, options: ['PLAY', 'WRITE'] },
    ...POCKET_SOUNDS.flatMap((_, s): ParamSpec[] => [
      { id: `a${s}`, label: `A ${s + 1}`, min: 0, max: 1, def: 0.5 },
      { id: `b${s}`, label: `B ${s + 1}`, min: 0, max: 1, def: 0.5 },
      { id: `m${s}`, label: `STEPS ${s + 1}`, min: 0, max: 0xffff, def: DEFAULT_MASKS[s], stepped: true },
    ]),
    ...LOCKS,
  ],
  leds: 1 + n,
  controls: [
    { kind: 'surface', name: 'pocket', x: 4, y: 14, w: 73.3, h: 74 },
    { kind: 'knob', param: 'tempo', x: 12, y: 99, size: 'S' },
    { kind: 'knob', param: 'swing', x: 26, y: 99, size: 'S' },
    { kind: 'knob', param: 'vol', x: 40, y: 99, size: 'S' },
    { kind: 'in', jack: 'clk', x: 54, y: 99 },
    { kind: 'out', jack: 'rsto', x: 69, y: 99 },
    { kind: 'in', jack: 'rst', x: 40, y: 113.5 },
    { kind: 'out', jack: 'clko', x: 54, y: 113.5 },
    { kind: 'out', jack: 'out', x: 69, y: 113.5 },
  ],
}
