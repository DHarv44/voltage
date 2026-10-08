import { useEffect, useState, useSyncExternalStore } from 'react'
import { engine } from '../../audio/engine'
import { telemetry } from '../../audio/telemetry'
import { SPECS } from '../../modules'
import { jackInfo, SIGNALS } from '../../modules/jackInfo'
import { patchStore } from '../../patch/store'
import { useSettings } from '../settings'
import { useJackHover } from './jackHover'

const fmt = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`

/** The jack tooltip: what the jack is (its name, the kind of signal, what it
 *  does), the live voltage on it (DC for steady signals, range and
 *  peak-to-peak for moving ones), and with "Explain" on, what that kind of
 *  signal is in plain words. */
export function JackReadout() {
  const hover = useJackHover()
  const { explain } = useSettings()
  const power = useSyncExternalStore(engine.subscribe, engine.getStatus).power
  const [, tick] = useState(0)

  useEffect(() => (hover ? telemetry.subscribe(() => tick((n) => n + 1)) : undefined), [hover])
  if (!hover) return null

  const m = patchStore.get().modules.find((x) => x.id === hover.mod)
  if (!m) return null
  const spec = SPECS[m.type]
  const list = hover.dir === 'in' ? spec.inputs : spec.outputs
  const idx = list.findIndex((j) => j.id === hover.jack)
  const info = jackInfo(spec, hover.jack, hover.dir)
  const sig = SIGNALS[info.signal]

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
    <div className={explain ? 'jack-readout explain' : 'jack-readout'} style={{ left: hover.x + 14, top: hover.y + 14 }}>
      <span className="jr-name">
        {spec.title} · {info.label} <em>{hover.dir === 'in' ? 'input' : 'output'}</em>
      </span>
      <span className={`jr-sig sig-${info.signal}`}>
        {sig.name}
        {info.poly && ' · poly'}
      </span>
      <span className="jr-what">{info.what}</span>
      {explain && <span className="jr-explain">{sig.explain}</span>}
      <span className="jr-value">{reading}</span>
    </div>
  )
}
