/** Dev-only: play every module's ready-to-play rig headless and measure what
 *  reaches the speakers. Not imported by the app; run from the console:
 *    const C = await import('/src/dev/starterCheck.ts'); await C.checkStarters()
 *  Yields between rigs so the page stays responsive. */
import { buildPatchMsg } from '../audio/patchMsg'
import { Graph } from '../engine/graph'
import { buildStarter, STARTERS } from '../patch/starters'
import { FS, rms } from './harness'

export interface StarterResult {
  type: string
  /** RMS at the speakers over the last part of the run (after things get going). */
  level: number
  /** Played by you: silence is expected until you do. */
  played: boolean
  ok: boolean
}

/** Quieter than this is "nothing coming out". */
const SILENT = 0.002

export async function checkStarters(types = Object.keys(STARTERS), secs = 4): Promise<StarterResult[]> {
  const results: StarterResult[] = []
  const block = 128
  for (const type of types) {
    const p = buildStarter(type, 104)
    if (!p) continue
    const g = new Graph(FS)
    const msg = buildPatchMsg(p)
    if (msg.type === 'patch') g.applyPatch(msg)
    const n = Math.round(secs * FS)
    const audio = new Float32Array(n)
    const L = new Float32Array(block)
    for (let i = 0; i < n; i += block) {
      g.process(block, L, null)
      audio.set(L.subarray(0, Math.min(block, n - i)), i)
    }
    const level = rms(audio, Math.round(n * 0.25))
    const played = !!STARTERS[type].played
    results.push({ type, level: Math.round(level * 1e4) / 1e4, played, ok: played || level > SILENT })
    await new Promise((r) => setTimeout(r, 0))
  }
  return results
}
