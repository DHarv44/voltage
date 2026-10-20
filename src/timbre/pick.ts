import { INSTRUMENTS } from './instruments'
import type { VoiceRequest } from './request'
import { familyOf, type Timbre } from './taxonomy'

/** What plays a request: a module, or one of the patched chains the
 *  builder knows (a VCO → filter → VCA voice; its poly twin). */
export interface Pick {
  type: string
  why: string
}

const RAW: Timbre[] = ['saw', 'square', 'sine', 'triangle', 'lead', 'synthbass', 'bass', 'noise']

/** The best instrument for a request. Mono synth waves get a patched voice
 *  (you can see and re-patch it); chords with a moving filter get the poly
 *  chain for the same reason; everything else is scored against what the
 *  instrument modules say they play: the timbre itself, then its family,
 *  then the fallback synth, with a filter CV when the request moves one. */
export function pickInstrument(r: VoiceRequest): Pick {
  const mono = r.poly <= 1
  if (mono && RAW.includes(r.timbre)) return { type: 'chain:mono', why: `${r.timbre}: a mono voice` }
  if (!mono && r.c.cutoffMoves && (RAW.includes(r.timbre) || r.timbre === 'supersaw')) return { type: 'chain:poly', why: `${r.timbre} chords with a moving filter: a poly voice` }
  const fam = familyOf(r.timbre)
  let best: Pick | null = null
  let bestScore = -Infinity
  for (const [type, ins] of Object.entries(INSTRUMENTS)) {
    if (!mono && ins.voices < 2) continue
    const i = ins.plays.indexOf(r.timbre)
    let score = 0
    let why = ''
    if (i >= 0) {
      score = 10 + (i === 0 ? 2 : 0) - i * 0.1
      why = `plays ${r.timbre}`
    } else if (ins.plays.some((t) => familyOf(t) === fam)) {
      score = 5
      why = `plays ${fam} sounds`
    } else if (ins.fallback) {
      score = 1
      why = `the synth voice (nothing plays ${r.timbre})`
    } else continue
    if (r.c.cutoffMoves && !ins.cutoffCv && ins.fallback) score -= 3
    if (score > bestScore) {
      bestScore = score
      best = { type, why }
    }
  }
  return best ?? { type: 'chain:mono', why: `${r.timbre}: a mono voice` }
}
