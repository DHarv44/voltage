import type { Signal } from './jackInfo'

/** More jack explanations (`type:dir:id`): the modules that filled the gaps
 *  in the range. Merged into jackInfo's OVERRIDES. */
export const MORE_JACKS: Record<string, { signal?: Signal; what?: string }> = {
  'panner:in:in': { signal: 'audio', what: 'The mono sound to place in the stereo field.' },
  'panner:in:cv': { signal: 'cv', what: 'Moves the pan: −5 V hard left, +5 V hard right, on top of the PAN knob and the auto-pan.' },
  'panner:in:rst': { signal: 'reset', what: 'Starts the auto-pan’s swing from the beginning (patch a clock’s bar or RST so it swings in time).' },
  'panner:out:l': { signal: 'audio', what: 'The left side: patch to OUT L (or a stereo effect’s L).' },
  'panner:out:r': { signal: 'audio', what: 'The right side: patch to OUT R.' },
  'widener:in:l': { signal: 'audio', what: 'Left in (or a mono sound on its own, which HAAS spreads).' },
  'widener:in:r': { signal: 'audio', what: 'Right in. Leave it empty for a mono sound: the widener makes the right side itself.' },
  'widener:in:cv': { signal: 'cv', what: 'Adds to WIDTH: +5 V a whole step wider, −5 V narrower (an LFO breathes the width).' },
  'widener:out:l': { signal: 'audio', what: 'The widened left side.' },
  'widener:out:r': { signal: 'audio', what: 'The widened right side.' },
  'qlfo:in:rate': { signal: 'cv', what: 'Speeds the four up or down together: +1 V doubles the rate, −1 V halves it.' },
  'qlfo:in:rst': { signal: 'reset', what: 'Lines all four up at the start of their cycle.' },
  'qlfo:out:o1': { signal: 'cv', what: 'LFO 1, ±5 V: the reference the others are spread from.' },
  'qlfo:out:o2': { signal: 'cv', what: 'LFO 2, ±5 V: a quarter-cycle behind 1 in PHASE, twice as fast in RATIO (at full SPREAD).' },
  'qlfo:out:o3': { signal: 'cv', what: 'LFO 3, ±5 V: half a cycle behind 1 (upside down) in PHASE, ×3 in RATIO.' },
  'qlfo:out:o4': { signal: 'cv', what: 'LFO 4, ±5 V: three quarters behind 1 in PHASE, ×4 in RATIO.' },
  'chance:in:in1': { signal: 'gate', what: 'Gates or a clock to toss: each one goes out of A 1 or B 1.' },
  'chance:in:in2': { signal: 'gate', what: 'Gates for channel 2 (copies IN 1 when empty, so one clock feeds two different coins).' },
  'chance:in:cv1': { signal: 'cv', what: 'Shifts channel 1’s odds: +5 V toward B by half, −5 V toward A.' },
  'chance:in:cv2': { signal: 'cv', what: 'Shifts channel 2’s odds.' },
  'chance:out:a1': { signal: 'gate', what: 'The gates that landed A (tails).' },
  'chance:out:b1': { signal: 'gate', what: 'The gates that landed B (heads): CHANCE 1 sets how many.' },
  'chance:out:a2': { signal: 'gate', what: 'Channel 2’s A gates.' },
  'chance:out:b2': { signal: 'gate', what: 'Channel 2’s B gates.' },
  'sswitch:in:in1': { signal: 'cv', what: 'Input 1: heard at OUT while the switch is on position 1 (audio or CV).' },
  'sswitch:in:in2': { signal: 'cv', what: 'Input 2, at OUT on position 2.' },
  'sswitch:in:in3': { signal: 'cv', what: 'Input 3, at OUT on position 3.' },
  'sswitch:in:in4': { signal: 'cv', what: 'Input 4, at OUT on position 4.' },
  'sswitch:in:x': { signal: 'cv', what: 'One signal sent out of whichever X→ jack is selected (the others are silent).' },
  'sswitch:in:clk': { signal: 'clock', what: 'Each pulse moves to the next position.' },
  'sswitch:in:rst': { signal: 'reset', what: 'Back to position 1.' },
  'sswitch:in:sel': { signal: 'cv', what: 'Picks the position by voltage instead of the clock: 0–10 V across the STEPS.' },
  'sswitch:out:out': { signal: 'cv', what: 'Whichever input is selected.' },
  'sswitch:out:x1': { signal: 'cv', what: 'X, while position 1 is selected.' },
  'sswitch:out:x2': { signal: 'cv', what: 'X, while position 2 is selected.' },
  'sswitch:out:x3': { signal: 'cv', what: 'X, while position 3 is selected.' },
  'sswitch:out:x4': { signal: 'cv', what: 'X, while position 4 is selected.' },
  'kaleido:in:trig': { signal: 'trigger', what: 'Plays a note: opens the low-pass gate (or strikes STRING and MODAL). Empty, it drones (STRING and MODAL strike on each new note).' },
  'kaleido:in:model': { signal: 'cv', what: 'Steps through the models: 0–10 V across all eight on top of the MODEL knob.' },
  'kaleido:out:out': { signal: 'audio', what: 'The sound.' },
  'kaleido:out:aux': { signal: 'audio', what: 'A second side of the same sound: VA a sub octave, FOLD the plain sine, FM the modulator, VOWEL the raw buzz, ADDITIVE the fundamental, CHORD the root alone, STRING the body, MODAL the lowest mode.' },
  'resonator:in:in': { signal: 'audio', what: 'What makes it ring: a drum, noise, a voice, anything. Empty, STRUM strikes it on its own.' },
  'resonator:in:strum': { signal: 'trigger', what: 'Strikes (or plucks) a new voice at the current note. Empty, a hit at IN or a new note strums.' },
  'resonator:out:odd': { signal: 'audio', what: 'The odd modes, strings or voices: patch to OUT L.' },
  'resonator:out:even': { signal: 'audio', what: 'The even modes, strings or voices: patch to OUT R (together they make it wide).' },
  'tuner:in:in': { signal: 'audio', what: 'The sound to tune: one note at a time (an oscillator, a voice, a guitar through AUDIO IN).' },
  'tuner:out:pitch': { signal: 'pitch', what: 'The pitch it hears, as V/OCT: patch it to an oscillator and it follows whatever you play or sing.' },
  'tuner:out:gate': { signal: 'gate', what: 'High while it hears a clear note.' },
  'analyser:in:l': { signal: 'audio', what: 'The mix (or its left side) to measure.' },
  'analyser:in:r': { signal: 'audio', what: 'The right side (empty: L is measured as mono in both).' },
  'analyser:in:rst': { signal: 'reset', what: 'Starts the integrated loudness and MAX peak again.' },
  'analyser:out:l': { signal: 'audio', what: 'The sound passed straight through, untouched: patch on to OUT L.' },
  'analyser:out:r': { signal: 'audio', what: 'The right side passed through: patch on to OUT R.' },
  'pianoroll:in:trans': { signal: 'pitch', what: 'Transposes every note: +1 V an octave up, +1/12 V a semitone (a sequencer here moves the whole part).' },
  'pianoroll:out:pitch': { signal: 'pitch', what: 'A poly cable: the pitch of every note sounding, one per voice. Patch to a poly oscillator (or any oscillator, which plays voice 1).' },
  'pianoroll:out:gate': { signal: 'gate', what: 'A poly cable: each voice’s gate, high while its note lasts. Patch to a poly envelope.' },
  'pianoroll:out:vel': { signal: 'cv', what: 'A poly cable: each note’s velocity, 0–10 V.' },
  'arranger:out:pat': { signal: 'cv', what: 'The section’s pattern letter as a voltage (A, B, C, D in 2.5 V bands), changing a 16th early: patch to LOCKSTEP’s PAT or LATTICE’s PAGE.' },
  'arranger:out:sec': { signal: 'cv', what: 'Which section is playing, 0–10 V in sixteen steps.' },
  'arranger:out:g1': { signal: 'gate', what: 'High in the sections where part 1 plays: patch to a VCA’s CV (or a VCA×4 channel) to bring the part in and out.' },
  'arranger:out:g2': { signal: 'gate', what: 'High in the sections where part 2 plays.' },
  'arranger:out:g3': { signal: 'gate', what: 'High in the sections where part 3 plays.' },
  'arranger:out:g4': { signal: 'gate', what: 'High in the sections where part 4 plays.' },
  'arranger:out:chg': { signal: 'trigger', what: 'A pulse at the start of each section (a crash, a fill, a reset).' },
  'arranger:out:end': { signal: 'trigger', what: 'A pulse when the song ends (or goes round again).' },
  'arranger:out:bar': { signal: 'clock', what: 'A pulse at the start of every bar.' },
  'trackhold:in:in1': { signal: 'cv', what: 'The voltage to follow and freeze (empty: a slow random wander, so the gate alone makes melodies).' },
  'trackhold:in:in2': { signal: 'cv', what: 'Channel 2’s voltage (copies IN 1 when empty: two different freezes of one source).' },
  'trackhold:in:g1': { signal: 'gate', what: 'When channel 1 follows and when it holds (see MODE 1).' },
  'trackhold:in:g2': { signal: 'gate', what: 'Channel 2’s gate (copies GATE 1 when empty).' },
  'trackhold:out:out1': { signal: 'cv', what: 'Channel 1: following, or frozen.' },
  'trackhold:out:out2': { signal: 'cv', what: 'Channel 2: following, or frozen.' },
}

