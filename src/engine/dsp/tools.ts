import { Dsp, MAX_VOICES } from './base'
import { Schmitt } from './cores'

const PULSE_S = 0.004

/** RATCHET: see the spec. The clock's period is measured edge to edge. */
export class RatchetDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iTrig = this.ii('trig')
  private readonly iN = this.ii('ncv')
  private readonly oMult = this.oi('mult')
  private readonly oBurst = this.oi('burst')
  private readonly pN = this.pi('n')
  private readonly pCurve = this.pi('curve')
  private readonly clk = new Schmitt()
  private readonly trig = new Schmitt()
  private period = 0
  private since = 0
  private multLeft = 0
  private multAt = 0
  private multGap = 0
  private burstLeft = 0
  private burstAt = 0
  private burstGap = 0
  private burstK = 0
  private multHigh = 0
  private burstHigh = 0
  private readonly width = Math.round(PULSE_S * this.fs)

  private count(): number {
    return Math.max(1, Math.min(8, Math.round(this.p[this.pN] + (this.patched[this.iN] ? this.in[this.iN] : 0))))
  }

  /** Gap before hit k of n (SPEED UP: long to short; SLOW DOWN: short to long). */
  private gap(k: number, n: number, total: number): number {
    const c = Math.round(this.p[this.pCurve])
    if (c === 0 || n < 2) return total / n
    const w = c === 1 ? n - k : k + 1
    return (total * w) / ((n * (n + 1)) / 2)
  }

  tick(): void {
    this.since++
    const n = this.count()
    if (this.clk.rise(this.in[this.iClk])) {
      if (this.since > 8) this.period = this.since
      this.since = 0
      this.multHigh = this.width
      this.multLeft = n - 1
      this.multGap = this.period / n
      this.multAt = this.multGap
    } else if (this.multLeft > 0 && --this.multAt <= 0) {
      this.multHigh = this.width
      this.multLeft--
      this.multAt = this.multGap
    }
    if (this.trig.rise(this.in[this.iTrig])) {
      const total = this.period > 0 ? this.period : 0.25 * this.fs
      this.burstHigh = this.width
      this.burstLeft = n - 1
      this.burstK = 0
      this.burstGap = total
      this.burstAt = this.gap(0, n, total)
    } else if (this.burstLeft > 0 && --this.burstAt <= 0) {
      this.burstHigh = this.width
      this.burstLeft--
      this.burstK++
      this.burstAt = this.gap(this.burstK, n, this.burstGap)
    }
    this.out[this.oMult] = this.multHigh > 0 ? 10 : 0
    this.out[this.oBurst] = this.burstHigh > 0 ? 10 : 0
    if (this.multHigh > 0) this.multHigh--
    if (this.burstHigh > 0) this.burstHigh--
    this.led[0] = this.out[this.oBurst] > 0 || this.out[this.oMult] > 0 ? 1 : this.led[0] * 0.999
  }
}

const RING = 64

/** GATE DELAY: each rise and fall is queued and replayed DELAY later; with a
 *  LENGTH, only the rise is kept and the gate lasts that long. */
export class GateDelayDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iD = this.ii('dcv')
  private readonly oOut = this.oi('out')
  private readonly pDelay = this.pi('delay')
  private readonly pLen = this.pi('len')
  private readonly gate = new Schmitt()
  /** Pending edges: when (sample count) and which (1 rise, 0 fall). */
  private readonly when = new Float64Array(RING)
  private readonly what = new Uint8Array(RING)
  private head = 0
  private tail = 0
  private now = 0
  private high = false
  private hold = 0

  private queue(at: number, v: number): void {
    const next = (this.tail + 1) % RING
    if (next === this.head) return
    this.when[this.tail] = at
    this.what[this.tail] = v
    this.tail = next
  }

  tick(): void {
    this.now++
    const was = this.gate.high
    const rose = this.gate.rise(this.in[this.iIn])
    const fell = was && !this.gate.high
    const d = Math.max(0, this.p[this.pDelay] * Math.pow(2, this.patched[this.iD] ? this.in[this.iD] : 0)) * this.fs
    // LENGTH all the way down (its 1 ms minimum) keeps each gate's own length
    const len = this.p[this.pLen] < 0.0015 ? 0 : this.p[this.pLen]
    if (rose) this.queue(this.now + d, 1)
    if (fell && len < 0.001) this.queue(this.now + d, 0)
    while (this.head !== this.tail && this.when[this.head] <= this.now) {
      const v = this.what[this.head] === 1
      if (v && len >= 0.001) this.hold = Math.round(len * this.fs)
      if (len < 0.001) this.high = v
      this.head = (this.head + 1) % RING
    }
    if (len >= 0.001) {
      this.high = this.hold > 0
      if (this.hold > 0) this.hold--
    }
    this.out[this.oOut] = this.high ? 10 : 0
    this.led[0] = this.high ? 1 : 0
  }
}

