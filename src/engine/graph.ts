import type { Dsp } from './dsp/base'
import { createDsp } from './dsp/registry'
import type { MidiEvent, TelemetryMsg, ToEngine, UiEvent } from './protocol'
import { Probe } from './probe'
import { CROSSTALK, NOMINAL_RAIL, power } from './dsp/power'

type PatchMsg = Extract<ToEngine, { type: 'patch' }>

/** The rack. Every module runs once per sample in dependency order; a cable
 *  that closes a feedback loop simply reads last sample's value, i.e. a
 *  1-sample delay, which is what makes feedback patches possible. */
export class Graph {
  private mods = new Map<string, Dsp>()
  private order: Dsp[] = []
  private probe: Probe | null = null
  private sag = 0
  private readonly fs: number

  constructor(fs: number) {
    this.fs = fs
  }

  /** Rebuild wiring; module instances (and their phase/state) survive by id. */
  applyPatch(msg: PatchMsg): void {
    const next = new Map<string, Dsp>()
    for (const m of msg.modules) {
      let d = this.mods.get(m.id)
      const fresh = !d || d.spec.type !== m.type
      if (fresh) d = createDsp(m.type, this.fs, m.seed) ?? undefined
      if (!d) continue
      m.params.forEach((v, i) => d!.setParam(i, v, fresh))
      d.srcMod.fill(null)
      d.patched.fill(0)
      d.outPatched.fill(0)
      d.in.fill(0)
      next.set(m.id, d)
    }
    for (const c of msg.cables) {
      const from = next.get(c.from)
      const to = next.get(c.to)
      if (!from || !to || c.toIn < 0 || c.fromOut < 0) continue
      to.srcMod[c.toIn] = from
      to.srcOut[c.toIn] = c.fromOut
      to.patched[c.toIn] = 1
      from.outPatched[c.fromOut] = 1
    }
    this.mods = next
    if (this.probe) this.setProbe(this.probe.id) // re-attach (or drop) after the rebuild
    this.order = topoOrder([...next.values()])
  }

  getModule(id: string): Dsp | undefined {
    return this.mods.get(id)
  }

  setParam(id: string, index: number, value: number): void {
    this.mods.get(id)?.setParam(index, value)
  }

  midi(ev: MidiEvent): void {
    for (const d of this.mods.values()) d.onMidi?.(ev)
  }

  ui(id: string, ev: UiEvent): void {
    this.mods.get(id)?.onUi?.(ev)
  }

  process(n: number, L: Float32Array, R: Float32Array | null): void {
    const order = this.order
    const len = order.length
    const xt = power.crosstalk
    for (let s = 0; s < n; s++) {
      let l = 0
      let r = 0
      for (let k = 0; k < len; k++) {
        const m = order[k]
        const src = m.srcMod
        const so = m.srcOut
        const inp = m.in
        for (let i = 0; i < src.length; i++) {
          const sm = src[i]
          if (sm) inp[i] = sm.out[so[i]]
        }
        if (xt) for (let i = 1; i < src.length; i++) if (src[i] && src[i - 1]) inp[i] += CROSSTALK * inp[i - 1]
        m.stepParams()
        m.tick()
        if (m.sink) {
          l += m.audioL
          r += m.audioR
        }
      }
      L[s] = l
      if (R) R[s] = r
      this.probe?.sample()
    }
    const dt = n / this.fs
    for (let k = 0; k < len; k++) order[k].age += dt
    this.updatePower(n)
  }

  /** Supply sag: total output current (≈ Σ|V| across all outputs) drags the
   *  rails down and the expo converters flat, with ~80 ms supply recovery. */
  private updatePower(n: number): void {
    if (!power.sagOn) {
      power.rail = NOMINAL_RAIL
      power.pitchSag = 0
      this.sag = 0
      return
    }
    let load = 0
    let outs = 0
    for (const m of this.order) {
      const o = m.out
      for (let k = 0; k < o.length; k++) load += o[k] < 0 ? -o[k] : o[k]
      outs += o.length
    }
    const level = Math.min(1, load / (5 * Math.max(8, outs * 0.5)))
    this.sag += (level - this.sag) * (1 - Math.exp(-n / (0.08 * this.fs)))
    power.rail = NOMINAL_RAIL - 2 * this.sag
    power.pitchSag = -0.004 * this.sag
  }

  setOptions(sag: boolean, crosstalk: boolean): void {
    power.sagOn = sag
    power.crosstalk = crosstalk
  }

  telemetry(): TelemetryMsg {
    const leds: Record<string, number[]> = {}
    const scopes: Record<string, Float32Array> = {}
    const params: [string, number, number][] = []
    for (const [id, d] of this.mods) {
      if (d.led.length) leds[id] = Array.from(d.led)
      const f = d.takeFrame?.()
      if (f) scopes[id] = f
      const w = d.paramWrites
      for (let i = 0; i < w.length; i += 2) params.push([id, w[i], w[i + 1]])
      w.length = 0
    }
    return { type: 'telemetry', leds, scopes, params, probe: this.probe?.take() }
  }

  loadBuffer(id: string, slot: number, rate: number, data: Float32Array): void {
    this.mods.get(id)?.loadBuffer?.(slot, rate, data)
  }

  dumpBuffer(id: string, slot: number): { rate: number; data: Float32Array } | null {
    return this.mods.get(id)?.dumpBuffer?.(slot) ?? null
  }

  /** Buffers changed since the last call (to be persisted by the main thread). */
  takeBuffers(): { id: string; slot: number; rate: number; data: Float32Array }[] {
    const out: { id: string; slot: number; rate: number; data: Float32Array }[] = []
    for (const [id, d] of this.mods) {
      if (!d.bufferOut.length) continue
      for (const b of d.bufferOut) out.push({ id, ...b })
      d.bufferOut.length = 0
    }
    return out
  }

  /** Start/stop watching one module's jack voltages for the hover readout. */
  setProbe(id: string | null): void {
    const d = id ? this.mods.get(id) : undefined
    this.probe = id && d ? new Probe(id, d) : null
  }
}

/** Upstream-first order via DFS; back edges (cycles) are skipped, becoming z⁻¹. */
function topoOrder(mods: Dsp[]): Dsp[] {
  const out: Dsp[] = []
  const state = new Map<Dsp, number>() // 1 visiting, 2 done
  const visit = (d: Dsp) => {
    if (state.has(d)) return
    state.set(d, 1)
    for (const s of d.srcMod) if (s && !state.has(s)) visit(s)
    state.set(d, 2)
    out.push(d)
  }
  mods.forEach(visit)
  return out
}
