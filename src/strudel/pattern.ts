/** Our own pattern engine for Strudel / Tidal code: a Pattern is a function
 *  from a time span (in cycles) to the events (haps) inside it. Written from
 *  the published language, not from Strudel's source. Times are floats. */

export type Value = Record<string, number | string>

/** An event: its whole (the note's full extent; absent for continuous
 *  signals), the part of it inside the query, and its value. */
export interface Hap {
  b: number
  e: number
  pb: number
  pe: number
  v: Value
  /** Continuous (a signal): no onset. */
  cont?: boolean
}

export const EPS = 1e-9
export const hasOnset = (h: Hap): boolean => !h.cont && Math.abs(h.pb - h.b) < EPS

export class Pattern {
  /** The layers a root stack was made of (the importer's lanes). */
  layers: Pattern[] | null = null
  /** How many cycles an arrangement lasts (0 = endless / unknown). */
  cycles = 0

  constructor(readonly query: (b: number, e: number) => Hap[]) {}

  /** Query cycle by cycle (for patterns that depend on the cycle number). */
  static perCycle(f: (c: number, b: number, e: number) => Hap[]): Pattern {
    return new Pattern((b, e) => {
      const out: Hap[] = []
      for (let c = Math.floor(b + EPS); c < e - EPS; c++) {
        const qb = Math.max(b, c)
        const qe = Math.min(e, c + 1)
        if (qe - qb > EPS) for (const h of f(c, qb, qe)) out.push(h)
      }
      return out
    })
  }

  withTime(f: (t: number) => number, g: (t: number) => number): Pattern {
    return new Pattern((b, e) => this.query(g(b), g(e)).map((h) => ({ ...h, b: f(h.b), e: f(h.e), pb: f(h.pb), pe: f(h.pe) })))
  }

  withValue(f: (v: Value) => Value): Pattern {
    return new Pattern((b, e) => this.query(b, e).map((h) => ({ ...h, v: f(h.v) })))
  }

  filterHaps(f: (h: Hap) => boolean): Pattern {
    return new Pattern((b, e) => this.query(b, e).filter(f))
  }

  fast(k: number): Pattern {
    if (k === 0) return silence
    if (k < 0) return this.fast(-k).rev()
    return this.withTime(
      (t) => t / k,
      (t) => t * k,
    )
  }

  slow(k: number): Pattern {
    return k === 0 ? silence : this.fast(1 / k)
  }

  late(t: number): Pattern {
    return this.withTime(
      (x) => x + t,
      (x) => x - t,
    )
  }

  early(t: number): Pattern {
    return this.late(-t)
  }

  /** Each cycle played backwards. */
  rev(): Pattern {
    return Pattern.perCycle((c, b, e) => {
      const r = (t: number) => c + (c + 1 - t)
      return this.query(r(e), r(b)).map((h) => ({ ...h, b: r(h.e), e: r(h.b), pb: r(h.pe), pe: r(h.pb) }))
    })
  }

  /** The pattern squeezed into [s, e) of each cycle (silent elsewhere). */
  compress(s: number, e: number): Pattern {
    if (e <= s) return silence
    const w = e - s
    return Pattern.perCycle((c, qb, qe) => {
      const lo = Math.max(qb, c + s)
      const hi = Math.min(qe, c + e)
      if (hi - lo <= EPS) return []
      const inner = (t: number) => (t - c - s) / w + c
      const outer = (t: number) => (t - c) * w + c + s
      return this.query(inner(lo), inner(hi)).map((h) => ({ ...h, b: outer(h.b), e: outer(h.e), pb: outer(h.pb), pe: outer(h.pe) }))
    })
  }

  /** The part [s, e) of each cycle, stretched to fill the cycle (zoom). */
  zoomPart(s: number, e: number): Pattern {
    const w = e - s
    if (w <= 0) return silence
    return Pattern.perCycle((c, qb, qe) => {
      const inner = (t: number) => c + s + (t - c) * w
      const outer = (t: number) => c + (t - c - s) / w
      return this.query(inner(qb), inner(qe))
        .map((h) => ({ ...h, b: outer(h.b), e: outer(h.e), pb: Math.max(qb, outer(h.pb)), pe: Math.min(qe, outer(h.pe)) }))
        .filter((h) => h.pe - h.pb > EPS)
    })
  }

  /** Structure from `bool` (its true events), values from this pattern at those times. */
  struct(bool: Pattern): Pattern {
    return new Pattern((b, e) => {
      const out: Hap[] = []
      for (const s of bool.query(b, e)) {
        if (!truthy(s.v)) continue
        for (const h of this.query(s.pb, s.pe)) {
          if (h.cont || overlaps(h, s)) out.push({ b: s.b, e: s.e, pb: Math.max(s.pb, h.pb), pe: Math.min(s.pe, h.pe), v: h.v })
        }
      }
      return out
    })
  }

  /** Only the parts of this pattern under `bool`'s true events. */
  mask(bool: Pattern): Pattern {
    return new Pattern((b, e) => {
      const out: Hap[] = []
      const ms = bool.query(b, e).filter((m) => truthy(m.v))
      for (const h of this.query(b, e))
        for (const m of ms) {
          const pb = Math.max(h.pb, m.pb)
          const pe = Math.min(h.pe, m.pe)
          if (pe - pb > EPS) out.push({ ...h, pb, pe })
        }
      return out
    })
  }

