import type { ModuleSpec, ParamSpec } from './types'
import { MODULE_TERMS, OVERRIDES, type ParamTerm } from './paramGlossary'

/** What a knob or switch does, in plain words: the "Explain" line of the
 *  control tooltip. Looked up by the module's own entry (`type:param`), then
 *  its own words, then the common words below, trying the label whole and
 *  then without its leading words ("KICK DECAY" → "DECAY"). DOM-free. */

/** Words most synths share, most specific first. */
const TERMS: ParamTerm[] = [
  { match: /^(LEVEL|LVL|VOLUME|VOL|FADER)$/, what: 'How loud this part is.' },
  { match: /^MASTER$/, what: 'The overall volume of everything this module puts out.' },
  { match: /^CUTOFF$/, what: 'Where the filter starts cutting. Down: dark and muffled. Up: bright and open. The most played knob on a synth.' },
  {
    match: /^(RESONANCE|RESO|PEAK)$/,
    what: 'Boosts the sound right at the cutoff: sharper, squelchier, more “wah”. Turned high, the filter rings or whistles on its own.',
  },
  { match: /^Q$/, what: 'How narrow the filter is: higher is sharper and more vocal.' },
  { match: /^ATTACK$/, what: 'How long a note takes to reach full volume: zero snaps in, longer swells in slowly.' },
  { match: /^DECAY$/, what: 'How long the sound takes to die away: short is a click or a pluck, long rings on.' },
  { match: /^SUSTAIN$/, what: 'The level a note holds at for as long as the key (the gate) is held down.' },
  { match: /^RELEASE$/, what: 'How long a note takes to fade out after you let go.' },
  { match: /^(TONE|BRIGHT|COLOR)$/, what: 'Darker to brighter: turns the high frequencies down or up.' },
  { match: /^(DRIVE|GRIT)$/, what: 'Pushes the sound harder: warmer and thicker at first, then gritty, then distorted.' },
  { match: /^GAIN$/, what: 'How much the input is boosted on the way in.' },
  { match: /^TUNE$/, what: 'The basic pitch: tune this to the rest of the music.' },
  { match: /^FINE$/, what: 'Small pitch nudges, for exact tuning (or a slight detune against another oscillator for a thicker sound).' },
  { match: /^(FREQ|FREQUENCY)$/, what: 'The frequency: the pitch it plays (or, on a filter, where it cuts).' },
  { match: /^(OCTAVE|OCT)$/, what: 'Shifts the pitch up or down in whole octaves.' },
  { match: /^PITCH$/, what: 'Raises or lowers the pitch.' },
  { match: /^DETUNE$/, what: 'Pulls copies of the sound slightly out of tune with each other: thicker, chorused.' },
  { match: /^GLIDE$/, what: 'Portamento: how long the pitch slides from one note to the next. Zero jumps straight there.' },
  { match: /^RATE$/, what: 'How fast it goes. On an LFO: how fast it wobbles.' },
  { match: /^SPEED$/, what: 'How fast it runs.' },
  { match: /^DEPTH$/, what: 'How strong the movement is: a gentle shimmer to a deep sweep.' },
  { match: /^MIX$/, what: 'Dry to wet: how much of the effect you hear against the untouched sound.' },
  { match: /^(DRY|DIRECT)$/, what: 'How much of the untouched input is mixed in.' },
  { match: /^TIME$/, what: 'The delay time: how far apart the echoes are.' },
  { match: /^(FEEDBACK|FDBK|REPEATS)$/, what: 'How much of the echo is fed back in: one repeat, many, then endless (careful at the top).' },
  {
    match: /^FEEDBK$/,
    what: 'The operator feeds itself back: pure, then buzzy, then noisy. A quick way from flute to brass to grit.',
  },
  { match: /^(SIZE)$/, what: 'How big the space (or object) is: bigger is longer and deeper.' },
  { match: /^(DAMPING|DAMP)$/, what: 'How quickly the highs die away: more is darker and softer.' },
  { match: /^PREDELAY$/, what: 'A short gap before the reverb starts, so the dry hit stays clear.' },
  { match: /^WOW$/, what: 'Slow pitch wobble, like a warped tape or record.' },
  { match: /^PAN$/, what: 'Where this sits between the left and right speakers.' },
  { match: /^SEND$/, what: 'How much of this channel goes out to the effect send (RETURN brings the effect back).' },
  { match: /^RETURN$/, what: 'How loud the effect coming back from the send is.' },
  { match: /^MUTE$/, what: 'Silences this channel.' },
  { match: /^DUCK$/, what: 'Sidechain ducking: how far this channel dips on each hit at the DUCK input. Feed it the kick for the pumping sound.' },
  { match: /^TRIM$/, what: 'Input level, set first so every channel arrives about equally loud.' },
  { match: /^(LOW|BASS)$/, what: 'Boosts or cuts the low end: the weight and thump.' },
  { match: /^(MID|MIDDLE)$/, what: 'Boosts or cuts the middle: the body and honk.' },
  { match: /^(HIGH|HI|TREBLE)$/, what: 'Boosts or cuts the top end: brightness and air.' },
  { match: /^PRESENCE$/, what: 'The upper-middle bite that helps a sound cut through a mix.' },
  { match: /^(TEMPO|BPM)$/, what: 'The speed, in beats per minute.' },
  { match: /^SWING$/, what: 'Holds back every second step a little: a shuffled, human groove instead of a stiff one.' },
  { match: /^(LENGTH|STEPS)$/, what: 'How many steps the pattern plays before it goes round again (try odd numbers for patterns that drift).' },
  { match: /^(RUN|PLAY)$/, what: 'Starts and stops it.' },
  { match: /^PATTERN$/, what: 'Which stored pattern plays; the arrow settings chain patterns one after another.' },
  { match: /^ACCENT$/, what: 'How much harder the accented steps hit.' },
  { match: /^GATE$/, what: 'How long each note is held: short and plucky to long and legato.' },
  { match: /^(VELOCITY)$/, what: 'How hard that step hits: louder, and brighter where velocity reaches the filter.' },
  { match: /^SNAPPY$/, what: 'The snare wires: more rattle and crack on top of the drum.' },
  { match: /^METAL$/, what: 'How metallic and clangy the hats are.' },
  { match: /^PUNCH$/, what: 'The click at the start of the hit: more cuts through, less is a soft boom.' },
  { match: /^(KEY|ROOT)$/, what: 'The key: the note everything is built from.' },
  { match: /^SCALE$/, what: 'Which scale the notes are kept to, so nothing plays out of key.' },
  { match: /^TRANSPOSE$/, what: 'Shifts every note up or down by semitones.' },
  { match: /^(THRESHOLD|THRESH)$/, what: 'The level it reacts above: lower catches quieter sounds.' },
  { match: /^RATIO$/, what: 'How hard it squashes what goes over the threshold: 2:1 is gentle, 10:1 and up is limiting.' },
  { match: /^MAKEUP$/, what: 'Turns the squashed sound back up to make up for what the compressor took off.' },
  { match: /^CV AMT$/, what: 'How far the CV input turns this module’s main control (left of centre turns it the other way).' },
  { match: /^CV$/, what: 'How far the CV input moves it.' },
  { match: /^FM$/, what: 'How much the FM input wobbles the pitch: a little for vibrato, a lot (from another oscillator) for bells and metal.' },
  { match: /^PWM$/, what: 'How much the modulation moves the pulse width: a moving, chorused tone.' },
  { match: /^WIDTH$/, what: 'Pulse width, the shape of the square wave: 50% is hollow, narrower is thin and nasal.' },
  { match: /^(ENV AMT|EG AMT|ENV|EG)$/, what: 'How far the envelope sweeps the filter on each note (left of centre sweeps it down).' },
  { match: /^LFO AMT$/, what: 'How much the LFO wobbles things: vibrato, or a filter sweep.' },
  { match: /^NOISE$/, what: 'How much noise is mixed in: hiss, breath, wind, the snap of a snare.' },
  { match: /^SLEW$/, what: 'Smooths the output: higher values glide instead of jumping.' },
  { match: /^SPREAD$/, what: 'How far apart the parts are spread.' },
  { match: /^OFFSET$/, what: 'A fixed starting amount, so it’s partly open even with no CV.' },
  { match: /^SENS$/, what: 'How sensitive it is to its input.' },
  { match: /^RANGE$/, what: 'How wide a range it covers.' },
  { match: /^SHAPE$/, what: 'The shape of the curve or wave.' },
  { match: /^TIMBRE$/, what: 'The tone colour: from plain toward rich and complex.' },
  { match: /^BODY$/, what: 'How much of the body resonates: fuller and warmer.' },
  { match: /^RING$/, what: 'How long it rings after it’s struck.' },
  { match: /^SYMMETRY$/, what: 'Tilts the wave off-centre: a different, often hollower set of harmonics.' },
  { match: /^(RISE)$/, what: 'How long the voltage takes to rise.' },
  { match: /^(FALL)$/, what: 'How long the voltage takes to fall back.' },
  { match: /^BALLS$/, what: 'How many balls are in play: more balls, busier rhythm.' },
  { match: /^GRAVITY$/, what: 'How strong gravity is: stronger falls faster, and the rhythm speeds up.' },
  { match: /^BOUNCE$/, what: 'How bouncy the balls are: how much energy they keep on each hit.' },
  { match: /^ENERGY$/, what: 'How much energy: calm to wild.' },
  { match: /^(SCENE|SOUND|VOICE|INSTRUMENT|ENGINE|EFFECT|STYLE|MODE|SYSTEM)$/, what: 'Picks which one: the choices are listed below.' },
  { match: /^HUE$/, what: 'The colour.' },
  { match: /^GLOW$/, what: 'How brightly it glows.' },
  { match: /^COUNT$/, what: 'How many creatures there are.' },
  { match: /^VOICING$/, what: 'How the chord’s notes are stacked: CLOSE keeps them together, OPEN spreads them out for a bigger sound.' },
  { match: /^VIBRATO$/, what: 'A gentle pitch wobble, like a singer’s.' },
]

