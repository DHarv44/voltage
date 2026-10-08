/** TALLY's data, shared by the spec, the engine and the face. */

export const TALLY_SOUNDS = ['PIANO', 'FANTASY', 'VIOLIN', 'FLUTE', 'GUITAR', 'ADSR']
export const ADSR_SOUND = 5
export const TALLY_MODES = ['CAL', 'PLAY', 'REC']
export const CAL = 0
export const PLAY = 1
export const REC = 2
export const TALLY_OCTAVES = ['LOW', 'MID', 'HIGH']

/** The key strip: 29 keys from G3 (semitones from C4). */
export const TALLY_KEYS = 29
export const TALLY_LOW = -5
/** Recorded melody: up to this many notes (params m0…, −1 = none), each
 *  stored as semitones from C4 + MELODY_OFFSET (so it stays positive). */
export const MELODY_MAX = 100
export const MELODY_OFFSET = 20

/** Ten rhythms on three sounds: PO (low blip), PI (high blip), SHA (noise).
 *  One step per sixteenth (a waltz bar is 12). */
export interface Rhythm {
  name: string
  po: string
  pi: string
  sha: string
  /** Delay every second sixteenth (0..0.5). */
  swing?: number
}
export const TALLY_RHYTHMS: Rhythm[] = [
  { name: 'MARCH', po: 'x.......x.......', pi: '....x.......x...', sha: '..x...x...x...x.' },
  { name: 'WALTZ', po: 'x...........', pi: '....x...x...', sha: '..x...x...x.' },
  { name: '4 BEAT', po: 'x.......x.......', pi: '....x.......x...', sha: 'x.x.x.x.x.x.x.x.' },
  { name: 'SWING', po: 'x.......x.......', pi: '....x.......x...', sha: 'x...x.x.x...x.x.', swing: 0.33 },
  { name: 'ROCK 1', po: 'x.......x.x.....', pi: '....x.......x...', sha: 'x.x.x.x.x.x.x.x.' },
  { name: 'ROCK 2', po: 'x..x....x.......', pi: '....x.......x..x', sha: 'xxxxxxxxxxxxxxxx' },
  { name: 'BOSSA', po: 'x..x..x.x..x..x.', pi: 'x..x...x..x..x..', sha: 'x.xxx.xxx.xxx.xx' },
  { name: 'SAMBA', po: 'x..xx..xx..xx..x', pi: '..x...x...x...x.', sha: 'xxxxxxxxxxxxxxxx' },
  { name: 'RHUMBA', po: 'x...x...x...x...', pi: '...x..x....x..x.', sha: 'x.x.x.x.x.x.x.x.' },
  { name: 'BEGUINE', po: 'x.....x.x.......', pi: '....x.......x...', sha: 'x.xxx.x.x.xxx.x.' },
]

/** ADSR codes: eight digits, read left to right as WAVE (0–9), ATTACK,
 *  DECAY, SUSTAIN LEVEL, SUSTAIN TIME, RELEASE, VIBRATO, TREMOLO (0–9 each). */
export const ADSR_DIGITS = ['WAVE', 'ATTACK', 'DECAY', 'SUS LEVEL', 'SUS TIME', 'RELEASE', 'VIBRATO', 'TREMOLO']
export const DEFAULT_CODE = 3_6_5_5_9_6_3_0 // a soft, singing flute-like default
export const digitsOf = (code: number): number[] => {
  const s = String(Math.max(0, Math.round(code))).padStart(8, '0').slice(-8)
  return Array.from(s, (c) => Number(c))
}

/** Engine → face on the LED channel. */
export const TLL = {
  /** The sounding key (semitones from C4; −99 = none). */
  note: 0,
  gate: 1,
  /** Rhythm step (−1 = stopped). */
  step: 2,
  /** Next melody note to play / notes recorded. */
  mpos: 3,
  mlen: 4,
  /** A digit being played by ♪ (−1 = none). */
  digit: 5,
  end: 6,
} as const
