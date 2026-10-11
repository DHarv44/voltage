import { PC_STEPS, PCL } from '../../../modules/specs/pacific'
import type { ModuleSpec } from '../../../modules/types'
import type { MidiEvent } from '../../protocol'
import { Dsp } from '../base'
import { OscCore, Schmitt } from '../cores'
import { KeyVoices } from '../keyVoices'
import { SpringLine } from '../spring'
import { TAU, fastTanh } from '../util'
import { ComplexOsc, Pulser, Vactrol, WestEnv } from './parts'

const SPRINGS = [0.0371, 0.0413, 0.0479]

/** PACIFIC: see the spec. One voice: keys (or V/OCT + GATE), the pulser,
 *  sequencer and envelope as routed by the switches, the two oscillators
 *  into the two low-pass gates, a spring tank. */
export class PacificDsp extends Dsp {
  private readonly I = {
    voct: this.ii('voct'),
    gate: this.ii('gate'),
    pulse: this.ii('pulse'),
    clk: this.ii('clk'),
    rst: this.ii('rst'),
    fm: this.ii('fm'),
    timbre: this.ii('timbre'),
    mod: this.ii('mod'),
    pitch: this.ii('pitch'),
    lpg1: this.ii('lpg1'),
    lpg2: this.ii('lpg2'),
    ext: this.ii('ext'),
  }
  private readonly O = {
    out: this.oi('out'),
    cplx: this.oi('cplx'),
    mod: this.oi('modo'),
    env: this.oi('envo'),
    seq: this.oi('seqo'),
    pulse: this.oi('pulso'),
    kcv: this.oi('kcv'),
    kgate: this.oi('kgate'),
  }
  private readonly P = {
    mfreq: this.pi('mfreq'),
    mwave: this.pi('mwave'),
    mtrack: this.pi('mtrack'),
    fm: this.pi('fm'),
    pitch: this.pi('pitch'),
    cwave: this.pi('cwave'),
    timbre: this.pi('timbre'),
    sym: this.pi('sym'),
    wmix: this.pi('wmix'),
    psrc: this.pi('psrc'),
    tsrc: this.pi('tsrc'),
    tmod: this.pi('tmod'),
    g1src: this.pi('g1src'),
    g1mode: this.pi('g1mode'),
    g1lvl: this.pi('g1lvl'),
    g2src: this.pi('g2src'),
    g2mode: this.pi('g2mode'),
    g2lvl: this.pi('g2lvl'),
    rev: this.pi('rev'),
    vol: this.pi('vol'),
    s0: this.pi('s0'),
    steps: this.pi('steps'),
    sclk: this.pi('sclk'),
    prate: this.pi('prate'),
    pmode: this.pi('pmode'),
    att: this.pi('att'),
    sus: this.pi('sus'),
    dec: this.pi('dec'),
    emode: this.pi('emode'),
    etrig: this.pi('etrig'),
    oct: this.pi('oct'),
    glide: this.pi('glide'),
    quant: this.pi('quant'),
  }
  private readonly keys: KeyVoices
  private readonly pulser: Pulser
  private readonly env: WestEnv
  private readonly g1: Vactrol
  private readonly g2: Vactrol
  private readonly cosc: ComplexOsc
  private readonly mosc = new OscCore()
  private readonly springs: SpringLine[]
  private readonly pulseIn = new Schmitt()
  private readonly clkIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  private readonly dcR = 1 - (TAU * 20) / this.fs
  private readonly springLp = 1 - Math.exp((-TAU * 3800) / this.fs)
  private dcX = 0
  private dcY = 0
  private wasGate = false
  private step = 0
  private keyV = 0
  private glided = 0
  /** The pulser's own flash for a gate it drives (held the length of a strike). */
  private strike = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.keys = new KeyVoices(fs)
    this.pulser = new Pulser(fs)
    this.env = new WestEnv(fs)
    this.g1 = new Vactrol(fs)
    this.g2 = new Vactrol(fs)
    this.cosc = new ComplexOsc(fs)
    this.springs = SPRINGS.map((s) => new SpringLine(s * this.tol(0.02), fs))
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev, 1)
  }

  /** A gate's control from its source: the envelope, a pulser strike, or the step's voltage. */
  private control(src: number, seqV: number): number {
    return src === 0 ? this.env.v : src === 1 ? (this.strike > 0 ? 1 : 0) : Math.max(0, Math.min(1, seqV * 0.5 + 0.5))
  }

  tick(): void {
    const p = this.p
    const i = this.in
    const pt = this.patched
    // the keys (or V/OCT + GATE): one voice, last note wins
    const cvGate = pt[this.I.gate] === 1
    const gate = cvGate ? i[this.I.gate] > 1 : this.keys.held(0)
    if (gate) this.keyV = (cvGate ? i[this.I.voct] : this.keys.pitch[0] + i[this.I.voct]) + Math.round(p[this.P.oct])
    const keyDown = gate && !this.wasGate
    this.wasGate = gate
    const gl = p[this.P.glide]
    this.glided += (this.keyV - this.glided) * (gl <= 0.002 ? 1 : 1 - Math.exp(-1 / (gl * 0.3 * this.fs)))
    // the pulser
    const ext = this.pulseIn.rise(i[this.I.pulse])
    this.pulser.step(p[this.P.prate], Math.round(p[this.P.pmode]), gate, keyDown, ext)
    const pulsed = this.pulser.fired
    if (pulsed) this.strike = Math.round(0.004 * this.fs)
    else if (this.strike > 0) this.strike--
    // the sequencer
    const n = 3 + Math.round(p[this.P.steps])
    if (this.rstIn.rise(i[this.I.rst])) this.step = 0
    const adv = pt[this.I.clk] === 1 ? this.clkIn.rise(i[this.I.clk]) : p[this.P.sclk] < 0.5 ? pulsed : keyDown
    if (adv) this.step = (this.step + 1) % n
    if (this.step >= n) this.step = 0
    let seqV = p[this.P.s0 + this.step]
    if (p[this.P.quant] >= 0.5) seqV = Math.round(seqV * 12) / 12
    // the envelope
    const et = Math.round(p[this.P.etrig])
    if (et === 0 ? pulsed : et === 1 ? keyDown : adv) this.env.trigger()
    const e = this.env.step(p[this.P.att], p[this.P.sus], p[this.P.dec], Math.round(p[this.P.emode]), gate)
    // the complex oscillator's pitch: keys, steps or both
    const ps = Math.round(p[this.P.psrc])
    const v = (ps === 1 ? 0 : this.glided) + (ps === 0 ? 0 : seqV) + (pt[this.I.pitch] === 1 ? i[this.I.pitch] : 0)
    // the modulation oscillator (following that pitch keeps FM ratios harmonic)
    const mHz = p[this.P.mfreq] * Math.pow(2, (p[this.P.mtrack] >= 0.5 ? v : 0) + (pt[this.I.mod] === 1 ? i[this.I.mod] : 0))
    this.mosc.step(Math.min(0.45, mHz / this.fs), 0.5)
    const mw = Math.round(p[this.P.mwave])
    const mod = mw === 0 ? this.mosc.saw : mw === 1 ? this.mosc.sqr : this.mosc.tri
    // linear FM (through zero), timbre
    const fmSig = pt[this.I.fm] === 1 ? i[this.I.fm] / 5 : mod
    const base = p[this.P.pitch] * Math.pow(2, v)
    const hz = base * (1 + p[this.P.fm] * 3 * fmSig)
    const ts = Math.round(p[this.P.tsrc])
    const tSrc = ts === 0 ? mod * 0.5 + 0.5 : ts === 1 ? e : seqV * 0.5 + 0.5
    const timbre = Math.max(0, Math.min(1.5, p[this.P.timbre] + p[this.P.tmod] * tSrc + (pt[this.I.timbre] === 1 ? i[this.I.timbre] / 10 : 0)))
    this.cosc.step(hz, Math.round(p[this.P.cwave]), timbre, p[this.P.sym])
    const wm = p[this.P.wmix]
    // SYMMETRY's offset leaves DC in the fold: blocked, so a gate opening doesn't thump
    const raw = this.cosc.shape * (1 - wm) + this.cosc.folded * wm
    this.dcY = raw - this.dcX + this.dcR * this.dcY
    this.dcX = raw
    const cplx = this.dcY
    // the gates: the complex oscillator (or EXT IN) into gate 1, the mod osc into gate 2
    const src1 = pt[this.I.ext] === 1 ? i[this.I.ext] / 5 : cplx
    const c1 = pt[this.I.lpg1] === 1 ? i[this.I.lpg1] / 10 : this.control(Math.round(p[this.P.g1src]), seqV)
    const c2 = pt[this.I.lpg2] === 1 ? i[this.I.lpg2] / 10 : this.control(Math.round(p[this.P.g2src]), seqV)
    const y1 = this.g1.step(src1, c1, Math.round(p[this.P.g1mode])) * p[this.P.g1lvl]
    const y2 = this.g2.step(mod, c2, Math.round(p[this.P.g2mode])) * p[this.P.g2lvl]
    const dry = y1 + y2
    // the spring tank
    const r = p[this.P.rev]
    let wet = 0
    if (r > 0.001) {
      const drive = fastTanh(dry * 0.8) * 0.5
      for (let k = 0; k < this.springs.length; k++) wet += this.springs[k].step(drive, 0.78, this.springLp, this.dcR)
    }
    const mixed = dry * (1 - r * 0.5) + wet * r * 2.2
    this.out[this.O.out] = fastTanh(mixed * 0.9) * 6 * p[this.P.vol]
    this.out[this.O.cplx] = cplx * 5
    this.out[this.O.mod] = mod * 5
    this.out[this.O.env] = e * 10
    this.out[this.O.seq] = seqV
    this.out[this.O.pulse] = this.pulser.high > 0 ? 10 : 0
    this.out[this.O.kcv] = this.glided
    this.out[this.O.kgate] = gate ? 10 : 0
    for (let s = 0; s < PC_STEPS; s++) this.led[PCL.step + s] = s === this.step ? 1 : 0
    this.led[PCL.pulse] = this.pulser.high > 0 ? 1 : 0
    this.led[PCL.env] = e
  }
}
