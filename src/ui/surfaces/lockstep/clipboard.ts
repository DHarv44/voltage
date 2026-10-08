import { LS_PATTERNS, LS_STEPS, LS_TRACKS, stepIds, trigsId } from '../../../modules/specs/lockstepDefs'

/** LOCKSTEP's copy and paste: a whole pattern, one track's part of it, or one
 *  step. One clipboard for every LOCKSTEP in the rack, so parts travel
 *  between machines too. Pastes come back as param writes (one undo). */

type Params = Record<string, number>
type Writes = [id: string, value: number][]
interface Part {
  mask: number
  /** Per step, the values of stepIds in order. */
  steps: number[][]
}
type Clip = { kind: 'pattern'; parts: Part[] } | { kind: 'track'; part: Part } | { kind: 'step'; on: boolean; vals: number[] }

let clip: Clip | null = null

const stepVals = (p: Params, t: number, s: number, pat: number) => stepIds(t, s, pat).map((id) => p[id] ?? 0)
const readPart = (p: Params, t: number, pat: number): Part => ({
  mask: Math.round(p[trigsId(t, pat)] ?? 0),
  steps: Array.from({ length: LS_STEPS }, (_, s) => stepVals(p, t, s, pat)),
})
const writePart = (part: Part, t: number, pat: number): Writes => [
  [trigsId(t, pat), part.mask],
  ...part.steps.flatMap((vals, s) => stepIds(t, s, pat).map((id, i): [string, number] => [id, vals[i]])),
]
const writeStep = (p: Params, t: number, s: number, pat: number, on: boolean, vals: number[]): Writes => {
  const mask = Math.round(p[trigsId(t, pat)] ?? 0)
  return [[trigsId(t, pat), on ? mask | (1 << s) : mask & ~(1 << s)], ...stepIds(t, s, pat).map((id, i): [string, number] => [id, vals[i]])]
}

export const lsClip = {
  /** Copies; returns what to tell the player. */
  copyPattern(p: Params, pat: number): string {
    clip = { kind: 'pattern', parts: Array.from({ length: LS_TRACKS }, (_, t) => readPart(p, t, pat)) }
    return `COPIED PATTERN ${LS_PATTERNS[pat]}`
  },
  copyTrack(p: Params, t: number, pat: number): string {
    clip = { kind: 'track', part: readPart(p, t, pat) }
    return `COPIED ${LS_PATTERNS[pat]} T${t + 1}`
  },
  copyStep(p: Params, t: number, s: number, pat: number): string {
    clip = { kind: 'step', on: ((Math.round(p[trigsId(t, pat)] ?? 0) >>> s) & 1) === 1, vals: stepVals(p, t, s, pat) }
    return `COPIED STEP ${s + 1}`
  },
  /** The writes that paste the clipboard here (a step needs one picked). */
  paste(p: Params, t: number, s: number, pat: number): { writes: Writes; say: string } {
    if (!clip) return { writes: [], say: 'NOTHING COPIED' }
    if (clip.kind === 'pattern') {
      const parts = clip.parts
      return { writes: parts.flatMap((part, k) => writePart(part, k, pat)), say: `PASTED INTO ${LS_PATTERNS[pat]}` }
    }
    if (clip.kind === 'track') return { writes: writePart(clip.part, t, pat), say: `PASTED INTO ${LS_PATTERNS[pat]} T${t + 1}` }
    if (s < 0) return { writes: [], say: 'PICK A STEP FIRST' }
    return { writes: writeStep(p, t, s, pat, clip.on, clip.vals), say: `PASTED STEP ${s + 1}` }
  },
  /** The writes that empty a step: no trig, its note, condition and locks back to none. */
  clearStep(p: Params, t: number, s: number, pat: number): Writes {
    return writeStep(p, t, s, pat, false, stepIds(t, s, pat).map(() => 0))
  },
  holding: (): string => (clip ? clip.kind.toUpperCase() : ''),
}

/** A short line for the screen after a copy or paste, per module. */
const notes = new Map<string, { text: string; until: number }>()
export const lsNote = {
  say: (mod: string, text: string): void => {
    notes.set(mod, { text, until: performance.now() + 1600 })
  },
  get: (mod: string): string => {
    const n = notes.get(mod)
    return n && performance.now() < n.until ? n.text : ''
  },
}
