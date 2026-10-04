import type { ModuleSpec } from '../types'
import { CREAM } from './panels'

export const TAPE_SOUNDS = ['STRINGS', 'FLUTE', 'CHOIR']
/** Seconds of tape behind each key. */
export const TAPE_SECONDS = 8

/** Tape-replay keyboard (Mellotron-style). Every key has its own strip of tape
 *  with a recorded note on it: pressing the key plays the strip, holding past
 *  8 s runs it out, releasing lets a spring rewind it — re-press before it's
 *  home and the note starts part-way in. The recordings (strings, flutes, choir)
 *  are synthesised; the tape mechanism adds wow, flutter, hiss and roll-off.
 *  Plays from the keyboard/MIDI, or from POLY·CV on the poly inputs. */
export const tapekeys: ModuleSpec = {
  type: 'tapekeys',
  title: 'TAPE KEYS',
  name: 'Tape Replay Keyboard',
  tagline: 'Mellotron-style: a strip of tape per key (8 s, then it runs out; rewinds on release); strings, flutes, choir',
  category: 'Polyphonic',
  hp: 14,
  panel: CREAM,
  inputs: [
    { id: 'voct', label: 'V/OCT' },
    { id: 'gate', label: 'GATE' },
    { id: 'speed', label: 'SPEED' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'sound', label: 'SOUND', min: 0, max: 2, def: 0, stepped: true, options: TAPE_SOUNDS },
    { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.7, unit: '%' },
    { id: 'tone', label: 'TONE', min: 0, max: 1, def: 0.55, unit: '%' },
    { id: 'speed', label: 'SPEED', min: -1, max: 1, def: 0, unit: 'st' },
    { id: 'wow', label: 'WOW', min: 0, max: 1, def: 0.35, unit: '%' },
  ],
  leds: 1,
  controls: [
    { kind: 'switch', param: 'sound', x: 9, y: 30 },
    { kind: 'knob', param: 'vol', x: 39, y: 28 },
    { kind: 'knob', param: 'tone', x: 59, y: 28 },
    { kind: 'knob', param: 'speed', x: 22, y: 52, size: 'S' },
    { kind: 'knob', param: 'wow', x: 48, y: 52, size: 'S' },
    { kind: 'text', text: 'TAPE', x: 35.5, y: 66, size: 1.8 },
    { kind: 'progress', x: 10, y: 69, w: 51, led: 0 },
    { kind: 'in', jack: 'voct', x: 12, y: 97 },
    { kind: 'in', jack: 'gate', x: 26, y: 97 },
    { kind: 'in', jack: 'speed', x: 40, y: 97 },
    { kind: 'out', jack: 'out', x: 58, y: 113.5 },
  ],
}