/** COMPARE: see the spec. */
export class CompareDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iT = this.ii('tcv')
  private readonly O = { above: this.oi('above'), below: this.oi('below'), inside: this.oi('inside'), cross: this.oi('cross') }
  private readonly P = { thr: this.pi('thr'), win: this.pi('win'), hys: this.pi('hys') }
  private above = false
  private inside = false
  private pulse = 0

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const t = p[this.P.thr] + (this.patched[this.iT] ? this.in[this.iT] : 0)
    const h = p[this.P.hys] / 2
    const was = this.above
    if (this.above ? x < t - h : x > t + h) this.above = !this.above
    if (was !== this.above) this.pulse = Math.round(PULSE_S * this.fs)
    const w = p[this.P.win] / 2
    this.inside = this.inside ? x > t - w - h && x < t + w + h : x > t - w + h && x < t + w - h
    this.out[this.O.above] = this.above ? 10 : 0
    this.out[this.O.below] = this.above ? 0 : 10
    this.out[this.O.inside] = this.inside ? 10 : 0
    this.out[this.O.cross] = this.pulse > 0 ? 10 : 0
    if (this.pulse > 0) this.pulse--
    this.led[0] = this.above ? 1 : 0
  }
}

/** CV MATH: see the spec. */
export class CvMathDsp extends Dsp {
  private readonly iA = this.ii('a')
  private readonly iB = this.ii('b')
  private readonly O = { sum: this.oi('sum'), diff: this.oi('diff'), min: this.oi('min'), max: this.oi('max'), rect: this.oi('rect') }
  private readonly pOct = this.pi('oct')
  private readonly pOff = this.pi('off')

  tick(): void {
    const a = this.in[this.iA]
    const b = this.in[this.iB]
    this.out[this.O.sum] = a + b + Math.round(this.p[this.pOct]) + this.p[this.pOff]
    this.out[this.O.diff] = a - b
    this.out[this.O.min] = a < b ? a : b
    this.out[this.O.max] = a > b ? a : b
    this.out[this.O.rect] = a < 0 ? -a : a
  }
}

/** XFADE: see the spec. Poly in, poly out (voice by voice). */
export class XfadeDsp extends Dsp {
  private readonly iA = this.ii('a')
  private readonly iB = this.ii('b')
  private readonly iCv = this.ii('cv')
  private readonly oOut = this.oi('out')
  private readonly pPos = this.pi('pos')
  private readonly pLaw = this.pi('law')

  tick(): void {
    const x = Math.max(0, Math.min(1, this.p[this.pPos] + (this.patched[this.iCv] ? this.in[this.iCv] / 10 : 0)))
    const lin = this.p[this.pLaw] >= 0.5
    const ga = lin ? 1 - x : Math.cos((x * Math.PI) / 2)
    const gb = lin ? x : Math.sin((x * Math.PI) / 2)
    const n = Math.max(this.inChans(this.iA), this.inChans(this.iB))
    for (let v = 0; v < n; v++) this.pout(this.oOut, v, this.pin(this.iA, v) * ga + this.pin(this.iB, v) * gb)
    this.chans[this.oOut] = n
  }
}

/** NOTES: words only, no circuit. */
export class NotesDsp extends Dsp {
  tick(): void {}
}

/** SPLIT: voice v of the poly cable onto jack v. */
export class SplitDsp extends Dsp {
  private readonly iIn = this.ii('in')

  tick(): void {
    const n = this.inChans(this.iIn)
    for (let v = 0; v < 8; v++) this.out[v] = v < n ? this.pin(this.iIn, v) : 0
  }
}

/** MERGE: jacks 1..k (k the highest patched) as the voices of one cable. */
export class MergeDsp extends Dsp {
  private readonly oOut = this.oi('out')

  tick(): void {
    let n = 1
    for (let v = 0; v < 8; v++) if (this.patched[v]) n = v + 1
    for (let v = 0; v < n; v++) this.pout(this.oOut, v, this.in[v])
    this.chans[this.oOut] = n
  }
}

/** UNISON: each incoming voice copied VOICES times, spread evenly across
 *  ±DETUNE semitones (the stack is capped at the cable's eight voices). */
export class UnisonDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iG = this.ii('gate')
  private readonly oV = this.oi('pv')
  private readonly oG = this.oi('pg')
  private readonly pN = this.pi('n')
  private readonly pDet = this.pi('det')

  tick(): void {
    const k = Math.max(1, Math.round(this.p[this.pN]))
    const notes = Math.max(this.inChans(this.iV), this.inChans(this.iG))
    const spread = this.p[this.pDet] / 12
    let out = 0
    for (let v = 0; v < notes && out < MAX_VOICES; v++) {
      const pv = this.pin(this.iV, v)
      const g = this.pin(this.iG, v)
      for (let j = 0; j < k && out < MAX_VOICES; j++) {
        const off = k === 1 ? 0 : (j / (k - 1) - 0.5) * 2 * spread
        this.pout(this.oV, out, pv + off)
        this.pout(this.oG, out, g)
        out++
      }
    }
    this.chans[this.oV] = Math.max(1, out)
    this.chans[this.oG] = Math.max(1, out)
  }
}
