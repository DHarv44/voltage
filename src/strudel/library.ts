import { mini, numeric, patterned } from './mini'
import { noteToMidi, scaleNote } from './music'
import { arrange, euclid, fastcat, Pattern, pure, signal, silence, slowcat, stack, timeToRand, type Value } from './pattern'

/** What the evaluator can hold: numbers, strings, arrays, functions, patterns. */
export type Val = number | string | boolean | Val[] | Pattern | Fn | null | undefined
export type Fn = (...args: Val[]) => Val

/** Anything a function is given, as a pattern: a string is mini-notation,
 *  a number or name is constant, an array a sequence. */
export function toPattern(x: Val): Pattern {
  if (x instanceof Pattern) return x
  if (typeof x === 'string') return mini(x)
  if (typeof x === 'number' || typeof x === 'boolean') return pure({ value: Number(x) })
  if (Array.isArray(x)) return fastcat(x.map(toPattern))
  return silence
}

/** A step of a boolean pattern that plays: x, t, true, or any nonzero number. */
const isHit = (x: number | string | undefined): boolean => x === 'x' || x === 't' || x === 'true' || (typeof x === 'number' && x !== 0)
const num = (x: Val, d = 0): number => (typeof x === 'number' ? x : typeof x === 'string' ? Number(x) || d : d)

/** The value a raw mini atom carries, for a control: notes become MIDI numbers under `note`. */
function controlValue(name: string, raw: number | string): number | string {
  if (name === 'note' && typeof raw === 'string') {
    const m = noteToMidi(raw)
    return Number.isFinite(m) ? m : raw
  }
  if (name === 's' && typeof raw === 'number') return String(raw)
  return raw
}

/** Control names (and aliases) that set a value on each event. */
export const CONTROLS: Record<string, string> = {
  s: 's',
  sound: 's',
  n: 'n',
  note: 'note',
  gain: 'gain',
  velocity: 'velocity',
  vel: 'velocity',
  pan: 'pan',
  lpf: 'lpf',
  cutoff: 'lpf',
  ctf: 'lpf',
  lp: 'lpf',
  hpf: 'hpf',
  hcutoff: 'hpf',
  hp: 'hpf',
  bpf: 'bpf',
  lpq: 'lpq',
  resonance: 'lpq',
  hpq: 'hpq',
  room: 'room',
  size: 'size',
  roomsize: 'size',
  delay: 'delay',
  delaytime: 'delaytime',
  delayfeedback: 'delayfb',
  delayfb: 'delayfb',
  attack: 'attack',
  att: 'attack',
  decay: 'decay',
  dec: 'decay',
  sustain: 'sustain',
  sus: 'sustain',
  release: 'release',
  rel: 'release',
  shape: 'shape',
  distort: 'shape',
  crush: 'crush',
  coarse: 'coarse',
  speed: 'speed',
  bank: 'bank',
  legato: 'legato',
  clip: 'legato',
  vowel: 'vowel',
  fm: 'fm',
  fmh: 'fmh',
  vib: 'vib',
  vibmod: 'vibmod',
  detune: 'detune',
  unison: 'unison',
  phaser: 'phaser',
  orbit: 'orbit',
  channel: 'channel',
  begin: 'begin',
  end: 'end',
  cut: 'cut',
  accelerate: 'accelerate',
  postgain: 'postgain',
  compressor: 'compressor',
  duck: 'duck',
}

/** `gain(x)` on its own makes a pattern of that control; `pat.gain(x)` sets it on pat's events. */
export function control(name: string, pat: Pattern | null, arg: Val): Pattern {
  const argPat = toPattern(arg)
  const key = CONTROLS[name]
  if (!pat) return argPat.withValue((v) => ({ [key]: controlValue(key, v.value ?? '') }))
  return pat.setFrom(argPat, (v, a) => ({ ...v, [key]: controlValue(key, a.value ?? '') }))
}

/** Scale degrees (`n`) to notes. */
function applyScale(pat: Pattern, arg: Val): Pattern {
  return pat.setFrom(toPattern(arg).withValue((v) => ({ value: v.value })), (v, a) => (v.n === undefined ? v : { ...v, note: scaleNote(Number(v.n), String(a.value)) }))
}

const numArg = (x: Val) => toPattern(x)