/** The words to try, longest first ("KICK DECAY" → KICK DECAY, DECAY;
 *  "LEVEL 2" → LEVEL; "A · PITCH (step 3 lock)" → A PITCH, PITCH). */
function candidates(label: string): string[] {
  const words = label.toUpperCase().replace(/\(.*\)/, '').split(/[\s·]+/).filter(Boolean)
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) words.pop()
  return words.map((_, i) => words.slice(i).join(' '))
}

/** What this control does, or undefined if nothing explains it yet. `label`
 *  is the name printed on the panel when it differs from the param's. */
export function paramInfo(spec: ModuleSpec, ps: ParamSpec, label?: string): string | undefined {
  const over = OVERRIDES[`${spec.type}:${ps.id}`]
  if (over) return over
  const own = MODULE_TERMS[spec.type] ?? []
  for (const l of [label, ps.label])
    if (l)
      for (const c of candidates(l)) {
        const t = own.find((m) => m.match.test(c)) ?? TERMS.find((m) => m.match.test(c))
        if (t) return t.what
      }
  return undefined
}

/** Panel knobs and switches nothing explains, and glossary entries for params
 *  that don't exist (a dev check, like the catalog's). */
export function paramGaps(specs: ModuleSpec[]): string[] {
  const out: string[] = []
  const byType = new Map(specs.map((s) => [s.type, s]))
  for (const key of Object.keys(OVERRIDES)) {
    const [type, id] = key.split(':')
    if (!byType.get(type)?.params.some((p) => p.id === id)) out.push(`${key}: no such param`)
  }
  for (const s of specs)
    for (const c of s.controls) {
      if (c.kind !== 'knob' && c.kind !== 'switch') continue
      const ps = s.params.find((p) => p.id === c.param)
      if (ps && !paramInfo(s, ps, c.kind === 'knob' ? c.label : undefined)) out.push(`${s.type}:${ps.id} (${(c.kind === 'knob' && c.label) || ps.label})`)
    }
  return out
}
