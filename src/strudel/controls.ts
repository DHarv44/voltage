import { mini } from './mini'
import { noteToMidi } from './music'
import { Pattern, type Value } from './pattern'

/** Every control name Strudel documents (and its aliases) → the key we store.
 *  Stored even when nothing in the rack uses it yet, so pieces run unchanged. */
const ALIASES: Record<string, string[]> = {
  s: ['s', 'sound'],
  n: ['n'],
  note: ['note'],
  freq: ['freq'],
  gain: ['gain'],
  velocity: ['velocity', 'vel'],
  postgain: ['postgain'],
  pan: ['pan'],
  lpf: ['lpf', 'cutoff', 'ctf', 'lp'],
  lpq: ['lpq', 'resonance'],
  hpf: ['hpf', 'hcutoff', 'hp'],
  hpq: ['hpq', 'hresonance'],
  bpf: ['bpf', 'bandf', 'bp'],
  bpq: ['bpq', 'bandq'],
  ftype: ['ftype'],
  vowel: ['vowel'],
  lpattack: ['lpattack', 'lpa'],
  lpdecay: ['lpdecay', 'lpd'],
  lpsustain: ['lpsustain', 'lps'],
  lprelease: ['lprelease', 'lpr'],
  lpenv: ['lpenv', 'lpe'],
  hpattack: ['hpattack', 'hpa'],
  hpdecay: ['hpdecay', 'hpd'],
  hpsustain: ['hpsustain', 'hps'],
  hprelease: ['hprelease', 'hpr'],
  hpenv: ['hpenv', 'hpe'],
  bpattack: ['bpattack', 'bpa'],
  bpdecay: ['bpdecay', 'bpd'],
  bpsustain: ['bpsustain', 'bps'],
  bprelease: ['bprelease', 'bpr'],
  bpenv: ['bpenv', 'bpe'],
  attack: ['attack', 'att'],
  decay: ['decay', 'dec'],
  sustain: ['sustain', 'sus'],
  release: ['release', 'rel'],
  adsr: ['adsr'],
  penv: ['penv'],
  pattack: ['pattack', 'patt'],
  pdecay: ['pdecay', 'pdec'],
  prelease: ['prelease', 'prel'],
  pcurve: ['pcurve'],
  panchor: ['panchor'],
  compressor: ['compressor'],
  xfade: ['xfade'],
  coarse: ['coarse'],
  crush: ['crush'],
  shape: ['shape'],
  distort: ['distort', 'dist'],
  tremolo: ['tremolo', 'trem'],
  tremolosync: ['tremolosync', 'tremsync'],
  tremolodepth: ['tremolodepth', 'tremdepth'],
  tremoloskew: ['tremoloskew', 'tremskew'],
  tremolophase: ['tremolophase', 'tremphase'],
  tremoloshape: ['tremoloshape', 'tremshape'],
  vib: ['vib', 'vibrato', 'v'],
  vibmod: ['vibmod', 'vmod'],
  orbit: ['orbit', 'o'],
  delay: ['delay'],
  delaytime: ['delaytime', 'delayt', 'dt'],
  delayfb: ['delayfeedback', 'delayfb', 'dfb'],
  room: ['room'],
  size: ['roomsize', 'rsize', 'sz', 'size'],
  roomfade: ['roomfade', 'rfade'],
  roomlp: ['roomlp', 'rlp'],
  roomdim: ['roomdim', 'rdim'],
  iresponse: ['iresponse', 'ir'],
  phaser: ['phaser', 'ph'],
  phaserdepth: ['phaserdepth', 'phd', 'phasdp'],
  phasercenter: ['phasercenter', 'phc'],
  phasersweep: ['phasersweep', 'phs'],
  duck: ['duckorbit', 'duck'],
  duckattack: ['duckattack', 'duckatt', 'datt'],
  duckdepth: ['duckdepth'],
  speed: ['speed'],
  accelerate: ['accelerate'],
  begin: ['begin'],
  end: ['end'],
  loop: ['loop'],
  loopBegin: ['loopBegin', 'loopb'],
  loopEnd: ['loopEnd', 'loope'],
  cut: ['cut'],
  legato: ['legato', 'clip'],
  fm: ['fm', 'fmi'],
  fmh: ['fmh'],
  fmattack: ['fmattack', 'fmatt'],
  fmdecay: ['fmdecay', 'fmdec'],
  fmsustain: ['fmsustain', 'fmsus'],
  fmenv: ['fmenv'],
  partials: ['partials'],
  phases: ['phases'],
  noise: ['noise'],
  density: ['density'],
  pw: ['pw'],
  unison: ['unison'],
  detune: ['detune'],
  spread: ['spread'],
  bank: ['bank'],
  channel: ['channel'],
  dry: ['dry'],
  zrand: ['zrand'],
  zmod: ['zmod'],
  zcrush: ['zcrush'],
  zdelay: ['zdelay'],
  curve: ['curve'],
  slide: ['slide'],
  deltaSlide: ['deltaSlide'],
  pitchJump: ['pitchJump'],
  pitchJumpTime: ['pitchJumpTime'],
  lfo: ['lfo'],
  color: ['color'],
}

