import { build, patterned } from './miniBuild'
import type { Pattern, Value } from './pattern'

export { patterned }

/** The mini-notation inside Strudel's strings: steps in a sequence, `[ ]`
 *  subdivides, `< >` alternates each cycle, `,` layers, `|` picks at random,
 *  `~` and `-` rest, `*` and `/` speed a step up or down (by a number or a
 *  pattern), `@` weights, `!` repeats, `?` drops at random, `:` a sample
 *  index, `(k,n,r)` Euclid, `.` groups feet. */

export type Node =
  | { k: 'atom'; v: string }
  | { k: 'rest' }
  | { k: 'seq'; steps: { node: Node; w: number }[] }
  | { k: 'stack'; items: Node[] }
  | { k: 'choice'; items: Node[] }
  | { k: 'alt'; items: Node[] }
  | { k: 'poly'; layers: Node[]; steps: Node | null }
  | { k: 'fast'; node: Node; by: Node }
  | { k: 'slow'; node: Node; by: Node }
  | { k: 'degrade'; node: Node; p: number }
  | { k: 'euclid'; node: Node; args: Node[] }

const WORD = /[A-Za-z0-9#._'^-]/
/** A word character that isn't the start of `..` (a range). */
const wordAt = (r: Reader): boolean => WORD.test(r.peek()) && !r.s.startsWith('..', r.i) && !(r.peek() === '.' && footDot(r))

class Reader {
  i = 0
  constructor(readonly s: string) {}
  peek(): string {
    return this.s[this.i] ?? ''
  }
  next(): string {
    return this.s[this.i++] ?? ''
  }
  ws(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++
  }
  eof(): boolean {
    this.ws()
    return this.i >= this.s.length
  }
  fail(msg: string): never {
    throw new Error(`mini-notation: ${msg} at ${this.i} in "${this.s}"`)
  }
}

/** A `.` at the reader is a foot separator (followed by a space or the end), not part of "0.5". */
const footDot = (r: Reader): boolean => {
  const nx = r.s[r.i + 1]
  return nx === undefined || /\s/.test(nx)
}

/** A sequence up to a closing bracket: steps, with `,` layers, `|` choices, `.` feet. */
function parseSeq(r: Reader, close: string): Node {
  const layers: Node[][] = [[]]
  let choice = false
  let feet: Node[][] | null = null
  let steps: { node: Node; w: number }[] = []
  const finishSteps = (): Node => ({ k: 'seq', steps })
  const closeFoot = () => {
    if (feet) {
      feet.push([finishSteps()])
      steps = []
    }
  }
  const closeLayer = () => {
    closeFoot()
    const node: Node = feet ? { k: 'seq', steps: feet.map((f) => ({ node: f[0], w: 1 })) } : finishSteps()
    layers[layers.length - 1].push(node)
    steps = []
    feet = null
  }
  for (;;) {
    r.ws()
    const c = r.peek()
    if (c === '' || c === close) {
      if (c === '' && close) r.fail(`missing ${close}`)
      break
    }
    if (c === ',') {
      r.next()
      closeLayer()
      layers.push([])
      continue
    }
    if (c === '|') {
      r.next()
      closeLayer()
      choice = true
      layers.push([])
      continue
    }
    if (c === '.' && footDot(r)) {
      r.next()
      if (!feet) feet = []
      feet.push([finishSteps()])
      steps = []
      continue
    }
    if (c === '!') {
      // a bare `!`: the previous step again
      r.next()
      if (steps.length) steps.push(steps[steps.length - 1])
      continue
    }
    if (c === '_' && /\s|$/.test(r.s[r.i + 1] ?? '')) {
      // `_`: the previous step lasts one step longer
      r.next()
      if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], w: steps[steps.length - 1].w + 1 }
      continue
    }
    if (r.s.startsWith('..', r.i)) {
      // `a .. b`: every whole number between
      r.i += 2
      const to = parseStep(r)
      const from = steps.pop()
      const lo = from && from.node.k === 'atom' ? Number(from.node.v) : NaN
      const hi = to.node.k === 'atom' ? Number(to.node.v) : NaN
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) r.fail('.. needs numbers either side')
      const dir = hi >= lo ? 1 : -1
      for (let v = lo; dir > 0 ? v <= hi : v >= hi; v += dir) steps.push({ node: { k: 'atom', v: String(v) }, w: 1 })
      continue
    }
    const step = parseStep(r)
    steps.push(step)
  }
  closeLayer()
  const items = layers.map((l) => l[0]).filter(Boolean)
  if (items.length === 1) return items[0]
  return choice ? { k: 'choice', items } : { k: 'stack', items }
}

