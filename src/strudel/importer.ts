import { PP_BEATS } from '../modules/specs/fx2'
import { ST_LANES, laneOut } from '../modules/specs/strudel'
import type { Jack, Kit } from '../patch/starters/kit'
import { mix, voice } from '../patch/starters/kit'
import { analyseLanes, type LaneInfo } from './analyse'
import { DRUM_OUTS } from './music'
import { runStrudel } from './run'

export interface StrudelReport {
  lines: string[]
  warnings: string[]
  error: string | null
}

/** A share link's code, or the code itself. */
export function decodeStrudelInput(input: string): string {
  const s = input.trim()
  const hash = s.match(/^https?:\/\/[^#]*#(.+)$/)?.[1]
  if (!hash) return s
  try {
    const b64 = decodeURIComponent(hash).replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return s
  }
}

/** What a sound name asks for. */
type Kind = 'piano' | 'epiano' | 'organ' | 'wind' | 'choir' | 'pad' | 'bass' | 'lead' | 'sine' | 'triangle' | 'square'
function kindOf(sound: string): Kind {
  const s = sound.toLowerCase()
  if (/epiano|rhodes|wurl|clav/.test(s)) return 'epiano'
  if (/piano|harpsi/.test(s)) return 'piano'
  if (/organ/.test(s)) return 'organ'
  if (/flute|clarinet|recorder|oboe|whistle|ocarina|pan_flute|bassoon/.test(s)) return 'wind'
  if (/choir|voice|vox|aah|ooh|vocal/.test(s)) return 'choir'
  if (/string|pad|ensemble|warm|halo|sweep|brass/.test(s)) return 'pad'
  if (/bass/.test(s)) return 'bass'
  if (s === 'sine' || s === 'sin') return 'sine'
  if (s === 'triangle' || s === 'tri') return 'triangle'
  if (s === 'square') return 'square'
  return 'lead'
}
const KIND_NAMES: Record<Kind, string> = { piano: 'GRAND', epiano: 'STAGE', organ: 'DRAWBAR', wind: 'BREATH', choir: 'CHOIR', pad: 'HALCYON pad', bass: 'saw bass', lead: 'saw lead', sine: 'sine voice', triangle: 'triangle voice', square: 'square voice' }

const level = (gain: number) => Math.max(0.12, Math.min(0.95, 0.8 * Math.pow(Math.max(0, gain), 0.7)))

/** Mix any number of jacks down to one (MIX takes four). */
function mixAll(k: Kit, ins: Jack[], levels: number[]): Jack {
  if (ins.length === 1 && levels[0] >= 0.69 && levels[0] <= 0.71) return ins[0]
  if (ins.length <= 4) return mix(k, ins, levels)
  const first = mix(k, ins.slice(0, 4), levels.slice(0, 4))
  return mixAll(k, [first, ...ins.slice(4)], [0.9, ...levels.slice(4)])
}

/** One melodic lane's voice, from its sound: returns its mono audio. */
function laneVoice(k: Kit, st: string, l: number, info: LaneInfo, report: string[]): Jack {
  const v: Jack = [st, laneOut(l, 'v')]
  const g: Jack = [st, laneOut(l, 'g')]
  const kind = kindOf(info.sound)
  const env = { a: info.p.attack ?? 0.003, d: info.p.decay ?? 0.25, s: info.p.sustain ?? 0.7, r: info.p.release ?? 0.1 }
  const poly = info.maxPoly > 1
  const stereo = (id: string) => mix(k, [[id, 'l'], [id, 'r']], [0.7, 0.7])
  const note = (what: string) => report.push(`Lane ${l + 1} (${info.sound || 'notes'}): ${what}`)
  if (poly || ['piano', 'epiano', 'organ', 'choir', 'pad'].includes(kind)) {
    if (kind === 'piano') {
      const id = k.add('grand', { level: 0.8 })
      k.wire(v, [id, 'voct'])
      k.wire(g, [id, 'gate'])
      k.wire([st, laneOut(l, 'vel')], [id, 'vel'])
      note('GRAND')
      return stereo(id)
    }
    if (kind === 'epiano') {
      const id = k.add('fm4', { voice: 0, level: 0.75 })
      k.wire(v, [id, 'voct'])
      k.wire(g, [id, 'gate'])
      k.wire([st, laneOut(l, 'vel')], [id, 'vel'])
      note('FM-4 electric piano')
      return [id, 'out']
    }
    if (kind === 'organ') {
      const id = k.add('organ')
      k.wire(v, [id, 'voct'])
      k.wire(g, [id, 'gate'])
      note('DRAWBAR')
      return [id, 'out']
    }
    if (kind === 'choir') {
      const id = k.add('choir', { att: env.a, rel: env.r })
      k.wire(v, [id, 'voct'])
      k.wire(g, [id, 'gate'])
      note('CHOIR')
      return stereo(id)
    }
    const id = k.add('halcyon', {
      cutoff: info.p.lpf ?? (kind === 'pad' ? 1800 : 3000),
      a: Math.max(0.001, kind === 'pad' ? Math.max(env.a, 0.2) : env.a),
      d: env.d,
      s: env.s,
      r: env.r,
      chorus: kind === 'pad' ? 2 : 0,
      pulse: kind === 'square' ? 1 : 0,
      saw: kind === 'square' ? 0 : 1,
      sub: kind === 'bass' ? 0.5 : 0,
    })
    k.wire(v, [id, 'voct'])
    k.wire(g, [id, 'gate'])
    note(`HALCYON (${poly ? `${info.maxPoly} voices` : kind})`)
    return stereo(id)
  }
  if (kind === 'wind') {
    const id = k.add('wind', { att: env.a, rel: env.r })
    k.wire(v, [id, 'voct'])
    k.wire(g, [id, 'gate'])
    note('BREATH')
    return [id, 'out']
  }
  // a mono voice: the wave the sound names, a filter from lpf / hpf
  const out = kind === 'sine' ? 'sin' : kind === 'triangle' ? 'tri' : kind === 'square' ? 'sqr' : 'saw'
  let filter: { type: string; params: Record<string, number>; out: string }
  let filterCv: Jack | undefined
  let how: string
  if (info.p.hpf !== undefined) {
    filter = { type: 'svf', params: { cutoff: info.patterned.has('hpf') ? 20 : info.p.hpf, res: 0.1, cv: info.patterned.has('hpf') ? 1 : 0 }, out: 'hp' }
    if (info.patterned.has('hpf')) filterCv = [st, laneOut(l, 'mod')]
    how = info.patterned.has('hpf') ? 'hpf pattern → MOD → SVF high-pass' : `high-pass at ${Math.round(info.p.hpf)} Hz`
  } else if (info.p.lpf !== undefined) {
    const pat = info.patterned.has('lpf')
    filter = { type: 'vcf', params: { cutoff: pat ? 20 : info.p.lpf, res: info.p.lpq !== undefined ? Math.min(0.9, info.p.lpq / 20) : 0.2, cv: pat ? 1 : 0.3 }, out: 'lp4' }
    if (pat) filterCv = [st, laneOut(l, 'mod')]
    how = pat ? 'lpf pattern → MOD → ladder' : `ladder at ${Math.round(info.p.lpf)} Hz`
  } else {
    filter = { type: 'vcf', params: { cutoff: kind === 'bass' ? 900 : kind === 'lead' ? 3500 : 6000, res: 0.25 }, out: 'lp4' }
    how = 'ladder opened by the envelope'
  }
  const vc = voice(k, v, g, { osc: { type: 'vco', out }, filter, filterCv, env })
  note(`${KIND_NAMES[kind]}, ${how}${info.doubled.length ? `; ${info.doubled.join(' + ')} folded in` : ''}`)
  return vc.out
}

/** Build the rack for a piece of Strudel code into `k`: the STRUDEL module
 *  with the code, drums for its drum sounds, a voice per lane, a console
 *  with a plate on its send, OUT. */
export function buildStrudelRack(k: Kit, code: string): StrudelReport {
  const run = runStrudel(code)
  if (run.error) return { lines: [], warnings: run.warnings, error: run.error }
  const a = analyseLanes(run)
  const lines: string[] = []
  const st = k.add('strudel', { cpm: Math.max(10, Math.min(120, run.cps * 60)) })
  k.setText(st, code)
  const channels: { src: Jack; level: number; pan: number; room: number; name: string }[] = []
  // the drums
  const drumOuts: Jack[] = []
  const drumLevels: number[] = []
  let hats = ''
  const used: string[] = []
  a.drums.forEach((d, i) => {
    if (!d.count) return
    const name = DRUM_OUTS[i]
    const trig: Jack = [st, name]
    let id: string
    if (name === 'bd') (id = k.add('kick', { decay: 0.5, punch: 0.6 })), k.wire(trig, [id, 'trig'])
    else if (name === 'sd') (id = k.add('snare')), k.wire(trig, [id, 'trig'])
    else if (name === 'cp') (id = k.add('clap')), k.wire(trig, [id, 'trig'])
    else if (name === 'tom') (id = k.add('tom')), k.wire(trig, [id, 'trig'])
    else if (name === 'ch' || name === 'oh') {
      if (!hats) hats = k.add('hats', { chd: 0.04 })
      id = hats
      k.wire(trig, [id, name])
      if (drumOuts.some((j) => j[0] === hats)) {
        used.push(name)
        return
      }
    } else {
      id = k.add('perc')
      k.wire(trig, [id, name === 'rim' ? 'rim' : 'bell'])
    }
    drumOuts.push([id, id === hats ? 'mix' : 'out'])
    drumLevels.push(level(d.gain))
    used.push(name)
  })
  if (drumOuts.length) {
    channels.push({ src: mixAll(k, drumOuts, drumLevels), level: 0.85, pan: 0, room: a.drumRoom, name: 'drums' })
    lines.push(`Drums: ${used.join(', ')} → our KICK / SNARE / HATS / CLAP / PERC`)
  }
  // the lanes
  a.lanes.forEach((info, l) => {
    if (l >= ST_LANES || !info.notes) return
    let src = laneVoice(k, st, l, info, lines)
    if (info.p.shape) {
      const f = k.add('fold', { fold: Math.min(1, info.p.shape * 1.5) })
      k.wire(src, [f, 'in'])
      src = [f, 'out']
    }
    if (info.p.delay) {
      const bpm = run.cps * 240
      const beats = (info.p.delaytime ?? 0.375) * 4
      let div = 3
      let best = Infinity
      PP_BEATS.forEach((b, i) => {
        if (Math.abs(b - beats) < best) (best = Math.abs(b - beats)), (div = i)
      })
      const pp = k.add('pingpong', { div, bpm: Math.max(40, Math.min(240, bpm)), fb: info.p.delayfb ?? 0.4, mix: Math.min(0.6, info.p.delay) })
      k.wire(src, [pp, 'l'])
      src = [pp, 'ol']
    }
    channels.push({ src, level: level(info.p.gain ?? 1), pan: (info.p.pan ?? 0.5) * 2 - 1, room: info.p.room ?? 0, name: `lane ${l + 1}` })
  })
  if (a.lanes.length > ST_LANES) lines.push(`${a.lanes.length} layers: the last ${a.lanes.length - ST_LANES + 1} share lane ${ST_LANES}`)
  // the desk: a plate on the send, channels' room as their send
  const chans = channels.slice(0, 6)
  if (channels.length > 6) {
    const extra = mixAll(k, channels.slice(5).map((c) => c.src), channels.slice(5).map((c) => c.level))
    chans[5] = { ...channels[5], src: extra, level: 0.8, name: 'lanes 6+' }
    lines.push('More than six parts: the rest share console channel 6')
  }
  const conParams: Record<string, number> = { ret: 0.5 }
  chans.forEach((c, i) => {
    conParams[`lvl${i + 1}`] = c.level
    conParams[`pan${i + 1}`] = c.pan
    conParams[`snd${i + 1}`] = Math.min(1, c.room * 2)
  })
  for (let i = chans.length; i < 6; i++) conParams[`lvl${i + 1}`] = 0
  const con = k.add('console', conParams)
  chans.forEach((c, i) => k.wire(c.src, [con, `in${i + 1}`]))
  const plate = k.add('plate', { decay: 0.55, mix: 1 })
  k.wire([con, 'send'], [plate, 'in'])
  k.wire([plate, 'l'], [con, 'retL'])
  k.wire([plate, 'r'], [con, 'retR'])
  const out = k.add('output', { vol: 0.6 })
  k.wire([con, 'l'], [out, 'l'])
  k.wire([con, 'r'], [out, 'r'])
  lines.push(`${(run.cps * 60).toFixed(1)} cycles a minute${run.pattern.cycles ? `, ${run.pattern.cycles} cycles long` : ''}`)
  return { lines, warnings: [...run.warnings, ...a.warnings], error: null }
}
