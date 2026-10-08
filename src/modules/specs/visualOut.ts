import type { ModuleSpec } from '../types'
import { BLACK } from './panels'

/** XY vector display (oscilloscope music). X and Y drive the beam like a CRT in
 *  XY mode: patch two oscillators a fifth apart for a Lissajous figure, or a
 *  stereo pair for "oscilloscope music". Z dims the beam. The phosphor glows
 *  and fades (PERSIST); a faster-moving beam is dimmer, as on a real tube. */
export const vector: ModuleSpec = {
  type: 'vector',
  title: 'VECTOR',
  name: 'Vector Display',
  tagline: 'XY-mode CRT: Lissajous figures and oscilloscope music with phosphor glow',
  category: 'Visuals',
  hp: 16,
  panel: BLACK,
  inputs: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'z', label: 'Z' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [],
  leds: 1,
  params: [
    { id: 'scale', label: 'SCALE', min: 0.05, max: 2, def: 0.2, curve: 'exp', unit: 'V/div' },
    { id: 'persist', label: 'PERSIST', min: 0, max: 0.97, def: 0.75, unit: '%' },
    { id: 'focus', label: 'FOCUS', min: 0, max: 1, def: 0.6, unit: '%' },
  ],
  controls: [
    { kind: 'surface', name: 'vector', x: 4, y: 15, w: 73.3, h: 73.3 },
    { kind: 'knob', param: 'scale', x: 12, y: 98, size: 'S' },
    { kind: 'knob', param: 'persist', x: 26, y: 98, size: 'S' },
    { kind: 'knob', param: 'focus', x: 40, y: 98, size: 'S' },
    { kind: 'in', jack: 'rst', x: 12, y: 113 },
    { kind: 'in', jack: 'x', x: 40, y: 113 },
    { kind: 'in', jack: 'y', x: 54, y: 113 },
    { kind: 'in', jack: 'z', x: 68, y: 113 },
  ],
}

/** Scrolling spectrogram: frequency up the side (log scale), time across,
 *  loudness as colour. Watch a filter sweep, a chord's overtones, a drum's
 *  noise burst. */
export const waterfall: ModuleSpec = {
  type: 'waterfall',
  title: 'WATERFALL',
  name: 'Spectrogram',
  tagline: 'Scrolling spectrogram (log frequency): see overtones, sweeps and noise',
  category: 'Visuals',
  hp: 20,
  panel: BLACK,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [],
  leds: 1,
  params: [
    { id: 'range', label: 'RANGE', min: 30, max: 100, def: 70, unit: '%' },
    { id: 'gain', label: 'GAIN', min: -20, max: 30, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'surface', name: 'waterfall', x: 4, y: 15, w: 93.6, h: 78 },
    { kind: 'knob', param: 'range', x: 50, y: 108, size: 'S' },
    { kind: 'knob', param: 'gain', x: 68, y: 108, size: 'S' },
    { kind: 'in', jack: 'in', x: 14, y: 110 },
    { kind: 'in', jack: 'rst', x: 32, y: 110 },
  ],
}

/** Rack-wide light show: the music lights the whole case. Bass glows red,
 *  mids green, treble blue, washing over the wood and the rows. Patch the mix
 *  in; turn it off with LEVEL. */
export const lightshow: ModuleSpec = {
  type: 'lightshow',
  title: 'LIGHTS',
  name: 'Light Show',
  tagline: 'The music lights up the whole rack: bass red, mids green, treble blue',
  category: 'Visuals',
  hp: 6,
  panel: BLACK,
  inputs: [{ id: 'in', label: 'IN' }],
  outputs: [],
  params: [
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.7, unit: '%' },
    { id: 'sens', label: 'SENS', min: 0.2, max: 5, def: 1, curve: 'exp', unit: 'x' },
  ],
  leds: 3,
  controls: [
    { kind: 'led', index: 0, x: 15.24, y: 24, color: '#ff4a3a' },
    { kind: 'led', index: 1, x: 15.24, y: 31, color: '#3bff6b' },
    { kind: 'led', index: 2, x: 15.24, y: 38, color: '#4a8aff' },
    { kind: 'knob', param: 'level', x: 15.24, y: 56 },
    { kind: 'knob', param: 'sens', x: 15.24, y: 78, size: 'S' },
    { kind: 'in', jack: 'in', x: 15.24, y: 106 },
  ],
}
