import { CONTROLS, control } from './controls'
import { num, signals, weighted, type Fn, type Val } from './globals'
import { mini, patterned } from './mini'
import { chordNotes, scaleNote } from './music'
import { arrange, euclid, fastcat, Pattern, pure, silence, slowcat, stack, timecat, timeToRand, type Hap, type Value } from './pattern'

type Apply = (f: Val, p: Pattern) => Pattern

export { CONTROLS, control }
export type { Fn, Val }

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
const bools = (x: Val) => toPattern(x).withValue((v) => ({ value: isHit(v.value) ? 1 : 0 }))
const rnd = (h: Hap) => timeToRand(h.b + 0.0001)

/** Add to whatever a value is: a note, a scale degree, or a plain number. */
function addTo(v: Value, d: number): Value {
  if (v.note !== undefined) return { ...v, note: Number(v.note) + d }
  if (v.n !== undefined) return { ...v, n: Number(v.n) + d }
  return { ...v, value: Number(v.value) + d }
}

/** Scale degrees (`n`) to notes; the scale is kept for scaleTranspose. */
function applyScale(pat: Pattern, arg: Val): Pattern {
  return pat.setFrom(toPattern(arg), (v, a) => {
    const scale = String(a.value)
    return v.n === undefined ? { ...v, scale } : { ...v, scale, note: scaleNote(Number(v.n), scale) }
  })
}

function sometimes(p: Pattern, x: number, f: Val, apply: Apply): Pattern {
  return stack([p.filterHaps((h) => rnd(h) >= x), apply(f, p.filterHaps((h) => rnd(h) < x))])
}

/** Apply f where the boolean pattern is true, the pattern itself elsewhere. */
function when(p: Pattern, bool: Pattern, f: Val, apply: Apply): Pattern {
  const changed = apply(f, p)
  return new Pattern((b, e) => {
    const out: Hap[] = []
    for (const m of bool.query(b, e)) for (const h of (isHit(m.v.value) ? changed : p).query(m.pb, m.pe)) out.push(h)
    return out
  })
}

/** Swing: within each of n slices of the cycle, events in the second half land x of a half-slice late. */
function swingBy(p: Pattern, x: number, n: number): Pattern {
  const d = x / (n * 2)
  return new Pattern((b, e) =>
    p
      .query(b - d, e)
      .map((h) => ((((h.b * n) % 1) + 1) % 1 >= 0.5 - 1e-6 ? { ...h, b: h.b + d, e: h.e + d, pb: h.pb + d, pe: h.pe + d } : h))
      .filter((h) => h.pe > b && h.pb < e)
      .map((h) => ({ ...h, pb: Math.max(h.pb, b), pe: Math.min(h.pe, e) })),
  )
}

