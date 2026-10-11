import type { Control, ModuleSpec } from '../types'
import { opts, simpleSpec } from './build'
import { CREAM } from './panels'

/** Values per note in MIDI FILE's buffer: beat, note, velocity, length (beats), channel. */
export const MF_STRIDE = 5
/** LEDs: the playhead (beats), the length (beats), playing (0/1). */
export const MFL = { beat: 0, len: 1, run: 2 } as const

/** The factory piece: the first sixteen bars of Bach's Prelude in C (BWV 846,
 *  public domain), our own transcription: each bar a held bass and tenor
 *  under three notes broken twice. */
const PRELUDE = [
  [48, 52, 55, 60, 64],
  [48, 50, 57, 62, 65],
  [47, 50, 55, 62, 65],
  [48, 52, 55, 60, 64],
  [48, 52, 57, 64, 69],
  [48, 50, 54, 57, 62],
  [47, 50, 55, 62, 67],
  [47, 48, 52, 55, 60],
  [45, 48, 52, 55, 60],
  [38, 45, 50, 54, 60],
  [43, 47, 50, 55, 59],
  [43, 46, 52, 55, 61],
  [41, 45, 50, 57, 62],
  [41, 44, 50, 53, 59],
  [40, 43, 48, 55, 60],
  [40, 41, 45, 48, 53],
]

/** The factory piece as MIDI FILE's buffer data. */
export function factoryNotes(): Float32Array {
  const out: number[] = []
  PRELUDE.forEach((c, bar) => {
    for (let half = 0; half < 2; half++) {
      const b = bar * 4 + half * 2
      out.push(b, c[0], 70, 2, 1)
      out.push(b + 0.25, c[1], 64, 1.75, 1)
      for (let i = 0; i < 6; i++) out.push(b + 0.5 + i * 0.25, c[2 + (i % 3)], 76 - (i % 3) * 4, 0.25, 1)
    }
  })
  return Float32Array.from(out)
}

/** MIDI FILE: plays a .mid file (or the factory piece) into the rack. */
export const midifile: ModuleSpec = simpleSpec({
  type: 'midifile',
  title: 'MIDI FILE',
  name: 'MIDI File Player',
  tagline: 'Plays a MIDI file into the rack: poly V/OCT, GATE and VELOCITY for any voice, at the file’s tempo, your own or a clock’s; loops',
  category: 'Sequencers',
  hp: 18,
  panel: CREAM,
  params: [
    opts('src', 'PLAYING', ['BACH', 'FILE'], 0),
    { id: 'tempo', label: 'TEMPO', min: 30, max: 240, def: 72, unit: 'bpm' },
    { id: 'trans', label: 'TRANSPOSE', min: -24, max: 24, def: 0, stepped: true, unit: 'st' },
    opts('ch', 'CHANNEL', ['ALL', ...Array.from({ length: 16 }, (_, i) => String(i + 1))], 0),
    opts('loop', 'END', ['STOP', 'LOOP'], 1),
    opts('run', 'PLAY', ['STOP', 'PLAY'], 1),
  ],
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
    { id: 'trs', label: 'TRANSPOSE' },
  ],
  outputs: [
    { id: 'voct', label: 'V/OCT', poly: true },
    { id: 'gate', label: 'GATE', poly: true },
    { id: 'vel', label: 'VEL', poly: true },
    { id: 'eot', label: 'END' },
  ],
  leds: MFL.run + 1,
  rows: [
    ['s:src', 'ks:tempo', 'ks:trans', 'ks:ch', 's:loop', 's:run', 'f:0:LOAD .MID:midi'],
    ['i:clk', 'i:rst', 'i:trs', '-', 'o:voct', 'o:gate', 'o:vel', 'o:eot'],
  ],
  top: (top, w) => [{ kind: 'surface', name: 'midiroll', x: 4, y: 14, w: w - 8, h: top - 15.5 - 14 } as Control],
})
