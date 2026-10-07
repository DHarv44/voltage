import type { Control, ModuleSpec } from '../types'
import { BLACK } from './panels'

export const FT_TRACKS = 4
export const FT_SECONDS = 30
export const FTL = {
  /** Head position in seconds. */
  head: 0,
  play: 1,
  rec: 2,
  /** Tape speed (1 = play, negative = reverse/rewind). */
  speed: 3,
  arm0: 4,
} as const

const TX = [14, 38, 62, 86]

/** Four-track cassette portastudio. Arm tracks, hit REC to punch in (REC again
 *  punches out), bounce by patching outputs back into an armed track, slow the
 *  tape (VARI) or flip it (REVERSE) — record slow, play back fast for the
 *  chipmunk trick. Tape saturates, hisses and rolls off a little each pass. */
export const fourtrack: ModuleSpec = {
  type: 'fourtrack',
  title: '4-TRACK',
  name: '4-Track Tape Recorder',
  tagline: '30 s four-track tape: punch in/out, bounce, varispeed, reverse, loop; reels you can watch',
  category: 'Sampling & Tape',
  hp: 28,
  panel: BLACK,
  inputs: Array.from({ length: FT_TRACKS }, (_, i) => ({ id: `in${i + 1}`, label: `IN ${i + 1}` })),
  outputs: [
    ...Array.from({ length: FT_TRACKS }, (_, i) => ({ id: `out${i + 1}`, label: `TRK ${i + 1}` })),
    { id: 'mix', label: 'MIX' },
  ],
  params: [
    ...Array.from({ length: FT_TRACKS }, (_, i) => ({ id: `lvl${i + 1}`, label: `LEVEL ${i + 1}`, min: 0, max: 1, def: 0.8, unit: '%' as const })),
    { id: 'vari', label: 'VARI', min: 0.5, max: 1.5, def: 1, unit: 'x' },
    { id: 'rev', label: 'DIRECTION', min: 0, max: 1, def: 0, stepped: true, options: ['FWD', 'REV'] },
    { id: 'loop', label: 'LOOP', min: 0, max: 1, def: 1, stepped: true, options: ['OFF', 'LOOP'] },
  ],
  leds: 8,
  controls: [
    { kind: 'surface', name: 'reels', x: 4, y: 15, w: 72, h: 40 },
    { kind: 'button', name: 'rew', x: 86, y: 26, label: 'REW' },
    { kind: 'button', name: 'play', x: 100, y: 26, label: 'PLAY', led: FTL.play, ledColor: '#3bff6b' },
    { kind: 'button', name: 'rec', x: 114, y: 26, label: 'REC', led: FTL.rec, ledColor: '#ff3b2f' },
    { kind: 'button', name: 'stop', x: 128, y: 26, label: 'STOP' },
    { kind: 'knob', param: 'vari', x: 90, y: 47 },
    { kind: 'switch', param: 'rev', x: 108, y: 47 },
    { kind: 'switch', param: 'loop', x: 124, y: 47 },
    ...TX.flatMap((x, i): Control[] => [
      { kind: 'button', name: `arm${i + 1}`, x, y: 66, label: `ARM ${i + 1}`, led: FTL.arm0 + i, ledColor: '#ff3b2f' },
      { kind: 'knob', param: `lvl${i + 1}`, x, y: 82, size: 'S' },
      { kind: 'in', jack: `in${i + 1}`, x, y: 98 },
      { kind: 'out', jack: `out${i + 1}`, x, y: 114.5 },
    ]),
    { kind: 'out', jack: 'mix', x: 118, y: 114.5 },
  ],
}