MORE_JACKS['stage:in:sus'] = { signal: 'gate', what: 'The sustain pedal: while it’s high, notes you let go keep ringing until it falls. A MIDI sustain pedal works on the keys too.' }
MORE_JACKS['stage:in:vel'] = { signal: 'cv', what: 'Velocity per note, 0–10 V: soft notes are round and bell-like, hard ones bark (TINE) or bite (REED).' }
MORE_JACKS['stage:in:voct'] = { signal: 'pitch', what: 'The notes (a poly cable from POLY·CV or the PIANO ROLL plays a chord). With GATE empty it transposes the keys.' }
MORE_JACKS['stage:in:gate'] = { signal: 'gate', what: 'Each note’s gate: its rise is the hammer, its fall lands the damper. Empty: STAGE plays from your keys.' }
// COMBO and COMBO CORE
const COMBO_TYPES = ['combocore']
for (const t of COMBO_TYPES) {
  const J: Record<string, { signal: 'audio' | 'pitch' | 'gate' | 'cv' | 'clock' | 'reset' | 'trigger'; what: string }> = {
    'in:in': { signal: 'audio', what: 'Your playing to teach it (patch AUDIO IN: a guitar, keys, a voice). With GATE patched it learns from V/OCT and GATE instead.' },
    'in:voct': { signal: 'pitch', what: 'Notes to teach it from (a poly cable from the keys, POLY·CV or the PIANO ROLL): exact chords, no listening needed. Used with GATE.' },
    'in:gate': { signal: 'gate', what: 'The gates of the notes on V/OCT. Patched, COMBO learns from the cables rather than IN.' },
    'in:clk': { signal: 'clock', what: 'A clock in 16ths (CLOCK’s 1/16): the band plays at its tempo instead of the one you taught.' },
    'in:rst': { signal: 'reset', what: 'A pulse sends the band back to the top of the part.' },
    'in:band': { signal: 'gate', what: 'A footswitch for BAND: press to teach, press on the same downbeat to finish, press to stop; hold two seconds to forget the part.' },
    'in:next': { signal: 'trigger', what: 'A pulse cues the next learned part (it comes in at the end of this one, after a fill).' },
    'in:part': { signal: 'cv', what: 'Picks the part: 0–2 V part 1, 2–4 V part 2, up to 8–10 V part 5 (ARRANGER can run the song).' },
    'out:kick': { signal: 'trigger', what: 'The drummer’s kick: a trigger for a KICK module.' },
    'out:snare': { signal: 'trigger', what: 'The snare (and the rolls in fills).' },
    'out:hat': { signal: 'trigger', what: 'The closed hi-hat.' },
    'out:ohat': { signal: 'trigger', what: 'The open hi-hat.' },
    'out:ride': { signal: 'trigger', what: 'The ride cymbal.' },
    'out:tom': { signal: 'trigger', what: 'The toms (fills and tom grooves).' },
    'out:perc': { signal: 'trigger', what: 'The style’s percussion: tambourine, shaker, clap, conga or rim.' },
    'out:crash': { signal: 'trigger', what: 'A crash: at the top of each part, and on high intensity.' },
    'out:acc': { signal: 'trigger', what: 'High on accented hits: patch to the drum modules’ ACC.' },
    'out:bass': { signal: 'pitch', what: 'The bass line’s pitch (V/OCT), following your chords.' },
    'out:bgate': { signal: 'gate', what: 'The bass line’s gate: high while each bass note sounds.' },
    'out:chord': { signal: 'pitch', what: 'A poly cable: the chord you taught, playing now (patch to a poly voice for a pad).' },
    'out:root': { signal: 'pitch', what: 'The root of the chord playing now.' },
    'out:clko': { signal: 'clock', what: 'The band’s clock in 16ths: everything else can follow it.' },
    'out:rsto': { signal: 'reset', what: 'A pulse at the top of each part.' },
    'out:link': { signal: 'cv', what: 'Patch to a FOOTSWITCH or a LOOPER: they work with this band.' },
  }
  for (const [k, v] of Object.entries(J)) MORE_JACKS[`${t}:${k}`] = v
}

