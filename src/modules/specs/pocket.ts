import type { ModuleSpec, PanelStyle, ParamSpec } from '../types'
import { CREAM, SAND } from './panels'
import { morePatterns, SONG_LEDS, songParams } from './pocketShared'

export const POCKET_SOUNDS = ['KICK', 'SNARE', 'CLAP', 'HAT', 'OPEN', 'TOM', 'BLIP', 'ZAP']
/** POCKET OFFICE: the office as a drum kit. */
export const OFFICE_SOUNDS = ['TYPE', 'SPACE', 'STAPLE', 'GLITCH', 'BELL', 'RETURN', 'PHONE', 'PAPER']
export const POCKET_STEPS = 16
export const POCKETL = { step: 0, hit0: 1, song: 9 } as const

/** The eight sound names of a drum POCKET, by module type. */
export const drumPocketSounds = (type: string): string[] => (type === 'pocketoffice' ? OFFICE_SOUNDS : POCKET_SOUNDS)

const N = 8

/** Per-step parameter locks: −1 = not locked (use the sound's knob). */
const LOCKS: ParamSpec[] = Array.from({ length: N * POCKET_STEPS * 2 }, (_, k) => {
  const ab = k % 2 === 0 ? 'a' : 'b'
  const s = Math.floor(k / 2 / POCKET_STEPS)
  const i = Math.floor(k / 2) % POCKET_STEPS
  return { id: `l${ab}${s}_${i}`, label: `LOCK ${ab.toUpperCase()} ${s + 1}.${i + 1}`, min: -1, max: 1, def: -1, stepped: true }
})

/** A drum POCKET: eight sounds, 16 steps, parameter locks; `masks` is each
 *  sound's starting steps. */
function drumPocket(o: { type: string; title: string; name: string; tagline: string; sounds: string[]; masks: number[]; panel: PanelStyle }): ModuleSpec {
  const mask = (s: number): ParamSpec => ({ id: `m${s}`, label: `STEPS ${s + 1}`, min: 0, max: 0xffff, def: o.masks[s], stepped: true })
  return {
    type: o.type,
    title: o.title,
    name: o.name,
    tagline: o.tagline,
    category: 'Systems',
    hp: 16,
    panel: o.panel,
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
      { id: 'sel', label: 'SOUND', min: 0, max: N - 1, def: 0, stepped: true, options: o.sounds },
      { id: 'run', label: 'PLAY', min: 0, max: 1, def: 0, stepped: true, options: ['STOP', 'PLAY'] },
      { id: 'write', label: 'WRITE', min: 0, max: 1, def: 1, stepped: true, options: ['PLAY', 'WRITE'] },
      ...o.sounds.flatMap((_, s): ParamSpec[] => [
        { id: `a${s}`, label: `A ${s + 1}`, min: 0, max: 1, def: 0.5 },
        { id: `b${s}`, label: `B ${s + 1}`, min: 0, max: 1, def: 0.5 },
        mask(s),
      ]),
      ...LOCKS,
      ...songParams(),
      ...morePatterns([...o.sounds.map((_, s) => mask(s)), ...LOCKS]),
    ],
    leds: 1 + N + SONG_LEDS,
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
}

/** Pocket groovebox (a calculator-sized drum machine): eight sounds, 16 steps, and
 *  parameter locks. WRITE on: the 16 buttons toggle steps of the selected
 *  sound. WRITE off: buttons 1–8 play and select sounds. Knobs A (pitch) and
 *  B (decay) set the selected sound; right-click a step (in WRITE) to lock A/B
 *  for just that step (it lights), double-click a knob to clear the lock.
 *  PATTERN and FX (shared by every POCKET): patterns A–D and a song chain,
 *  and 16 hold-to-play punch-in effects. */
export const pocket = drumPocket({
  type: 'pocket',
  title: 'POCKET',
  name: 'Pocket Groovebox',
  tagline: 'Calculator-sized groovebox: 8 sounds, 16 steps, per-step parameter locks, swing',
  sounds: POCKET_SOUNDS,
  masks: [0x1111, 0x1010, 0, 0x5555, 0x8080, 0, 0x0c48, 0],
  panel: SAND,
})

const steps = (...on: number[]) => on.reduce((m, s) => m | (1 << (s - 1)), 0)

/** The office as a drum kit, made of clicks and noise: typewriter keys and the
 *  space bar, a stapler, glitchy hats, the carriage bell and return, a phone's
 *  chirp, paper. Same POCKET as the drums: steps, locks, CLK. */
export const pocketoffice = drumPocket({
  type: 'pocketoffice',
  title: 'POCKET OFFICE',
  name: 'Pocket Office',
  tagline: 'Calculator-sized drum kit of office noises: typewriter keys, stapler, glitch hats, the carriage bell and return',
  sounds: OFFICE_SOUNDS,
  // a typist at work: keys on the off-beats and in runs, the space bar on the beat,
  // a staple on 2 and 4, the bell at the end of the line, then the carriage return
  masks: [steps(2, 3, 4, 6, 7, 10, 11, 12, 14), steps(1, 9), steps(5, 13), steps(3, 7, 11, 15), steps(15), steps(16), 0, steps(8)],
  panel: CREAM,
})
