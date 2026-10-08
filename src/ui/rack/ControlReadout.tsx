import { useEffect, useState } from 'react'
import { SPECS } from '../../modules'
import { formatParam } from '../../modules/params'
import { paramInfo } from '../../modules/paramInfo'
import { patchStore } from '../../patch/store'
import { useSettings } from '../settings'
import { useControlHover } from './controlHover'

/** The knob and switch tooltip: its name and value, how to use it, and with
 *  "Explain" on, what it does in plain words. Appears after a short pause
 *  (CSS) so sweeping across a panel doesn't flicker. */
export function ControlReadout() {
  const hover = useControlHover()
  const { explain } = useSettings()
  const [, tick] = useState(0)

  // the value follows the knob as it's scrolled
  useEffect(() => (hover ? patchStore.subscribe(() => tick((n) => n + 1)) : undefined), [hover])
  if (!hover) return null

  const m = patchStore.get().modules.find((x) => x.id === hover.mod)
  if (!m) return null
  const spec = SPECS[m.type]
  const name = hover.label || hover.ps.label
  const what = explain ? paramInfo(spec, hover.ps, hover.label) : undefined

  return (
    <div
      key={`${hover.mod}:${hover.ps.id}`}
      className="jack-readout control-readout"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <span className="jr-name">
        {spec.title} · {name}
      </span>
      <span className="jr-value">{formatParam(hover.ps, hover.read())}</span>
      {what && <span className="jr-what">{what}</span>}
      <span className="jr-how">{hover.how}</span>
    </div>
  )
}