MORE_JACKS['pianoroll:out:ped'] = { signal: 'gate', what: 'The sustain pedal lane: high on the steps where the pedal is drawn down. Patch to a piano’s SUS (GRAND, STAGE, FM-4).' }
MORE_JACKS['grand:in:sus'] = { signal: 'gate', what: 'The sustain pedal: while it’s high every damper is lifted, so notes you let go ring on and the free strings ring along in sympathy. A MIDI sustain pedal works too.' }
MORE_JACKS['grand:in:soft'] = { signal: 'gate', what: 'The soft pedal (una corda): while it’s high the hammers strike one string fewer, with a softer part of the felt: quieter and darker.' }
MORE_JACKS['grand:in:vel'] = { signal: 'cv', what: 'Velocity per note, 0–10 V: soft notes are quiet and round, hard ones loud and bright.' }
MORE_JACKS['grand:in:voct'] = { signal: 'pitch', what: 'The notes (a poly cable from POLY·CV or the PIANO ROLL plays a chord). With GATE empty it transposes the keys.' }
MORE_JACKS['grand:in:gate'] = { signal: 'gate', what: 'Each note’s gate: its rise is the hammer, its fall lands the damper. Empty: GRAND plays from your keys.' }
MORE_JACKS['fm4:in:sus'] = { signal: 'gate', what: 'The sustain pedal: while it’s high, notes you let go keep ringing until it falls (a footswitch, or any gate). A MIDI sustain pedal works on the keys too.' }

