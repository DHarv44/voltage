import { buildPatchMsg } from '../audio/patchMsg'
import { Graph } from '../engine/graph'
import { SPECS } from '../modules'
import { Kit } from '../patch/starters/kit'
import { buildStrudelRack } from '../strudel/importer'

/** Our side of the bench: the rack the importer builds for the code,
 *  rendered headless for `seconds`. Returns mono audio and the import report. */
export function renderOurs(code: string, seconds: number, rate = 48000): { data: Float32Array; rate: number; report: string[]; error: string | null } {
  const k = new Kit(104)
  const r = buildStrudelRack(k, code)
  if (r.error) return { data: new Float32Array(0), rate, report: r.lines, error: r.error }
  const patch = k.build()
  const g = new Graph(rate)
  const msg = buildPatchMsg(patch)
  if (msg.type === 'patch') g.applyPatch(msg)
  const n = Math.round(seconds * rate)
  const data = new Float32Array(n)
  const L = new Float32Array(128)
  const R = new Float32Array(128)
  // a rack eases in when first patched (OUT's half-second fade): let that pass
  // with the piece stopped, then start it at cycle 0 like Strudel does
  const host = patch.modules.find((m) => m.type === 'strudelcore' || m.type === 'strudel')
  const run = host ? SPECS[host.type].params.findIndex((p) => p.id === 'run') : -1
  if (host && run >= 0) {
    g.setParam(host.id, run, 0)
    for (let i = 0; i < rate; i += 128) g.process(128, L, R)
    g.setParam(host.id, run, 1)
  }
  for (let i = 0; i < n; i += 128) {
    g.process(128, L, R)
    for (let j = 0; j < 128 && i + j < n; j++) data[i + j] = (L[j] + R[j]) / 2
  }
  return { data, rate, report: r.lines, error: null }
}
