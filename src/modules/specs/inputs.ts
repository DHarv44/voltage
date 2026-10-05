import type { ModuleSpec } from '../types'
import { ALU, BLACK } from './panels'

/** Your audio interface's input in the rack: a mic, a guitar, a line in.
 *  ENABLE asks the browser for the input (nothing leaves your machine). ENV
 *  follows the level, GATE opens over THRESH, PITCH tracks the note you sing
 *  or play (monophonic) — hum a bassline into the rack. */
export const audioin: ModuleSpec = {
  type: 'audioin',
  title: 'AUDIO IN',
  name: 'Audio Input',
  tagline: 'Your mic or line input as a module: audio, envelope, gate and pitch tracking',
  category: 'I/O',
  hp: 10,
  panel: ALU,
  inputs: [],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
    { id: 'env', label: 'ENV' },
    { id: 'gate', label: 'GATE' },
    { id: 'pitch', label: 'PITCH' },
  ],
  params: [
    { id: 'gain', label: 'GAIN', min: 0.05, max: 8, def: 2, curve: 'exp', unit: 'x' },
    { id: 'thresh', label: 'THRESH', min: 0.1, max: 5, def: 0.8, curve: 'exp', unit: 'V' },
  ],
  leds: 3,
  controls: [
    { kind: 'surface', name: 'audioin', x: 4, y: 15, w: 42.8, h: 24 },
    { kind: 'knob', param: 'gain', x: 14, y: 52 },
    { kind: 'knob', param: 'thresh', x: 37, y: 52, size: 'S' },
    { kind: 'out', jack: 'env', x: 12, y: 84.3 },
    { kind: 'out', jack: 'gate', x: 25.4, y: 84.3 },
    { kind: 'out', jack: 'pitch', x: 38.8, y: 84.3 },
    { kind: 'out', jack: 'l', x: 18, y: 113.5 },
    { kind: 'out', jack: 'r', x: 33, y: 113.5 },
  ],
}

/** Webcam motion → CV. ENABLE turns the camera on (it stays on this machine;
 *  only a 64×48 thumbnail is analysed). MOTION is how much is moving, X/Y
 *  where the movement is (mirrored, like a mirror), LIGHT how bright the room
 *  is, MOVE a gate while you're moving. Wave a hand to open a filter. */
export const camera: ModuleSpec = {
  type: 'camera',
  title: 'CAMERA',
  name: 'Camera Motion',
  tagline: 'Webcam motion as CV: how much, where, how bright; a gate while you move',
  category: 'I/O',
  hp: 12,
  panel: BLACK,
  inputs: [],
  outputs: [
    { id: 'motion', label: 'MOTION' },
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'light', label: 'LIGHT' },
    { id: 'move', label: 'MOVE' },
  ],
  params: [
    { id: 'sens', label: 'SENS', min: 0.2, max: 5, def: 1, curve: 'exp', unit: 'x' },
    { id: 'slew', label: 'SLEW', min: 0.01, max: 2, def: 0.15, curve: 'exp', unit: 's' },
  ],
  leds: 1,
  controls: [
    { kind: 'surface', name: 'camera', x: 4, y: 15, w: 53, h: 40 },
    { kind: 'knob', param: 'sens', x: 18, y: 66, size: 'S' },
    { kind: 'knob', param: 'slew', x: 43, y: 66, size: 'S' },
    { kind: 'out', jack: 'motion', x: 12, y: 98.9 },
    { kind: 'out', jack: 'move', x: 48.8, y: 98.9 },
    { kind: 'out', jack: 'x', x: 12, y: 113.5 },
    { kind: 'out', jack: 'y', x: 30.5, y: 113.5 },
    { kind: 'out', jack: 'light', x: 48.8, y: 113.5 },
  ],
}

/** A game controller in the rack: both sticks (±5 V), the two triggers (0–10 V)
 *  and six buttons as gates. Press any button on the controller to wake it
 *  (browsers keep controllers hidden until then). */
export const gamepad: ModuleSpec = {
  type: 'gamepad',
  title: 'GAMEPAD',
  name: 'Gamepad',
  tagline: 'Game controller sticks, triggers and buttons as CV and gates',
  category: 'I/O',
  hp: 16,
  panel: BLACK,
  inputs: [],
  outputs: [
    { id: 'lx', label: 'LX' },
    { id: 'ly', label: 'LY' },
    { id: 'rx', label: 'RX' },
    { id: 'ry', label: 'RY' },
    { id: 'lt', label: 'LT' },
    { id: 'rt', label: 'RT' },
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'lb', label: 'LB' },
    { id: 'rb', label: 'RB' },
  ],
  params: [{ id: 'slew', label: 'SLEW', min: 0.001, max: 0.5, def: 0.01, curve: 'exp', unit: 's' }],
  controls: [
    { kind: 'surface', name: 'gamepad', x: 4, y: 15, w: 73.3, h: 38 },
    { kind: 'knob', param: 'slew', x: 40.6, y: 62, size: 'S' },
    ...['lx', 'ly', 'rx', 'ry', 'lt', 'rt'].map((jack, i) => ({ kind: 'out' as const, jack, x: 10 + (i % 6) * 12.2, y: 84.3 })),
    ...['a', 'b', 'x', 'y', 'lb', 'rb'].map((jack, i) => ({ kind: 'out' as const, jack, x: 10 + (i % 6) * 12.2, y: 113.5 })),
  ],
}
