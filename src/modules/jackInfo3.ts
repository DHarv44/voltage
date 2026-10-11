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
}
