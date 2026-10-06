import { Dsp } from './base'
import type { UiEvent } from '../protocol'
import { LadderCore, OscCore, Schmitt } from './cores'
import { TempoClock } from './stepSeq'
import { Drift } from './drift'
import { KIN_STEPS, KINL } from '../../modules/specs/kin'
import { TAU, rails } from './util'

/** ~1% left after the knob time. */
const DECAY_SHAPE = 4.6
const ATTACK = [0.0008, 0.04]
const TRIG_S = 0.005

/** KIN-8: the DFAM-style percussion voice. Each strike fires all three decay
 *  envelopes: the VCO EG sweeps both oscillators' pitch, the VCF EG opens the
 *  ladder and the VCA EG sounds it, the last two scaled by the step's
 *  velocity. Switched jacks: TRIG takes the strikes off the sequencer, ADV
 *  clocks it, VEL / VCA CV / EXT IN / VCF MOD replace their normals, the rest
 *  add CV. */
export class KinDsp extends Dsp {
  private I = {
    trig: this.ii('trig'), vcacv: this.ii('vcacv'), vel: this.ii('vel'), vcadec: this.ii('vcadec'),
    ext: this.ii('ext'), vcfdec: this.ii('vcfdec'), noise: this.ii('noise'), vcodec: this.ii('vcodec'),
    vcfmod: this.ii('vcfmod'), vco1: this.ii('vco1'), fm: this.ii('fm'), vco2: this.ii('vco2'),
    tempo: this.ii('tempo'), run: this.ii('run'), adv: this.ii('adv'),
  }
  private O = {
    vca: this.oi('vca'), vcfeg: this.oi('vcfeg'), vcoeg: this.oi('vcoeg'), vco1: this.oi('vco1'),
    vco2: this.oi('vco2'), trig: this.oi('trig'), vel: this.oi('vel'), pitch: this.oi('pitch'),
  }
  private P = {
    vcodec: this.pi('vcodec'), seqmod: this.pi('seqmod'), vco1eg: this.pi('vco1eg'), vco1: this.pi('vco1'),
    wave1: this.pi('wave1'), lvl1: this.pi('lvl1'), noise: this.pi('noise'), cutoff: this.pi('cutoff'),
    res: this.pi('res'), vcfmode: this.pi('vcfmode'), vcadec: this.pi('vcadec'), vol: this.pi('vol'),
    fm: this.pi('fm'), sync: this.pi('sync'), vco2eg: this.pi('vco2eg'), vco2: this.pi('vco2'),
    wave2: this.pi('wave2'), lvl2: this.pi('lvl2'), noisemod: this.pi('noisemod'), vcfeg: this.pi('vcfeg'),
    vcfdec: this.pi('vcfdec'), vcaatt: this.pi('vcaatt'), tempo: this.pi('tempo'), run: this.pi('run'),
    quant: this.pi('quant'),
  }
  private pPitch = Array.from({ length: KIN_STEPS }, (_, i) => this.pi(`p${i}`))
  private pVel = Array.from({ length: KIN_STEPS }, (_, i) => this.pi(`v${i}`))

  private readonly osc1 = new OscCore()
  private readonly osc2 = new OscCore()
  private readonly ladder = new LadderCore()
  private readonly clock = new TempoClock(this.fs)
  private readonly trigIn = new Schmitt()
  private readonly advIn = new Schmitt()
  private readonly drift1 = new Drift(this.rng, this.fs)
  private readonly drift2 = new Drift(this.rng, this.fs)
  private readonly tol1 = this.tol(0.01)
  private readonly tol2 = this.tol(0.01)
  private readonly ctol = this.tol(0.03)
  private readonly w = TAU / (2 * this.fs)
  private readonly fMax = this.fs * 0.45
  /** AC coupling on the VCA out (the voice is DC-free in volts, but sync and FM aren't). */
  private readonly R = 1 - (TAU * 5) / this.fs
  private hx = 0
  private hy = 0

