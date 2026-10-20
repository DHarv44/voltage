import { mix, voice, type Jack, type Kit } from '../patch/starters/kit'
import { bankPreset } from './banksLookup'
import { DRUM_VOICES, INSTRUMENTS } from './instruments'
import { pickInstrument } from './pick'
import { envelope, type Controls, type DrumRequest, type Hit, type VoiceRequest } from './request'
import { TREATMENTS } from './treatments'

/** Where a part's control signals come from. */
export interface PartJacks {
  v: Jack
  g: Jack
  vel?: Jack
  /** The filter CV, when the part's cutoff moves. */
  mod?: Jack
}

const toMono = (k: Kit, out: Jack[]): Jack => (out.length === 1 ? out[0] : mix(k, out, [0.7, 0.7]))

/** A mono synth voice patched from parts: VCO → filter → VCA, the wave and
 *  filter from the request (a moving cutoff takes MOD into the filter's CV). */
function monoChain(k: Kit, r: VoiceRequest, j: PartJacks, say: (s: string) => void): Jack {
  const c = r.c
  const wave = r.timbre === 'sine' ? 'sin' : r.timbre === 'triangle' ? 'tri' : r.timbre === 'square' ? 'sqr' : 'saw'
  const env = envelope(r)
  let filter: { type: string; params: Record<string, number>; out: string }
  let filterCv: Jack | undefined
  let how: string
  // a high-pass worth a filter of its own (below 150 Hz it's a rumble cut: the low-pass matters more)
  if (c.hpf !== undefined && (c.hpf >= 150 || c.hpfMoves)) {
    filter = { type: 'svf', params: { cutoff: c.hpfMoves ? 20 : c.hpf, res: 0.1, cv: c.hpfMoves ? 1 : 0 }, out: 'hp' }
    if (c.hpfMoves) filterCv = j.mod
    how = c.hpfMoves ? 'hpf pattern → MOD → SVF high-pass' : `high-pass at ${Math.round(c.hpf)} Hz`
  } else if (c.cutoff !== undefined) {
    filter = { type: 'vcf', params: { cutoff: c.cutoffMoves ? 20 : c.cutoff, res: c.resonance ?? 0.2, cv: c.cutoffMoves ? 1 : 0.3 }, out: 'lp4' }
    if (c.cutoffMoves) filterCv = j.mod
    how = c.cutoffMoves ? 'lpf pattern → MOD → ladder' : `ladder at ${Math.round(c.cutoff)} Hz`
  } else {
    filter = { type: 'vcf', params: { cutoff: r.timbre === 'synthbass' || r.timbre === 'bass' ? 900 : r.timbre === 'lead' ? 3500 : 6000, res: 0.25 }, out: 'lp4' }
    how = 'ladder opened by the envelope'
  }
  const vc = voice(k, j.v, j.g, { osc: { type: 'vco', out: wave }, filter, filterCv, env })
  say(`${wave} VCO voice, ${how}`)
  return vc.out
}

/** The poly chain: P-VCO → P-LADDER → P-VCA with a P-ADSR, summed by POLY MIX. */
function polyChain(k: Kit, r: VoiceRequest, j: PartJacks, say: (s: string) => void): Jack {
  const c = r.c
  const osc = k.add('pvco')
  const flt = k.add('pvcf', { cutoff: c.cutoffMoves ? 20 : (c.cutoff ?? 3000), res: c.resonance ?? 0.2, cv: 1 })
  const env = k.add('padsr', envelope(r))
  const vca = k.add('pvca', { gain: 0, cv: 1 })
  const sum = k.add('polymix')
  k.wire(j.v, [osc, 'voct'])
  k.wire(j.g, [env, 'gate'])
  k.wire([osc, r.timbre === 'square' ? 'sqr' : r.timbre === 'sine' ? 'sin' : 'saw'], [flt, 'in'])
  k.wire(c.cutoffMoves && j.mod ? j.mod : [env, 'env'], [flt, 'cv'])
  k.wire([flt, 'lp'], [vca, 'in'])
  k.wire([env, 'env'], [vca, 'cv'])
  k.wire([vca, 'out'], [sum, 'in'])
  say(`poly voice (P-VCO → P-LADDER → P-VCA), ${c.cutoffMoves ? 'lpf pattern → MOD → P-LADDER' : 'envelope on the filter'}`)
  return [sum, 'sum']
}

