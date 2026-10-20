import { envelope, type Hit, type VoiceRequest } from './request'
import type { Timbre } from './taxonomy'

/** What an instrument module can play and how it's patched: the one place a
 *  module says this, in our words, so every importer finds it. */
export interface Instrument {
  /** The timbres it's good for, best first. */
  plays: Timbre[]
  /** Notes at once (1: mono). */
  voices: number
  /** Jack ids. */
  voct: string
  gate: string
  vel?: string
  /** A CV input that moves its filter, when it has one. */
  cutoffCv?: string
  out: [string] | [string, string]
  /** Params to set for a request (the request picks a patch, sets its envelope). */
  set?: (r: VoiceRequest) => Record<string, number>
  /** The generic synth voice: plays anything when nothing closer exists. */
  fallback?: boolean
}

const FM_VOICE: Partial<Record<Timbre, number>> = { epiano: 0, synthbass: 1, bell: 2, musicbox: 2, brass: 3, organ: 4, marimba: 5, xylophone: 5, vibes: 5, clavinet: 6, pad: 7, lead: 8 }
const pct = (s: number | undefined, max: number, def: number) => (s === undefined ? def : Math.max(0, Math.min(1, s / max)))

export const INSTRUMENTS: Record<string, Instrument> = {
  grand: {
    plays: ['piano', 'harpsichord'],
    voices: 8,
    voct: 'voct',
    gate: 'gate',
    vel: 'vel',
    out: ['l', 'r'],
    set: (r) => ({ level: 0.8, model: r.timbre === 'harpsichord' ? 2 : 0 }),
  },
  stage: { plays: ['epiano', 'clavinet'], voices: 8, voct: 'voct', gate: 'gate', vel: 'vel', out: ['l', 'r'], set: (r) => ({ level: 0.8, model: r.timbre === 'clavinet' ? 1 : 0 }) },
  fm4: {
    plays: ['bell', 'marimba', 'vibes', 'xylophone', 'musicbox', 'brass', 'clavinet', 'synthbass'],
    voices: 8,
    voct: 'voct',
    gate: 'gate',
    vel: 'vel',
    out: ['out'],
    set: (r) => ({ voice: FM_VOICE[r.timbre] ?? 8, level: 0.75, att: pct(r.c.attack, 1, 0), rel: pct(r.c.release, 2, r.synth ? 0.05 : 0.5) }),
  },
  organ: { plays: ['organ'], voices: 8, voct: 'voct', gate: 'gate', out: ['out'] },
  wind: {
    plays: ['flute', 'clarinet', 'sax', 'oboe'],
    voices: 1,
    voct: 'voct',
    gate: 'gate',
    out: ['out'],
    set: (r) => ({ model: r.timbre === 'flute' ? 0 : 1, att: r.c.attack ?? 0.05, rel: r.c.release ?? 0.1 }),
  },
  choir: { plays: ['choir'], voices: 8, voct: 'voct', gate: 'gate', out: ['l', 'r'], set: (r) => ({ att: r.c.attack ?? 0.1, rel: r.c.release ?? 0.3 }) },
  swarm: {
    plays: ['supersaw'],
    voices: 8,
    voct: 'voct',
    gate: 'gate',
    out: ['l', 'r'],
    // Strudel's supersaw: 5 voices, detune 0.18, spread 0.6; its attack / release only (no decay stage)
    set: (r) => {
      const e = envelope(r)
      return { cutoff: r.c.cutoff ?? 6000, detune: 0.3, spread: 0.6, att: e.a, rel: e.r, level: 0.7 }
    },
  },
  // no cutoffCv on the poly synths: their CV inputs aren't log2(Hz / 20) scaled, so a moving
  // filter goes to the patched poly chain (the picker sends it there) and these take the median
  halcyon: {
    plays: ['pad', 'strings', 'brass', 'lead', 'square', 'saw', 'sine', 'triangle', 'noise', 'synthbass', 'drone', 'guitar', 'pluck'],
    voices: 6,
    voct: 'voct',
    gate: 'gate',
    out: ['l', 'r'],
    fallback: true,
    set: (r) => {
      const padLike = r.timbre === 'pad' || r.timbre === 'strings' || r.timbre === 'drone'
      const e = envelope(r)
      return {
        cutoff: r.c.cutoff ?? (padLike ? 1800 : 3000),
        a: padLike ? Math.max(e.a, 0.2) : e.a,
        d: e.d,
        s: e.s,
        r: padLike ? Math.max(e.r, 0.1) : e.r,
        chorus: padLike ? 2 : 0,
        pulse: r.timbre === 'square' ? 1 : 0,
        saw: r.timbre === 'square' ? 0 : 1,
        sub: r.timbre === 'synthbass' ? 0.5 : 0,
        hpf: r.c.hpf !== undefined && r.c.hpf >= 150 ? (r.c.hpf > 500 ? 3 : 2) : 1,
      }
    },
  },
  tapekeys: {
    plays: ['strings', 'choir', 'flute'],
    voices: 8,
    voct: 'voct',
    gate: 'gate',
    out: ['out'],
    set: (r) => ({ sound: r.timbre === 'flute' ? 1 : r.timbre === 'choir' ? 2 : 0 }),
  },
  strike: { plays: ['handpan', 'steelpan', 'kalimba'], voices: 1, voct: 'voct', gate: 'trig', vel: 'vel', out: ['out'], set: (r) => ({ inst: r.timbre === 'steelpan' ? 1 : r.timbre === 'kalimba' ? 2 : 0 }) },
  harp: { plays: ['harp'], voices: 1, voct: 'voct', gate: 'trig', out: ['out'] },
  gamelan: { plays: ['gamelan'], voices: 1, voct: 'voct', gate: 'trig', out: ['out'] },
}

/** A drum module: which hits it makes, on which trigger inputs. */
export interface DrumVoice {
  hits: Partial<Record<Hit, string>>
  out: string
  /** Params to set; `decay` maps a requested decay (seconds) onto the module. */
  set?: Record<string, number>
  decay?: (hit: Hit, s: number) => Record<string, number>
}

export const DRUM_VOICES: Record<string, DrumVoice> = {
  kick: { hits: { bd: 'trig' }, out: 'out', set: { decay: 0.5, punch: 0.6 }, decay: (_, s) => ({ decay: Math.max(0.05, Math.min(2, s)) }) },
  snare: { hits: { sd: 'trig' }, out: 'out', decay: (_, s) => ({ decay: Math.max(0.05, Math.min(0.6, s)) }) },
  clap: { hits: { cp: 'trig' }, out: 'out', decay: (_, s) => ({ decay: Math.max(0.05, Math.min(1, s)) }) },
  tom: { hits: { tom: 'trig' }, out: 'out', decay: (_, s) => ({ decay: Math.max(0.05, Math.min(1.5, s)) }) },
  hats: {
    hits: { ch: 'ch', oh: 'oh' },
    out: 'mix',
    set: { chd: 0.04 },
    decay: (h, s): Record<string, number> => (h === 'ch' ? { chd: Math.max(0.01, Math.min(0.25, s)) } : { ohd: Math.max(0.1, Math.min(2, s)) }),
  },
  perc: { hits: { rim: 'rim', cym: 'bell' }, out: 'mix', decay: (h, s): Record<string, number> => (h === 'cym' ? { bdecay: Math.max(0.05, Math.min(1, s)) } : {}) },
}
