import type { ParamSpec } from '../types'

/** What every POCKET shares on top of its own sound: four patterns (A keeps
 *  the original ids, B–D are prefixed `B.` …), a chain of up to eight of them
 *  played as a song, and 16 hold-to-play punch-in effects on the output. */
export const POCKET_PATTERNS = ['A', 'B', 'C', 'D']
export const POCKET_CHAIN = 8
export const POCKET_FX = [
  'LOOP ¼', 'LOOP ⅛', 'LOOP 16TH', 'LOOP 32ND',
  'ROLL', 'OCT DOWN', 'OCT UP', 'REVERSE',
  'TAPE STOP', 'SCRATCH', 'LOW SWEEP', 'HIGH SWEEP',
  'CRUSH', 'CHOP', 'ECHO', 'WOBBLE',
]

/** The id prefix of pattern k ('' for A). */
export const patPre = (k: number): string => (k <= 0 ? '' : `${POCKET_PATTERNS[k]}.`)

/** Telemetry after each POCKET's own: the pattern playing, the chain slot
 *  playing (−1 off), the effect held (−1 none). */
export const SONGL = { pat: 0, slot: 1, fx: 2 } as const
export const SONG_LEDS = 3

/** The pattern / chain params. */
export const songParams = (): ParamSpec[] => [
  { id: 'pat', label: 'PATTERN', min: 0, max: POCKET_PATTERNS.length - 1, def: 0, stepped: true, options: POCKET_PATTERNS },
  { id: 'chon', label: 'SONG', min: 0, max: 1, def: 0, stepped: true, options: ['OFF', 'ON'] },
  { id: 'chlen', label: 'CHAIN LENGTH', min: 1, max: POCKET_CHAIN, def: 2, stepped: true },
  ...Array.from({ length: POCKET_CHAIN }, (_, i): ParamSpec => ({
    id: `ch${i}`,
    label: `CHAIN ${i + 1}`,
    min: 0,
    max: POCKET_PATTERNS.length - 1,
    def: i === 1 ? 1 : 0,
    stepped: true,
    options: POCKET_PATTERNS,
  })),
]

/** Patterns B–D: copies of pattern A's params under prefixed ids, starting
 *  empty (no steps on, locks clear, notes at the bottom). */
export const morePatterns = (a: ParamSpec[]): ParamSpec[] =>
  POCKET_PATTERNS.slice(1).flatMap((letter, k) =>
    a.map((ps): ParamSpec => ({ ...ps, id: `${patPre(k + 1)}${ps.id}`, label: `${letter} · ${ps.label}`, def: ps.min < 0 ? ps.def : 0 })),
  )
