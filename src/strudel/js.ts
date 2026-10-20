/** A small evaluator for the JavaScript Strudel code is written in: `const`
 *  declarations, calls, method chains, numbers with arithmetic, strings,
 *  arrays, arrow functions. Nothing runs that we don't define, so pasted
 *  code can't reach the page. */

type Tok = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'id'; v: string } | { t: 'p'; v: string } | { t: 'eof' }

const PUNCT = ['=>', '===', '!==', '==', '!=', '<=', '>=', '&&', '||', '(', ')', '[', ']', '{', '}', ',', '.', ';', ':', '=', '+', '-', '*', '/', '%', '<', '>', '!', '?']

export function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2)
      i = j < 0 ? src.length : j + 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) {
          s += src[j + 1]
          j += 2
        } else s += src[j++]
      }
      out.push({ t: 'str', v: s })
      i = j + 1
      continue
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i
      while (j < src.length && /[0-9.eE]/.test(src[j])) j++
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) })
      i = j
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++
      out.push({ t: 'id', v: src.slice(i, j) })
      i = j
      continue
    }
    const p = PUNCT.find((q) => src.startsWith(q, i))
    if (!p) throw new Error(`unexpected character "${c}" at ${i}`)
    out.push({ t: 'p', v: p })
    i += p.length
  }
  out.push({ t: 'eof' })
  return out
}

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'id'; v: string }
  | { k: 'arr'; items: Node[] }
  | { k: 'obj'; keys: string[]; vals: Node[] }
  | { k: 'call'; fn: Node; args: Node[] }
  | { k: 'member'; obj: Node; name: string }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'neg'; a: Node }
  | { k: 'not'; a: Node }
  | { k: 'arrow'; params: string[]; body: Node }
  | { k: 'cond'; c: Node; a: Node; b: Node }

export type Stmt = { k: 'const'; name: string; e: Node } | { k: 'expr'; e: Node } | { k: 'dollar'; e: Node } | { k: 'muted'; e: Node }

export class Parser {
  private i = 0
  constructor(private readonly toks: Tok[]) {}

  private peek(n = 0): Tok {
    return this.toks[Math.min(this.toks.length - 1, this.i + n)]
  }
  private isP(v: string, n = 0): boolean {
    const t = this.peek(n)
    return t.t === 'p' && t.v === v
  }
  private isId(v: string, n = 0): boolean {
    const t = this.peek(n)
    return t.t === 'id' && t.v === v
  }
  private take(): Tok {
    return this.toks[this.i++]
  }
  private expectP(v: string): void {
    if (!this.isP(v)) throw new Error(`expected "${v}"`)
    this.i++
  }

  program(): Stmt[] {
    const out: Stmt[] = []
    while (this.peek().t !== 'eof') {
      if (this.isP(';')) {
        this.i++
        continue
      }
      out.push(this.statement())
    }
    return out
  }

  private statement(): Stmt {
    if (this.isId('const') || this.isId('let') || this.isId('var')) {
      this.i++
      const name = this.take()
      if (name.t !== 'id') throw new Error('expected a name after const')
      this.expectP('=')
      return { k: 'const', name: name.v, e: this.expr() }
    }
    // `$: pattern` or `name: pattern`: another top-level pattern to play; `_$:` one that's muted
    if (this.peek().t === 'id' && this.isP(':', 1)) {
      const name = (this.peek() as { v: string }).v
      this.i += 2
      return { k: name.startsWith('_') ? 'muted' : 'dollar', e: this.expr() }
    }
    return { k: 'expr', e: this.expr() }
  }

  expr(): Node {
    return this.cond()
  }

  private cond(): Node {
    const c = this.or()
    if (this.isP('?')) {
      this.i++
      const a = this.expr()
      this.expectP(':')
      return { k: 'cond', c, a, b: this.expr() }
    }
    return c
  }