/** One step and its modifiers; `!` and `@` are returned as the step's weight / repeats. */
function parseStep(r: Reader): { node: Node; w: number } {
  let node = parseAtom(r)
  let w = 1
  let reps = 1
  for (;;) {
    const c = r.peek()
    if (c === '*') {
      r.next()
      node = { k: 'fast', node, by: parseAtom(r) }
    } else if (c === '/') {
      r.next()
      node = { k: 'slow', node, by: parseAtom(r) }
    } else if (c === '@') {
      r.next()
      w = parseNumber(r)
    } else if (c === '!') {
      r.next()
      reps = /[0-9]/.test(r.peek()) ? Math.round(parseNumber(r)) : reps + 1
    } else if (c === '?') {
      r.next()
      const p = /[0-9.]/.test(r.peek()) ? parseNumber(r) : 0.5
      node = { k: 'degrade', node, p }
    } else if (c === ':') {
      r.next()
      const idx = parseAtom(r)
      node = { k: 'atom', v: `${node.k === 'atom' ? node.v : ''}:${idx.k === 'atom' ? idx.v : '0'}` }
    } else if (c === '(') {
      r.next()
      const args: Node[] = []
      for (;;) {
        args.push(parseAtom(r))
        r.ws()
        const d = r.next()
        if (d === ',') continue
        if (d === ')') break
        r.fail('bad euclid')
      }
      node = { k: 'euclid', node, args }
    } else break
  }
  if (reps > 1) {
    const steps = Array.from({ length: reps }, () => ({ node, w: 1 }))
    return { node: { k: 'seq', steps }, w: w * reps }
  }
  return { node, w }
}

function parseNumber(r: Reader): number {
  let s = ''
  while (/[0-9.-]/.test(r.peek())) s += r.next()
  const n = parseFloat(s)
  if (!Number.isFinite(n)) r.fail('expected a number')
  return n
}

function parseAtom(r: Reader): Node {
  r.ws()
  const c = r.peek()
  if (c === '[') {
    r.next()
    const n = parseSeq(r, ']')
    r.next()
    return n
  }
  if (c === '<') {
    r.next()
    const n = parseSeq(r, '>')
    r.next()
    return toAlt(n)
  }
  if (c === '{') {
    r.next()
    const n = parseSeq(r, '}')
    r.next()
    const layers = n.k === 'stack' ? n.items : [n]
    let steps: Node | null = null
    if (r.peek() === '%') {
      r.next()
      steps = parseAtom(r)
    }
    return { k: 'poly', layers, steps }
  }
  if (c === '~') {
    r.next()
    return { k: 'rest' }
  }
  let s = ''
  while (r.peek() !== '' && wordAt(r)) s += r.next()
  if (!s) r.fail(`unexpected "${c}"`)
  if (s === '-' || s === '~') return { k: 'rest' }
  return { k: 'atom', v: s }
}

/** `< >`: a sequence whose steps come one per cycle (layers stay layered). */
function toAlt(n: Node): Node {
  if (n.k === 'seq') return { k: 'alt', items: n.steps.flatMap((s) => Array.from({ length: Math.max(1, Math.round(s.w)) }, () => s.node)) }
  if (n.k === 'stack') return { k: 'stack', items: n.items.map(toAlt) }
  return { k: 'alt', items: [n] }
}

/** Parse a mini-notation string into a pattern of raw values ({ value }). */
export function mini(s: string, atom: (s: string) => Value = (v) => ({ value: numeric(v) })): Pattern {
  const r = new Reader(s)
  const n = parseSeq(r, '')
  return build(n, atom)
}

/** A word as a number when it is one, else itself. */
export function numeric(s: string): number | string {
  const n = Number(s)
  return s !== '' && Number.isFinite(n) ? n : s
}
