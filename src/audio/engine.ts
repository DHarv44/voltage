import workletUrl from '../engine/worklet.ts?worker&url'
import { SPECS } from '../modules'
import type { AudioChunkMsg, FromEngine, MidiEvent, ToEngine, UiEvent } from '../engine/protocol'
import { actions, patchStore } from '../patch/store'
import type { Patch } from '../patch/types'
import { buildPatchMsg, topologyKey } from './patchMsg'
import { initMidi } from './midi'
import { telemetry } from './telemetry'
import { settings } from '../ui/settings'

export interface EngineStatus {
  power: boolean
  booting: boolean
  sampleRate: number
  latencyMs: number
  midi: string
  error: string | null
}

/** Main-thread side of the rack: owns the AudioContext + worklet node and mirrors
 *  the patch store into the engine (full rebuild on topology change, param deltas otherwise). */
class AudioEngine {
  private ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private lastTopo = ''
  private lastPatch: Patch | null = null
  private status: EngineStatus = { power: false, booting: false, sampleRate: 0, latencyMs: 0, midi: '—', error: null }
  private subs = new Set<() => void>()
  /** Hooks for the recorder and buffer manager (kept separate to avoid import cycles). */
  onAudio: ((m: AudioChunkMsg) => void) | null = null
  beforeSuspend: (() => Promise<void>) | null = null
  onBuffer: ((m: Extract<FromEngine, { type: 'buffer' }>) => void) | null = null
  /** Called after every topology change has been sent to the engine. */
  afterPatch: ((p: Patch) => void) | null = null

  getStatus = (): EngineStatus => this.status
  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  private update(s: Partial<EngineStatus>): void {
    this.status = { ...this.status, ...s }
    this.subs.forEach((f) => f())
  }

  async setPower(on: boolean): Promise<void> {
    if (!on) {
      await this.beforeSuspend?.()
      await this.ctx?.suspend()
      this.send({ type: 'midi', ev: { kind: 'panic' } })
      telemetry.clear()
      this.update({ power: false })
      return
    }
    try {
      this.update({ booting: true, error: null })
      if (!this.ctx) await this.boot()
      await this.ctx!.resume()
      const ctx = this.ctx!
      this.update({
        power: true,
        booting: false,
        sampleRate: ctx.sampleRate,
        latencyMs: (ctx.baseLatency + (ctx.outputLatency || 0)) * 1000,
      })
    } catch (err) {
      this.update({ booting: false, error: String(err) })
    }
  }

  private async boot(): Promise<void> {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.audioWorklet.addModule(workletUrl)
    const node = new AudioWorkletNode(ctx, 'voltage-rack', {
      numberOfInputs: 1, // the audio interface's input, for AUDIO IN (connected on request)
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
    node.port.onmessage = (e: MessageEvent<FromEngine>) => {
      const m = e.data
      if (m.type === 'telemetry') {
        this.applyEngineParams(m.params)
        if (this.status.power) telemetry.ingest(m)
      } else if (m.type === 'audio') this.onAudio?.(m)
      else if (m.type === 'buffer') this.onBuffer?.(m)
      else this.update({ error: m.message })
    }
    node.connect(ctx.destination)
    this.ctx = ctx
    this.node = node
    this.sync()
    patchStore.subscribe(this.sync)
    // Analog-imperfection options follow the settings.
    let last = ''
    const sendOptions = () => {
      const s = settings.get()
      const key = `${s.psuSag}/${s.crosstalk}`
      if (key === last) return
      last = key
      this.send({ type: 'options', sag: s.psuSag, crosstalk: s.crosstalk })
    }
    sendOptions()
    settings.subscribe(sendOptions)
    void initMidi((ev) => this.midi(ev), (midi) => this.update({ midi }))
  }

  midi(ev: MidiEvent): void {
    if (this.status.power) this.send({ type: 'midi', ev })
  }

  /** Watch one module's jack voltages (hover readout). */
  probe(id: string | null): void {
    this.send({ type: 'probe', id })
  }

  /** A pad hit or button press on a module's panel. */
  ui(id: string, ev: UiEvent): void {
    if (this.status.power) this.send({ type: 'ui', id, ev })
  }

  /** Values the engine changed itself (live-recorded steps) go back into the patch. */
  private applyEngineParams(params: [string, number, number][]): void {
    if (!params.length) return
    const mods = new Map(patchStore.get().modules.map((m) => [m.id, m]))
    for (const [id, index, value] of params) {
      const m = mods.get(id)
      const ps = m && SPECS[m.type].params[index]
      if (ps) actions.setParam(id, ps.id, value)
    }
  }

  /** Route a microphone/line stream into the engine's input. Returns the
   *  disconnect function (null when the engine isn't running yet). */
  connectInput(stream: MediaStream): (() => void) | null {
    if (!this.ctx || !this.node) return null
    const src = this.ctx.createMediaStreamSource(stream)
    src.connect(this.node)
    return () => src.disconnect()
  }

  send(msg: ToEngine): void {
    this.node?.port.postMessage(msg)
  }

  private sync = (): void => {
    const p = patchStore.get()
    const key = topologyKey(p)
    if (key !== this.lastTopo) {
      this.send(buildPatchMsg(p))
      this.lastTopo = key
      this.afterPatch?.(p)
    } else if (this.lastPatch) {
      const prev = new Map(this.lastPatch.modules.map((m) => [m.id, m]))
      for (const m of p.modules) {
        const old = prev.get(m.id)
        if (!old || old.params === m.params) continue
        SPECS[m.type].params.forEach((ps, index) => {
          const v = m.params[ps.id]
          if (v !== old.params[ps.id]) this.send({ type: 'param', id: m.id, index, value: v })
        })
      }
    }
    this.lastPatch = p
  }
}

export const engine = new AudioEngine()
