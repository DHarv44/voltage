import type { Node } from './mini'
import { euclid, fastcat, Pattern, pure, silence, slowcat, stack, timecat, timeToRand, type Hap, type Value } from './pattern'

/** How many steps a sequence has (weights count; anything else is one). */
const weightOf = (n: Node): number => (n.k === 'seq' ? n.steps.reduce((s, x) => s + x.w, 0) : 1)

/** The number a step's `*` / `/` argument stands for (patterned when it varies). */
const numberOf = (n: Node): Pattern => build(n, (s) => ({ value: parseFloat(s) }))

/** Apply f for each value the argument pattern takes (Tidal's default join). */
export function patterned(arg: Pattern, f: (x: number) => Pattern): Pattern {
  return new Pattern((b, e) => {
    const out: Hap[] = []
    for (const a of arg.query(b, e)) for (const h of f(Number(a.v.value)).query(a.pb, a.pe)) out.push(h)
    return out
  })
}

/** A parsed mini-notation tree as a pattern; `atom` says what a word means. */
export function build(n: Node, atom: (s: string) => Value): Pattern {
  switch (n.k) {
    case 'atom':
      return pure(atom(n.v))
    case 'rest':
      return silence
    case 'seq':
      return n.steps.length === 1 && n.steps[0].w === 1 ? build(n.steps[0].node, atom) : timecat(n.steps.map((s) => [s.w, build(s.node, atom)]))
    case 'stack':
      return stack(n.items.map((i) => build(i, atom)))
    case 'alt':
      return slowcat(n.items.map((i) => build(i, atom)))
    case 'poly': {
      // steps per cycle: given, else the first layer's; each layer runs at that step rate and wraps
      const base = weightOf(n.layers[0])
      const layers = n.layers.map((l) => [weightOf(l), build(l, atom)] as [number, Pattern])
      const at = (s: number) => stack(layers.map(([w, p]) => p.slow(w / Math.max(1e-6, s))))
      return n.steps ? patterned(numberOf(n.steps), at) : at(base)
    }
    case 'choice': {
      const pats = n.items.map((i) => build(i, atom))
      return Pattern.perCycle((c, b, e) => pats[Math.floor(timeToRand(c + 0.0001) * pats.length)].query(b, e))
    }
    case 'fast':
      return patterned(numberOf(n.by), (k) => build(n.node, atom).fast(k))
    case 'slow':
      return patterned(numberOf(n.by), (k) => build(n.node, atom).slow(k))
    case 'degrade': {
      const p = n.p
      return build(n.node, atom).filterHaps((h) => timeToRand(h.b + 0.0001) >= p)
    }
    case 'euclid': {
      const inner = build(n.node, atom)
      const [k, steps, rot] = n.args.map(numberOf)
      return patterned(k, (kk) =>
        patterned(steps, (nn) =>
          patterned(rot ?? pure({ value: 0 }), (rr) => {
            const hits = euclid(kk, nn, rr)
            return inner.struct(fastcat(hits.map((h) => pure({ value: h ? 1 : 0 }))))
          }),
        ),
      )
    }
  }
}
