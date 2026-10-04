import type { Dsp } from './dsp/base'
import { createDsp } from './dsp/registry'
import type { MidiEvent, TelemetryMsg, ToEngine, UiEvent } from './protocol'
import { Probe } from './probe'

type PatchMsg = Extract<ToEngine, { type: 'patch' }>

/** The rack. Every module runs once per sample in dependency order; a cable
 *  that closes a feedback loop simply reads last sample's value, i.e. a
 *  1-sample delay, which is what makes feedback patches possible. */
export class Graph {
  private mods = new Map<string, Dsp>()
  private order: Dsp[] = []
  private probe: Probe | null = null
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
    }
    this.mods = next
    if (this.probe) this.setProbe(this.probe.id) // re-attach (or drop) after the rebuild
    this.order = topoOrder([...next.values()])
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
