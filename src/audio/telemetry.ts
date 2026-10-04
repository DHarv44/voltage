import type { ProbeFrame, TelemetryMsg } from '../engine/protocol'

type Fn = () => void
const subs = new Set<Fn>()

/** Latest LED levels and scope frames from the engine (~30 Hz). Components
 *  subscribe and paint directly, so meters never re-render React. */
export const telemetry = {
  leds: {} as Record<string, number[]>,
  scopes: {} as Record<string, Float32Array>,
  probe: null as ProbeFrame | null,
  frames: 0,

  subscribe(fn: Fn): () => void {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },

  ingest(m: TelemetryMsg): void {
    telemetry.leds = m.leds
    telemetry.probe = m.probe ?? null
    for (const [id, f] of Object.entries(m.scopes)) telemetry.scopes[id] = f
    telemetry.frames++
    subs.forEach((f) => f())
  },

  clear(): void {
    telemetry.leds = {}
    telemetry.scopes = {}
    subs.forEach((f) => f())
  },
}