/** Alias → stored key. */
export const CONTROLS: Record<string, string> = {}
for (const [key, names] of Object.entries(ALIASES)) for (const name of names) CONTROLS[name] = key

/** Controls whose mini value may carry extra fields after colons. */
const COMPOUND: Record<string, string[]> = {
  s: ['s', 'n'],
  lpf: ['lpf', 'lpq'],
  hpf: ['hpf', 'hpq'],
  bpf: ['bpf', 'bpq'],
  delay: ['delay', 'delaytime', 'delayfb'],
  room: ['room', 'size'],
  adsr: ['attack', 'decay', 'sustain', 'release'],
  distort: ['distort', 'postgain'],
  vib: ['vib', 'vibmod'],
  compressor: ['compressor'],
  duck: ['duck'],
}

const numeric = (s: string): number | string => {
  const n = Number(s)
  return s !== '' && Number.isFinite(n) ? n : s
}

/** The fields one raw mini value sets for a control. */
function fields(key: string, raw: number | string): Value {
  if (key === 'note') {
    if (typeof raw === 'string') {
      const m = noteToMidi(raw)
      return { note: Number.isFinite(m) ? m : raw }
    }
    return { note: raw }
  }
  const parts = COMPOUND[key]
  if (parts && typeof raw === 'string' && raw.includes(':')) {
    const out: Value = {}
    raw.split(':').forEach((p, i) => {
      if (i < parts.length && p !== '') out[parts[i]] = key === 's' && i === 0 ? p : numeric(p)
    })
    return out
  }
  if (key === 's') return { s: String(raw) }
  return { [key]: raw }
}

/** Anything a control is given, as a pattern of raw values. */
export function argPattern(x: unknown): Pattern {
  if (x instanceof Pattern) return x
  if (typeof x === 'string') return mini(x)
  if (typeof x === 'number' || typeof x === 'boolean') return pureValue(Number(x))
  if (Array.isArray(x)) return mini(x.map((v) => String(v)).join(' '))
  return new Pattern(() => [])
}
const pureValue = (v: number) => Pattern.perCycle((c, b, e) => [{ b: c, e: c + 1, pb: b, pe: e, v: { value: v } }])

/** `gain(x)` alone: a pattern of that control. `pat.gain(x)`: the control set
 *  on pat's events from x at each onset (a stacked x layers the event). */
export function control(name: string, pat: Pattern | null, arg: unknown): Pattern {
  const key = CONTROLS[name]
  const a = argPattern(arg)
  if (!pat) return a.withValue((v) => fields(key, v.value ?? ''))
  return pat.setFrom(a, (v, x) => ({ ...v, ...fields(key, x.value ?? '') }))
}