  /** Each event repeated n times within itself. */
  ply(n: number): Pattern {
    const k = Math.max(1, Math.round(n))
    return new Pattern((b, e) => {
      const out: Hap[] = []
      for (const h of this.query(b, e)) {
        if (h.cont) {
          out.push(h)
          continue
        }
        const d = (h.e - h.b) / k
        for (let i = 0; i < k; i++) {
          const sb = h.b + i * d
          const se = sb + d
          const pb = Math.max(sb, h.pb)
          const pe = Math.min(se, h.pe)
          if (pe - pb > EPS) out.push({ b: sb, e: se, pb, pe, v: h.v })
        }
      }
      return out
    })
  }

  /** Apply a per-value control taken from `arg` at each event's onset (one
   *  event per arg event at that moment: a stacked arg layers the sound). */
  setFrom(arg: Pattern, f: (v: Value, a: Value) => Value): Pattern {
    return new Pattern((b, e) => {
      const out: Hap[] = []
      for (const h of this.query(b, e)) {
        const t = h.cont ? h.pb : h.b
        const as = arg.query(t, t + EPS * 10)
        if (!as.length) out.push(h)
        for (const a of as) out.push({ ...h, v: f(h.v, a.v) })
      }
      return out
    })
  }
}

export const overlaps = (a: Hap, b: Hap): boolean => Math.min(a.pe, b.pe) - Math.max(a.pb, b.pb) > EPS
export const truthy = (v: Value): boolean => {
  const x = v.value ?? v.n ?? v.s
  return x !== undefined && x !== 0 && x !== '~' && x !== '' && x !== 'f' && x !== 'false'
}

export const silence = new Pattern(() => [])

/** One value, once a cycle. */
export function pure(v: Value): Pattern {
  return Pattern.perCycle((c, b, e) => [{ b: c, e: c + 1, pb: b, pe: e, v }])
}

/** A continuous signal sampled at the start of each query. */
export function signal(f: (t: number) => number): Pattern {
  return new Pattern((b, e) => [{ b, e, pb: b, pe: e, v: { value: f(b) }, cont: true }])
}

export function stack(pats: Pattern[]): Pattern {
  const p = new Pattern((b, e) => {
    const out: Hap[] = []
    for (const q of pats) for (const h of q.query(b, e)) out.push(h)
    return out
  })
  p.layers = pats
  p.cycles = Math.max(0, ...pats.map((q) => q.cycles))
  return p
}

/** One pattern per cycle in turn, each continuing from where it left off. */
export function slowcat(pats: Pattern[]): Pattern {
  if (!pats.length) return silence
  const n = pats.length
  const p = Pattern.perCycle((c, b, e) => {
    const i = ((c % n) + n) % n
    const off = c - Math.floor(c / n)
    return pats[i].query(b - off, e - off).map((h) => ({ ...h, b: h.b + off, e: h.e + off, pb: h.pb + off, pe: h.pe + off }))
  })
  p.cycles = n * Math.max(1, ...pats.map((q) => q.cycles || 1))
  return p
}

export function fastcat(pats: Pattern[]): Pattern {
  return pats.length ? slowcat(pats).fast(pats.length) : silence
}

/** Patterns side by side in one cycle, each taking its weight's share. */
export function timecat(pairs: [number, Pattern][]): Pattern {
  const total = pairs.reduce((s, [w]) => s + w, 0)
  if (total <= 0) return silence
  let at = 0
  const parts = pairs.map(([w, p]) => {
    const s = at / total
    at += w
    return p.compress(s, at / total)
  })
  return stack(parts)
}

/** Sections in turn, each for its number of cycles. */
export function arrange(pairs: [number, Pattern][]): Pattern {
  const total = pairs.reduce((s, [n]) => s + n, 0)
  const p = timecat(pairs.map(([n, q]) => [n, q.fast(n)] as [number, Pattern])).slow(total)
  p.cycles = total
  p.layers = null
  return p
}

/** Strudel's time-seeded randomness: the same answer for the same moment
 *  every run, so a piece replays identically yet never loops audibly. */
export function timeToRand(t: number): number {
  let x = Math.trunc(((t / 300) % 1) * 536870912) | 0
  x ^= x << 13
  x ^= x >> 17
  x ^= x << 5
  return Math.abs((x % 536870912) / 536870912)
}

/** Bjorklund's algorithm: k hits spread over n steps. */
export function euclid(k: number, n: number, rot = 0): boolean[] {
  if (n <= 0) return []
  k = Math.max(0, Math.min(n, Math.round(k)))
  let a: boolean[][] = Array.from({ length: k }, () => [true])
  let b: boolean[][] = Array.from({ length: n - k }, () => [false])
  while (b.length > 1 && a.length > 0) {
    const m = Math.min(a.length, b.length)
    const next: boolean[][] = []
    for (let i = 0; i < m; i++) next.push(a[i].concat(b[i]))
    const rest = a.length > m ? a.slice(m) : b.slice(m)
    a = next
    b = rest
  }
  const out = a.concat(b).flat()
  const r = ((Math.round(rot) % n) + n) % n
  return out.slice(r).concat(out.slice(0, r))
}
