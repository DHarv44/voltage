import { numeric } from './mini'
import { Pattern, signal, timeToRand } from './pattern'

/** What the evaluator can hold: numbers, strings, arrays, objects, functions, patterns. */
export type Val = number | string | boolean | Val[] | { [k: string]: Val } | Pattern | Fn | null | undefined
export type Fn = (...args: Val[]) => Val

export const num = (x: Val, d = 0): number => (typeof x === 'number' ? x : typeof x === 'string' ? Number(x) || d : d)

/** A weighted pick: pairs of [value, weight]. */
export function weighted(pairs: Val[], r: number): Val {
  let total = 0
  for (const p of pairs) total += Array.isArray(p) ? num(p[1], 1) : 1
  let acc = 0
  for (const p of pairs) {
    acc += Array.isArray(p) ? num(p[1], 1) : 1
    if (r * total < acc) return Array.isArray(p) ? p[0] : p
  }
  return Array.isArray(pairs[0]) ? pairs[0][0] : pairs[0]
}

const frac = (t: number) => ((t % 1) + 1) % 1

/** The continuous signals and random sources Strudel names at top level. */
export function signals(): Record<string, Val> {
  return {
    sine: signal((t) => (Math.sin(2 * Math.PI * t) + 1) / 2),
    sine2: signal((t) => Math.sin(2 * Math.PI * t)),
    cosine: signal((t) => (Math.cos(2 * Math.PI * t) + 1) / 2),
    cosine2: signal((t) => Math.cos(2 * Math.PI * t)),
    saw: signal(frac),
    saw2: signal((t) => frac(t) * 2 - 1),
    isaw: signal((t) => 1 - frac(t)),
    isaw2: signal((t) => 1 - frac(t) * 2),
    tri: signal((t) => 1 - Math.abs(frac(t) - 0.5) * 2),
    tri2: signal((t) => 1 - Math.abs(frac(t) - 0.5) * 4),
    square: signal((t) => (frac(t) < 0.5 ? 0 : 1)),
    square2: signal((t) => (frac(t) < 0.5 ? -1 : 1)),
    time: signal((t) => t),
    rand: signal((t) => timeToRand(t)),
    rand2: signal((t) => timeToRand(t) * 2 - 1),
    brand: signal((t) => (timeToRand(t) < 0.5 ? 0 : 1)),
    brandBy: (p: Val) => signal((t) => (timeToRand(t) < num(p, 0.5) ? 1 : 0)),
    perlin: signal((t) => {
      const a = timeToRand(Math.floor(t))
      const b = timeToRand(Math.floor(t) + 1)
      const f = t - Math.floor(t)
      return a + (b - a) * f * f * (3 - 2 * f)
    }),
    irand: (n: Val) => signal((t) => Math.floor(timeToRand(t) * num(n, 8))),
    signal: (f: Val) => signal((t) => (typeof f === 'function' ? num(f(t)) : 0)),
    choose: (...xs: Val[]) => signal((t) => timeToRand(t)).withValue((v) => ({ value: numeric(String(xs[Math.floor(Number(v.value) * xs.length)] ?? '')) })),
    wchoose: (...pairs: Val[]) => signal((t) => timeToRand(t)).withValue((v) => ({ value: numeric(String(weighted(pairs, Number(v.value)))) })),
  }
}
