import type { ModuleSpec, ParamSpec } from './types'

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Knob position (0..1) for a parameter value. */
export function toNorm(p: ParamSpec, v: number): number {
  if (p.curve === 'exp') return clamp01(Math.log(v / p.min) / Math.log(p.max / p.min))
  return clamp01((v - p.min) / (p.max - p.min))
}

/** Parameter value for a knob position (0..1). */
export function fromNorm(p: ParamSpec, n: number): number {
  n = clamp01(n)
  const v = p.curve === 'exp' ? p.min * Math.pow(p.max / p.min, n) : p.min + n * (p.max - p.min)
  return p.stepped ? Math.round(v) : v
}

export function defaultParams(spec: ModuleSpec): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of spec.params) out[p.id] = p.def
  return out
}

export function formatParam(p: ParamSpec, v: number): string {
  if (p.options) return p.options[Math.round(v - p.min)] ?? String(v)
  switch (p.unit) {
    case 'Hz':
      return v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${v.toFixed(v < 10 ? 2 : 0)} Hz`
    case 's':
    case 's/scr':
      return v < 1 ? `${(v * 1000).toFixed(v < 0.01 ? 1 : 0)} ms` : `${v.toFixed(2)} s`
    case 'oct':
      return `${v >= 0 ? '+' : ''}${v.toFixed(2)} oct`
    case 'st':
      // a fine-tune knob (±1 semitone) reads in cents; anything wider in semitones
      if (p.stepped || p.max - p.min > 2) return `${v >= 0 ? '+' : ''}${p.stepped ? Math.round(v) : v.toFixed(1)} st`
      return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)} ct`
    case '%':
      return `${(v * 100).toFixed(0)}%`
    case 'x':
      return `×${v.toFixed(2)}`
    case 'V':
      return `${v.toFixed(2)} V`
    case 'dB':
      return `${v > 0 && p.min < 0 ? '+' : ''}${v.toFixed(1)} dB`
    case 'V/div':
      return `${v.toFixed(2)} V/div`
    case 'bpm':
      return `${v.toFixed(v < 100 ? 1 : 0)} BPM`
    default:
      return p.stepped ? `${v >= 0 && p.min < 0 ? '+' : ''}${v}` : v.toFixed(2)
  }
}
