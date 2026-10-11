import type { Signal } from './jackInfo'

/** Jack explanations (`type:dir:id`) for the modules added from 2026-10-12
 *  on (mix tools, instruments, sequencers, space, tuning). Merged into
 *  jackInfo's OVERRIDES. */
export const JACKS_3: Record<string, { signal?: Signal; what?: string }> = {}
