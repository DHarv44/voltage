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
  // T&H
  'trackhold:m1': 'Channel 1: TRACK follows the input while the gate is high and freezes when it drops; S&H takes one sample on each rise; HOLD is the reverse of TRACK.',
  'trackhold:m2': 'Channel 2’s mode (TRACK, S&H or HOLD). Its input and gate copy channel 1’s when nothing is patched to them.',
}
