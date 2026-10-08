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
  // TAP
  'tap:level': 'How loud the tapped mix comes out: 1 brings a usual mix back to normal audio level; raise it if your OUT is turned down low.',
  // MOTION
  'motion:tempo': 'The loop’s speed, when nothing is patched to CLK.',
  'motion:bars': 'How long each lane’s loop is, in bars: the length you record, and the length that repeats.',
  'motion:smooth': 'How smoothly playback glides: left follows your hand exactly (steps and all), right rounds it into slow curves.',
}
