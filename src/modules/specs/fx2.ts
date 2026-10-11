import type { ModuleSpec } from '../types'
import { opts, pct, simpleSpec } from './build'
import { BLACK, CREAM } from './panels'

/** PING-PONG's note values (in quarter notes). */
export const PP_DIVS = ['1/16', '1/8T', '1/8', '1/8.', '1/4T', '1/4', '1/4.', '1/2', '1 BAR']
export const PP_BEATS = [0.25, 1 / 3, 0.5, 0.75, 2 / 3, 1, 1.5, 2, 4]

/** PING-PONG: a stereo delay in time with the song: repeats bounce from side to side. */
export const pingpong: ModuleSpec = simpleSpec({
  type: 'pingpong',
  title: 'PING-PONG',
  name: 'Tempo Delay',
  tagline: 'A stereo delay locked to the tempo (1/16 to a bar, dotted, triplets): repeats bounce left and right, darken and duck under the playing',
  category: 'Effects',
  hp: 10,
  panel: CREAM,
  params: [
    opts('div', 'TIME', PP_DIVS, 3),
    { id: 'bpm', label: 'TEMPO', min: 40, max: 240, def: 110, unit: 'bpm' },
    pct('fb', 'REPEATS', 0.45),
    { id: 'tone', label: 'TONE', min: 500, max: 16000, def: 4500, curve: 'exp', unit: 'Hz' },
    pct('duck', 'DUCK', 0.3),
    pct('mix', 'MIX', 0.35),
    opts('mode', 'MODE', ['PING-PONG', 'STEREO', 'MONO'], 0),
  ],
  inputs: [
    { id: 'l', label: 'IN L' },
    { id: 'r', label: 'IN R' },
    { id: 'clk', label: 'CLK' },
  ],
  outputs: [
    { id: 'ol', label: 'L' },
    { id: 'or', label: 'R' },
  ],
  rows: [['kl:div'], ['ks:bpm', 's:mode'], ['k:fb', 'k:tone'], ['k:duck', 'k:mix'], ['i:l', 'i:r', 'i:clk'], ['o:ol', 'o:or']],
})

/** FLANGER: the jet-plane sweep: a very short delay swept against the dry sound. */
export const flanger: ModuleSpec = simpleSpec({
  type: 'flanger',
  title: 'FLANGER',
  name: 'Flanger',
  tagline: 'A very short swept delay against the dry sound: the jet-plane whoosh, metallic with feedback',
  category: 'Effects',
  hp: 8,
  panel: BLACK,
  params: [
    { id: 'rate', label: 'RATE', min: 0.02, max: 8, def: 0.25, curve: 'exp', unit: 'Hz' },
    pct('depth', 'DEPTH', 0.7),
    /** The delay at the centre of the sweep, in milliseconds. */
    { id: 'manual', label: 'MANUAL', min: 0.2, max: 8, def: 1.5, curve: 'exp' },
    { id: 'fb', label: 'FEEDBACK', min: -0.95, max: 0.95, def: 0.6, unit: '%' },
    pct('mix', 'MIX', 0.5),
  ],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'SWEEP CV' },
  ],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  rows: [['k:rate', 'k:depth'], ['k:manual', 'k:fb'], ['ks:mix'], ['i:in', 'i:cv'], ['o:l', 'o:r']],
})

/** ROTARY: the organ's rotating speaker cabinet. */
export const rotary: ModuleSpec = simpleSpec({
  type: 'rotary',
  title: 'ROTARY',
  name: 'Rotary Speaker',
  tagline: 'A rotating horn and drum in a cabinet: Doppler warble and swirl, SLOW / FAST with the motors speeding up and slowing down, a valve preamp',
  category: 'Effects',
  hp: 10,
  panel: CREAM,
  params: [
    opts('speed', 'SPEED', ['BRAKE', 'SLOW', 'FAST'], 1),
    pct('drive', 'DRIVE', 0.25),
    pct('balance', 'HORN · DRUM', 0.5),
    pct('spread', 'MIC SPREAD', 0.8),
    pct('mix', 'MIX', 1),
  ],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'fast', label: 'FAST' },
  ],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  leds: 2,
  rows: [['s:speed'], ['l:0', 'l:1'], ['k:drive', 'k:balance'], ['k:spread', 'ks:mix'], ['i:in', 'i:fast'], ['o:l', 'o:r']],
})

/** FREQ SHIFT: moves every partial by the same number of hertz (not a pitch
 *  shift: harmonics stop being harmonic). Bell tones, phasing, barber-pole
 *  spirals with feedback. */
export const fshift: ModuleSpec = simpleSpec({
  type: 'fshift',
  title: 'FREQ SHIFT',
  name: 'Frequency Shifter',
  tagline: 'Shifts every partial by the same hertz: clangorous bells, slow phasing, endless spirals with feedback',
  category: 'Effects',
  hp: 8,
  panel: BLACK,
  params: [
    { id: 'shift', label: 'SHIFT', min: -1, max: 1, def: 0.05, unit: '%' },
    opts('range', 'RANGE', ['±10 Hz', '±300 Hz', '±3 kHz'], 1),
    pct('fb', 'FEEDBACK', 0),
    pct('mix', 'MIX', 1),
  ],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'SHIFT CV' },
  ],
  outputs: [
    { id: 'up', label: 'UP' },
    { id: 'down', label: 'DOWN' },
    { id: 'out', label: 'MIX' },
  ],
  rows: [['kl:shift'], ['s:range'], ['k:fb', 'k:mix'], ['i:in', 'i:cv'], ['o:up', 'o:down', 'o:out']],
})

/** COMB: a delay so short it's a pitch, fed back: anything rings at the note. */
export const comb: ModuleSpec = simpleSpec({
  type: 'comb',
  title: 'COMB',
  name: 'Comb Filter',
  tagline: 'A tuned feedback delay: drums, noise and chords ring at the note (V/OCT), or flange with it hollowly',
  category: 'Filters',
  hp: 8,
  panel: BLACK,
  params: [
    { id: 'freq', label: 'FREQ', min: 20, max: 4000, def: 220, curve: 'exp', unit: 'Hz' },
    { id: 'fb', label: 'FEEDBACK', min: -0.99, max: 0.99, def: 0.85, unit: '%' },
    pct('damp', 'DAMP', 0.3),
    pct('mix', 'MIX', 0.7),
  ],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'voct', label: 'V/OCT' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  rows: [['kl:freq'], ['k:fb', 'k:damp'], ['ks:mix'], ['i:in', 'i:voct'], ['o:out']],
})

export const FORMANT_VOWELS = ['A', 'E', 'I', 'O', 'U']

/** FORMANT: a vowel filter: three resonances where a voice has them. */
export const formant: ModuleSpec = simpleSpec({
  type: 'formant',
  title: 'FORMANT',
  name: 'Vowel Filter',
  tagline: 'Three resonances placed like a voice’s: morph A–E–I–O–U to make a synth (or a drum loop) talk',
  category: 'Filters',
  hp: 8,
  panel: CREAM,
  params: [
    { id: 'vowel', label: 'VOWEL', min: 0, max: 4, def: 0, unit: '%' },
    { id: 'size', label: 'SIZE', min: -1, max: 1, def: 0, unit: '%' },
    pct('res', 'RESONANCE', 0.6),
    pct('mix', 'MIX', 1),
  ],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'VOWEL CV' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  rows: [['kl:vowel'], ['k:size', 'k:res'], ['ks:mix'], ['i:in', 'i:cv'], ['o:out']],
})
