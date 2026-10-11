import { PR_SLOTS } from '../../modules/specs/pianoroll'
import { hits, TRACK, type Bar } from '../songs/parts'
import type { Jack, Kit } from '../starters/kit'

/** The notes and helpers of "Voltage" (presets/voltageSong.ts). */

/** A note on a roll: bar (0-based), step in the bar, length (16ths), name. */
export type Note = [bar: number, step: number, len: number, name: string]
const PC: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
/** A note name → PIANO ROLL row (0 = C2). */
const row = (name: string) => PC[name.slice(0, -1)] + 12 * (Number(name.slice(-1)) - 2)

/** The hook, as played in the second and third drops (bars 1–2 over Em,
 *  3–4 over C, 5–6 over D, 7–8 back on Em with a pickup into the top). */
export const HOOK: Note[] = [
  [0, 0, 4, 'B5'], [0, 4, 4, 'A5'], [0, 8, 3, 'G5'], [0, 11, 1, 'E5'], [0, 12, 1, 'G5'], [0, 13, 3, 'E5'],
  [1, 0, 1, 'G5'], [1, 1, 3, 'E5'], [1, 4, 3, 'G5'], [1, 7, 1, 'F#5'], [1, 8, 1, 'G5'], [1, 9, 1, 'D5'], [1, 10, 1, 'B4'], [1, 11, 1, 'A4'], [1, 12, 4, 'B4'],
  [2, 0, 4, 'B5'], [2, 4, 4, 'A5'], [2, 8, 1, 'G5'], [2, 9, 2, 'A5'], [2, 11, 1, 'E5'], [2, 12, 4, 'G5'],
  [3, 0, 7, 'G5'], [3, 7, 1, 'F#5'], [3, 8, 1, 'G5'], [3, 9, 1, 'D5'], [3, 10, 1, 'B4'], [3, 11, 5, 'A4'],
  [4, 0, 3, 'A5'], [4, 3, 1, 'F#5'], [4, 4, 4, 'G5'], [4, 8, 1, 'F#5'], [4, 9, 2, 'G5'], [4, 11, 1, 'D5'], [4, 12, 1, 'F#5'], [4, 13, 3, 'A4'],
  [5, 0, 8, 'A4'], [5, 8, 2, 'B4'], [5, 10, 1, 'G5'], [5, 11, 1, 'F#5'], [5, 12, 2, 'E5'], [5, 14, 2, 'B4'],
  [6, 0, 2, 'B4'], [6, 2, 1, 'D5'], [6, 3, 2, 'E5'], [6, 5, 2, 'G5'], [6, 7, 1, 'F#5'], [6, 8, 1, 'E5'], [6, 9, 1, 'B4'], [6, 10, 1, 'D5'], [6, 11, 2, 'E5'], [6, 13, 2, 'B4'], [6, 15, 2, 'E5'],
  [7, 1, 1, 'B4'], [7, 2, 1, 'D5'], [7, 3, 3, 'E5'], [7, 6, 1, 'G5'], [7, 7, 1, 'F#5'], [7, 8, 1, 'E5'], [7, 9, 1, 'D5'], [7, 10, 1, 'B4'], [7, 11, 1, 'E5'], [7, 12, 1, 'G5'], [7, 13, 1, 'E5'], [7, 14, 1, 'F#5'], [7, 15, 1, 'G5'],
]

/** The bass's roots, each one pushed three 16ths ahead of its chord. */
export const BASS: Note[] = [[0, 0, 29, 'E2'], [1, 13, 32, 'C2'], [3, 13, 32, 'D2'], [5, 13, 35, 'E2']]

/** An eight-bar PIANO ROLL holding these notes (every other slot empty). */
export function roll(k: Kit, notes: Note[], voices: number, extra: Record<string, number> = {}, vel = 0.85): string {
  const p: Record<string, number> = { bars: 8, voices, view: 10, ...extra }
  for (let i = 0; i < PR_SLOTS; i++) {
    const n = notes[i]
    p[`s${i}`] = n ? n[0] * 16 + n[1] : -1
    if (!n) continue
    p[`l${i}`] = n[2]
    p[`n${i}`] = row(n[3])
    p[`v${i}`] = vel
  }
  return k.add('pianoroll', p)
}

/** A gate passed only while an arranger part plays (a VCA as a switch). */
export function onlyIn(k: Kit, gate: Jack, part: Jack): Jack {
  const v = k.add('vca', { gain: 0, cv: 1 })
  k.wire(gate, [v, 'in'])
  k.wire(part, [v, 'cv'])
  return [v, 'out']
}

/** The drums, on a clock from elsewhere (ARRANGER XL's): TR-16 with patterns
 *  A intro hats, B nothing (the breakdown), C the fill, D the drop's groove;
 *  PAT picks them. Returns each drum's output. */
export function songDrums(k: Kit, clk: Jack, rst: Jack, pat: Jack) {
  const bars: Bar[] = [
    { ch: '..x...x...x...x.' },
    {},
    // the fill: nothing on the first half, kicks then a snare roll filling in toward the drop
    { kick: '........x.x.xxxx', snare: '............xxxx' },
    { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xx.xxx.xxx.xxx.x', oh: '..x...x...x...x.', acc: '..x...x...x...x.' },
  ]
  const p: Record<string, number> = {}
  bars.forEach((bar, b) => {
    for (const part of Object.keys(TRACK) as (keyof typeof TRACK)[]) p[`${'abcd'[b]}${TRACK[part]}`] = bar[part] ? hits(bar[part]!) : 0
  })
  const tr = k.add('tr16', p)
  k.wire(clk, [tr, 'clk'])
  k.wire(rst, [tr, 'rst'])
  k.wire(pat, [tr, 'pat'])
  const kick = k.add('kick', { tune: 50, decay: 0.45, punch: 0.7, drive: 0.35 })
  const snare = k.add('snare', { tune: 210, decay: 0.12, snappy: 0.8 })
  const clap = k.add('clap', { tone: 1300, decay: 0.25 })
  const hats = k.add('hats', { chd: 0.03, ohd: 0.22, tone: 10500 })
  k.wire([tr, 't1'], [kick, 'trig'])
  k.wire([tr, 'acc'], [kick, 'acc'])
  k.wire([tr, 't2'], [snare, 'trig'])
  k.wire([tr, 'acc'], [snare, 'acc'])
  k.wire([tr, 't3'], [clap, 'trig'])
  k.wire([tr, 't4'], [hats, 'ch'])
  k.wire([tr, 't5'], [hats, 'oh'])
  k.wire([tr, 'acc'], [hats, 'acc'])
  return { tr, kick: [kick, 'out'] as Jack, snare: [snare, 'out'] as Jack, clap: [clap, 'out'] as Jack, hats: [hats, 'mix'] as Jack }
}
