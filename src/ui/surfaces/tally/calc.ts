/** TALLY's calculator: an eight-digit pocket calculator, chained the way they
 *  are (2 + 3 × 4 = 20, left to right). Pure state, no DOM. */

const DIGITS = 8

/** A number as an eight-digit display, or 'E' if it won't fit. */
export function fit(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) >= 10 ** DIGITS) return 'E'
  if (Number.isInteger(n)) return String(n)
  const whole = String(Math.trunc(Math.abs(n))).length
  let s = n.toFixed(Math.max(0, DIGITS - whole))
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

export class Calc {
  display = '0'
  private acc: number | null = null
  private op: string | null = null
  /** The next digit starts a new number. */
  private fresh = true

  value(): number {
    const v = Number(this.display)
    return Number.isFinite(v) ? v : 0
  }

  private apply(a: number, op: string, b: number): number {
    switch (op) {
      case '+':
        return a + b
      case '−':
        return a - b
      case '×':
        return a * b
      default:
        return b === 0 ? NaN : a / b
    }
  }

  press(k: string): void {
    if (k === 'C') {
      this.display = '0'
      this.acc = null
      this.op = null
      this.fresh = true
      return
    }
    if (this.display === 'E') return
    if (/^[0-9]$/.test(k) || k === '.') {
      if (this.fresh) {
        this.display = k === '.' ? '0.' : k
        this.fresh = false
        return
      }
      if (k === '.' && this.display.includes('.')) return
      if (this.display.replace(/[-.]/g, '').length >= DIGITS) return
      this.display = this.display === '0' && k !== '.' ? k : this.display + k
      return
    }
    if (k === '=') {
      if (this.op !== null && this.acc !== null) this.display = fit(this.apply(this.acc, this.op, this.value()))
      this.acc = null
      this.op = null
      this.fresh = true
      return
    }
    // an operator: finish the pending sum first (left to right)
    if (this.op !== null && this.acc !== null && !this.fresh) this.display = fit(this.apply(this.acc, this.op, this.value()))
    this.acc = this.value()
    this.op = k
    this.fresh = true
  }
}
