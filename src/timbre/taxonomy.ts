/** The timbre vocabulary: what a sound *is*, in our own words, so anything
 *  that asks for a sound (a Strudel sound name, a MIDI program number, a
 *  search) and anything that can make one (our instrument modules) meet in
 *  the middle. The families are General MIDI's sixteen plus `synth` for the
 *  raw waves; a timbre is a finer word inside a family. */
export const FAMILIES = ['piano', 'chromatic', 'organ', 'guitar', 'bass', 'strings', 'ensemble', 'brass', 'reed', 'pipe', 'lead', 'pad', 'fx', 'ethnic', 'percussive', 'sfx', 'synth'] as const
export type Family = (typeof FAMILIES)[number]

/** Every timbre and the family it belongs to. */
export const TIMBRES = {
  piano: 'piano',
  epiano: 'piano',
  harpsichord: 'piano',
  clavinet: 'piano',
  bell: 'chromatic',
  vibes: 'chromatic',
  marimba: 'chromatic',
  xylophone: 'chromatic',
  musicbox: 'chromatic',
  steelpan: 'chromatic',
  organ: 'organ',
  guitar: 'guitar',
  pluck: 'guitar',
  bass: 'bass',
  synthbass: 'bass',
  strings: 'strings',
  harp: 'strings',
  choir: 'ensemble',
  brass: 'brass',
  sax: 'reed',
  clarinet: 'reed',
  oboe: 'reed',
  flute: 'pipe',
  lead: 'lead',
  pad: 'pad',
  drone: 'pad',
  sfx: 'sfx',
  handpan: 'ethnic',
  kalimba: 'ethnic',
  gamelan: 'ethnic',
  sitar: 'ethnic',
  drum: 'percussive',
  saw: 'synth',
  square: 'synth',
  sine: 'synth',
  triangle: 'synth',
  supersaw: 'synth',
  noise: 'synth',
  wavetable: 'synth',
} as const satisfies Record<string, Family>
export type Timbre = keyof typeof TIMBRES

export const familyOf = (t: Timbre): Family => TIMBRES[t]

/** Words in a sound's name → timbre, first match wins (the order matters:
 *  "epiano" before "piano", "synth_bass" before "synth"). */
const WORDS: [RegExp, Timbre][] = [
  [/epiano|rhodes|wurl|e\.?piano|electric_?piano/, 'epiano'],
  [/clav/, 'clavinet'],
  [/harpsi/, 'harpsichord'],
  [/piano|keys/, 'piano'],
  [/music_?box|celest|glocken|tinkle|crystal/, 'musicbox'],
  [/vibra|vibes/, 'vibes'],
  [/marimba|xylo|wood_?block/, 'marimba'],
  [/steel_?(pan|drum)/, 'steelpan'],
  [/kalimba|mbira/, 'kalimba'],
  [/handpan|hang/, 'handpan'],
  [/gamelan|gong/, 'gamelan'],
  [/bell|chime|carillon|tubular/, 'bell'],
  [/organ|accordion|harmonica|calliope/, 'organ'],
  [/harp\b|harp_|^harp$/, 'harp'],
  [/pizz|pluck|koto|banjo|shamisen|ukulele|mandolin/, 'pluck'],
  [/sitar/, 'sitar'],
  [/guitar|gtr|nylon/, 'guitar'],
  [/synth_?bass|fm_?bass|sub_?bass|acid/, 'synthbass'],
  [/bass/, 'bass'],
  [/choir|voice|vox|aah|ooh|vocal|hum/, 'choir'],
  [/synth_?string/, 'pad'],
  [/string|violin|viola|cello|contrabass|fiddle|orchestra/, 'strings'],
  [/brass|horn|trumpet|trombone|tuba/, 'brass'],
  [/sax/, 'sax'],
  [/clarinet/, 'clarinet'],
  [/oboe|bassoon|english_horn|shanai/, 'oboe'],
  [/flute|recorder|piccolo|whistle|ocarina|pan_?flute|shakuhachi|bagpipe/, 'flute'],
  [/supersaw|super_?saw/, 'supersaw'],
  [/pad|warm|halo|sweep|atmos|bowed|metallic|polysynth|new_?age|sci-?fi|ensemble/, 'pad'],
  [/drone/, 'drone'],
  [/^noise|white|pink|brown|crackle/, 'noise'],
  [/sawtooth|^saw$|z_saw/, 'saw'],
  [/square|pulse|z_square/, 'square'],
  [/^sine$|^sin$|z_sine/, 'sine'],
  [/triangle|^tri$|z_tri/, 'triangle'],
  [/lead|charang|chiff|fifth/, 'lead'],
  [/fx|effect|goblin|echo|rain|soundtrack|brightness|helicopter|applause|gunshot|seashore|bird|telephone|breath_?noise|fret|reverse/, 'sfx'],
  [/drum|taiko|agogo|perc/, 'drum'],
]

/** A sound's timbre from its name (GM program names, synth words, our own
 *  names). Unknown: a lead (the generic synth voice). */
export function timbreOfName(name: string): Timbre {
  const s = name.toLowerCase().replace(/[\s-]+/g, '_')
  for (const [re, t] of WORDS) if (re.test(s)) return t
  return 'lead'
}

/** The timbre of a General MIDI program (0–127), by its family and the
 *  exceptions inside each. */
export function timbreOfProgram(n: number): Timbre {
  const p = Math.max(0, Math.min(127, Math.floor(n)))
  const in8 = p & 7
  switch (p >> 3) {
    case 0:
      return in8 < 4 ? 'piano' : in8 < 6 ? 'epiano' : in8 === 6 ? 'harpsichord' : 'clavinet'
    case 1:
      return in8 === 0 ? 'musicbox' : in8 === 1 ? 'bell' : in8 === 2 ? 'musicbox' : in8 === 3 ? 'vibes' : in8 === 4 ? 'marimba' : in8 === 5 ? 'xylophone' : 'bell'
    case 2:
      return 'organ'
    case 3:
      return 'guitar'
    case 4:
      return in8 < 2 ? 'bass' : 'synthbass'
    case 5:
      return in8 === 5 ? 'pluck' : in8 === 6 ? 'harp' : 'strings'
    case 6:
      return in8 >= 4 && in8 <= 6 ? 'choir' : 'strings'
    case 7:
      return 'brass'
    case 8:
      return in8 < 4 ? 'sax' : in8 === 7 ? 'clarinet' : 'oboe'
    case 9:
      return 'flute'
    case 10:
      return in8 === 0 ? 'square' : in8 === 1 ? 'saw' : 'lead'
    case 11:
      return 'pad'
    case 12:
      return 'sfx'
    case 13:
      return in8 === 0 ? 'sitar' : in8 === 4 ? 'kalimba' : in8 === 5 ? 'flute' : 'pluck'
    case 14:
      return in8 === 0 ? 'bell' : in8 === 2 ? 'steelpan' : 'drum'
    default:
      return 'sfx'
  }
}
