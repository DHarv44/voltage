import type { ModuleSpec, ParamSpec } from '../types'
import { opts, pct, simpleSpec } from './build'
import { BLACK, CREAM } from './panels'

/** The nine drawbars: their footages and the semitones each sounds above the key. */
export const DB_FEET = ["16'", "5⅓'", "8'", "4'", "2⅔'", "2'", "1⅗'", "1⅓'", "1'"]
export const DB_SEMIS = [-12, 7, 0, 12, 19, 24, 28, 31, 36]
export const DB_VIB = ['OFF', 'V1', 'V2', 'V3', 'C1', 'C2', 'C3']
/** "888000000" and friends: the registration a drawbar organ is known for. */
const DEF = [8, 8, 8, 0, 0, 0, 0, 0, 0]
const sec = (id: string, label: string, min: number, max: number, def: number): ParamSpec => ({ id, label, min, max, def, curve: 'exp', unit: 's' })

/** DRAWBAR: a tonewheel organ. */
export const organ: ModuleSpec = simpleSpec({
  type: 'organ',
  title: 'DRAWBAR',
  name: 'Tonewheel Organ',
  tagline: 'Nine drawbars of spinning tonewheels, percussion, key click, the vibrato/chorus scanner and an overdriven preamp: play it into ROTARY',
  category: 'Instruments',
  hp: 30,
  panel: BLACK,
  params: [
    ...DB_FEET.map((label, i): ParamSpec => ({ id: `d${i}`, label, min: 0, max: 8, def: DEF[i], stepped: true })),
    opts('perc', 'PERCUSSION', ['OFF', '2ND', '3RD'], 1),
    opts('pdec', 'PERC DECAY', ['FAST', 'SLOW'], 0),
    opts('vib', 'VIBRATO', DB_VIB, 6),
    pct('click', 'KEY CLICK', 0.4),
    pct('leak', 'LEAKAGE', 0.3),
    pct('drive', 'DRIVE', 0.2),
    pct('level', 'LEVEL', 0.5),
  ],
  inputs: [
    { id: 'voct', label: 'V/OCT', poly: true },
    { id: 'gate', label: 'GATE', poly: true },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  grid: true,
  rows: [
    ['k:d0', 'k:d1', 'k:d2', 'k:d3', 'k:d4', 'k:d5', 'k:d6', 'k:d7', 'k:d8'],
    ['s:perc', 's:pdec', '-', 'ks:vib', '-', 'ks:click', 'ks:leak', 'ks:drive', 'ks:level'],
    ['i:voct', 'i:gate', '-', '-', '-', '-', '-', '-', 'o:out'],
  ],
})

/** BREATH: a blown instrument modelled as air and a tube. */
export const wind: ModuleSpec = simpleSpec({
  type: 'wind',
  title: 'BREATH',
  name: 'Wind Instrument Model',
  tagline: 'A flute (an air jet across a tube) or a clarinet (a reed on a tube), modelled: breath, overblowing, growl and all; play BREATH from an envelope or follower',
  category: 'Instruments',
  hp: 12,
  panel: CREAM,
  params: [
    opts('model', 'MODEL', ['FLUTE', 'CLARINET'], 0),
    pct('breath', 'BREATH', 0.7),
    pct('noise', 'AIR', 0.25),
    pct('tone', 'TONE', 0.55),
    pct('vib', 'VIBRATO', 0.25),
    sec('att', 'ATTACK', 0.005, 2, 0.06),
    sec('rel', 'RELEASE', 0.01, 3, 0.15),
    pct('level', 'LEVEL', 0.75),
  ],
  inputs: [
    { id: 'voct', label: 'V/OCT' },
    { id: 'gate', label: 'GATE' },
    { id: 'bcv', label: 'BREATH' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  rows: [['s:model'], ['k:breath', 'k:noise'], ['k:tone', 'k:vib'], ['ks:att', 'ks:rel', 'ks:level'], ['i:voct', 'i:gate', 'i:bcv'], ['o:out']],
})

export const CHOIR_VOWELS = ['A', 'E', 'I', 'O', 'U']

/** CHOIR: a row of singers. */
export const choir: ModuleSpec = simpleSpec({
  type: 'choir',
  title: 'CHOIR',
  name: 'Formant Choir',
  tagline: 'Eight voices of three singers each: a breathy, vibrato-wavering choir singing vowels (fixed, or a new one each note), harmonising whatever you play',
  category: 'Instruments',
  hp: 14,
  panel: CREAM,
  params: [
    { id: 'vowel', label: 'VOWEL', min: 0, max: 4, def: 0, unit: '%' },
    opts('words', 'VOWELS', ['FIXED', 'EACH NOTE'], 0),
    pct('ens', 'ENSEMBLE', 0.6),
    pct('breath', 'BREATH', 0.2),
    pct('vib', 'VIBRATO', 0.4),
    { id: 'size', label: 'SIZE', min: -1, max: 1, def: 0, unit: '%' },
    sec('att', 'ATTACK', 0.01, 3, 0.25),
    sec('rel', 'RELEASE', 0.02, 4, 0.8),
    pct('level', 'LEVEL', 0.75),
  ],
  inputs: [
    { id: 'voct', label: 'V/OCT', poly: true },
    { id: 'gate', label: 'GATE', poly: true },
    { id: 'vcv', label: 'VOWEL CV' },
  ],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  rows: [['kl:vowel', 's:words'], ['k:ens', 'k:breath', 'k:vib'], ['ks:size', 'ks:att', 'ks:rel', 'ks:level'], ['i:voct', 'i:gate', 'i:vcv'], ['o:l', 'o:r']],
})
