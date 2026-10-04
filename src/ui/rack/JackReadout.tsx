import { useEffect, useState, useSyncExternalStore } from 'react'
import { engine } from '../../audio/engine'
import { telemetry } from '../../audio/telemetry'
import { SPECS } from '../../modules'
import { patchStore } from '../../patch/store'
import { useJackHover } from './jackHover'

const fmt = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`

/** Floating multimeter next to the hovered jack: DC value for steady signals,
 *  range and peak-to-peak for moving ones. */
export function JackReadout() {
  const hover = useJackHover()
  const power = useSyncExternalStore(engine.subscribe, engine.getStatus).power
  const [, tick] = useState(0)

  useEffect(() => (hover ? telemetry.subscribe(() => tick((n) => n + 1)) : undefined), [hover])
  if (!hover) return null

  const m = patchStore.get().modules.find((x) => x.id === hover.mod)
  if (!m) return null
  const spec = SPECS[m.type]
  const list = hover.dir === 'in' ? spec.inputs : spec.outputs
  const idx = list.findIndex((j) => j.id === hover.jack)
  const label = list[idx]?.label || `${hover.dir === 'in' ? 'IN' : 'OUT'} ${idx + 1}`

  let reading = 'power off'
  const p = telemetry.probe
  if (power && p && p.id === hover.mod) {
    const pair = (hover.dir === 'in' ? p.ins : p.outs)[idx]
    if (pair) {
      const [lo, hi] = pair
      reading = hi - lo < 0.05 ? `${fmt((lo + hi) / 2)} V` : `${fmt(lo)} … ${fmt(hi)} V  (p-p ${(hi - lo).toFixed(2)})`
    }
  } else if (power) reading = '…'

  return (
    <div className="jack-readout" style={{ left: hover.x + 14, top: hover.y + 14 }}>
      <span className="jr-name">
        {spec.title} · {label} <em>{hover.dir === 'in' ? 'input' : 'output'}</em>
      </span>
      <span className="jr-value">{reading}</span>
    </div>
  )
}