/** Methods on patterns: transforms. Each takes the pattern then the call's arguments. */
export const METHODS: Record<string, (pat: Pattern, args: Val[], apply: (f: Val, p: Pattern) => Pattern) => Pattern> = {
  fast: (p, [k]) => patterned(numArg(k), (x) => p.fast(x)),
  hurry: (p, [k]) => patterned(numArg(k), (x) => p.fast(x).withValue((v) => ({ ...v, speed: num(v.speed, 1) * x }))),
  slow: (p, [k]) => patterned(numArg(k), (x) => p.slow(x)),
  late: (p, [k]) => patterned(numArg(k), (x) => p.late(x)),
  early: (p, [k]) => patterned(numArg(k), (x) => p.early(x)),
  rev: (p) => p.rev(),
  ply: (p, [k]) => patterned(numArg(k), (x) => p.ply(x)),
  struct: (p, [b]) => p.struct(toPattern(b).withValue((v) => ({ value: isHit(v.value) ? 1 : 0 }))),
  mask: (p, [b]) => p.mask(toPattern(b).withValue((v) => ({ value: isHit(v.value) ? 1 : 0 }))),
  euclid: (p, [k, n, r]) => patterned(numArg(k), (kk) => patterned(numArg(n), (nn) => patterned(numArg(r ?? 0), (rr) => p.struct(fastcat(euclidBools(kk, nn, rr)))))),
  euclidRot: (p, [k, n, r]) => METHODS.euclid(p, [k, n, r], () => p),
  every: (p, [n, f], apply) => patterned(numArg(n), (k) => Pattern.perCycle((c, b, e) => (k > 0 && ((c % k) + k) % k === 0 ? apply(f, p) : p).query(b, e))),
  firstOf: (p, a, apply) => METHODS.every(p, a, apply),
  lastOf: (p, [n, f], apply) => patterned(numArg(n), (k) => Pattern.perCycle((c, b, e) => (k > 0 && ((c % k) + k) % k === k - 1 ? apply(f, p) : p).query(b, e))),
  sometimesBy: (p, [x, f], apply) => sometimes(p, num(x, 0.5), f, apply),
  sometimes: (p, [f], apply) => sometimes(p, 0.5, f, apply),
  often: (p, [f], apply) => sometimes(p, 0.75, f, apply),
  rarely: (p, [f], apply) => sometimes(p, 0.25, f, apply),
  almostNever: (p, [f], apply) => sometimes(p, 0.1, f, apply),
  almostAlways: (p, [f], apply) => sometimes(p, 0.9, f, apply),
  always: (p, [f], apply) => apply(f, p),
  never: (p) => p,
  someCyclesBy: (p, [x, f], apply) => Pattern.perCycle((c, b, e) => (timeToRand(c + 0.5) < num(x, 0.5) ? apply(f, p) : p).query(b, e)),
  someCycles: (p, [f], apply) => METHODS.someCyclesBy(p, [0.5, f], apply),
  degradeBy: (p, [x]) => p.filterHaps((h) => timeToRand(h.b + 0.0001) >= num(x, 0.5)),
  degrade: (p) => p.filterHaps((h) => timeToRand(h.b + 0.0001) >= 0.5),
  undegradeBy: (p, [x]) => p.filterHaps((h) => timeToRand(h.b + 0.0001) < num(x, 0.5)),
  off: (p, [t, f], apply) => stack([p, apply(f, patterned(numArg(t), (x) => p.late(x)))]),
  superimpose: (p, [f], apply) => stack([p, apply(f, p)]),
  layer: (p, fs, apply) => stack(fs.map((f) => apply(f, p))),
  jux: (p, [f], apply) => stack([p.withValue((v) => ({ ...v, pan: 0 })), apply(f, p).withValue((v) => ({ ...v, pan: 1 }))]),
  add: (p, [x]) => p.setFrom(numArg(x), (v, a) => addTo(v, Number(a.value))),
  sub: (p, [x]) => p.setFrom(numArg(x), (v, a) => addTo(v, -Number(a.value))),
  mul: (p, [x]) => p.setFrom(numArg(x), (v, a) => ({ ...v, value: Number(v.value) * Number(a.value) })),
  range: (p, [lo, hi]) => p.withValue((v) => ({ ...v, value: num(lo) + Number(v.value) * (num(hi, 1) - num(lo)) })),
  rangex: (p, [lo, hi]) => p.withValue((v) => ({ ...v, value: num(lo, 1) * Math.pow(num(hi, 1) / num(lo, 1), Number(v.value)) })),
  segment: (p, [n]) => patterned(numArg(n), (k) => p.struct(fastcat(Array.from({ length: Math.max(1, Math.round(k)) }, () => pure({ value: 1 }))))),
  scale: (p, [s]) => applyScale(p, s),
  transpose: (p, [x]) => p.setFrom(numArg(x), (v, a) => addTo(v, Number(a.value))),
  linger: (p, [x]) => patterned(numArg(x), (k) => Pattern.perCycle((c, b, e) => p.compress(0, k).fast(1 / k).query(b, e)).compress(0, 1)),
  chunk: (p, [n, f], apply) => patterned(numArg(n), (k) => Pattern.perCycle((c, b, e) => { const i = ((c % k) + k) % k; return stack([p.mask(fastcat(Array.from({ length: k }, (_, j) => pure({ value: j === i ? 0 : 1 })))), apply(f, p).mask(fastcat(Array.from({ length: k }, (_, j) => pure({ value: j === i ? 1 : 0 }))))]).query(b, e) })),
  iter: (p, [n]) => patterned(numArg(n), (k) => Pattern.perCycle((c, b, e) => p.early((((c % k) + k) % k) / k).query(b, e))),
  palindrome: (p) => slowcat([p, p.rev()]),
  brak: (p) => Pattern.perCycle((c, b, e) => (c % 2 ? fastcat([p, silence]).late(0.25) : p).query(b, e)),
  swingBy: (p, [x, n]) => swingBy(p, num(x, 1 / 3), num(n, 4)),
  swing: (p, [n]) => swingBy(p, 1 / 3, num(n, 4)),
  legato: (p, [x]) => control('legato', p, x),
  clip: (p, [x]) => control('legato', p, x),
  voicing: (p) => p,
  pianoroll: (p) => p,
  _pianoroll: (p) => p,
  punchcard: (p) => p,
  color: (p) => p,
  log: (p) => p,
  midi: (p) => p,
  osc: (p) => p,
  hush: () => silence,
}

