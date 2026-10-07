import { Dsp } from './base'
import { AudioOutCore, EnvCore, KeyboardCore, LadderCore, OscCore, Schmitt } from './cores'
import { Drift } from './drift'
import { SpringLine } from './spring'
import type { MidiEvent } from '../protocol'
import { power } from './power'
import { C4, TAU, fastTanh, rails } from './util'

/** STUDIO-3: a 2600-style semi-modular. Internal (normalled) signal flow:
 *  keys → VCO1/2/3 + VCF tracking · VCO2 sine → VCO1 FM · VCO1×VCO2 → ring ·
 *  mixer (V1 saw, V2 pulse, V3 saw, noise, ring) → VCF ← ADSR, VCO3, S&H ·
 *  VCF → VCA ← AR · LFO clocks S&H sampling noise · VCA → spring → output.
 *  Each patch-bay input is a switched jack replacing its internal source.
 *  It feeds the speakers directly until its OUT is patched. */
export class StudioDsp extends Dsp {
  sink = true
  private I = Object.fromEntries(this.spec.inputs.map((j, k) => [j.id, k])) as Record<string, number>
  private O = Object.fromEntries(this.spec.outputs.map((j, k) => [j.id, k])) as Record<string, number>
  private P = Object.fromEntries(this.spec.params.map((p, k) => [p.id, k])) as Record<string, number>

