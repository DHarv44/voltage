import { chordQuality, chordRoot } from '../../../modules/specs/combo/chords'
import type { ModuleSpec } from '../../../modules/types'
import { GATE_SLOTS, type Band } from './band'

const PULSE_S = 0.005
const DRUM_JACKS = ['kick', 'snare', 'hat', 'ohat', 'ride', 'tom', 'perc', 'crash']

/** The band as voltages, for whichever of these jacks a module has (COMBO
 *  CORE all of them, COMBO a few): a 5 ms trigger per drum and on accents,
 *  the bass line's pitch and gate, the chord (poly) and its root, the clock
 *  in 16ths and a pulse at the top of each part. */
export class BandOutputs {
  private readonly gates: number[]
  private readonly acc: number
  private readonly bass: number
  private readonly bgate: number
  private readonly chord: number
  private readonly root: number
  private readonly clk: number
  private readonly rst: number
  private readonly timer = new Int32Array(10)
  private readonly pulse: number

  constructor(spec: ModuleSpec, fs: number) {
    const at = (id: string) => spec.outputs.findIndex((j) => j.id === id)
    this.gates = DRUM_JACKS.map(at)
    this.acc = at('acc')
    this.bass = at('bass')
    this.bgate = at('bgate')
    this.chord = at('chord')
    this.root = at('root')
    this.clk = at('clko')
    this.rst = at('rsto')
    this.pulse = Math.round(PULSE_S * fs)
  }

  write(b: Band, o: Float64Array, polyOut: (Float64Array | null)[], chans: Int32Array): void {
    const t = this.timer
    let accent = false
    for (let k = 0; k < 8; k++) {
      const v = b.hit[GATE_SLOTS[k]]
      if (v > 0) t[k] = this.pulse
      if (v >= 0.9) accent = true
      if (this.gates[k] >= 0) o[this.gates[k]] = t[k] > 0 ? 10 : 0
      if (t[k] > 0) t[k]--
    }
    if (accent) t[8] = this.pulse
    if (this.acc >= 0) o[this.acc] = t[8] > 0 ? 10 : 0
    if (t[8] > 0) t[8]--
    if (b.tick16 || b.partStart) t[9] = this.pulse
    if (this.bass >= 0) o[this.bass] = (b.bassPitch - 60) / 12
    if (this.bgate >= 0) o[this.bgate] = b.bassGate ? 10 : 0
    if (this.clk >= 0) o[this.clk] = t[9] > 0 ? 10 : 0
    if (this.rst >= 0) o[this.rst] = b.partStart ? 10 : 0
    if (t[9] > 0) t[9]--
    if (this.chord >= 0) {
      const c = b.chord
      const tones = c >= 0 ? chordQuality(c).tones : null
      const root = c >= 0 ? 48 + chordRoot(c) : 48
      const n = tones ? tones.length : 1
      const poly = polyOut[this.chord]!
      for (let k = 0; k < n; k++) poly[k] = tones ? (root + tones[k] - 60) / 12 : 0
      o[this.chord] = poly[0]
      chans[this.chord] = n
      if (this.root >= 0) o[this.root] = (root - 60) / 12
    }
  }
}
