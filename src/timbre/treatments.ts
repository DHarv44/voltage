import { PP_BEATS } from '../modules/specs/fx2'
import type { Controls } from './request'

/** An effect module and when a sound asks for it: the one place an effect
 *  says what it treats. Applied in this order, each feeding the next. */
export interface Treatment {
  in: [string] | [string, string]
  out: [string] | [string, string]
  wants: (c: Controls) => boolean
  set: (c: Controls, ctx: { bpm: number }) => Record<string, number>
  /** For the report. */
  why: (c: Controls) => string
  /** How much louder the part should be mixed for it (Strudel's distortion adds level; a formant takes it away). */
  gain?: (c: Controls) => number
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export const TREATMENTS: Record<string, Treatment> = {
  fold: {
    in: ['in'],
    out: ['out'],
    wants: (c) => (c.distortion ?? 0) > 0.05,
    set: (c) => ({ fold: clamp(0.25 + (c.distortion ?? 0), 0.5, 10) }),
    why: () => 'distortion → FOLD',
    gain: (c) => 1 + Math.min(3, (c.distortion ?? 0) * 3),
  },
  era: {
    in: ['in'],
    out: ['out'],
    wants: (c) => (c.crush !== undefined && c.crush < 16) || (c.coarse !== undefined && c.coarse > 1),
    set: (c) => ({ era: 0, bits: clamp(Math.round(((c.crush ?? 16) - 16) / 2), -6, 0), rate: clamp(1 / (c.coarse ?? 1), 0.25, 2), mix: 1 }),
    why: (c) => `${c.crush !== undefined ? `crush ${c.crush}` : ''}${c.coarse !== undefined ? ` coarse ${c.coarse}` : ''} → ERA`.trim(),
  },
  formant: {
    in: ['in'],
    out: ['out'],
    wants: (c) => c.vowel !== undefined,
    set: (c) => ({ vowel: clamp(c.vowel ?? 0, 0, 4), mix: 1 }),
    why: () => 'vowel → FORMANT',
    gain: () => 2.2,
  },
  phaser: {
    in: ['in'],
    out: ['out'],
    wants: (c) => (c.phaser ?? 0) > 0,
    set: (c) => ({ rate: clamp(c.phaser ?? 0.4, 0.05, 8), depth: clamp(c.phaserDepth ?? 0.7, 0, 1) }),
    why: () => 'phaser → PHASER',
  },
  pingpong: {
    in: ['l', 'r'],
    out: ['ol', 'or'],
    wants: (c) => (c.delay ?? 0) > 0,
    set: (c, { bpm }) => {
      const beats = (c.delayTime ?? 0.375) * 4
      let div = 3
      let best = Infinity
      PP_BEATS.forEach((b, i) => {
        if (Math.abs(b - beats) < best) (best = Math.abs(b - beats)), (div = i)
      })
      // Strudel's delayfeedback defaults to 0.5
      return { div, bpm: clamp(bpm, 40, 240), fb: c.delayFeedback ?? 0.5, mix: Math.min(0.6, c.delay ?? 0.3) }
    },
    why: () => 'delay → PING-PONG',
  },
}
