import type { ModuleSpec } from './types'

/** What a jack carries and what it's for, in plain words: the jack tooltip,
 *  its "Explain" text, and the patching hints (which jacks suit each other).
 *  Everything in the rack is a voltage, so any jack can go to any other;
 *  this says what each one *means*. DOM-free. */

/** Signal families: the hints favour jacks of the same family. */
export type Signal = 'audio' | 'pitch' | 'gate' | 'trigger' | 'clock' | 'reset' | 'cv'
export type Family = 'audio' | 'pitch' | 'timing' | 'cv'
export const familyOf = (s: Signal): Family => (s === 'gate' || s === 'trigger' || s === 'clock' || s === 'reset' ? 'timing' : s)

export const SIGNALS: Record<Signal, { name: string; explain: string }> = {
  audio: {
    name: 'Audio',
    explain: 'A sound wave, swinging about ±5 V hundreds of times a second. Patch it into a filter, an effect, a mixer, or OUT to hear it.',
  },
  pitch: {
    name: 'Pitch (V/OCT)',
    explain:
      '“Volts per octave”: +1 V plays an octave higher, +1/12 V a semitone. A sequencer, keyboard or quantizer sends it; an oscillator’s V/OCT input plays it.',
  },
  gate: {
    name: 'Gate',
    explain: 'On (about 10 V) while a note is held, off (0 V) when it’s let go. Envelopes start when it goes on and fade when it goes off.',
  },
  trigger: {
    name: 'Trigger',
    explain: 'A short pulse that sets something off: a drum hit, an envelope, a strike. Only the moment it rises counts.',
  },
  clock: {
    name: 'Clock',
    explain: 'A steady stream of pulses that keeps time. Sequencers and drum machines take one step per pulse; share one clock to keep parts in sync.',
  },
  reset: {
    name: 'Reset',
    explain: 'A pulse here sends a sequencer back to its first step (use it to line parts up at the start of a bar).',
  },
  cv: {
    name: 'Control voltage (CV)',
    explain: 'A slowly moving voltage that turns a knob for you: an LFO, an envelope, a sequencer, a hand on the XY pad. More voltage, more of the thing.',
  },
}

interface Term {
  /** Matched against the jack's label (upper case), or its id if unlabelled. */
  match: RegExp
  signal: Signal
  /** What this jack does, one line (or [as an input, as an output]). */
  what: string | [string, string]
}

