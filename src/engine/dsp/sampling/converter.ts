import { Biquad } from '../biquad'

/** What a sampler's converters do to a sound: the period hardware's bits,
 *  rate and filters (or the lack of them). */
export interface Era {
  name: string
  /** Bits kept (16 = clean). */
  bits: number
  /** Its sample rate (Hz). */
  rate: number
  /** 8-bit companding (µ-law-like): quiet detail survives, loud gets gritty. */
  companded: boolean
  /** The anti-alias filter on the way in (Hz; 0 = none: everything above
   *  half the rate folds back down, the gritty classic). */
  aa: number
  /** The reconstruction filter on the way out (Hz; 0 = none: the steps of
   *  the hold are heard as a metallic haze). */
  recon: number
  /** A touch of analog warmth in the output stage. */
  drive: number
}

/** The periods ERA (and the samplers) can sound like: our own names for the
 *  hardware generations, not the makers'. */
export const ERAS: Era[] = [
  { name: 'CLEAN', bits: 16, rate: 48000, companded: false, aa: 20000, recon: 20000, drive: 0 },
  { name: 'EARLY 8-BIT', bits: 8, rate: 30200, companded: false, aa: 0, recon: 9000, drive: 0.2 },
  { name: 'COMPANDED', bits: 8, rate: 27700, companded: true, aa: 12000, recon: 10000, drive: 0.15 },
  { name: '12-BIT PUNCH', bits: 12, rate: 26040, companded: false, aa: 0, recon: 0, drive: 0.35 },
  { name: '12-BIT WARM', bits: 12, rate: 40000, companded: false, aa: 18000, recon: 15000, drive: 0.3 },
  { name: 'HOME COMPUTER', bits: 8, rate: 28867, companded: false, aa: 0, recon: 3300, drive: 0.1 },
  { name: '90s RACK', bits: 16, rate: 32000, companded: false, aa: 14000, recon: 14000, drive: 0.1 },
  { name: 'TOY', bits: 6, rate: 11025, companded: false, aa: 0, recon: 0, drive: 0.4 },
]

/** Quantise x (−1..1) to `bits`, optionally through 8-bit-style companding. */
export function quantise(x: number, bits: number, companded: boolean): number {
  const q = Math.pow(2, bits - 1)
  if (!companded) return Math.round(x * q) / q
  // µ-law-like: compress, quantise, expand
  const mu = 255
  const s = Math.sign(x)
  const c = (s * Math.log(1 + mu * Math.min(1, Math.abs(x)))) / Math.log(1 + mu)
  const cq = Math.round(c * q) / q
  return (Math.sign(cq) * (Math.pow(1 + mu, Math.abs(cq)) - 1)) / mu
}

/** A converter pair run on a continuous signal (a cable through ERA, or a
 *  sampler's input while it records): the anti-alias filter (if the era had
 *  one), a sample-and-hold at the era's rate, the bits, then the
 *  reconstruction filter (if it had one) and its output stage. Signals are
 *  in volts (±5 V full scale). */
export class Converter {
  private readonly aa1: Biquad
  private readonly aa2: Biquad
  private readonly rc1: Biquad
  private readonly rc2: Biquad
  private era: Era | null = null
  private rate = 48000
  private ph = 1
  private held = 0

  constructor(private readonly fs: number) {
    this.aa1 = new Biquad(fs)
    this.aa2 = new Biquad(fs)
    this.rc1 = new Biquad(fs)
    this.rc2 = new Biquad(fs)
  }

  /** Set the era, and (optionally) override its rate (Hz) and bits. */
  set(era: Era, rate = era.rate, bits = era.bits): void {
    if (this.era !== era || this.rate !== rate) {
      const aa = era.aa > 0 ? Math.min(era.aa, rate * 0.45) : this.fs * 0.49
      const rc = era.recon > 0 ? Math.min(era.recon, rate * 0.5) : this.fs * 0.49
      this.aa1.lowpass(aa, 0.54)
      this.aa2.lowpass(aa, 1.31)
      this.rc1.lowpass(rc, 0.54)
      this.rc2.lowpass(rc, 1.31)
    }
    this.era = era
    this.rate = rate
    this.bits = bits
  }

  private bits = 16

  run(x: number): number {
    const e = this.era
    if (!e) return x
    let v = x / 5
    if (e.aa > 0) v = this.aa2.run(this.aa1.run(v))
    this.ph += this.rate / this.fs
    if (this.ph >= 1) {
      this.ph -= Math.floor(this.ph)
      this.held = quantise(Math.max(-1, Math.min(1, v)), this.bits, e.companded)
    }
    let y = this.held
    if (e.recon > 0) y = this.rc2.run(this.rc1.run(y))
    if (e.drive > 0) y = Math.tanh(y * (1 + e.drive * 2)) / Math.tanh(1 + e.drive * 2)
    return y * 5
  }
}
