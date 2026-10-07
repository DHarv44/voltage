import type { ModuleSpec } from '../types'
import { ALU } from './panels'

/** Engine → platter display state (LED channel). */
export const TTL = {
  /** Platter angle, revolutions mod 1. */
  angle: 0,
  motor: 1,
  /** 0 idle, 1 cutting a new record from IN. */
  rec: 2,
  /** Platter speed relative to 33⅓ rpm. */
  speed: 3,
  /** Needle position across the record 0..1. */
  pos: 4,
  /** 1 while the platter is held by the hand. */
  held: 5,
  /** Record still being pressed (default record generating). */
  pressing: 6,
} as const

const IN_X = [9, 22, 35, 48]
const OUT_X = [66, 80, 94, 108]

/** Direct-drive turntable. Grab the platter to scratch; let go and the motor
 *  pulls it back up to speed. The record holds up to 60 s: cut your own from
 *  IN (REC), load a file, or scratch the factory "battle record" (a synthesised
 *  break and vocal stab). 45 rpm plays a 33 record fast, like the real thing. */
export const turntable: ModuleSpec = {
  type: 'turntable',
  title: 'TURNTABLE',
  name: 'Turntable',
  tagline: 'Scratch it: grab the platter, motor spin-up/brake, pitch fader, transformer CUT, cut your own record',
  category: 'Sampling & Tape',
  hp: 24,
  panel: ALU,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'start', label: 'START' },
    { id: 'cut', label: 'CUT' },
    { id: 'speed', label: 'SPEED' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'speed', label: 'SPEED' },
    { id: 'pos', label: 'POS' },
    { id: 'rot', label: 'ROT' },
  ],
  params: [
    { id: 'rpm', label: 'RPM', min: 0, max: 1, def: 0, stepped: true, options: ['33', '45'] },
    { id: 'pitch', label: 'PITCH', min: -1, max: 1, def: 0, unit: '%' },
    { id: 'brake', label: 'BRAKE', min: 0.05, max: 4, def: 0.4, curve: 'exp', unit: 's' },
    { id: 'wear', label: 'WEAR', min: 0, max: 1, def: 0.25, unit: '%' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1.5, def: 1, unit: '%' },
  ],
  leds: 7,
  controls: [
    { kind: 'surface', name: 'turntable', x: 3, y: 15, w: 84, h: 84 },
    { kind: 'button', name: 'start', x: 96, y: 24, label: 'START', led: TTL.motor, ledColor: '#3bff6b' },
    { kind: 'button', name: 'rec', x: 112, y: 24, label: 'REC', led: TTL.rec, ledColor: '#ff3b2f' },
    { kind: 'switch', param: 'rpm', x: 96, y: 42 },
    { kind: 'file', slot: 0, x: 112, y: 42, label: 'LOAD' },
    { kind: 'knob', param: 'pitch', x: 96, y: 59 },
    { kind: 'knob', param: 'brake', x: 112, y: 59, size: 'S' },
    { kind: 'knob', param: 'wear', x: 96, y: 76, size: 'S' },
    { kind: 'knob', param: 'level', x: 112, y: 76, size: 'S' },
    { kind: 'button', name: 'cut', x: 104, y: 91, label: 'CUT' },
    ...['in', 'start', 'cut', 'speed'].map((jack, i) => ({ kind: 'in' as const, jack, x: IN_X[i], y: 113 })),
    ...['out', 'speed', 'pos', 'rot'].map((jack, i) => ({ kind: 'out' as const, jack, x: OUT_X[i], y: 113 })),
  ],
}
