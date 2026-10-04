import { Dsp } from './base'
import type { MidiEvent } from '../protocol'
import { AudioOutCore, EnvCore, KeyboardCore, LadderCore, OscCore } from './cores'
import { Drift } from './drift'
import { C4, TAU, rails } from './util'

/** MONO-1 semi-modular voice. The internal signal path is fixed, but every
 *  patch-bay input is a switched jack: patched, it replaces the internal signal.
 *  The unit has its own keyboard interface and feeds the audio interface directly. */
export class MonoSystemDsp extends Dsp {
  sink = true
  private I = {
    pitch: this.ii('pitch'), gate: this.ii('gate'), fm: this.ii('fm'), pwm: this.ii('pwm'),
    vcfin: this.ii('vcfin'), cutoff: this.ii('cutoff'), vcain: this.ii('vcain'), vcacv: this.ii('vcacv'),
  }
  private O = {
    vco: this.oi('vco'), lfo: this.oi('lfo'), env: this.oi('env'), vcf: this.oi('vcf'),
    vca: this.oi('vca'), key: this.oi('key'), kgate: this.oi('kgate'),
  }
  private P = {
    tune: this.pi('tune'), wave: this.pi('wave'), pw: this.pi('pw'), pwm: this.pi('pwm'), glide: this.pi('glide'),
    lrate: this.pi('lrate'), cutoff: this.pi('cutoff'), res: this.pi('res'), envamt: this.pi('envamt'),
    lfoamt: this.pi('lfoamt'), drive: this.pi('drive'), a: this.pi('a'), d: this.pi('d'), s: this.pi('s'),
    r: this.pi('r'), mode: this.pi('mode'), vol: this.pi('vol'),
  }

  private readonly kb = new KeyboardCore()
  private readonly vco = new OscCore()
  private readonly lfo = new OscCore()
  private readonly ladder = new LadderCore()
  private readonly env = new EnvCore(this.fs, this.tol(0.05))
  private readonly audio = new AudioOutCore(this.fs)
  private readonly drift = new Drift(this.rng, this.fs)
  private readonly track = this.tol(0.0035)
  private readonly ctol = this.tol(0.03)
  private readonly w = TAU / (2 * this.fs)
  private readonly fMax = this.fs * 0.45

  onMidi(ev: MidiEvent): void {
    this.kb.midi(ev, this.fs)
  }

  /** Switched jack: the patched voltage, or the internal normal. */
  private jack(k: number, normal: number): number {
    return this.patched[k] ? this.in[k] : normal
  }

  tick(): void {
    const { I, O, P } = this
    const i = this.in
    const p = this.p

    const kb = this.kb
    kb.step(p[P.glide], this.fs)
    const keyV = kb.pitch + (kb.bend * 2) / 12
    const gateV = kb.gate ? 10 : 0

    this.lfo.step(Math.min((p[P.lrate] * this.ctol) / this.fs, 0.45), 0.5)
    const lfoV = this.lfo.tri * 5

    // Oscillator
    let pw = p[P.pw] + (this.jack(I.pwm, lfoV) / 10) * p[P.pwm]
    pw = pw < 0.03 ? 0.03 : pw > 0.97 ? 0.97 : pw
    const oct = this.jack(I.pitch, keyV) * this.track + p[P.tune] + i[I.fm] + this.drift.next(this.age)
    this.vco.step(Math.min((C4 * Math.pow(2, oct)) / this.fs, 0.45), pw)
    const wave = p[P.wave]
    const vcoV = 5 * ((1 - wave) * this.vco.saw + wave * this.vco.sqr)

    // Envelope, normalled to the keyboard gate. Legato notes don't retrigger (classic mono behaviour).
    const env = this.env.step(this.jack(I.gate, gateV), false, p[P.a], p[P.d], p[P.s], p[P.r])

    // Filter: env amount spans ±6 octaves, LFO amount ±2 octaves
    let fc = p[P.cutoff] * this.ctol * Math.pow(2, p[P.envamt] * env * 6 + (p[P.lfoamt] * lfoV) / 2.5 + i[I.cutoff])
    fc = fc < 5 ? 5 : fc > this.fMax ? this.fMax : fc
    const k = 4 * p[P.res]
    const x = (this.jack(I.vcfin, vcoV) / 5) * p[P.drive] * (1 + 0.3 * k) + (this.rng.next() - 0.5) * 2e-4
    const vcfV = this.ladder.process(x, 1 - Math.exp(-fc * this.w), k) * 5

    // VCA: CV normalled to the envelope (or held open in DRONE)
    const internalCv = p[P.mode] >= 0.5 ? 1 : env
    const cv = this.patched[I.vcacv] ? Math.max(0, i[I.vcacv] / 10) : internalCv
    const vcaV = rails(this.jack(I.vcain, vcfV) * Math.min(cv, 1.2))

    const o = this.out
    o[O.vco] = vcoV
    o[O.lfo] = lfoV
    o[O.env] = env * 10
    o[O.vcf] = vcfV
    o[O.vca] = vcaV
    o[O.key] = keyV
    o[O.kgate] = gateV

    const s = this.audio.process(vcaV, p[P.vol])
    this.audioL = s
    this.audioR = s
    this.led[0] = this.lfo.tri
    this.led[1] = env
  }
}
