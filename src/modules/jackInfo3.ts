import type { Signal } from './jackInfo'

type J = { signal?: Signal; what?: string }

const stereo = (type: string, what = 'The sound'): Record<string, J> => ({
  [`${type}:in:l`]: { signal: 'audio', what: `${what}: left (or mono).` },
  [`${type}:in:r`]: { signal: 'audio', what: 'Right (empty: the left).' },
  [`${type}:out:ol`]: { signal: 'audio', what: 'Left.' },
  [`${type}:out:or`]: { signal: 'audio', what: 'Right.' },
})

/** Jack explanations (`type:dir:id`) for the modules added from 2026-10-12
 *  on (mix tools, instruments, sequencers, space, tuning). Merged into
 *  jackInfo's OVERRIDES. */
export const JACKS_3: Record<string, J> = {
  ...stereo('peq', 'The sound to EQ'),
  ...stereo('transient', 'Drums, or anything with hits'),
  ...stereo('ngate', 'The sound to gate'),
  'ngate:in:key': { signal: 'audio', what: 'Opens the gate instead of the sound itself: a drum’s trigger, a kick, another part (the gated-reverb trick).' },
  'ngate:out:gate': { signal: 'gate', what: 'High while the gate is open.' },
  ...stereo('ott', 'The mix or a part'),
  'organ:in:voct': { signal: 'pitch', what: 'Notes per voice on a poly cable (with GATE). Empty: the keys play it.' },
  'organ:in:gate': { signal: 'gate', what: 'A gate per note on a poly cable.' },
  'organ:out:out': { signal: 'audio', what: 'The organ: patch it into ROTARY.' },
  'wind:in:voct': { signal: 'pitch', what: 'The note, 1 V/oct (with the keys, added to them).' },
  'wind:in:gate': { signal: 'gate', what: 'Blows while high (replaces the keys).' },
  'wind:in:bcv': { signal: 'cv', what: 'The breath itself, 0–10 V, instead of the envelope: an envelope follower on your voice, a slow LFO for swells.' },
  'wind:out:out': { signal: 'audio', what: 'The instrument.' },
  'choir:in:voct': { signal: 'pitch', what: 'Notes per voice on a poly cable (chords). Empty: the keys play it.' },
  'choir:in:gate': { signal: 'gate', what: 'A gate per note.' },
  'choir:in:vcv': { signal: 'cv', what: 'Moves the vowel: 0–10 V from A to U.' },
  'choir:out:l': { signal: 'audio', what: 'Left (the voices spread across).' },
  'choir:out:r': { signal: 'audio', what: 'Right.' },
}
