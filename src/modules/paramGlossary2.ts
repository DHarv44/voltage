/** More of the knob glossary (single controls, `type:param`): the synth
 *  voices. Merged into paramGlossary's OVERRIDES. */
export const MORE_OVERRIDES: Record<string, string> = {
  // FM-4
  'fm4:voice': 'The sound: each one is a recipe of four operators (their pitches, levels and envelopes) and a wiring. Start here, then shape it.',
  'fm4:algo': 'The algorithm: how the four operators are wired, which ones you hear and which ones bend the others. VOICE keeps the sound’s own.',
  'fm4:bright': 'How hard the modulators bend the carriers: FM’s filter knob. Left is soft and round, right is bright, brassy, then metallic.',
  'fm4:decay': 'Stretches every envelope: left makes notes short and plucky, right lets them ring.',
  'fm4:fb': 'Operator 4 feeding back into itself: from a clean tone to buzzy, then noisy.',
  'fm4:detune': 'Pulls the operators slightly apart: a chorused, shimmering electric piano.',
  'fm4:att': 'Slows the start of every note: from a hit to a swell.',
  'fm4:rel': 'How long notes ring after you let go.',
  'fm4:velo': 'How much playing harder makes the sound brighter and louder (the electric piano’s bark when you dig in).',
  // SWARM
  'swarm:detune': 'How far apart the seven saws are tuned: a fat chorus at first, then a wide, beating wall (it opens up fast past halfway).',
  'swarm:mix': 'The centre saw against the six around it: left is focused and plain, right is all swirl.',
  'swarm:spread': 'How far the saws fan out across the stereo field: 0 is mono, right is as wide as it gets.',
  'swarm:sub': 'A square wave an octave down: weight under the chord.',
  'swarm:cvamt': 'How far the CUTOFF input opens the filter.',
  'swarm:att': 'How long each note takes to swell in: zero for stabs, longer for pads.',
  // GRAINS
  'grains:pos': 'How far back in the four-second memory the grains come from: left is right now, right is four seconds ago.',
  'grains:size': 'How long each grain is: tiny ones buzz and sparkle, long ones blur into a smeared copy of the sound.',
  'grains:density': 'How many grains start each second: a few separate blips to a thick, continuous cloud.',
  'grains:pitch': 'Every grain played this many semitones up or down, without changing speed: octaves (±12) and fifths (7) sound sweetest.',
  'grains:spray': 'Scatters where each grain starts around POSITION: zero is tight, more is a cloud of moments.',
  'grains:spread': 'Throws the grains across the stereo field: wider and more enveloping.',
  'grains:rev': 'The chance each grain plays backwards: a dreamy, reversed shimmer.',
  'grains:fb': 'Feeds the cloud back into the memory, so it layers on itself into a wash.',
  'grains:mix': 'The dry input against the cloud.',
  'grains:freeze': 'FREEZE stops recording: the memory holds that moment, and the grains keep playing with it.',
  // SHIMMER
  'shimmer:decay': 'How long the reverb rings: a room to an endless wash.',
  'shimmer:shimmer': 'How much of the tail is pitched up and sent back in: every repeat climbs, so the sound glows and rises.',
  'shimmer:interval': 'How far each pass climbs: an octave (+12), a fifth (+7), both (+19), two octaves, or an octave down for darkness.',
  'shimmer:freeze': 'FREEZE: the tail holds forever and new sound stays out, a pad made of whatever was ringing.',
  // SHIFT
  'shift:a': 'Voice A’s pitch, in semitones from what goes in: +12 is an octave up, 7 a fifth, −12 an octave down.',
  'shift:b': 'Voice B’s pitch, in semitones from what goes in (turn LEVEL B up to hear it).',
  'shift:la': 'How loud voice A is.',
  'shift:lb': 'How loud voice B is.',
  'shift:fine': 'Detunes the two voices apart by a few cents: set both SHIFTs to 0 for a thick double-tracked sound.',
  'shift:size': 'The window the shifter works in: short is tight but buzzy, long is smooth but smears fast notes.',
  'shift:fb': 'Sends the shifted sound back through again: each repeat climbs (or falls) once more, the endless pitch spiral.',
  'shift:delay': 'How long before each feedback repeat comes round.',
  // TALLY
  'tally:mode': 'CAL: a calculator. PLAY: the keys play. REC: what you play is remembered (it starts afresh), for ONE KEY PLAY.',
  'tally:sound': 'The voice: five tiny digital sounds, or ADSR, your own sound set by an eight-digit code typed on the calculator.',
  'tally:oct': 'Moves the key strip down or up an octave.',
  'tally:rhythm': 'Which of the ten rhythms the little drum box plays (▶ RHYTHM starts it).',
  'tally:balance': 'The melody against the rhythm: left is all melody, right all rhythm.',
  'tally:vol': 'How loud TALLY is.',
  'tally:tempo': 'The rhythm’s speed (and how fast ♪ plays a number), when nothing is patched to CLK.',
  // CLOCK and MIDI
  'clock:sync': 'INT: its own TEMPO. MIDI IN: follows MIDI clock from a DAW or a drum machine (tempo, START and STOP); the TEMPO knob shows what it hears.',
  'clock:mout': 'MIDI OUT: sends MIDI clock, START and STOP to your MIDI outputs, so a DAW or other gear follows the rack.',
  // TAP
  'tap:level': 'How loud the tapped mix comes out: 1 brings a usual mix back to normal audio level; raise it if your OUT is turned down low.',
  // MOTION
  'motion:tempo': 'The loop’s speed, when nothing is patched to CLK.',
  'motion:bars': 'How long each lane’s loop is, in bars: the length you record, and the length that repeats.',
  'motion:smooth': 'How smoothly playback glides: left follows your hand exactly (steps and all), right rounds it into slow curves.',
}