/** Common jack names, most specific first. */
const TERMS: Term[] = [
  {
    match: /^(1?V\/OCT|V\/O|MOD V\/O)$/,
    signal: 'pitch',
    what: ['Pitch in (V/OCT): the note to play. Patch a sequencer’s or keyboard’s pitch here.', 'Pitch out (V/OCT): patch it to an oscillator’s V/OCT to play the note.'],
  },
  {
    match: /^(PITCH|NOTE|HEARD|ROOT|KEY|TOM CV|SEQ \d)$/,
    signal: 'pitch',
    what: ['Pitch in (V/OCT): the note to play.', 'A pitch out (V/OCT): patch it to an oscillator’s V/OCT.'],
  },
  { match: /^(NOTES|MERGED|POLY IN)$/, signal: 'pitch', what: 'A polyphonic cable: several voices (a whole chord) down one wire.' },
  {
    match: /^(GATE|VOICED|MY TURN|PLUCK|HAT|OPEN|SNARE|KICK|TOM|ANY|TURN|CONJ)$|^G\d$/,
    signal: 'gate',
    what: ['The gate that plays this: high while a note is held, low to let go.', 'A gate out: high while the note (or event) lasts. Patch it to an envelope’s GATE.'],
  },
  {
    match: /^(TRIG|STRIKE|ADV|NEXT|CHANGE|RESEED|REC|CLR|START|CUT|STEP|STRUM|BOOM|CRASH|EXTINCT|FLIP|BIT)$/,
    signal: 'trigger',
    what: ['A trigger in: each pulse sets this off.', 'A trigger out: a pulse on each event. Patch it to a drum’s TRIG or an envelope.'],
  },
  { match: /^(EOR|EOC|EOL|EOS|GEN|CHG)$/, signal: 'trigger', what: 'A pulse when a cycle ends (end of rise, cycle, loop or sample): chain things off it.' },
  { match: /^(ACC|ACCENT)$/, signal: 'trigger', what: 'Accent: high on the steps that should hit harder.' },
  {
    match: /^(CLK|CLOCK|1\/16|1\/8|1\/4|1\/2|BAR|÷\d)$/,
    signal: 'clock',
    what: ['Clock in: one step per pulse (patch a CLOCK here to keep it in time).', 'Clock out: one pulse per step (the label says how often). Patch it to a sequencer’s CLK.'],
  },
  {
    match: /^(RST|RESET)$/,
    signal: 'reset',
    what: ['A pulse here goes back to the first step.', 'A pulse at the start of each cycle: patch it to other sequencers’ RESET to line them up.'],
  },
  { match: /^(RUN|PLAY|FILL|FREEZE)$/, signal: 'gate', what: 'A gate that switches this on while it’s high.' },
  { match: /^(VEL)$/, signal: 'cv', what: 'Velocity: how hard a note was played (more volts, louder or brighter).' },
  { match: /^(ENV|ADSR|AR|VCF EG|VCO EG|VCA EG|EG)$/, signal: 'cv', what: 'An envelope: a rise and fall on every note. Patch it to a VCA for volume or a filter for brightness.' },
  { match: /^(LFO|SIN|TRI|SAW|SQR)$/, signal: 'cv', what: 'A wave. From an LFO it’s slow: wobble, vibrato, sweeps. From an oscillator it’s audio.' },
  { match: /^(FM|FM AMT|V\d FM)$/, signal: 'cv', what: 'Frequency modulation: wobbles the pitch. Slowly: vibrato. At audio speed: new metallic or bell-like tones.' },
  { match: /^PWM$/, signal: 'cv', what: 'Pulse-width modulation: changes the shape of the square wave for a moving, chorused tone.' },
  { match: /^SYNC$/, signal: 'trigger', what: 'Hard sync: restarts this oscillator every cycle of the one patched here: tearing, vocal leads.' },
  { match: /^(DUCK IN|KEY)$/, signal: 'audio', what: 'Sidechain: what this listens to (often the kick) to duck or compress the rest.' },
  { match: /^(MOD|BEND|AFTER|PRES|X|Y|Z|X1|Y1|LX|LY|RX|RY|LT|RT|POS|SPEED|DIST|ANGLE|SPREAD|HEADING|PREY|PRED|POP|MOTION|STATE|LIGHT|MOVE|GR|FUNC|SCENE|X-CV)$/, signal: 'cv', what: 'A control voltage: a moving value to turn knobs elsewhere.' },
  {
    match: /^(CV|CV\d|CV \d|QUAL CV|WAVE CV|TIME CV|SWEEP|INDEX|TIMBRE|GAIN|VOWEL)$/,
    signal: 'cv',
    what: ['Control voltage in: turns this module’s knob for you (its CV AMT knob sets how far).', 'A control voltage out: patch it to a CV input to move a knob elsewhere.'],
  },
  {
    match: /^(L|R|IN L|IN R|RET L|RET R|L\d|T\d|TRK \d|OUT B|CAB|DI|WET|LOOP|SEND|SUM|MIX|OUT|OUT ?\d|IN|IN ?\d|AUDIO|EXT IN|CARRIER|CARR|VCF IN|VCA IN|S&H IN|REV IN|A|B|M\d|V\d|VOICE \d|CH\d)$/,
    signal: 'audio',
    what: ['Audio in: the sound for this module to work on.', 'Audio out: patch it on to a filter, an effect, a mixer, or OUT to hear it.'],
  },
  {
    match: /^(VCO|VCO \d|VCF|VCA|NOISE|WHITE|PINK|RED|RING|SUB \d|SINE|PULSE|−\d OCT|LP|HP|BP|NOTCH|24DB|12DB|CHORD|HARP|BASS|PAD|BD|SD|CP|CH|OH|HATS|RIM|BELL|OSC|INV|AND|OR|XOR|NOT A)$/,
    signal: 'audio',
    what: ['Audio in.', 'Audio out (the label says which part of the sound): patch it on, or to OUT to hear it.'],
  },
  { match: /^VCA CV$/, signal: 'cv', what: 'Opens the VCA (the volume) directly, instead of its own envelope.' },
  { match: /^(VCF CV|VCF MOD)$/, signal: 'cv', what: 'Moves the filter’s cutoff: more volts, brighter.' },
  { match: /^K\d$/, signal: 'cv', what: 'Turns that knob of the current sound for you (±5 V is half its travel).' },
  { match: /^SUB \d-\d$/, signal: 'cv', what: 'Moves that subharmonic’s divider: each volt is one step deeper.' },
  { match: /^RHY \d$/, signal: 'trigger', what: 'Pulses here replace that rhythm divider’s own.' },
  { match: /^S&H CLK$/, signal: 'clock', what: 'Each pulse samples a new value.' },
  { match: /^S&H$/, signal: 'cv', what: 'The sample-and-hold output: random steps.' },
  { match: /^RETRIG$/, signal: 'trigger', what: 'Restarts the envelope from its attack, even while the gate is held.' },
  { match: /^CYC$/, signal: 'gate', what: 'While high, the function keeps cycling: an LFO.' },
  { match: /^CMP$/, signal: 'cv', what: 'Moves the comparator’s threshold.' },
  { match: /^HOME$/, signal: 'trigger', what: 'A pulse sends the progression back to its home chord.' },
  { match: /^LISTEN$/, signal: 'audio', what: 'What the drummer listens to: play louder and it lays back.' },
  { match: /^(FEED|SCATTER|CULL)$/, signal: 'trigger', what: 'A pulse here does what it says to the creatures.' },
  { match: /^(GRAV|TILT|TX|TY|FOOD|RUB)$/, signal: 'cv', what: 'A voltage here pushes the simulation (gravity, tilt, the flock’s target, food, the rub).' },
  { match: /^(VOL|ROT)$/, signal: 'cv', what: 'What your hand (or the platter) is doing, as a voltage.' },
  { match: /^(LB|RB)$/, signal: 'gate', what: 'That gamepad button: high while held.' },
  { match: /^G\d$/, signal: 'gate', what: 'That pad’s gate: high while it’s held.' },
]

