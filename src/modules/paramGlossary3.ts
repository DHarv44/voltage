/** COMBO and COMBO CORE's panel (the same knobs on both). */
function comboTexts(type: string): Record<string, string> {
  return {
    [`${type}:genre`]: 'The genre the band plays the selected part in: blues, R&B, rock, alternative, metal, pop, electronic pop, hip-hop, country, folk, Latin, jazz. Each part keeps its own.',
    [`${type}:style`]: 'One of the genre’s twelve styles (1–9 in 4/4, 10–12 in 3/4). The lights on the screen suggest styles: green ones match the meter and feel you played, amber ones the meter.',
    [`${type}:tempo`]: 'Plays faster or slower than you taught it (the middle is your tempo). Ignored when a clock is patched to CLK.',
    [`${type}:alt`]: 'ALT TIME: another reading of your tempo, at double or half time, for the selected part.',
    [`${type}:sbass`]: 'The bass player: ACTIVE plays the style’s line, ROOTS the same rhythm on each chord’s root, BAR one root a bar, held.',
    [`${type}:count`]: 'Four clicks of the sticks before the band comes in (when you start it with BAND; after teaching, it comes straight in).',
  }
}

/** More of the knob glossary (`type:param`): the modules that filled the
 *  gaps in the range (stereo tools, CV tools, …). Merged into OVERRIDES. */
