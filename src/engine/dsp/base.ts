import type { ModuleSpec } from '../../modules/types'
import type { MidiEvent, UiEvent } from '../protocol'
import { Rng } from './util'

/** One module's circuit. The graph copies upstream output voltages into `in`
 *  each sample, calls tick(), and downstream modules read `out`.
 *  `patched[i]` mirrors a switched jack: modules use it for normalled inputs. */
export abstract class Dsp {
  readonly spec: ModuleSpec
  readonly fs: number
  readonly in: Float64Array
  readonly out: Float64Array
  readonly patched: Uint8Array
  /** 1 where an output has a cable plugged in (for outputs that break a normal, e.g. VCA mixer channels). */
  readonly outPatched: Uint8Array
  readonly srcMod: (Dsp | null)[]
  readonly srcOut: Int32Array
  /** Smoothed parameter values, in spec order. */
  readonly p: Float64Array
  readonly led: Float32Array
  readonly rng: Rng
  /** Seconds since this module was powered (drives warm-up). */
  age = 0
  /** True for modules that feed the audio interface. */
  sink = false
  audioL = 0
  audioR = 0

  /** Engine-originated param changes awaiting telemetry: flat [index, value, …]. */
  readonly paramWrites: number[] = []

  private readonly target: Float64Array
  private readonly smooth: Uint8Array
  /** Indices of continuous params (only these are glided each sample). */
  private readonly smoothIdx: Int32Array
  private readonly k: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    this.spec = spec
    this.fs = fs
    const ni = spec.inputs.length
    this.in = new Float64Array(ni)
    this.out = new Float64Array(spec.outputs.length)
    this.outPatched = new Uint8Array(spec.outputs.length)
    this.patched = new Uint8Array(ni)
    this.srcMod = new Array<Dsp | null>(ni).fill(null)
    this.srcOut = new Int32Array(ni)
    this.p = Float64Array.from(spec.params, (ps) => ps.def)
    this.target = Float64Array.from(spec.params, (ps) => ps.def)
    this.smooth = Uint8Array.from(spec.params, (ps) => (ps.stepped ? 0 : 1))
    this.smoothIdx = Int32Array.from(spec.params.flatMap((ps, i) => (ps.stepped ? [] : [i])))
    this.k = 1 - Math.exp(-1 / (0.004 * fs))
    this.led = new Float32Array(spec.leds ?? 0)
    this.rng = new Rng(seed)
  }

  protected ii(id: string): number {
    return indexOf(this.spec.inputs, id, this.spec.type)
  }
  protected oi(id: string): number {
    return indexOf(this.spec.outputs, id, this.spec.type)
  }
  protected pi(id: string): number {
    return indexOf(this.spec.params, id, this.spec.type)
  }

  /** Component tolerance: a fixed multiplier drawn once per instance (spread = 1σ). */
  protected tol(spread: number): number {
    return 1 + this.rng.gauss() * spread
  }

  setParam(i: number, v: number, snap = false): void {
    this.target[i] = v
    if (snap || !this.smooth[i]) this.p[i] = v
  }

  /** The engine changes one of its own params (e.g. a live-recorded step);
   *  telemetry carries it back to the patch so the panel and save file agree. */
  protected writeParam(i: number, v: number): void {
    this.setParam(i, v, true)
    this.paramWrites.push(i, v)
  }

  /** ~4 ms one-pole glide on knob moves so turning a pot never zippers. */
  stepParams(): void {
    const t = this.target
    const p = this.p
    const idx = this.smoothIdx
    const k = this.k
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j]
      p[i] += (t[i] - p[i]) * k
    }
  }

  abstract tick(): void
  onMidi?(ev: MidiEvent): void
  onUi?(ev: UiEvent): void
  /** Scope-style modules hand a completed capture to telemetry, then re-arm. */
  takeFrame?(): Float32Array | null
}

function indexOf(list: { id: string }[], id: string, type: string): number {
  const i = list.findIndex((j) => j.id === id)
  if (i < 0) throw new Error(`${type}: unknown id "${id}"`)
  return i
}