/** Jacks whose name means something special on one module: `type:dir:id`. */
const OVERRIDES: Record<string, Partial<Omit<Term, 'match'>>> = {
  'mono:out:key': { signal: 'pitch', what: 'The keyboard’s pitch (V/OCT): play other modules from MONO-1’s keys.' },
  'glue:in:sc': { what: 'KEY (sidechain): the compressor listens to this instead of its own input (the kick, to pump everything else).' },
  'vocoder:in:mod': { signal: 'audio', what: 'The modulator: the voice (or beat) whose shape is put onto the carrier.' },
  'vocoder:in:car': { what: 'The carrier: the synth that gets the modulator’s shape. Empty: a built-in buzz on V/OCT.' },
  'midi:out:mod': { what: 'The mod wheel on your MIDI keyboard, as a voltage.' },
  'polycv:out:mod': { what: 'The mod wheel on your MIDI keyboard, as a voltage.' },
  'complex:out:mod': { signal: 'audio', what: 'The modulating oscillator on its own.' },
  'hats:in:ch': { signal: 'trigger', what: 'Plays the closed hat.' },
  'hats:in:oh': { signal: 'trigger', what: 'Plays the open hat (a closed hit chokes it).' },
  'perc:in:rim': { signal: 'trigger', what: 'Plays the rimshot.' },
  'perc:in:bell': { signal: 'trigger', what: 'Plays the cowbell.' },
  'mult:in:a': { signal: 'cv', what: 'Copies whatever arrives here to the three outputs below it.' },
  'mult:in:b': { signal: 'cv', what: 'Copies whatever arrives here (or A, if empty) to the three outputs below it.' },
  'logic:in:a': { signal: 'gate', what: 'Gate A for the logic.' },
  'logic:in:b': { signal: 'gate', what: 'Gate B for the logic.' },
  'logic:out:and': { signal: 'gate', what: 'High only while A and B are both high.' },
  'logic:out:or': { signal: 'gate', what: 'High while A or B (or both) is high.' },
  'logic:out:xor': { signal: 'gate', what: 'High while exactly one of A and B is high.' },
  'logic:out:not': { signal: 'gate', what: 'The opposite of A.' },
  'euclid:out:a': { signal: 'trigger', what: 'Rhythm A: hits spread as evenly as possible.' },
  'euclid:out:b': { signal: 'trigger', what: 'Rhythm B: hits spread as evenly as possible.' },
  'gamepad:out:a': { signal: 'gate', what: 'The A button: high while held.' },
  'gamepad:out:b': { signal: 'gate', what: 'The B button: high while held.' },
  'tr16:in:r1': { signal: 'trigger', what: 'Records a hit on track 1 while REC is on.' },
  'scenes:in:scene': { what: 'Picks a scene by voltage.' },
  'visionview:in:link': { signal: 'cv', what: 'The LINK from a VISION or VISION CORE: shows its creatures.' },
  'vision:out:link': { signal: 'cv', what: 'Patch to VISION VIEWs to watch this tank from other angles.' },
  'visioncore:out:link': { signal: 'cv', what: 'Patch to VISION VIEWs to watch this tank.' },
  'slew:in:in': { signal: 'cv', what: 'The voltage to smooth (a pitch for glide, a gate for a soft envelope).' },
  'slew:out:out': { signal: 'cv', what: 'The input, gliding instead of jumping.' },
  'quant:in:in': { signal: 'cv', what: 'Any voltage: it’s snapped to the nearest note of the scale.' },
  'quant:out:out': { signal: 'pitch', what: 'The input snapped to a note of the scale (V/OCT): always in key.' },
  'sh:in:in': { signal: 'cv', what: 'What to sample (empty: noise, for random voltages).' },
  'sh:out:out': { signal: 'cv', what: 'The voltage held since the last trigger: a staircase of random steps.' },
  'atten:in:a': { signal: 'cv', what: 'The voltage to scale (empty: a steady +5 V, so the knob becomes an offset).' },
  'atten:in:b': { signal: 'cv', what: 'The voltage to scale (empty: a steady +5 V, so the knob becomes an offset).' },
  'atten:out:a': { signal: 'cv', what: 'The input made smaller, bigger or upside down by the knob.' },
  'atten:out:b': { signal: 'cv', what: 'The input made smaller, bigger or upside down by the knob.' },
  'func:out:out': { signal: 'cv', what: 'The rise-and-fall shape: an envelope, or a slow LFO when it cycles.' },
  'seq8:out:cv': { signal: 'pitch', what: 'The current step’s pitch (V/OCT): patch it to an oscillator.' },
  'kick:in:tune': { signal: 'pitch', what: 'The kick’s pitch (V/OCT): play it like a bass (the 808 trick).' },
  'tom:in:tune': { signal: 'pitch', what: 'The tom’s pitch (V/OCT): melodic toms and congas.' },
  'vector:in:x': { signal: 'audio', what: 'Moves the beam left–right: patch audio for Lissajous figures.' },
  'vector:in:y': { signal: 'audio', what: 'Moves the beam up–down: patch audio for Lissajous figures.' },
}
// the oscillators' waves are audio (an LFO's same-named outputs are CV)
for (const t of ['vco', 'pvco', 'complex', 'wave'])
  for (const o of ['saw', 'sin', 'tri', 'sqr'])
    OVERRIDES[`${t}:out:${o}`] = { signal: 'audio', what: `The oscillator’s ${o === 'sqr' ? 'pulse' : o === 'sin' ? 'sine' : o === 'tri' ? 'triangle' : 'saw'} wave, as audio.` }
