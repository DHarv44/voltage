import type { ModuleSpec } from './types'

/** The library's second axis. A module's category says what it is (one
 *  home); its tags say what it's for and how it behaves (as many as fit), and
 *  `aka` holds the words people search with: the gear it's in the tradition
 *  of, jargon, other names. `aka` is searched, never shown. */
export const TAGS = [
  'beat',
  'bass',
  'melody',
  'chords',
  'drone',
  'ambient',
  'space',
  'echo',
  'dirt',
  'lo-fi',
  'texture',
  'modulation',
  'sequence',
  'clock',
  'record',
  'mix',
  'visual',
  'poly',
  'stereo',
  'plays itself',
  'touch',
  'generative',
  'world',
  'utility',
] as const
export type Tag = (typeof TAGS)[number]

interface Entry {
  tags: Tag[]
  aka?: string[]
}

export const CATALOG: Record<string, Entry> = {
  // Systems
  mono: { tags: ['bass', 'melody'], aka: ['mother-32', 'minimoog', 'semi-modular', 'mono synth'] },
  studio: { tags: ['bass', 'melody', 'texture'], aka: ['arp 2600', '2600', 'semi-modular'] },
  groove: { tags: ['beat', 'sequence', 'plays itself'], aka: ['tr-808', '808', '909', 'drum machine'] },
  sketchbook: { tags: ['melody', 'beat', 'record', 'stereo', 'plays itself'], aka: ['op-1', 'teenage engineering', 'workstation', 'groovebox', 'tape'] },
  kin: { tags: ['beat', 'sequence', 'plays itself'], aka: ['dfam', 'drummer from another mother', 'moog', 'semi-modular'] },
  undertone: { tags: ['drone', 'ambient', 'generative', 'sequence', 'plays itself'], aka: ['subharmonicon', 'moog', 'polyrhythm', 'subharmonics'] },
  lockstep: { tags: ['beat', 'bass', 'sequence', 'stereo', 'plays itself'], aka: ['elektron', 'digitone', 'digitakt', 'p-lock', 'parameter lock', 'fm', 'groovebox'] },
  lattice: { tags: ['generative', 'melody', 'beat', 'touch', 'plays itself'], aka: ['tenori-on', 'yamaha', 'grid', 'monome', 'light grid'] },
  pocket: { tags: ['beat', 'sequence', 'plays itself'], aka: ['pocket operator', 'po-12', 'teenage engineering', 'calculator'] },
  pocketbass: { tags: ['bass', 'sequence'], aka: ['pocket operator', 'tb-303', '303', 'acid'] },
  pocketmelody: { tags: ['melody', 'chords', 'sequence'], aka: ['pocket operator', 'arpeggio'] },
  pocketspeak: { tags: ['melody', 'lo-fi', 'sequence', 'plays itself'], aka: ['voice', 'singing', 'vocal', 'speech', 'robot voice', 'formant', 'choir', 'syllables', 'pocket operator'] },
  pocketoffice: { tags: ['beat', 'lo-fi', 'sequence', 'plays itself'], aka: ['typewriter', 'office', 'glitch', 'foley', 'found sound', 'clicks', 'pocket operator'] },
  pocketrobot: { tags: ['melody', 'touch', 'record', 'sequence'], aka: ['lead', 'live', 'glide', 'portamento', 'bitcrush', 'echo', 'record', 'pocket operator', 'robot'] },
  pocketarcade: { tags: ['melody', 'beat', 'lo-fi', 'sequence', 'plays itself'], aka: ['chiptune', 'chip', '8-bit', '8 bit', 'nes', 'game boy', 'video game', 'arpeggio', 'pocket operator'] },
  tally: {
    tags: ['melody', 'beat', 'lo-fi', 'touch'],
    aka: ['vl-tone', 'vl-1', 'casio', 'calculator', 'toy keyboard', 'one key play', 'adsr code', 'rhythm box', 'chiptune'],
  },
  // Instruments
  theremin: { tags: ['melody', 'touch'], aka: ['etherwave', 'moog'] },
  omnichord: { tags: ['chords', 'touch'], aka: ['suzuki', 'autoharp', 'strum'] },
  chordwheel: { tags: ['chords', 'touch'], aka: ['circle of fifths', 'orchid', 'chord controller'] },
  musicbox: { tags: ['melody', 'touch', 'lo-fi'], aka: ['music box', 'paper strip', 'wind-up', 'comb'] },
  strike: { tags: ['melody', 'touch', 'world'], aka: ['handpan', 'hang drum', 'steel pan', 'steel drum', 'kalimba', 'mbira'] },
  tanpura: { tags: ['drone', 'world', 'plays itself'], aka: ['tambura', 'sitar', 'indian', 'jawari'] },
  gamelan: { tags: ['melody', 'world'], aka: ['saron', 'bonang', 'gong', 'slendro', 'pelog', 'indonesian', 'bali'] },
  bowl: { tags: ['drone', 'ambient', 'world', 'touch'], aka: ['singing bowl', 'tibetan', 'crystal bowl', 'meditation'] },
  harp: { tags: ['melody', 'chords', 'touch'], aka: ['glissando', 'strings', 'plucked'] },
  stylophone: { tags: ['melody', 'lo-fi', 'touch'], aka: ['stylophone', 'dubreq', 'stylus'] },
  tapekeys: { tags: ['chords', 'lo-fi', 'poly'], aka: ['mellotron', 'chamberlin', 'strings', 'flute', 'choir', 'keyboard'] },
  // Polyphonic
  polycv: { tags: ['poly', 'chords'], aka: ['midi', 'polyphonic', 'keyboard', 'voice allocation'] },
  pvco: { tags: ['poly', 'chords'], aka: ['polyphonic oscillator'] },
  pvcf: { tags: ['poly'], aka: ['polyphonic filter', 'ladder'] },
  padsr: { tags: ['poly', 'modulation'], aka: ['polyphonic envelope'] },
  pvca: { tags: ['poly'], aka: ['polyphonic vca'] },
  polymix: { tags: ['poly', 'mix'], aka: ['poly merge', 'poly split'] },
  fm4: {
    tags: ['poly', 'chords', 'melody', 'bass'],
    aka: ['fm', 'dx7', 'dx', 'yamaha', 'tx81z', 'operator', 'frequency modulation', 'electric piano', 'rhodes', 'e.piano', 'bell', 'synth voice'],
  },
  swarm: {
    tags: ['poly', 'chords', 'melody', 'stereo'],
    aka: ['supersaw', 'jp-8000', 'trance', 'edm', 'unison', 'detune', 'hoover', 'saw stack', 'synth voice'],
  },
  // Oscillators
  vco: { tags: ['bass', 'melody'], aka: ['oscillator', 'saw', 'square', 'pwm', 'sync'] },
  complex: { tags: ['melody', 'texture'], aka: ['buchla 259', 'west coast', 'complex oscillator', 'fm', 'wavefolder'] },
  wave: { tags: ['melody', 'texture'], aka: ['wavetable', 'ppg', 'morph'] },
  kaleido: { tags: ['melody', 'bass', 'chords', 'texture'], aka: ['plaits', 'braids', 'mutable instruments', 'macro oscillator', 'fm', 'wavefolder', 'formant', 'vowel', 'additive', 'karplus', 'pluck', 'modal', 'low pass gate'] },
  sub: { tags: ['bass'], aka: ['sub octave', 'divider', 'octave down'] },
  noise: { tags: ['texture', 'beat'], aka: ['white noise', 'pink noise', 'red noise', 'brown noise'] },
  // Filters
  vcf: { tags: ['bass', 'texture'], aka: ['moog ladder', 'ladder', 'lowpass', '24db', 'filter'] },
  svf: { tags: ['texture'], aka: ['sem', 'oberheim', 'bandpass', 'notch', 'state variable', 'filter'] },
  ms: { tags: ['dirt', 'texture'], aka: ['ms-20', 'korg', 'highpass', 'filter'] },
  lpg: { tags: ['beat', 'texture', 'melody'], aka: ['low pass gate', 'vactrol', 'buchla 292', 'west coast', 'bongo', 'lxd', 'optomix', 'plucked'] },
  // Amps & Mixers
  vca: { tags: ['utility', 'mix'], aka: ['amplifier', 'volume'] },
  vcamix: { tags: ['mix'], aka: ['quad vca', 'vca mixer'] },
  mixer: { tags: ['mix', 'utility'], aka: ['sum', 'dc mixer'] },
  smix: { tags: ['mix', 'stereo'], aka: ['stereo mixer', 'pan', 'send', 'aux'] },
  djmix: { tags: ['mix', 'touch'], aka: ['dj', 'crossfader', 'kill eq', 'isolator'] },
  panner: { tags: ['stereo', 'modulation', 'mix'], aka: ['pan', 'auto-pan', 'autopan', 'auto pan', 'balance', 'stereo placement'] },
  widener: { tags: ['stereo', 'mix', 'space'], aka: ['stereo width', 'mid side', 'm/s', 'haas', 'imager', 'stereo imager', 'bass mono', 'correlation', 'phase meter'] },
  console: { tags: ['mix', 'stereo', 'beat'], aka: ['mixing desk', 'mixer', 'sidechain', 'ducking', 'pumping', 'edm', 'channel strip'] },
  glue: { tags: ['mix', 'stereo', 'dirt'], aka: ['ssl', 'bus compressor', 'compressor', 'sidechain', 'ducking', 'pumping', 'glue'] },
  master: { tags: ['mix', 'stereo'], aka: ['mastering', 'limiter', 'eq', 'equalizer', 'stereo width', 'mid side', 'loudness'] },
  // Envelopes & LFOs
  adsr: { tags: ['modulation'], aka: ['envelope', 'eg', 'contour'] },
  func: { tags: ['modulation'], aka: ['maths', 'make noise', 'function generator', 'slew'] },
  follow: { tags: ['modulation'], aka: ['envelope follower', 'comparator', 'sidechain'] },
  lfo: { tags: ['modulation'], aka: ['low frequency oscillator', 'wobble', 'tremolo', 'vibrato'] },
  qlfo: { tags: ['modulation', 'generative'], aka: ['quad lfo', 'quadrature', 'four lfos', 'batumi', 'phase', 'polyrhythm', 'drift'] },
  // Shapers
  fold: { tags: ['dirt', 'texture'], aka: ['wavefolder', 'west coast', 'buchla'] },
  ring: { tags: ['texture', 'dirt'], aka: ['ring modulator', 'bell', 'metallic'] },
  // CV Tools
  quant: { tags: ['melody', 'utility'], aka: ['quantizer', 'scale'] },
  slew: { tags: ['modulation', 'utility'], aka: ['portamento', 'glide', 'lag'] },
  sh: { tags: ['modulation', 'generative'], aka: ['sample and hold', 'random'] },
  trackhold: { tags: ['modulation', 'generative', 'utility'], aka: ['track and hold', 't&h', 'sample and hold', 'freeze', 'random'] },
  chance: { tags: ['generative', 'clock', 'utility'], aka: ['bernoulli', 'branches', 'probability', 'coin toss', 'random gate', 'mutable'] },
  sswitch: { tags: ['utility', 'sequence'], aka: ['sequential switch', 'switch', 'router', 'multiplexer', 'demultiplexer', 'stepper'] },
  atten: { tags: ['utility', 'modulation'], aka: ['attenuverter', 'attenuator', 'offset'] },
  mult: { tags: ['utility'], aka: ['multiple', 'splitter'] },
  logic: { tags: ['utility', 'clock'], aka: ['and', 'or', 'xor', 'flip-flop', 'boolean', 'gate'] },
  chord: { tags: ['chords'], aka: ['chord generator', 'harmony', 'inversion'] },
  // Drums
  kick: { tags: ['beat'], aka: ['808 kick', 'bass drum', 'bd'] },
  snare: { tags: ['beat'], aka: ['808 snare', 'sd'] },
  clap: { tags: ['beat'], aka: ['handclap', '808 clap'] },
  hats: { tags: ['beat'], aka: ['hi-hat', 'hihat', 'cymbal', '808'] },
  tom: { tags: ['beat', 'world'], aka: ['conga', '808 tom'] },
  perc: { tags: ['beat'], aka: ['rimshot', 'cowbell', '808'] },
  // Sequencers
  clock: { tags: ['clock'], aka: ['tempo', 'bpm', 'master clock', 'midi clock', 'sync', 'daw', 'external clock'] },
  div: { tags: ['clock'], aka: ['clock divider', 'divider'] },
  metronome: { tags: ['clock', 'utility'], aka: ['click', 'click track', 'tap tempo', 'count', 'practice', 'time signature'] },
  maelzel: { tags: ['clock', 'plays itself'], aka: ['metronome', 'wind-up', 'pendulum', 'wittner', 'clockwork', 'huygens', 'sync', 'swing', 'mechanical'] },
  coach: { tags: ['clock', 'utility'], aka: ['metronome', 'practice', 'speed trainer', 'tempo ramp', 'gap click', 'polyrhythm', 'click track', 'drummer'] },
  seq8: { tags: ['sequence', 'melody'], aka: ['step sequencer', 'analog sequencer'] },
  tr16: { tags: ['beat', 'sequence'], aka: ['drum sequencer', 'trigger sequencer', '808', 'song mode'] },
  euclid: { tags: ['beat', 'generative', 'sequence'], aka: ['euclidean', 'bjorklund', 'polyrhythm'] },
  turing: { tags: ['generative', 'sequence', 'melody'], aka: ['turing machine', 'music thing', 'shift register', 'random'] },
  arp: { tags: ['melody', 'sequence'], aka: ['arpeggiator', 'arpeggio'] },
  // Brains
  ghost: { tags: ['generative', 'melody'], aka: ['ai', 'call and response', 'improviser'] },
  progression: { tags: ['chords', 'generative'], aka: ['chord progression', 'harmony', 'voice leading'] },
  bandmate: { tags: ['beat', 'generative', 'plays itself'], aka: ['drummer', 'ai drummer', 'fills'] },
  // Simulations
  bounce: { tags: ['generative', 'beat'], aka: ['physics', 'gravity', 'balls'] },
  tumbler: { tags: ['generative', 'melody'], aka: ['physics', 'spinning', 'polygon', 'balls'] },
  orbit: { tags: ['generative', 'clock'], aka: ['planets', 'kepler', 'polyrhythm'] },
  life: { tags: ['generative', 'sequence'], aka: ['game of life', 'conway', 'cellular automaton'] },
  flock: { tags: ['generative', 'modulation'], aka: ['boids', 'birds', 'swarm'] },
  chaos: { tags: ['generative', 'modulation'], aka: ['lorenz', 'double pendulum', 'strange attractor'] },
  ecosystem: { tags: ['generative', 'modulation'], aka: ['predator prey', 'lotka-volterra', 'foxes', 'rabbits'] },
  // Effects
  bbd: { tags: ['echo', 'lo-fi'], aka: ['bucket brigade', 'analog delay', 'delay'] },
  tape: { tags: ['echo', 'lo-fi'], aka: ['tape delay', 'echoplex', 'wow', 'flutter', 'delay'] },
  spring: { tags: ['space', 'lo-fi'], aka: ['spring reverb', 'reverb', 'dub'] },
  plate: { tags: ['space', 'stereo', 'ambient'], aka: ['plate reverb', 'reverb', 'dattorro', 'emt'] },
  phaser: { tags: ['texture', 'modulation'], aka: ['phase 90', 'small stone'] },
  ensemble: { tags: ['stereo', 'texture'], aka: ['solina', 'string ensemble', 'chorus'] },
  tune: { tags: ['melody'], aka: ['auto-tune', 'autotune', 'pitch correction', 'robot voice'] },
  chamber: { tags: ['space', 'ambient'], aka: ['room', 'reverb', 'echo chamber', 'acoustics'] },
  resonator: { tags: ['ambient', 'texture', 'melody', 'stereo', 'chords'], aka: ['rings', 'mutable instruments', 'modal', 'sympathetic strings', 'karplus', 'physical model', 'resonant', 'bell', 'string'] },
  shimmer: { tags: ['space', 'ambient', 'stereo'], aka: ['shimmer', 'reverb', 'octave reverb', 'eno', 'blackhole', 'bigsky', 'cloud', 'freeze'] },
  grains: {
    tags: ['ambient', 'texture', 'record', 'stereo'],
    aka: ['granular', 'clouds', 'morphagene', 'beads', 'grain', 'time stretch', 'freeze', 'texture', 'cloud'],
  },
  shift: { tags: ['texture', 'stereo'], aka: ['pitch shifter', 'harmoniser', 'harmonizer', 'whammy', 'octaver', 'h910', 'eventide', 'spiral', 'doubler'] },
  vocoder: { tags: ['texture', 'melody'], aka: ['vocoder', 'talking synth', 'robot voice', 'daft punk', 'voice', 'formant', 'channel vocoder'] },
  // Pedals
  fuzz: { tags: ['dirt'], aka: ['fuzz face', 'distortion', 'germanium', 'guitar'] },
  wah: { tags: ['texture', 'touch'], aka: ['cry baby', 'wah-wah', 'auto wah', 'guitar'] },
  octave: { tags: ['dirt'], aka: ['octavia', 'oc-2', 'octaver', 'guitar'] },
  chorus: { tags: ['stereo', 'texture'], aka: ['ce-2', 'bbd chorus', 'guitar'] },
  echo: { tags: ['echo', 'lo-fi'], aka: ['space echo', 're-201', 'tape echo', 'delay'] },
  lpedal: { tags: ['record'], aka: ['looper', 'loop pedal', 'rc-1'] },
  amp: { tags: ['dirt'], aka: ['tube amp', 'valve', 'guitar amp', 'cabinet', 'overdrive', 'distortion'] },
  talkbox: { tags: ['texture', 'touch'], aka: ['talk box', 'voice', 'vowel', 'formant', 'vocoder'] },
  // Sampling & Tape
  loop: { tags: ['record'], aka: ['looper', 'overdub'] },
  sample: { tags: ['record'], aka: ['sampler', 'slicer', 'audio file'] },
  turntable: { tags: ['record', 'touch', 'lo-fi'], aka: ['scratch', 'vinyl', 'dj', 'technics', 'record player'] },
  chop: { tags: ['beat', 'record', 'lo-fi'], aka: ['mpc', 'sp-1200', 'sp-404', 'finger drumming', 'chopping'] },
  fourtrack: { tags: ['record', 'lo-fi'], aka: ['portastudio', 'cassette', 'tascam', 'multitrack'] },
  // Controllers
  midi: { tags: ['utility'], aka: ['midi to cv', 'keyboard', 'usb'] },
  pads: { tags: ['beat', 'touch'], aka: ['drum pads', 'finger drumming', 'mpc'] },
  touch: { tags: ['touch', 'modulation'], aka: ['buchla', 'touch plate', 'easel'] },
  xy: { tags: ['touch', 'modulation'], aka: ['kaoss pad', 'kaossilator', 'touchpad', 'xy pad'] },
  audioin: { tags: ['record', 'utility'], aka: ['microphone', 'mic', 'line in', 'pitch tracking', 'voice'] },
  camera: { tags: ['modulation', 'visual'], aka: ['webcam', 'motion'] },
  gamepad: { tags: ['modulation', 'touch'], aka: ['controller', 'joystick', 'xbox', 'playstation'] },
  // Performance
  scenes: { tags: ['utility'], aka: ['snapshot', 'preset', 'morph'] },
  macro: { tags: ['modulation', 'utility'], aka: ['macro knob', 'learn'] },
  motion: {
    tags: ['modulation', 'record', 'sequence'],
    aka: ['motion recording', 'automation', 'knob recording', 'parameter automation', 'elektron', 'motion sequence', 'gesture', 'looper'],
  },
  accident: { tags: ['generative'], aka: ['randomise', 'randomize', 'happy accident', 'variation'] },
  // Visuals
  vision: { tags: ['visual', 'generative'], aka: ['jellyfish', 'garden', 'fireflies', 'aurora', 'cymatics', '3d'] },
  visioncore: { tags: ['visual'], aka: ['vision engine'] },
  visionview: { tags: ['visual'], aka: ['viewport', 'screen'] },
  vector: { tags: ['visual'], aka: ['oscilloscope music', 'lissajous', 'xy scope', 'crt'] },
  waterfall: { tags: ['visual'], aka: ['spectrogram', 'spectrum', 'fft'] },
  lightshow: { tags: ['visual'], aka: ['lights', 'light show'] },
  scope: { tags: ['visual', 'utility'], aka: ['oscilloscope'] },
  // Output
  output: { tags: ['utility'], aka: ['speakers', 'audio out', 'master'] },
  monitor: { tags: ['utility', 'stereo'], aka: ['vu meter', 'metering', 'mute'] },
  tap: { tags: ['record', 'utility', 'stereo'], aka: ['resample', 'resampling', 'master', 'bounce', 'mixdown', 'record the mix', 'bus'] },
}

const NONE: Entry = { tags: [] }
export const catalogOf = (type: string): Entry => CATALOG[type] ?? NONE

/** Dev check: every module has an entry with at least one tag, and every tag
 *  is from the vocabulary (the type checks the literals; this catches typos in
 *  types and modules added without an entry). */
export function validateCatalog(specs: ModuleSpec[]): string[] {
  const out: string[] = []
  for (const s of specs) {
    const e = CATALOG[s.type]
    if (!e) out.push(`${s.type}: not in the library catalog (modules/catalog.ts)`)
    else if (e.tags.length === 0) out.push(`${s.type}: no tags`)
  }
  const types = new Set(specs.map((s) => s.type))
  for (const t of Object.keys(CATALOG)) if (!types.has(t)) out.push(`catalog: "${t}" is not a module`)
  return out
}