  private readonly kb = new KeyboardCore()
  private readonly vco = [new OscCore(), new OscCore(), new OscCore()]
  private readonly drift = [0, 1, 2].map(() => new Drift(this.rng, this.fs))
  private readonly track = [0, 1, 2].map(() => this.tol(0.0035))
  private readonly lfo = new OscCore()
  private readonly ladder = new LadderCore()
  private readonly adsr = new EnvCore(this.fs, this.tol(0.05))
  private readonly ar = new EnvCore(this.fs, this.tol(0.05))
  private readonly shClk = new Schmitt()
  private readonly springs: SpringLine[]
  private readonly audio = new AudioOutCore(this.fs)
  private readonly pink = new Float64Array(7)
  private readonly ctol = this.tol(0.03)
  private readonly w = TAU / (2 * this.fs)
  private readonly dcR = 1 - (TAU * 20) / this.fs
  private held = 0
  private lfoWas = false

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.springs = [0.0391, 0.0447].map((s) => new SpringLine(s * this.tol(0.02), this.fs))
    for (const v of this.vco) v.phase = this.rng.next()
  }

  onMidi(ev: MidiEvent): void {
    this.kb.midi(ev, this.fs)
  }

  private jack(k: number, normal: number): number {
    return this.patched[k] ? this.in[k] : normal
  }

  private noise(pink: boolean): number {
    const w = this.rng.next() * 2 - 1
    if (!pink) return w
    const b = this.pink
    b[0] = 0.99886 * b[0] + w * 0.0555179
    b[1] = 0.99332 * b[1] + w * 0.0750759
    b[2] = 0.969 * b[2] + w * 0.153852
    b[3] = 0.8665 * b[3] + w * 0.3104856
    b[4] = 0.55 * b[4] + w * 0.5329522
    b[5] = -0.7616 * b[5] - w * 0.016898
    const out = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362) * 0.11
    b[6] = w * 0.115926
    return out
  }

  private osc(n: number, oct: number, pw: number): OscCore {
    const o = this.vco[n]
    o.step(Math.min((C4 * Math.pow(2, oct)) / this.fs, 0.45), pw)
    return o
  }

  tick(): void {
    const { I, O, P } = this
    const p = this.p
    const kb = this.kb
    kb.step(0, this.fs)
    const key = this.jack(I.pitch, kb.pitch + (kb.bend * 2) / 12)
    const gate = this.jack(I.gate, kb.gate ? 10 : 0)

    // LFO and S&H (input normalled to noise, clock normalled to the LFO)
    this.lfo.step(Math.min(p[P.rate] / this.fs, 0.45), 0.5)
    const lfoV = this.lfo.tri * 5
    const noiseV = this.noise(p[P.ncol] >= 0.5) * 5
    const lfoHigh = this.lfo.sqr > 0
    const clkEdge = this.patched[I.shclk] ? this.shClk.rise(this.in[I.shclk]) : lfoHigh && !this.lfoWas
    this.lfoWas = lfoHigh
    if (clkEdge) this.held = this.jack(I.shin, noiseV)

    // VCOs (VCO2 is computed first: its sine is normalled to VCO1's FM)
    const sag = power.pitchSag
    const v2 = this.osc(1, key * this.track[1] + p[P.t2] + p[P.f2] / 12 + this.in[I.fm2] + this.drift[1].next(this.age) + sag, p[P.pw2])
    const fm1 = this.jack(I.fm1, v2.sin * 5 * p[P.fm1])
    const v1 = this.osc(0, key * this.track[0] + p[P.t1] + p[P.f1] / 12 + fm1 + this.drift[0].next(this.age) + sag, p[P.pw1])
    const low3 = p[P.lf3] >= 0.5 ? -Math.log2(100) : 0 // LOW range: ÷100, a modulation source
    const v3 = this.osc(2, (low3 ? 0 : key * this.track[2]) + p[P.t3] + p[P.f3] / 12 + low3 + this.in[I.fm3] + this.drift[2].next(this.age) + sag, 0.5)
    const ring = 5 * fastTanh(v1.saw * v2.sqr * 1.2)

    // Mixer → VCF
    const mix =
      5 * (v1.saw * p[P.m1] + v2.sqr * p[P.m2] + v3.saw * p[P.m3]) + noiseV * p[P.mn] + ring * p[P.mr]
    const adsr = this.adsr.step(gate, false, p[P.a], p[P.d], p[P.s], p[P.r])
    let fc =
      p[P.cut] *
      this.ctol *
      Math.pow(2, key * p[P.kbd] + adsr * 6 * p[P.env] + v3.tri * 2 * p[P.v3m] + (this.held / 5) * 2 * p[P.shm] + this.in[I.vcfcv])
    fc = fc < 5 ? 5 : fc > this.fs * 0.45 ? this.fs * 0.45 : fc
    const k = 4 * p[P.res]
    const x = (this.jack(I.vcfin, mix) / 5) * (1 + 0.3 * k) + (this.rng.next() - 0.5) * 2e-4
    const vcfV = this.ladder.process(x, 1 - Math.exp(-fc * this.w), k) * 5

    // VCA ← AR (sustains at full while the gate is held)
    const arEnv = this.ar.step(gate, false, p[P.ara], 0.001, 1, p[P.arr])
    const cv = this.patched[I.vcacv] ? Math.max(0, this.in[I.vcacv] / 10) : arEnv
    const g = Math.min(1.2, p[P.gain] + cv)
    const vcaV = rails(this.jack(I.vcain, vcfV) * g)

    // Spring reverb
    const rIn = fastTanh(this.jack(I.revin, vcaV) / 5) * 0.5
    const lpA = 1 - Math.exp((-TAU * 3500) / this.fs)
    const decay = 0.55 + 0.38 * p[P.rdec]
    const wet = rails((this.springs[0].step(rIn, decay, lpA, this.dcR) + this.springs[1].step(rIn, decay, lpA, this.dcR)) * 4.5)
    const outV = vcaV * (1 - p[P.rev] * 0.5) + wet * p[P.rev]

    const o = this.out
    o[O.v1] = v1.saw * 5
    o[O.v2] = v2.sqr * 5
    o[O.v3] = v3.tri * 5
    o[O.noise] = noiseV
    o[O.ring] = ring
    o[O.vcf] = vcfV
    o[O.vca] = vcaV
    o[O.adsr] = adsr * 10
    o[O.ar] = arEnv * 10
    o[O.sh] = this.held
    o[O.lfo] = lfoV
    o[O.out] = outV

    // switched direct out: the speakers until OUT is patched somewhere
    const s = this.audio.process(outV, p[P.vol])
    this.audioL = this.audioR = this.outPatched[O.out] ? 0 : s
    this.led[0] = g
    this.led[1] = this.lfo.tri
    this.led[2] = this.audio.peak * 1.5
  }
}
