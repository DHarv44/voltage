import { MN_RANGE_OCT, MNL } from '../../modules/specs/monarch'
import type { ModuleSpec } from '../../modules/types'
import type { MidiEvent } from '../protocol'
import { Dsp } from './base'
import { EnvCore, KeyboardCore, LadderCore, OscCore } from './cores'
import { Drift } from './drift'
import { power } from './power'
import { C4, TAU, fastTanh, rails } from './util'

/** The pulse widths of the six waves (only SQUARE, WIDE and NARROW use them). */
const PW = [0.5, 0.5, 0.5, 0.5, 0.3, 0.12]
/** Keyboard tracking of the cutoff: OFF, 1/3, 2/3, FULL. */
const KBD = [0, 1 / 3, 2 / 3, 1]

/** MONARCH: see the spec. The mixer's sum drives the ladder (its tanh stages
 *  are the overdrive); EXT, when nothing is patched to it, is the synth's own
 *  output from the sample before: the feedback loop the original's owners
 *  made with a cable from the headphone jack. */
export class MonarchDsp extends Dsp {
  private readonly I = {
    voct: this.ii('voct'),
    gate: this.ii('gate'),
    ext: this.ii('ext'),
    cutoff: this.ii('cutoff'),
    loud: this.ii('loud'),
    mod: this.ii('mod'),
    pitch: this.ii('pitch'),
  }
  private readonly O = {
    out: this.oi('out'),
    mix: this.oi('mix'),
    osc3: this.oi('osc3'),
    fenv: this.oi('fenv'),
    lenv: this.oi('lenv'),
    kcv: this.oi('kcv'),
    kgate: this.oi('kgate'),
  }
  private readonly P = {
    tune: this.pi('tune'),
    glide: this.pi('glide'),
    modmix: this.pi('modmix'),
    modamt: this.pi('modamt'),
    oscmod: this.pi('oscmod'),
    osc3ctl: this.pi('osc3ctl'),
    range1: this.pi('range1'),
    wave1: this.pi('wave1'),
    range2: this.pi('range2'),
    freq2: this.pi('freq2'),
    wave2: this.pi('wave2'),
    range3: this.pi('range3'),
    freq3: this.pi('freq3'),
    wave3: this.pi('wave3'),
    lvl1: this.pi('lvl1'),
    lvl2: this.pi('lvl2'),
    lvl3: this.pi('lvl3'),
    ext: this.pi('ext'),
    noise: this.pi('noise'),
    color: this.pi('color'),
    cutoff: this.pi('cutoff'),
    emph: this.pi('emph'),
    contour: this.pi('contour'),
    fa: this.pi('fa'),
    fd: this.pi('fd'),
    fs: this.pi('fs'),
    la: this.pi('la'),
    ld: this.pi('ld'),
    ls: this.pi('ls'),
    kbd: this.pi('kbd'),
    filtmod: this.pi('filtmod'),
    decay: this.pi('decay'),
    vol: this.pi('vol'),
  }
  private readonly kb = new KeyboardCore()
  private readonly osc = [new OscCore(), new OscCore(), new OscCore()]
  private readonly drift: Drift[]
  private readonly ladder = new LadderCore()
  private readonly fenv: EnvCore
  private readonly lenv: EnvCore
  private readonly w = TAU / (2 * this.fs)
  private readonly fMax = this.fs * 0.45
  /** Pink noise (three-pole approximation). */
  private p0 = 0
  private p1 = 0
  private p2 = 0
  private last = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.drift = [0, 1, 2].map(() => new Drift(this.rng, fs, 6, 1.8))
    this.fenv = new EnvCore(fs, this.tol(0.05))
    this.lenv = new EnvCore(fs, this.tol(0.05))
  }

  onMidi(ev: MidiEvent): void {
    this.kb.midi(ev, this.fs)
  }

  /** One oscillator's wave (±1). */
  private wave(o: OscCore, w: number): number {
    return w === 0 ? o.tri : w === 1 ? 0.5 * (o.tri + o.saw) : w === 2 ? o.saw : o.sqr
  }

  /** Oscillator n at `oct` octaves from C4 (pulse width from its wave). */
  private run(n: number, oct: number, w: number): number {
    const hz = C4 * Math.pow(2, oct + this.drift[n].next(this.age) + power.pitchSag)
    this.osc[n].step(Math.min(hz / this.fs, 0.45), PW[w])
    return this.wave(this.osc[n], w)
  }

  tick(): void {
    const { I, O, P } = this
    const p = this.p
    const i = this.in
    const pt = this.patched
    // the keyboard (or V/OCT + GATE)
    const kb = this.kb
    kb.step(p[P.glide] > 0.002 ? p[P.glide] : 0, this.fs)
    const keyV = pt[I.voct] ? i[I.voct] : kb.pitch + (kb.bend * 2) / 12
    const gateV = pt[I.gate] ? i[I.gate] : kb.gate ? 10 : 0
    // the modulation mix: oscillator 3 (from the sample before) and noise, or MOD IN
    const white = this.rng.next() * 2 - 1
    this.p0 = 0.99765 * this.p0 + white * 0.099046
    this.p1 = 0.963 * this.p1 + white * 0.2965164
    this.p2 = 0.57 * this.p2 + white * 1.0526913
    const noise = p[P.color] >= 0.5 ? (this.p0 + this.p1 + this.p2 + white * 0.1848) * 0.25 : white
    const w3 = Math.round(p[P.wave3])
    const o3prev = this.wave(this.osc[2], w3)
    const modSrc = pt[I.mod] ? i[I.mod] / 5 : o3prev * (1 - p[P.modmix]) + noise * p[P.modmix]
    const mod = modSrc * Math.min(1, p[P.modamt] + kb.mod / 127)
    // the three oscillators
    const base = keyV + p[P.tune] / 12 + (pt[I.pitch] ? i[I.pitch] : 0)
    const om = p[P.oscmod] >= 0.5 ? mod : 0
    const r3 = Math.round(p[P.range3])
    const lo3 = r3 === 0
    const o1 = this.run(0, base + MN_RANGE_OCT[Math.round(p[P.range1])] + om, Math.round(p[P.wave1]))
    const o2 = this.run(1, base + MN_RANGE_OCT[Math.round(p[P.range2])] + p[P.freq2] / 12 + om, Math.round(p[P.wave2]))
    const k3 = p[P.osc3ctl] >= 0.5 ? base : 0
    const o3 = this.run(2, k3 + MN_RANGE_OCT[r3] + (lo3 ? p[P.freq3] / 2.5 : p[P.freq3] / 12) + (lo3 ? 0 : om), w3)
    // the mixer: EXT is the output fed back unless something is patched
    const ext = pt[I.ext] ? i[I.ext] / 5 : this.last
    const mixed = o1 * p[P.lvl1] + o2 * p[P.lvl2] + o3 * p[P.lvl3] + ext * p[P.ext] * 2.5 + noise * p[P.noise]
    // the contours (DECAY ON: the release follows the decay)
    const rel = p[P.decay] >= 0.5
    const fe = this.fenv.step(gateV, false, p[P.fa], p[P.fd], p[P.fs], rel ? p[P.fd] : 0.008)
    const le = this.lenv.step(gateV, false, p[P.la], p[P.ld], p[P.ls], rel ? p[P.ld] : 0.008)
    // the filter: contour up to four octaves, keyboard tracking, modulation, CV
    const fm = p[P.filtmod] >= 0.5 ? mod * 2 : 0
    const track = KBD[Math.round(p[P.kbd])] * keyV
    let fc = p[P.cutoff] * Math.pow(2, p[P.contour] * fe * 4 + track + fm + (pt[I.cutoff] ? i[I.cutoff] : 0))
    fc = fc < 5 ? 5 : fc > this.fMax ? this.fMax : fc
    const k = 4 * p[P.emph]
    const y = this.ladder.process(mixed * 0.45 * (1 + 0.25 * k) + (this.rng.next() - 0.5) * 2e-4, 1 - Math.exp(-fc * this.w), k)
    // the loudness contour (or LOUDNESS CV)
    const amp = pt[I.loud] ? Math.max(0, i[I.loud] / 10) : le
    const v = y * Math.min(amp, 1.2)
    this.last = fastTanh(v * 1.5)
    const o = this.out
    o[O.out] = rails(v * 5 * p[P.vol] * 1.6)
    o[O.mix] = rails(mixed * 2.5)
    o[O.osc3] = o3 * 5
    o[O.fenv] = fe * 10
    o[O.lenv] = le * 10
    o[O.kcv] = keyV
    o[O.kgate] = gateV > 1 ? 10 : 0
    this.led[MNL.osc3] = o3 * 0.5 + 0.5
    this.led[MNL.loud] = le
  }
}