for (const v of ['v1', 'v2', 'v3', 'v4']) OVERRIDES[`chord:out:${v}`] = { signal: 'pitch', what: 'One note of the chord (V/OCT): patch each to its own oscillator.' }
for (const d of ['bd', 'sd', 'cp', 'ch', 'oh']) OVERRIDES[`groove:in:t_${d}`] = { signal: 'trigger', what: 'Plays this drum (and takes it off the sequencer).' }
for (let n = 1; n <= 8; n++) {
  OVERRIDES[`tr16:out:t${n}`] = { signal: 'trigger', what: `Track ${n}’s trigger: patch it to a drum’s TRIG.` }
  OVERRIDES[`tr16:in:r${n}`] = { signal: 'trigger', what: `Records a hit on track ${n} while REC is on.` }
  OVERRIDES[`life:out:r${n}`] = { signal: 'gate', what: `Row ${n}: high while the scanned cell in that row is alive.` }
}
for (const m of ['a', 'b']) for (let n = 1; n <= 3; n++) OVERRIDES[`mult:out:${m}${n}`] = { signal: 'cv', what: `A copy of input ${m.toUpperCase()}.` }
for (const t of ['fm4', 'swarm']) {
  OVERRIDES[`${t}:in:gate`] = { signal: 'gate', what: 'Poly gate (from POLY·CV): each voice plays while its gate is high. Leave it empty to play from the keys.' }
  OVERRIDES[`${t}:out:poly`] = { signal: 'audio', what: 'Each note on its own wire (a poly cable): for a P-VCA or P-LADDER per note.' }
}
OVERRIDES['fm4:in:vel'] = { signal: 'cv', what: 'Velocity per note (from POLY·CV): harder notes are louder and brighter.' }
OVERRIDES['swarm:in:voct'] = { signal: 'pitch', what: 'The notes (V/OCT, poly or mono). With no GATE patched, it drones on these notes.' }
for (let l = 0; l < 4; l++) OVERRIDES[`motion:out:cv${l}`] = { signal: 'cv', what: 'This lane’s recorded movement as a voltage (0–10 V): patch it to move something else the same way.' }
for (const s of ['l', 'r'])
  OVERRIDES[`tap:out:${s}`] = { signal: 'audio', what: `The ${s === 'l' ? 'left' : 'right'} speaker: everything you hear. Patch it into SAMPLE, LOOP or CHOP to resample the mix.` }
