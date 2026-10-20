import type { Controls, DrumRequest, VoiceRequest } from '../timbre/request'
import { HITS, type Hit } from '../timbre/request'
import { timbreOfName, type Timbre } from '../timbre/taxonomy'
import type { LaneInfo } from './analyse'

/** Strudel's words → ours. The only file that knows both: a sound name to
 *  a timbre, Strudel's control names and units to the neutral controls. */

const ALIAS: Record<string, Timbre> = { '': 'triangle', sawtooth: 'saw', saw: 'saw', square: 'square', pulse: 'square', sine: 'sine', sin: 'sine', triangle: 'triangle', tri: 'triangle', supersaw: 'supersaw', white: 'noise', pink: 'noise', brown: 'noise', crackle: 'noise' }

export function timbreOfSound(sound: string): Timbre {
  const s = sound.toLowerCase().replace(/^z_/, '')
  return ALIAS[s] ?? timbreOfName(s.replace(/^gm_/, ''))
}

const VOWEL: Record<string, number> = { a: 0, e: 1, i: 2, o: 3, u: 4 }

/** A lane's typical control values (Strudel names) as neutral controls. */
export function controlsOf(info: LaneInfo): Controls {
  const p = info.p
  const c: Controls = {}
  if (p.lpf !== undefined) {
    c.cutoff = p.lpf
    c.cutoffMoves = info.patterned.has('lpf')
  }
  if (p.lpq !== undefined) c.resonance = Math.min(0.9, p.lpq / 20)
  if (p.hpf !== undefined) {
    c.hpf = p.hpf
    c.hpfMoves = info.patterned.has('hpf')
  }
  if (p.attack !== undefined) c.attack = p.attack
  if (p.decay !== undefined) c.decay = p.decay
  if (p.sustain !== undefined) c.sustain = p.sustain
  if (p.release !== undefined) c.release = p.release
  if (p.gain !== undefined) c.gain = p.gain
  if (p.pan !== undefined) c.pan = p.pan * 2 - 1
  if (p.room !== undefined) c.reverb = p.room
  if (p.delay !== undefined) {
    c.delay = p.delay
    if (p.delaytime !== undefined) c.delayTime = p.delaytime
    if (p.delayfb !== undefined) c.delayFeedback = p.delayfb
  }
  const dirt = p.shape ?? (p.distort !== undefined ? p.distort / 4 : undefined)
  if (dirt !== undefined) c.distortion = dirt
  if (p.crush !== undefined) c.crush = p.crush
  if (p.coarse !== undefined) c.coarse = p.coarse
  if (info.vowel && VOWEL[info.vowel[0]] !== undefined) c.vowel = VOWEL[info.vowel[0]]
  if (p.phaser !== undefined) {
    c.phaser = p.phaser
    if (p.phaserdepth !== undefined) c.phaserDepth = p.phaserdepth
  }
  return c
}

export function requestOf(info: LaneInfo, index: number): VoiceRequest {
  return { name: `Part ${index + 1} (${info.name})`, timbre: timbreOfSound(info.sound), poly: info.maxPoly, c: controlsOf(info) }
}

/** The drums a piece plays (hit index order), with their typical gain and decay. */
export function drumRequests(drums: { count: number; gain: number; decay?: number }[]): DrumRequest[] {
  const out: DrumRequest[] = []
  drums.forEach((d, i) => {
    if (d.count) out.push({ hit: HITS[i] as Hit, gain: d.gain, decay: d.decay })
  })
  return out
}
