import { Graph } from './graph'
import type { AudioChunkMsg, ToEngine } from './protocol'

const TELEMETRY_HZ = 30
const REC_CHUNK = 16384

class VoltageRackProcessor extends AudioWorkletProcessor {
  private graph = new Graph(sampleRate)
  private since = 0
  private failed = false
  private recording = false
  private recL = new Float32Array(REC_CHUNK)
  private recR = new Float32Array(REC_CHUNK)
  private recN = 0

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<ToEngine>) => this.handle(e.data)
  }

  private handle(m: ToEngine): void {
    switch (m.type) {
      case 'patch':
        this.graph.applyPatch(m)
        this.failed = false
        break
      case 'param':
        this.graph.setParam(m.id, m.index, m.value)
        break
      case 'midi':
        this.graph.midi(m.ev)
        break
      case 'ui':
        this.graph.ui(m.id, m.ev)
        break
      case 'probe':
        this.graph.setProbe(m.id)
        break
      case 'record':
        if (m.on) this.recN = 0
        else if (this.recording) this.flush(true)
        this.recording = m.on
        break
    }
  }

  private flush(final: boolean): void {
    const msg: AudioChunkMsg = { type: 'audio', l: this.recL.slice(0, this.recN), r: this.recR.slice(0, this.recN), final }
    this.port.postMessage(msg, [msg.l.buffer, msg.r.buffer])
    this.recN = 0
  }

  private capture(l: Float32Array, r: Float32Array): void {
    for (let i = 0; i < l.length; i++) {
      this.recL[this.recN] = l[i]
      this.recR[this.recN] = r[i]
      if (++this.recN === REC_CHUNK) this.flush(false)
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]
    if (!out || !out[0] || this.failed) return true
    try {
      this.graph.process(out[0].length, out[0], out[1] ?? null)
    } catch (err) {
      this.failed = true
      this.port.postMessage({ type: 'error', message: String(err) })
    }
    if (this.recording) this.capture(out[0], out[1] ?? out[0])
    this.since += out[0].length
    if (this.since >= sampleRate / TELEMETRY_HZ) {
      this.since = 0
      this.port.postMessage(this.graph.telemetry())
    }
    return true
  }
}

registerProcessor('voltage-rack', VoltageRackProcessor)