/** Mount what plays a request, patched to its part: returns its mono audio. */
export function placeVoice(k: Kit, r: VoiceRequest, j: PartJacks, report: string[]): Jack {
  const pick = pickInstrument(r)
  const say = (s: string) => report.push(`${r.name}: ${s}`)
  if (pick.type === 'chain:mono') return monoChain(k, r, j, say)
  if (pick.type === 'chain:poly') return polyChain(k, r, j, say)
  const ins = INSTRUMENTS[pick.type]
  const id = k.add(pick.type, ins.set?.(r))
  k.wire(j.v, [id, ins.voct])
  k.wire(j.g, [id, ins.gate])
  if (ins.vel && j.vel) k.wire(j.vel, [id, ins.vel])
  if (ins.cutoffCv && r.c.cutoffMoves && j.mod) k.wire(j.mod, [id, ins.cutoffCv])
  say(`${pick.type.toUpperCase()} (${pick.why}${r.poly > 1 ? `, ${r.poly} notes at once` : ''})`)
  return toMono(k, ins.out.map((o) => [id, o] as Jack))
}

/** Mount drum modules for the hits asked for, each trigger from `trig(hit)`:
 *  returns their mix (levels from the requests' gains), or null for none. */
export function placeDrums(k: Kit, hits: DrumRequest[], trig: (h: Hit) => Jack, level: (gain: number) => number, report: string[]): Jack | null {
  // the hits each module takes, so a module is mounted once with all its params
  const byModule = new Map<string, DrumRequest[]>()
  for (const h of hits) {
    const entry = Object.entries(DRUM_VOICES).find(([, d]) => d.hits[h.hit])
    if (entry) (byModule.get(entry[0]) ?? byModule.set(entry[0], []).get(entry[0])!).push(h)
  }
  const outs: Jack[] = []
  const levels: number[] = []
  const used: string[] = []
  const banks = new Set<string>()
  for (const [type, hs] of byModule) {
    const d = DRUM_VOICES[type]
    // the module's defaults, then the drum machine's fitted setting per hit, then a decay the music states
    const params: Record<string, number> = { ...d.set }
    for (const h of hs) {
      const preset = h.bank ? bankPreset(h.bank) : null
      if (preset?.[h.hit]) {
        Object.assign(params, preset[h.hit])
        banks.add(h.bank!)
      }
    }
    for (const h of hs) if (h.decay !== undefined && d.decay) Object.assign(params, d.decay(h.hit, h.decay))
    const id = k.add(type, params)
    for (const h of hs) {
      k.wire(trig(h.hit), [id, d.hits[h.hit]!])
      used.push(h.hit)
    }
    outs.push([id, d.out])
    levels.push(level(Math.max(...hs.map((h) => h.gain))))
  }
  if (!outs.length) return null
  report.push(`Drums: ${used.join(', ')} → ${[...byModule.keys()].map((t) => t.toUpperCase()).join(' / ')}${banks.size ? ` set like ${[...banks].join(', ')}` : ''}`)
  return mixAll(k, outs, levels)
}

/** Mix any number of jacks down to one (MIX takes four). */
export function mixAll(k: Kit, ins: Jack[], levels: number[]): Jack {
  if (ins.length === 1 && levels[0] >= 0.69 && levels[0] <= 0.71) return ins[0]
  if (ins.length <= 4) return mix(k, ins, levels)
  const first = mix(k, ins.slice(0, 4), levels.slice(0, 4))
  return mixAll(k, [first, ...ins.slice(4)], [0.9, ...levels.slice(4)])
}

/** The effects a sound's controls ask for, in order, each fed by the last. */
export function placeTreatments(k: Kit, src: Jack, c: Controls, bpm: number, name: string, report: string[]): Jack {
  for (const [type, t] of Object.entries(TREATMENTS)) {
    if (!t.wants(c)) continue
    const id = k.add(type, t.set(c, { bpm }))
    k.wire(src, [id, t.in[0]])
    src = [id, t.out[0]]
    report.push(`${name}: ${t.why(c)}`)
  }
  return src
}