  private step = KIN_STEPS - 1
  private vcoEnv = 0
  private vcfEnv = 0
  private vcaEnv = 0
  private vcaRising = false
  private vel = 0
  private trigLeft = 0
  private wasRunning = false
  private pendTrig = false
  private pendAdv = false
  private ledDecay = Math.exp(-1 / (0.08 * this.fs))

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'button' || !ev.down) return
    if (ev.name === 'trig') this.pendTrig = true
    else if (ev.name === 'adv') this.pendAdv = true
  }

  /** Fire the envelopes with the current step's velocity. */
  private strike(): void {
    const i = this.in
    const v = this.patched[this.I.vel] ? i[this.I.vel] / 8 : this.p[this.pVel[this.step]]
    this.vel = v < 0 ? 0 : v > 1.25 ? 1.25 : v
    this.vcoEnv = 1
    this.vcfEnv = 1
    this.vcaRising = true
    this.trigLeft = Math.round(TRIG_S * this.fs)
  }

  /** Decay coefficient for a knob time with CV (each 2 V doubles it). */
  private coef(time: number, cv: number): number {
    return Math.exp(-DECAY_SHAPE / (time * Math.pow(2, cv * 0.5) * this.fs))
  }

  tick(): void {
    const { I, O, P } = this
    const i = this.in
    const p = this.p
    const pt = this.patched

    // Transport: RUN (gate when patched), ADV clocks it when patched, else the tempo.
    const running = pt[I.run] ? i[I.run] > 1.2 : p[P.run] >= 0.5
    if (running && !this.wasRunning) {
      this.clock.reset()
      this.step = KIN_STEPS - 1
    }
    this.wasRunning = running
    const advEdge = this.advIn.rise(i[I.adv])
    const edge = pt[I.adv] ? advEdge : running && this.clock.tick(p[P.tempo] * Math.pow(2, i[I.tempo]))
    const external = pt[I.trig] === 1
    if (edge || this.pendAdv) {
      this.step = (this.step + 1) % KIN_STEPS
      if (!external || this.pendAdv) this.strike()
      this.pendAdv = false
    }
    if ((external && this.trigIn.rise(i[I.trig])) || this.pendTrig) {
      this.strike()
      this.pendTrig = false
    }

    // The step's pitch CV (±2 V), optionally in semitones, to the VCOs the switch picks.
    let seqV = p[this.pPitch[this.step]] * 2
    if (p[P.quant] >= 0.5) seqV = Math.round(seqV * 12) / 12
    const route = Math.round(p[P.seqmod])
    const to1 = route === 2 ? seqV : 0
    const to2 = route === 1 ? 0 : seqV

    // Envelopes: VCO / VCF decay from an instant attack, the VCA rises first.
    this.vcoEnv *= this.coef(p[P.vcodec], i[I.vcodec])
    this.vcfEnv *= this.coef(p[P.vcfdec], i[I.vcfdec])
    if (this.vcaRising) {
      const a = ATTACK[p[P.vcaatt] >= 0.5 ? 1 : 0]
      this.vcaEnv += (1.3 - this.vcaEnv) * (1 - Math.exp(-1.47 / (a * this.fs)))
      if (this.vcaEnv >= 1) {
        this.vcaEnv = 1
        this.vcaRising = false
      }
    } else this.vcaEnv *= this.coef(p[P.vcadec], i[I.vcadec])

    // Oscillators: EG sweeps up to ±5 octaves, 1→2 FM from VCO 1's wave, hard sync.
    const before = this.osc1.phase
    const o1 = Math.log2(p[P.vco1] / 261.63) + p[P.vco1eg] * this.vcoEnv * 5 + to1 + i[I.vco1] + this.drift1.next(this.age)
    this.osc1.step(Math.min((261.63 * Math.pow(2, o1) * this.tol1 * this.ctol) / this.fs, 0.45), 0.5)
    const w1 = p[P.wave1] >= 0.5 ? this.osc1.sqr : this.osc1.tri
    if (p[P.sync] >= 0.5 && this.osc1.phase < before) this.osc2.phase = 0
    let fm = p[P.fm] + i[I.fm] / 10
    fm = fm < 0 ? 0 : fm > 1 ? 1 : fm
    const o2 = Math.log2(p[P.vco2] / 261.63) + p[P.vco2eg] * this.vcoEnv * 5 + to2 + i[I.vco2] + fm * w1 * 3 + this.drift2.next(this.age)
    this.osc2.step(Math.min((261.63 * Math.pow(2, o2) * this.tol2 * this.ctol) / this.fs, 0.45), 0.5)
    const w2 = p[P.wave2] >= 0.5 ? this.osc2.sqr : this.osc2.tri

    // Mixer: noise (or EXT IN) at its level, plus level CV.
    const white = this.rng.next() * 2 - 1
    const noiseSrc = pt[I.ext] ? i[I.ext] / 5 : white
    let nl = p[P.noise] + i[I.noise] / 10
    nl = nl < 0 ? 0 : nl > 1 ? 1 : nl
    const mix = p[P.lvl1] * w1 + p[P.lvl2] * w2 + nl * noiseSrc

    // Ladder: VCF EG (scaled by velocity) ±6 oct, NOISE MOD sweeps it with noise or VCF MOD.
    const mod = pt[I.vcfmod] ? i[I.vcfmod] / 5 : white
    let fc = p[P.cutoff] * this.ctol * Math.pow(2, p[P.vcfeg] * this.vcfEnv * this.vel * 6 + p[P.noisemod] * mod * 3)
    fc = fc < 5 ? 5 : fc > this.fMax ? this.fMax : fc
    const k = 4 * p[P.res]
    const x = mix * (1 + 0.3 * k)
    const lp = this.ladder.process(x, 1 - Math.exp(-fc * this.w), k)
    const vcf = p[P.vcfmode] >= 0.5 ? x - lp : lp

    // VCA: its EG times velocity, unless VCA CV takes over.
    const amp = pt[I.vcacv] ? Math.max(0, Math.min(1.2, i[I.vcacv] / 10)) : this.vcaEnv * this.vel
    const v = vcf * 5 * amp
    this.hy = v - this.hx + this.R * this.hy
    this.hx = v

    const o = this.out
    o[O.vca] = rails(this.hy * p[P.vol] * 3)
    o[O.vcfeg] = this.vcfEnv * 8
    o[O.vcoeg] = this.vcoEnv * 8
    o[O.vco1] = w1 * 5
    o[O.vco2] = w2 * 5
    o[O.trig] = this.trigLeft > 0 ? 10 : 0
    o[O.vel] = this.vel * 8
    o[O.pitch] = seqV
    if (this.trigLeft > 0) this.trigLeft--

    const led = this.led
    for (let s = 0; s < KIN_STEPS; s++) led[KINL.step + s] = s === this.step ? 0.25 + 0.75 * Math.min(1, this.vcaEnv * (0.3 + this.vel)) : 0
    led[KINL.tempo] = running && this.clock.high ? 1 : led[KINL.tempo] * this.ledDecay
  }
}