function euclidBools(k: number, n: number, r: number): Pattern[] {
  return euclid(k, n, r).map((h) => pure({ value: h ? 1 : 0 }))
}

/** Swing: within each of n slices of the cycle, events in the second half land x of a slice late. */
function swingBy(p: Pattern, x: number, n: number): Pattern {
  const d = x / n
  return new Pattern((b, e) =>
    p
      .query(b - d, e)
      .map((h) => {
        const frac = (((h.b * n) % 1) + 1) % 1
        return frac >= 0.5 - 1e-6 ? { ...h, b: h.b + d, e: h.e + d, pb: h.pb + d, pe: h.pe + d } : h
      })
      .filter((h) => h.pe > b && h.pb < e)
      .map((h) => ({ ...h, pb: Math.max(h.pb, b), pe: Math.min(h.pe, e) })),
  )
}

function sometimes(p: Pattern, x: number, f: Val, apply: (f: Val, p: Pattern) => Pattern): Pattern {
  const keep = p.filterHaps((h) => timeToRand(h.b + 0.0001) >= x)
  const changed = apply(
    f,
    p.filterHaps((h) => timeToRand(h.b + 0.0001) < x),
  )
  return stack([keep, changed])
}

/** Add to whatever a value is: a note, a scale degree, or a plain number. */
function addTo(v: Value, d: number): Value {
  if (v.note !== undefined) return { ...v, note: Number(v.note) + d }
  if (v.n !== undefined) return { ...v, n: Number(v.n) + d }
  return { ...v, value: Number(v.value) + d }
}

/** Top-level names: pattern makers and signals. */
export function globals(): Record<string, Val> {
  const g: Record<string, Val> = {
    silence,
    stack: (...xs: Val[]) => stack(xs.map(toPattern)),
    cat: (...xs: Val[]) => slowcat(xs.map(toPattern)),
    slowcat: (...xs: Val[]) => slowcat(xs.map(toPattern)),
    fastcat: (...xs: Val[]) => fastcat(xs.map(toPattern)),
    seq: (...xs: Val[]) => fastcat(xs.map(toPattern)),
    sequence: (...xs: Val[]) => fastcat(xs.map(toPattern)),
    arrange: (...xs: Val[]) => arrange(xs.map((x) => (Array.isArray(x) ? [num(x[0], 1), toPattern(x[1])] : [1, toPattern(x)]) as [number, Pattern])),
    pure: (x: Val) => toPattern(x),
    mini: (x: Val) => toPattern(x),
    m: (x: Val) => toPattern(x),
    run: (n: Val) => fastcat(Array.from({ length: Math.max(1, Math.round(num(n, 1))) }, (_, i) => pure({ value: i }))),
    sine: signal((t) => (Math.sin(2 * Math.PI * t) + 1) / 2),
    cosine: signal((t) => (Math.cos(2 * Math.PI * t) + 1) / 2),
    saw: signal((t) => t - Math.floor(t)),
    isaw: signal((t) => 1 - (t - Math.floor(t))),
    tri: signal((t) => 1 - Math.abs(((t % 1) + 1) % 1 - 0.5) * 2),
    square: signal((t) => (((t % 1) + 1) % 1 < 0.5 ? 0 : 1)),
    rand: signal((t) => timeToRand(t)),
    perlin: signal((t) => {
      const a = timeToRand(Math.floor(t))
      const b = timeToRand(Math.floor(t) + 1)
      const f = t - Math.floor(t)
      const s = f * f * (3 - 2 * f)
      return a + (b - a) * s
    }),
    irand: (n: Val) => signal((t) => Math.floor(timeToRand(t) * num(n, 8))),
    choose: (...xs: Val[]) => signal((t) => timeToRand(t)).withValue((v) => ({ value: numeric(String(xs[Math.floor(Number(v.value) * xs.length)] ?? '')) })),
  }
  for (const name of Object.keys(CONTROLS)) g[name] = (x: Val) => control(name, null, x)
  return g
}