export const GAP_OVERRIDES: Record<string, string> = {
  // PANNER
  'panner:pan': 'Where the sound sits: left, centre or right (the auto-pan swings around here).',
  'panner:auto': 'How far the auto-pan swings the sound from side to side: zero holds still, full sweeps speaker to speaker.',
  'panner:rate': 'How fast the auto-pan swings: a slow drift across the room to a fast tremolo-like flutter.',
  'panner:shape': 'How it swings: SINE glides smoothly, TRI moves at a steady pace, SQUARE jumps hard side to side (ping-pong), RANDOM wanders to a new spot each cycle.',
  // WIDENER
  'widener:width': 'How wide the stereo picture is: left folds it to mono, the middle leaves it as it is, right pushes it wider than the speakers (too far sounds hollow).',
  'widener:haas': 'For a mono sound (nothing in R): one side is delayed by this many milliseconds, so it opens out across the speakers without changing its tone. Around 5–15 ms sounds natural.',
  'widener:mono': 'Below this frequency everything stays in the middle: the kick and bass stay solid and punchy on big systems and in mono.',
  // QUAD LFO
  'qlfo:rate': 'How fast the four LFOs move (the RATE input adds an octave per volt).',
  'qlfo:shape': 'The wave all four share: SINE, TRI, SAW (a ramp up), SQUARE, or S&H (a new random step each cycle).',
  'qlfo:mode': 'How the four relate: PHASE, one wave seen at four points round its cycle (circling pans, rolling chords); RATIO, at ×1, ×2, ×3, ×4 speed (polyrhythms); DRIFT, each wandering off on its own and never lining up.',
  'qlfo:spread': 'How far apart the four are: in PHASE, up to a quarter-cycle each; in RATIO, from all the same up to ×1–×4; in DRIFT, how far they stray.',
  'qlfo:depth': 'How big the four waves are (±5 V at full).',
  // CHANCE
  'chance:p1': 'The odds for channel 1: each gate goes out of B this often, otherwise out of A. Middle is a fair coin; left is always A, right always B.',
  'chance:p2': 'The odds for channel 2 (IN 2 copies IN 1 when nothing is patched to it).',
  'chance:mode': 'GATE: the chosen side copies the gate going in. LATCH: the chosen side stays high until the next toss (a random toggle).',
  // SWITCH
  'sswitch:steps': 'How many of the four positions it steps through before going round again.',
  'sswitch:order': 'How it moves on each clock: UP (1, 2, 3, 4, 1…), PING-PONG (back and forth), or RANDOM.',
  // KALEIDO
  'kaleido:model': 'How the sound is made: VA (two analog oscillators), FOLD (a wavefolder), FM (two operators), VOWEL (a singing throat), ADDITIVE (harmonics drawn in), CHORD (four oscillators in a chord), STRING (plucked), MODAL (a struck bell or bar). The three knobs below change meaning with it.',
  'kaleido:tune': 'The pitch in semitones, on top of V/OCT.',
  'kaleido:harm': 'The first macro: VA the interval to the second oscillator; FOLD the second harmonic; FM the ratio; VOWEL the throat size; ADDITIVE which harmonic is loudest; CHORD which chord; STRING where it’s plucked; MODAL how out of tune the overtones are (string to bell).',
  'kaleido:timbre': 'The brightness macro: VA the pulse width; FOLD how hard it folds; FM how much FM; VOWEL which vowel; ADDITIVE how many harmonics; CHORD the voicing; STRING and MODAL how bright the strike is.',
  'kaleido:morph': 'The third macro: VA saw into pulse; FOLD lopsided folding; FM feedback (grit); VOWEL breath; ADDITIVE odd into even harmonics (hollow to full); CHORD saw into organ; STRING and MODAL how long it rings.',
  'kaleido:decay': 'With TRIG patched, how long each note takes to fade through the low-pass gate (it darkens as it closes, like a plucked or struck thing).',
  // RESONATOR
  'resonator:model': 'MODAL: a struck or bowed object (bar, bell, plate). STRINGS: four strings tuned to a chord, ringing in sympathy. STRING: a single plucked string.',
  'resonator:poly': 'How many voices ring at once: each strum takes the next one, so earlier notes keep ringing under the new one.',
  'resonator:tune': 'The pitch in semitones, on top of V/OCT.',
  'resonator:structure': 'MODAL: how the overtones are spaced, from a string’s (in tune) to a bar’s or bell’s (clangy). STRINGS: which chord the four strings are tuned to.',
  'resonator:bright': 'How much of the high overtones ring: dark and woody to bright and glassy.',
  'resonator:damp': 'How quickly it stops ringing: right damps it to a short thunk, left lets it ring for seconds.',
  'resonator:pos': 'Where it’s struck or plucked: near the edge is thin and bright, the middle round and hollow.',
  // TUNER and ANALYSER
  'tuner:ref': 'The pitch of A4 everything is measured against: 440 Hz is standard; orchestras use 442 or 443, baroque ensembles 415.',
  'analyser:range': 'How many decibels the spectrum shows top to bottom: less zooms in on the loud parts, more shows the quiet ones too.',
  'analyser:tilt': 'Tilts the spectrum up toward the highs by this many dB per octave: at 3 (pink), a balanced mix looks roughly level instead of falling away.',
  'analyser:target': 'The loudness you’re aiming for, in LUFS: about −14 for streaming services, −23 for broadcast, −9 to −6 for loud club masters. The bar and the integrated reading turn green near it.',
  // PIANO ROLL
  'pianoroll:tempo': 'The speed in beats per minute, when nothing is patched to CLK.',
  'pianoroll:bars': 'How many bars it plays before going round again (1–4).',
  'pianoroll:oct': 'Moves every note up or down by octaves.',
  'pianoroll:voices': 'How many notes can sound at once (each one a channel of the poly cables). A mono synth hears the first.',
  'pianoroll:swing': 'Holds back every second 16th: a shuffled feel.',
  'pianoroll:run': 'Starts and stops it (starting again begins at bar 1).',
  // ARRANGER
  'arranger:tempo': 'The speed in beats per minute, when nothing is patched to CLK.',
  'arranger:len': 'How many sections the song has (the + on the screen adds one too).',
  'arranger:loop': 'LOOP goes back to the first section after the last; ONCE stops there with every part off.',
  'arranger:run': 'Starts and stops the song (starting again begins at the first section).',
  // T&H
  'trackhold:m1': 'Channel 1: TRACK follows the input while the gate is high and freezes when it drops; S&H takes one sample on each rise; HOLD is the reverse of TRACK.',
  'trackhold:m2': 'Channel 2’s mode (TRACK, S&H or HOLD). Its input and gate copy channel 1’s when nothing is patched to them.',
  // STAGE
  'stage:model': 'TINE: a hammer on a tine over a magnetic pickup (bell-like soft, barking hard), panned by its tremolo. REED: a hammer on a steel reed in an electrostatic pickup (nasal, biting), with a volume tremolo.',
  'stage:voicing': 'Where the tine or reed sits against its pickup. Left: far off centre, round and pure. Right: close in, so every note bends into harmonics (more bell, more bark).',
  'stage:bell': 'How hard the felt is: more of the tine’s high bell partial and metallic tick at the start of each note.',
  'stage:decay': 'How long the notes ring while held (low notes always ring longer than high ones).',
  'stage:drive': 'The preamp: clean at the left, warm in the middle, gritty when pushed, the more so the harder you play.',
  'stage:trem': 'Tremolo depth: TINE pans from speaker to speaker, REED pulses in volume.',
  'stage:rate': 'Tremolo speed.',
  'stage:level': 'Output level.',
  // COMBO
  ...comboTexts('combocore'),
  ...comboTexts('combo'),
  'combo:drums': 'The drummer’s level.',
  'combo:bassl': 'The bass player’s level.',
  'combo:loopl': 'The loops’ level (the middle is as loud as you played them).',
  'combo:level': 'The whole mix: your playing, the band and the loops.',
  'combolooper:loopl': 'The loops’ level (the middle is as loud as you played them).',
  'combolooper:dry': 'How much of what comes in passes through to MIX alongside the loops.',
  'combolooper:stretch': 'When the band’s tempo isn’t the one a loop was made at: STRETCH keeps its pitch, TAPE speeds it up or slows it down with the pitch.',
  'combo:stretch':'When the tempo isn’t the one a loop was made at: STRETCH keeps its pitch (grains), TAPE speeds it up or slows it down with the pitch, like a tape machine.',
  // GRAND
  'grand:model': 'GRAND: long strings, a big soundboard, a long ring. UPRIGHT: shorter, stiffer strings in a boxier case. HONKY: the saloon upright with its unisons tuned wide.',
  'grand:bright': 'How hard the hammer felt is: from dark and woolly to bright and ringing (playing harder brightens it too).',
  'grand:decay': 'How long the strings ring while held (the bass always rings longest).',
  'grand:unison': 'How far apart the two or three strings of each note are tuned: from pure through the gentle beating of a real piano to honky-tonk.',
  'grand:body': 'How much the soundboard and case colour the sound: more is warmer and woodier.',
  'grand:hammer': 'The action’s own noise: the knock of the hammer and key.',
  'grand:width': 'Stereo spread as the player hears it: bass on the left, treble on the right.',
  'grand:level': 'Output level.',
}