for (const t of ['grains', 'shimmer']) OVERRIDES[`${t}:in:frz`] = { signal: 'gate', what: 'While high, the memory (or the tail) is frozen, as if FREEZE were on.' }
OVERRIDES['grains:in:trig'] = { signal: 'trigger', what: 'Each pulse starts an extra grain: play the cloud in rhythm.' }
OVERRIDES['grains:in:voct'] = { signal: 'pitch', what: 'Pitches the grains (V/OCT, added to PITCH): play the cloud from a sequencer.' }
OVERRIDES['grains:in:dens'] = { signal: 'cv', what: 'More grains a second with more volts (each 2 V doubles them).' }
for (const v of ['a', 'b']) OVERRIDES[`shift:in:cv${v}`] = { signal: 'pitch', what: `Adds to SHIFT ${v.toUpperCase()} in V/OCT (1 V = an octave): a sequencer plays the harmony.` }
OVERRIDES['tally:in:trig'] = { signal: 'gate', what: 'ONE KEY PLAY from the rack: each pulse plays the next remembered note (held while high). Patch a clock to play your melody in time.' }
OVERRIDES['tally:in:gate'] = { signal: 'gate', what: 'Plays TALLY’s voice from a sequencer, at the pitch on V/OCT.' }
OVERRIDES['tally:out:rhy'] = { signal: 'audio', what: 'The rhythm box on its own (for its own effects or channel).' }
OVERRIDES['tally:in:clk'] = { signal: 'clock', what: 'Clock in (16ths, CLOCK’s ×4): the rhythm box steps with the rack.' }
OVERRIDES['motion:in:clk'] = { signal: 'clock', what: 'Clock in, in 16ths (CLOCK’s ×4): keeps the loops in time with the music.' }
OVERRIDES['echo:in:cv'] = { signal: 'cv', what: 'Moves the RATE (the tape speed): the repeats bend in pitch.' }

export interface JackInfo {
  label: string
  signal: Signal
  /** One line: what this jack does. */
  what: string
  /** A polyphonic cable (several voices). */
  poly: boolean
}

/** Everything the UI says about one jack. */
export function jackInfo(spec: ModuleSpec, id: string, dir: 'in' | 'out'): JackInfo {
  const list = dir === 'in' ? spec.inputs : spec.outputs
  const js = list.find((j) => j.id === id)
  const label = js?.label || id.toUpperCase()
  const key = label.toUpperCase()
  // the label first; unlabelled or number-only jacks by their id
  const byId = id.toUpperCase()
  const term = TERMS.find((t) => t.match.test(key)) ?? (/^\d*$/.test(key) ? TERMS.find((t) => t.match.test(byId)) : undefined)
  const over = OVERRIDES[`${spec.type}:${dir}:${id}`]
  // an input named like one of the module's knobs turns that knob
  const knob = dir === 'in' && !term ? spec.params.find((p) => p.label.toUpperCase() === key || p.id === id) : undefined
  const signal = over?.signal ?? term?.signal ?? 'cv'
  const pick = (w: Term['what'] | undefined) => (w === undefined ? undefined : typeof w === 'string' ? w : w[dir === 'in' ? 0 : 1])
  const what =
    pick(over?.what) ??
    (knob ? `Turns ${knob.label} for you: more volts, more ${knob.label.toLowerCase()}.` : undefined) ??
    pick(term?.what) ??
    (dir === 'in' ? 'A voltage here changes how this module behaves.' : 'A voltage this module puts out, to patch anywhere.')
  return { label, signal, what, poly: !!js?.poly }
}

/** Do two signals suit each other (for the brighter patching hint)? */
export const suits = (a: Signal, b: Signal) => familyOf(a) === familyOf(b)