// VISION's beat and steering (the tank and the CORE), and a VIEW's own jacks
for (const t of ['vision', 'visioncore']) {
  MORE_JACKS[`${t}:in:clk`] = {
    signal: 'clock',
    what: 'The beat (CLOCK’s 1/4): every scene moves in time. The jelly twitches and glows (a full stroke each bar if TRIG is empty), flowers rock, fireflies flash, the aurora flares, the plate knocks, raindrops fall; the starlings and the fish turn on each bar.',
  }
  MORE_JACKS[`${t}:in:x`] = { signal: 'cv', what: 'Steer across: −5 V the left, +5 V the right. The jelly swims there, the flock and the school fly there, the fireflies gather, the insects follow, the curtains drift, the plate tilts, the rain falls there.' }
  MORE_JACKS[`${t}:in:y`] = { signal: 'cv', what: 'Steer up and down: −5 V the bottom (or the near water), +5 V the top. Patch an LFO to X and another a quarter-cycle on (QUAD LFO) to Y and the creatures circle.' }
}
const VIEW_OUT: Record<string, string> = {
  gate: 'The GATE of the scene this VIEW shows (whatever the CORE’s OUT knob says): each VIEW plays its own scene.',
  sway: 'MOTION of the scene this VIEW shows.',
  grow: 'STATE of the scene this VIEW shows.',
  light: 'LIGHT of the scene this VIEW shows.',
  depth: 'DEPTH of the scene this VIEW shows.',
  tx: 'Where your finger is across this VIEW’s glass, 0–10 V (held when you lift off).',
  ty: 'Where your finger is up this VIEW’s glass, 0–10 V.',
  tgate: 'High while a finger is on this VIEW’s glass.',
}
for (const [j, what] of Object.entries(VIEW_OUT)) MORE_JACKS[`visionview:out:${j}`] = { signal: j === 'gate' || j === 'tgate' ? 'gate' : 'cv', what }