  private or(): Node {
    let a = this.and()
    while (this.isP('||')) {
      this.i++
      a = { k: 'bin', op: '||', a, b: this.and() }
    }
    return a
  }
  private and(): Node {
    let a = this.cmp()
    while (this.isP('&&')) {
      this.i++
      a = { k: 'bin', op: '&&', a, b: this.cmp() }
    }
    return a
  }
  private cmp(): Node {
    let a = this.add()
    while (['==', '===', '!=', '!==', '<', '>', '<=', '>='].some((o) => this.isP(o))) {
      const op = (this.take() as { v: string }).v
      a = { k: 'bin', op, a, b: this.add() }
    }
    return a
  }
  private add(): Node {
    let a = this.mul()
    while (this.isP('+') || this.isP('-')) {
      const op = (this.take() as { v: string }).v
      a = { k: 'bin', op, a, b: this.mul() }
    }
    return a
  }
  private mul(): Node {
    let a = this.unary()
    while (this.isP('*') || this.isP('/') || this.isP('%')) {
      const op = (this.take() as { v: string }).v
      a = { k: 'bin', op, a, b: this.unary() }
    }
    return a
  }
  private unary(): Node {
    if (this.isP('-')) {
      this.i++
      return { k: 'neg', a: this.unary() }
    }
    if (this.isP('!')) {
      this.i++
      return { k: 'not', a: this.unary() }
    }
    return this.postfix(this.primary())
  }

  private postfix(n: Node): Node {
    for (;;) {
      if (this.isP('.')) {
        this.i++
        const name = this.take()
        if (name.t !== 'id') throw new Error('expected a name after "."')
        n = { k: 'member', obj: n, name: name.v }
      } else if (this.isP('(')) {
        this.i++
        n = { k: 'call', fn: n, args: this.list(')') }
      } else return n
    }
  }

  private list(close: string): Node[] {
    const items: Node[] = []
    while (!this.isP(close)) {
      items.push(this.expr())
      if (this.isP(',')) this.i++
      else if (!this.isP(close)) throw new Error(`expected "," or "${close}"`)
    }
    this.i++
    return items
  }

  /** `(a, b) => body` or `a => body`, if that's what's next. */
  private arrow(): Node | null {
    if (this.peek().t === 'id' && this.isP('=>', 1)) {
      const p = (this.take() as { v: string }).v
      this.i++
      return { k: 'arrow', params: [p], body: this.arrowBody() }
    }
    if (this.isP('(')) {
      let j = 1
      const params: string[] = []
      while (this.peek(j).t === 'id') {
        params.push((this.peek(j) as { v: string }).v)
        j++
        if (this.isP(',', j)) j++
        else break
      }
      if (this.isP(')', j) && this.isP('=>', j + 1)) {
        this.i += j + 2
        return { k: 'arrow', params, body: this.arrowBody() }
      }
    }
    return null
  }

  private arrowBody(): Node {
    if (this.isP('{')) {
      // a block: `{ return expr }` or `{ expr }`
      this.i++
      if (this.isId('return')) this.i++
      const e = this.expr()
      if (this.isP(';')) this.i++
      this.expectP('}')
      return e
    }
    return this.expr()
  }

  private primary(): Node {
    const arrow = this.arrow()
    if (arrow) return arrow
    const t = this.take()
    if (t.t === 'num') return { k: 'num', v: t.v }
    if (t.t === 'str') return { k: 'str', v: t.v }
    if (t.t === 'id') return { k: 'id', v: t.v }
    if (t.t === 'p' && t.v === '(') {
      const e = this.expr()
      this.expectP(')')
      return e
    }
    if (t.t === 'p' && t.v === '[') return { k: 'arr', items: this.list(']') }
    if (t.t === 'p' && t.v === '{') {
      const keys: string[] = []
      const vals: Node[] = []
      while (!this.isP('}')) {
        const key = this.take()
        if (key.t !== 'id' && key.t !== 'str') throw new Error('expected an object key')
        this.expectP(':')
        keys.push(String(key.v))
        vals.push(this.expr())
        if (this.isP(',')) this.i++
      }
      this.i++
      return { k: 'obj', keys, vals }
    }
    throw new Error(t.t === 'eof' ? 'unexpected end of code' : `unexpected "${(t as { v: string }).v}"`)
  }
}

export function parse(src: string): Stmt[] {
  return new Parser(tokenize(src)).program()
}
