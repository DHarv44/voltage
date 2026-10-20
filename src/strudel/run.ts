import { parse, type Node, type Stmt } from './js'
import { CONTROLS, control, globals, METHODS, toPattern, type Fn, type Val } from './library'
import { Pattern, silence, stack } from './pattern'

/** What running a piece of Strudel code gives: the pattern to play, its
 *  speed in cycles per second, and anything we had to skip. */
export interface Run {
  pattern: Pattern
  cps: number
  /** The code set its own tempo (setcps / setcpm). */
  cpsSet: boolean
  warnings: string[]
  error: string | null
}

const DEFAULT_CPS = 0.5

/** Run Strudel code with our interpreter (no eval: the code can only call
 *  what the library defines). Unknown calls are skipped and reported. */
export function runStrudel(code: string): Run {
  const warnings: string[] = []
  const warn = (s: string) => {
    if (!warnings.includes(s)) warnings.push(s)
  }
  let cps = DEFAULT_CPS
  let cpsSet = false
  const env = new Map<string, Val>(Object.entries(globals()))
  const custom = new Map<string, Fn>()
  env.set('setcps', (x) => {
    cps = Number(x) || DEFAULT_CPS
    cpsSet = true
    return null
  })
  env.set('setcpm', (x) => {
    cps = (Number(x) || DEFAULT_CPS * 60) / 60
    cpsSet = true
    return null
  })
  env.set('register', (name, fn) => {
    if (typeof name === 'string' && typeof fn === 'function') custom.set(name, fn)
    return fn as Val
  })
  for (const noop of ['samples', 'hush', 'all', 'setVoicingRange', 'await', 'initHydra', 'setDefaultVoicings']) env.set(noop, () => null)
  env.set('silence', silence)

  /** Apply a transform argument (an arrow, a named function, or a pattern to swap in). */
  const apply = (f: Val, p: Pattern): Pattern => {
    if (typeof f === 'function') {
      const r = f(p)
      return r instanceof Pattern ? r : p
    }
    if (f instanceof Pattern) return f
    return p
  }

  const method = (pat: Pattern, name: string, args: Val[]): Val => {
    if (CONTROLS[name]) return control(name, pat, args[0])
    if (METHODS[name]) return METHODS[name](pat, args, apply)
    const c = custom.get(name)
    if (c) return c(pat, ...args)
    warn(`.${name}() isn’t supported: skipped`)
    return pat
  }

  const evalNode = (n: Node, scope: Map<string, Val>): Val => {
    switch (n.k) {
      case 'num':
        return n.v
      case 'str':
        return n.v
      case 'id': {
        if (scope.has(n.v)) return scope.get(n.v)
        if (env.has(n.v)) return env.get(n.v)
        if (custom.has(n.v)) return custom.get(n.v) as Val
        if (METHODS[n.v]) return ((p: Val) => METHODS[n.v](toPattern(p), [], apply)) as Fn
        if (n.v === 'true') return true
        if (n.v === 'false') return false
        if (n.v === 'undefined' || n.v === 'null') return null
        warn(`"${n.v}" isn’t known: treated as silence`)
        return silence
      }
      case 'arr':
        return n.items.map((i) => evalNode(i, scope))
      case 'obj':
        return null
      case 'neg':
        return -Number(evalNode(n.a, scope))
      case 'not':
        return !evalNode(n.a, scope)
      case 'cond':
        return evalNode(n.c, scope) ? evalNode(n.a, scope) : evalNode(n.b, scope)
      case 'bin': {
        const a = evalNode(n.a, scope)
        const b = evalNode(n.b, scope)
        switch (n.op) {
          case '+':
            return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : Number(a) + Number(b)
          case '-':
            return Number(a) - Number(b)
          case '*':
            return Number(a) * Number(b)
          case '/':
            return Number(a) / Number(b)
          case '%':
            return Number(a) % Number(b)
          case '&&':
            return a && b
          case '||':
            return a || b
          case '==':
          case '===':
            return a === b
          case '!=':
          case '!==':
            return a !== b
          case '<':
            return Number(a) < Number(b)
          case '>':
            return Number(a) > Number(b)
          case '<=':
            return Number(a) <= Number(b)
          default:
            return Number(a) >= Number(b)
        }
      }
      case 'arrow':
        return ((...args: Val[]) => {
          const inner = new Map(scope)
          n.params.forEach((p, i) => inner.set(p, args[i]))
          return evalNode(n.body, inner)
        }) as Fn
      case 'member': {
        const obj = evalNode(n.obj, scope)
        // a method reference used as a value (`.every(2, fast(2))` style is a call; `.fast` bare is rare)
        if (obj instanceof Pattern || typeof obj === 'string') return ((...args: Val[]) => method(toPattern(obj), n.name, args)) as Fn
        if (typeof obj === 'number') return obj
        return null
      }
      case 'call': {
        if (n.fn.k === 'member') {
          const obj = evalNode(n.fn.obj, scope)
          const args = n.args.map((a) => evalNode(a, scope))
          if (obj instanceof Pattern || typeof obj === 'string' || typeof obj === 'number') return method(toPattern(obj), n.fn.name, args)
          if (obj === null || obj === undefined) return null
          warn(`.${n.fn.name}() on something that isn’t a pattern: skipped`)
          return obj
        }
        const fn = evalNode(n.fn, scope)
        const args = n.args.map((a) => evalNode(a, scope))
        if (typeof fn === 'function') return fn(...args)
        if (n.fn.k === 'id') warn(`${n.fn.v}() isn’t supported: skipped`)
        return fn instanceof Pattern ? fn : silence
      }
    }
  }

  let stmts: Stmt[]
  try {
    stmts = parse(code)
  } catch (err) {
    return { pattern: silence, cps, cpsSet, warnings, error: `Couldn’t read the code: ${(err as Error).message}` }
  }
  const tops: Pattern[] = []
  let last: Val = null
  try {
    for (const s of stmts) {
      if (s.k === 'const') env.set(s.name, evalNode(s.e, new Map()))
      else {
        const v = evalNode(s.e, new Map())
        if (s.k === 'dollar' && v instanceof Pattern) tops.push(v)
        else last = v
      }
    }
  } catch (err) {
    return { pattern: silence, cps, cpsSet, warnings, error: `Couldn’t run the code: ${(err as Error).message}` }
  }
  let pattern: Pattern
  if (tops.length) pattern = tops.length === 1 ? tops[0] : stack(tops)
  else if (last instanceof Pattern) pattern = last
  else if (typeof last === 'string') pattern = toPattern(last)
  else return { pattern: silence, cps, cpsSet, warnings, error: 'The code doesn’t end with a pattern to play.' }
  return { pattern, cps, cpsSet, warnings, error: null }
}
