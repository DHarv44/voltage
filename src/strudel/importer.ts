import { ST_LANES, laneOut } from '../modules/specs/strudel'
import { SP_DEFAULT_PARTS, SP_PARTS, slotOut, slotParam } from '../modules/specs/strudelFamily'
import type { Jack, Kit } from '../patch/starters/kit'
import { mixAll, placeDrums, placeTreatments, placeVoice, type PartJacks } from '../timbre/build'
import type { Hit } from '../timbre/request'
import { drumRequests, requestOf } from './adapt'
import { analyseLanes } from './analyse'
import { runStrudel } from './run'

export interface StrudelReport {
  /** What was built, line by line. */
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

/** A Strudel gain (relative, 1 = full) as a mixer level. */
const level = (gain: number) => Math.max(0.12, Math.min(0.95, 0.8 * Math.pow(Math.max(0, gain), 0.7)))

export interface ImportOptions {
  /** The STRUDEL module's own lanes and drum jacks instead of CORE + peripherals. */
  allInOne?: boolean
  /** How many parts to split the piece into (the rest share the last), up to SP_PARTS. */
  maxParts?: number
}

/** Build the rack for a piece of Strudel code into `k`. Modular (the
 *  default): STRUDEL CORE with the code, STRUDEL PARTS ×4 panels (or single
 *  PARTs for a part or two) and a STRUDEL DRUMS on its LINK; all-in-one: the
 *  STRUDEL module's own lanes and drum jacks (its first six parts). Then,
 *  from what each part asks for (src/timbre: the sound's timbre and its
 *  controls), drum modules, an instrument per part with its effects, a
 *  console with a plate on its send, OUT. */
export function buildStrudelRack(k: Kit, code: string, o: ImportOptions = {}): StrudelReport {
  const run = runStrudel(code)
  if (run.error) return { lines: [], warnings: run.warnings, error: run.error }
  const allInOne = !!o.allInOne
  const maxParts = allInOne ? ST_LANES : Math.max(1, Math.min(SP_PARTS, Math.round(o.maxParts ?? SP_DEFAULT_PARTS)))
  const a = analyseLanes(run, maxParts)
  const lines: string[] = []
  if (a.plan.byName) lines.push(`Parts: ${a.plan.names.join(' · ')}`)
  const cpm = Math.max(10, Math.min(120, run.cps * 60))
  const bpm = run.cps * 240
  const host = k.add(allInOne ? 'strudel' : 'strudelcore', allInOne ? { cpm } : { cpm, parts: maxParts })
  k.setText(host, code)
  // the drums, on STRUDEL DRUMS (or the STRUDEL's own triggers)
  let drumMod = host
  const hits = drumRequests(a.drums)
  if (!allInOne && hits.length) {
    drumMod = k.add('strudeldrums')
    k.wire([host, 'link'], [drumMod, 'link'])
  }
  const channels: { src: Jack; level: number; pan: number; room: number; name: string }[] = []
  const drums = placeDrums(k, hits, (h: Hit) => [drumMod, h], level, lines)
  if (drums) channels.push({ src: drums, level: 0.85, pan: 0, room: a.drumRoom, name: 'drums' })
  // the parts with notes, and where each one's jacks are: the STRUDEL's own
  // lane, or a slot on a PARTS ×4 (single PARTs when only one or two are left)
  const played = a.lanes.map((info, l) => l).filter((l) => l < maxParts && a.lanes[l].notes > 0)
  const jacks = new Map<number, PartJacks>()
  if (allInOne) for (const l of played) jacks.set(l, { v: [host, laneOut(l, 'v')], g: [host, laneOut(l, 'g')], vel: [host, laneOut(l, 'vel')], mod: [host, laneOut(l, 'mod')] })
  else
    for (let i = 0; i < played.length; i += 4) {
      const chunk = played.slice(i, i + 4)
      if (chunk.length <= 2) {
        for (const l of chunk) {
          const part = k.add('strudelpart', { lane: l + 1 })
          k.wire([host, 'link'], [part, 'link'])
          jacks.set(l, { v: [part, 'v'], g: [part, 'g'], vel: [part, 'vel'], mod: [part, 'mod'] })
        }
        continue
      }
      const params: Record<string, number> = {}
      chunk.forEach((l, s) => (params[slotParam(s)] = l + 1))
      const parts = k.add('strudelparts', params)
      k.wire([host, 'link'], [parts, 'link'])
      chunk.forEach((l, s) => jacks.set(l, { v: [parts, slotOut(s, 'v')], g: [parts, slotOut(s, 'g')], vel: [parts, slotOut(s, 'vel')], mod: [parts, slotOut(s, 'mod')] }))
    }
  for (const l of played) {
    const info = a.lanes[l]
    const r = requestOf(info, l)
    let src = placeVoice(k, r, jacks.get(l)!, lines)
    src = placeTreatments(k, src, r.c, bpm, r.name, lines)
    channels.push({ src, level: level(r.c.gain ?? 1), pan: r.c.pan ?? 0, room: r.c.reverb ?? 0, name: r.name })
  }
  // the desk: a plate on the send, channels' room as their send
  const chans = channels.slice(0, 6)
  if (channels.length > 6) {
    const extra = mixAll(k, channels.slice(5).map((c) => c.src), channels.slice(5).map((c) => c.level))
    chans[5] = { ...channels[5], src: extra, level: 0.8, name: 'parts 6+' }
    lines.push('More than six parts: the rest share console channel 6')
  }
  // Strudel gains are relative: bring the loudest part up to a healthy level, the rest with it
  const loudest = Math.max(0.05, ...chans.map((c) => c.level))
  const norm = Math.min(3, 0.85 / loudest)
  const conParams: Record<string, number> = { ret: 0.5 }
  chans.forEach((c, i) => {
    conParams[`lvl${i + 1}`] = Math.min(1, c.level * norm)
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