/** Each cycle's n parts in a random order (shuffle: each once; scramble: picked with replacement). */
function shuffled(p: Pattern, n: number, replace: boolean): Pattern {
  const k = Math.max(1, Math.round(n))
  return Pattern.perCycle((c, b, e) => {
    const order = Array.from({ length: k }, (_, i) => i)
    if (replace) for (let i = 0; i < k; i++) order[i] = Math.floor(timeToRand(c + i * 0.01 + 0.0001) * k)
    else for (let i = k - 1; i > 0; i--) {
      const j = Math.floor(timeToRand(c + i * 0.01 + 0.0001) * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    return timecat(order.map((i) => [1, p.zoomPart(i / k, (i + 1) / k)] as [number, Pattern])).query(b, e)
  })
}

/** Each event of `p` picks a pattern from xs by its value and plays one whole cycle of it squeezed into the event. */
function squeeze(p: Pattern, xs: Val, wrap: boolean): Pattern {
  return new Pattern((b, e) => {
    const out: Hap[] = []
    for (const h of p.query(b, e)) {
      if (h.cont) continue
      const inner = pickFrom(xs, Math.round(Number(h.v.value)), wrap)
      if (!inner) continue
      const w = h.e - h.b
      const map = (t: number) => h.b + t * w
      for (const q of inner.query(0, 1)) {
        const pb = Math.max(b, map(q.pb))
        const pe = Math.min(e, map(q.pe))
        if (pe - pb > 1e-9) out.push({ ...q, b: map(q.b), e: map(q.e), pb, pe })
      }
    }
    return out
  })
}

/** Chords stacked at one moment, played one note at a time by an index pattern. */
function arp(p: Pattern, idx: Val): Pattern {
  const ip = toPattern(idx)
  return new Pattern((b, e) => {
    const out: Hap[] = []
    for (const i of ip.query(b, e)) {
      const t = i.b
      const chord = p
        .query(t, t + 1e-6)
        .filter((h) => h.v.note !== undefined || h.v.n !== undefined)
        .sort((x, y) => Number(x.v.note ?? x.v.n) - Number(y.v.note ?? y.v.n))
      if (!chord.length) continue
      const k = Math.round(Number(i.v.value))
      const h = chord[((k % chord.length) + chord.length) % chord.length]
      out.push({ ...h, b: i.b, e: i.e, pb: i.pb, pe: i.pe })
    }
    return out
  })
}

const pickFrom = (xs: Val, i: number, wrap: boolean): Pattern | null => {
  if (Array.isArray(xs)) {
    if (!xs.length) return null
    const k = wrap ? ((i % xs.length) + xs.length) % xs.length : Math.max(0, Math.min(xs.length - 1, i))
    return toPattern(xs[k])
  }
  return null
}

/** Methods on patterns. Each takes the pattern, the call's arguments, and a way to apply a function argument. */
export const METHODS: Record<string, (pat: Pattern, args: Val[], apply: Apply) => Pattern> = {
  fast: (p, [k]) => patterned(toPattern(k), (x) => p.fast(x)),
  density: (p, a, ap) => METHODS.fast(p, a, ap),
  hurry: (p, [k]) => patterned(toPattern(k), (x) => p.fast(x).withValue((v) => ({ ...v, speed: num(v.speed, 1) * x }))),
  slow: (p, [k]) => patterned(toPattern(k), (x) => p.slow(x)),
  sparsity: (p, a, ap) => METHODS.slow(p, a, ap),
  late: (p, [k]) => patterned(toPattern(k), (x) => p.late(x)),
  early: (p, [k]) => patterned(toPattern(k), (x) => p.early(x)),
  rev: (p) => p.rev(),
  palindrome: (p) => slowcat([p, p.rev()]),
  iter: (p, [n]) => patterned(toPattern(n), (k) => Pattern.perCycle((c, b, e) => p.early((((c % k) + k) % k) / k).query(b, e))),
  iterBack: (p, [n]) => patterned(toPattern(n), (k) => Pattern.perCycle((c, b, e) => p.late((((c % k) + k) % k) / k).query(b, e))),
  iterback: (p, a, ap) => METHODS.iterBack(p, a, ap),
  ply: (p, [k]) => patterned(toPattern(k), (x) => p.ply(x)),
  segment: (p, [n]) => patterned(toPattern(n), (k) => p.struct(fastcat(Array.from({ length: Math.max(1, Math.round(k)) }, () => pure({ value: 1 }))))),
  seg: (p, a, ap) => METHODS.segment(p, a, ap),
  compress: (p, [s, e]) => p.compress(num(s), num(e, 1)),
  compressSpan: (p, a, ap) => METHODS.compress(p, a, ap),
  zoom: (p, [s, e]) => p.zoomPart(num(s), num(e, 1)),
  zoomArc: (p, a, ap) => METHODS.zoom(p, a, ap),
  linger: (p, [x]) => patterned(toPattern(x), (k) => (k === 0 ? silence : fastcat(Array.from({ length: Math.round(1 / Math.min(1, Math.abs(k))) }, () => p.zoomPart(0, Math.min(1, Math.abs(k))))))),
  fastGap: (p, [k]) => patterned(toPattern(k), (x) => p.compress(0, 1 / Math.max(1e-6, x))),
  fastgap: (p, a, ap) => METHODS.fastGap(p, a, ap),
  inside: (p, [n, f], apply) => apply(f, p.slow(num(n, 1))).fast(num(n, 1)),
  outside: (p, [n, f], apply) => apply(f, p.fast(num(n, 1))).slow(num(n, 1)),
  cpm: (p, [x]) => p.fast(num(x, 30) / 30),
  ribbon: (p, [o, n]) => Pattern.perCycle((c, b, e) => {
    const k = Math.max(1e-6, num(n, 1))
    const off = num(o) + (((c % k) + k) % k) - c
    return p.query(b + off, e + off).map((h) => ({ ...h, b: h.b - off, e: h.e - off, pb: h.pb - off, pe: h.pe - off }))
  }),
  rib: (p, a, ap) => METHODS.ribbon(p, a, ap),
  swingBy: (p, [x, n]) => swingBy(p, num(x, 1 / 3), num(n, 4)),
  swing: (p, [n]) => swingBy(p, 1 / 3, num(n, 4)),
  struct: (p, [b]) => p.struct(bools(b)),
  mask: (p, [b]) => p.mask(bools(b)),
  euclid: (p, [k, n, r]) => patterned(toPattern(k), (kk) => patterned(toPattern(n), (nn) => patterned(toPattern(r ?? 0), (rr) => p.struct(fastcat(euclid(kk, nn, rr).map((h) => pure({ value: h ? 1 : 0 }))))))),
  euclidRot: (p, a, ap) => METHODS.euclid(p, a, ap),
  euclidrot: (p, a, ap) => METHODS.euclid(p, a, ap),
  euclidLegato: (p, [k, n, r]) =>
    patterned(toPattern(k), (kk) =>
      patterned(toPattern(n), (nn) => {
        const hits = euclid(kk, nn, num(r))
        const steps: [number, Pattern][] = []
        hits.forEach((h, i) => {
          if (h) steps.push([1, pure({ value: 1 })])
          else if (steps.length) steps[steps.length - 1][0]++
          else steps.push([1, silence])
        })
        return p.struct(timecat(steps))
      }),
    ),
  every: (p, [n, f], apply) => patterned(toPattern(n), (k) => Pattern.perCycle((c, b, e) => (k > 0 && ((c % k) + k) % k === 0 ? apply(f, p) : p).query(b, e))),
  firstOf: (p, a, apply) => METHODS.every(p, a, apply),
  lastOf: (p, [n, f], apply) => patterned(toPattern(n), (k) => Pattern.perCycle((c, b, e) => (k > 0 && ((c % k) + k) % k === k - 1 ? apply(f, p) : p).query(b, e))),
  when: (p, [b, f], apply) => when(p, toPattern(b), f, apply),
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
  degradeBy: (p, [x]) => p.filterHaps((h) => rnd(h) >= num(x, 0.5)),
  degrade: (p) => p.filterHaps((h) => rnd(h) >= 0.5),
  undegradeBy: (p, [x]) => p.filterHaps((h) => rnd(h) < num(x, 0.5)),
  undegrade: (p) => p.filterHaps((h) => rnd(h) < 0.5),
  shuffle: (p, [n]) => shuffled(p, num(n, 4), false),
  scramble: (p, [n]) => shuffled(p, num(n, 4), true),
  chunk: (p, [n, f], apply) => patterned(toPattern(n), (k) => Pattern.perCycle((c, b, e) => chunkAt(p, k, ((c % k) + k) % k, f, apply).query(b, e))),
  slowChunk: (p, a, ap) => METHODS.chunk(p, a, ap),
  slowchunk: (p, a, ap) => METHODS.chunk(p, a, ap),
  fastChunk: (p, a, ap) => METHODS.chunk(p, a, ap),
  fastchunk: (p, a, ap) => METHODS.chunk(p, a, ap),
  chunkBack: (p, [n, f], apply) => patterned(toPattern(n), (k) => Pattern.perCycle((c, b, e) => chunkAt(p, k, k - 1 - (((c % k) + k) % k), f, apply).query(b, e))),
  chunkback: (p, a, ap) => METHODS.chunkBack(p, a, ap),
  off: (p, [t, f], apply) => stack([p, apply(f, patterned(toPattern(t), (x) => p.late(x)))]),
  superimpose: (p, fs, apply) => stack([p, ...fs.map((f) => apply(f, p))]),
  layer: (p, fs, apply) => stack(fs.map((f) => apply(f, p))),
  echo: (p, [n, t, fb]) => stack(Array.from({ length: Math.max(1, Math.round(num(n, 3))) }, (_, i) => p.late(i * num(t, 1 / 8)).withValue((v) => ({ ...v, gain: num(v.gain, 1) * Math.pow(num(fb, 0.5), i) })))),
  stut: (p, [n, fb, t]) => METHODS.echo(p, [n, t, fb], () => p),
  echoWith: (p, [n, t, f]) => stack(Array.from({ length: Math.max(1, Math.round(num(n, 3))) }, (_, i) => (typeof f === 'function' ? (f(p.late(i * num(t, 1 / 8)), i) as Pattern) : p))),
  stutWith: (p, a, ap) => METHODS.echoWith(p, a, ap),
  stutwith: (p, a, ap) => METHODS.echoWith(p, a, ap),
  jux: (p, [f], apply) => stack([p.withValue((v) => ({ ...v, pan: 0 })), apply(f, p).withValue((v) => ({ ...v, pan: 1 }))]),
  juxBy: (p, [x, f], apply) => stack([p.withValue((v) => ({ ...v, pan: 0.5 - num(x, 1) / 2 })), apply(f, p).withValue((v) => ({ ...v, pan: 0.5 + num(x, 1) / 2 }))]),
  juxby: (p, a, ap) => METHODS.juxBy(p, a, ap),
  brak: (p) => Pattern.perCycle((c, b, e) => (((c % 2) + 2) % 2 ? fastcat([p, silence]).late(0.25) : p).query(b, e)),
  inv: (p) => p.withValue((v) => ({ ...v, value: isHit(v.value) ? 0 : 1 })),
  invert: (p, a, ap) => METHODS.inv(p, a, ap),
  add: (p, [x]) => p.setFrom(toPattern(x), (v, a) => addTo(v, Number(a.value))),
  sub: (p, [x]) => p.setFrom(toPattern(x), (v, a) => addTo(v, -Number(a.value))),
  mul: (p, [x]) => p.setFrom(toPattern(x), (v, a) => ({ ...v, value: Number(v.value) * Number(a.value) })),
  div: (p, [x]) => p.setFrom(toPattern(x), (v, a) => ({ ...v, value: Number(v.value) / Number(a.value) })),
  range: (p, [lo, hi]) => p.withValue((v) => ({ ...v, value: num(lo) + Number(v.value) * (num(hi, 1) - num(lo)) })),
  range2: (p, [lo, hi]) => p.withValue((v) => ({ ...v, value: num(lo) + ((Number(v.value) + 1) / 2) * (num(hi, 1) - num(lo)) })),
  rangex: (p, [lo, hi]) => p.withValue((v) => ({ ...v, value: num(lo, 1) * Math.pow(num(hi, 1) / num(lo, 1), Number(v.value)) })),
  scale: (p, [s]) => applyScale(p, s),
  scaleTranspose: (p, [x]) => p.setFrom(toPattern(x), (v, a) => (v.n !== undefined && v.scale !== undefined ? { ...v, n: Number(v.n) + Number(a.value), note: scaleNote(Number(v.n) + Number(a.value), String(v.scale)) } : v)),
  transpose: (p, [x]) => p.setFrom(toPattern(x), (v, a) => addTo(v, Number(a.value))),
  trans: (p, a, ap) => METHODS.transpose(p, a, ap),
  arp: (p, [i]) => arp(p, i),
  voicing: (p) => p.withValue((v) => v),
  rootNotes: (p, [oct]) => p.withValue((v) => (v.chord !== undefined ? { ...v, note: chordNotes(String(v.chord), num(oct, 2))[0] } : v)),
  pick: (p, [xs]) => new Pattern((b, e) => p.query(b, e).flatMap((h) => pickFrom(xs, Math.round(Number(h.v.value)), false)?.query(h.pb, h.pe) ?? [])),
  pickmod: (p, [xs]) => new Pattern((b, e) => p.query(b, e).flatMap((h) => pickFrom(xs, Math.round(Number(h.v.value)), true)?.query(h.pb, h.pe) ?? [])),
  squeeze: (p, [xs]) => squeeze(p, xs, true),
  inhabit: (p, [xs]) => squeeze(p, xs, true),
  pickSqueeze: (p, [xs]) => squeeze(p, xs, false),
  legato: (p, [x]) => control('legato', p, x),
  clip: (p, [x]) => control('legato', p, x),
  pianoroll: (p) => p,
  _pianoroll: (p) => p,
  punchcard: (p) => p,
  _punchcard: (p) => p,
  scope: (p) => p,
  _scope: (p) => p,
  spiral: (p) => p,
  color: (p) => p,
  log: (p) => p,
  midi: (p) => p,
  osc: (p) => p,
  hush: () => silence,
}

/** Part i of k of each cycle under f, the rest as it was. */
function chunkAt(p: Pattern, k: number, i: number, f: Val, apply: Apply): Pattern {
  const part = (on: boolean) => fastcat(Array.from({ length: k }, (_, j) => pure({ value: (j === i) === on ? 1 : 0 })))
  return stack([p.mask(part(false)), apply(f, p).mask(part(true))])
}

/** The chord symbols a `chord()` pattern carries, voiced as stacked notes. */
export function voiceChords(p: Pattern, anchor = 60): Pattern {
  return new Pattern((b, e) =>
    p.query(b, e).flatMap((h) => {
      if (h.v.chord === undefined) return [h]
      return chordNotes(String(h.v.chord), 4, anchor).map((note) => ({ ...h, v: { ...h.v, note } }))
    }),
  )
}

/** Top-level names: pattern makers, the signals, the controls, and the transforms as bare functions. */
export function globals(): Record<string, Val> {
  const g: Record<string, Val> = {
    ...signals(),
    silence,
    stack: (...xs: Val[]) => stack(xs.map(toPattern)),
    cat: (...xs: Val[]) => slowcat(xs.map(toPattern)),
    slowcat: (...xs: Val[]) => slowcat(xs.map(toPattern)),
    fastcat: (...xs: Val[]) => fastcat(xs.map(toPattern)),
    seq: (...xs: Val[]) => fastcat(xs.map(toPattern)),
    sequence: (...xs: Val[]) => fastcat(xs.map(toPattern)),
    timeCat: (...xs: Val[]) => timecat(xs.map((x) => (Array.isArray(x) ? [num(x[0], 1), toPattern(x[1])] : [1, toPattern(x)]) as [number, Pattern])),
    timecat: (...xs: Val[]) => timecat(xs.map((x) => (Array.isArray(x) ? [num(x[0], 1), toPattern(x[1])] : [1, toPattern(x)]) as [number, Pattern])),
    arrange: (...xs: Val[]) => arrange(xs.map((x) => (Array.isArray(x) ? [num(x[0], 1), toPattern(x[1])] : [1, toPattern(x)]) as [number, Pattern])),
    polymeter: (...xs: Val[]) => stack(xs.map(toPattern)),
    pure: (x: Val) => toPattern(x),
    mini: (x: Val) => toPattern(x),
    m: (x: Val) => toPattern(x),
    run: (n: Val) => fastcat(Array.from({ length: Math.max(1, Math.round(num(n, 1))) }, (_, i) => pure({ value: i }))),
    chooseCycles: (...xs: Val[]) => Pattern.perCycle((c, b, e) => toPattern(xs[Math.floor(timeToRand(c + 0.0001) * xs.length)]).query(b, e)),
    randcat: (...xs: Val[]) => Pattern.perCycle((c, b, e) => toPattern(xs[Math.floor(timeToRand(c + 0.0001) * xs.length)]).query(b, e)),
    wchooseCycles: (...pairs: Val[]) => Pattern.perCycle((c, b, e) => toPattern(weighted(pairs, timeToRand(c + 0.0001))).query(b, e)),
    wrandcat: (...pairs: Val[]) => Pattern.perCycle((c, b, e) => toPattern(weighted(pairs, timeToRand(c + 0.0001))).query(b, e)),
    chord: (x: Val) => toPattern(x).withValue((v) => ({ chord: String(v.value) })),
  }
  for (const name of Object.keys(CONTROLS)) g[name] = (x: Val) => control(name, null, x)
  // transforms usable bare as function arguments: `.every(2, fast(2))`, `jux(rev)`
  for (const name of Object.keys(METHODS)) if (!(name in g)) g[name] = (...args: Val[]) => ((p: Val) => METHODS[name](toPattern(p), args, (f, q) => (typeof f === 'function' ? (f(q) as Pattern) : q))) as Fn
  return g
}

