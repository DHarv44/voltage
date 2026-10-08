import type { ModuleSpec } from '../types'
import { BLACK } from './panels'
import { QUANT_SCALES } from './shapers'

/** State the engine publishes on the LED channel for the pad display. */
export const XYL = {
  x: 0,
  y: 1,
  gate: 2,
  /** 0 idle, 0.5 armed (waiting for a touch), 1 recording. */
  rec: 3,
  /** 1 while the recorded gesture is looping. */
  play: 4,
  /** Position in the loop 0..1. */
  pos: 5,
  pres: 6,
} as const

export const XY_MODES = ['FREE', 'SPRING', 'FLING']

const OUT_X = [47, 60, 73, 86]

/** XY touch surface (Kaoss-pad style). Drag the dot: X/Y/pressure/speed/
 *  distance/angle come out as CV, PITCH plays a scale across the width.
 *  FREE leaves the dot where you let go, SPRING returns it to centre like a
 *  joystick, FLING throws it with momentum. REC loops a gesture (clock-synced
 *  when CLK is patched); MORPH blends four knob snapshots stored in the corners. */
export const xy: ModuleSpec = {
  type: 'xy',
  title: 'XY',
  name: 'XY Touch Pad',
  tagline: 'Drag a dot for X/Y/pressure/speed CV; spring and fling modes, gesture looper, corner morphing',
  category: 'Controllers',
  hp: 20,
  panel: BLACK,
  inputs: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'gate', label: 'GATE' },
    { id: 'pres', label: 'PRES' },
    { id: 'speed', label: 'SPEED' },
    { id: 'dist', label: 'DIST' },
    { id: 'angle', label: 'ANGLE' },
    { id: 'pitch', label: 'PITCH' },
  ],
  params: [
    { id: 'mode', label: 'MODE', min: 0, max: 2, def: 0, stepped: true, options: XY_MODES },
    { id: 'scale', label: 'SCALE', min: 0, max: QUANT_SCALES.length - 1, def: 4, stepped: true, options: QUANT_SCALES },
    { id: 'range', label: 'RANGE', min: 1, max: 4, def: 2, stepped: true, unit: 'oct' },
    { id: 'glide', label: 'GLIDE', min: 0.1, max: 8, def: 1.5, curve: 'exp', unit: 's' },
    { id: 'morph', label: 'MORPH', min: 0, max: 1, def: 0, stepped: true, options: ['OFF', 'MORPH'] },
  ],
  leds: 7,
  controls: [
    { kind: 'xypad', x: 5, y: 15.5, w: 91.6, h: 54.8 },
    { kind: 'switch', param: 'mode', x: 9, y: 80 },
    { kind: 'knob', param: 'scale', x: 27, y: 80, size: 'S' },
    { kind: 'knob', param: 'range', x: 38, y: 80, size: 'S' },
    { kind: 'knob', param: 'glide', x: 49, y: 80, size: 'S' },
    { kind: 'switch', param: 'morph', x: 60, y: 80 },
    { kind: 'button', name: 'rec', x: 75, y: 80, label: 'REC', led: XYL.rec, ledColor: '#ff3b2f' },
    { kind: 'button', name: 'play', x: 90, y: 80, label: 'LOOP', led: XYL.play, ledColor: '#3bff6b' },
    { kind: 'in', jack: 'x', x: 9, y: 99 },
    { kind: 'in', jack: 'y', x: 21, y: 99 },
    { kind: 'in', jack: 'clk', x: 33, y: 99 },
    { kind: 'in', jack: 'rst', x: 33, y: 114 },
    { kind: 'text', text: 'CV MOVES THE DOT', x: 15, y: 110, size: 1.6 },
    { kind: 'text', text: 'CLK: LOOP IN TIME', x: 15, y: 113, size: 1.6 },
    ...['x', 'y', 'gate', 'pres'].map((jack, i) => ({ kind: 'out' as const, jack, x: OUT_X[i], y: 99 })),
    ...['speed', 'dist', 'angle', 'pitch'].map((jack, i) => ({ kind: 'out' as const, jack, x: OUT_X[i], y: 114 })),
  ],
}
