import { useEffect, type RefObject } from 'react'
import { telemetry } from '../../audio/telemetry'
import { patchStore } from '../../patch/store'

/** Rack-wide light show: while a LIGHTS module is on the rack, its bass / mid /
 *  treble levels tint the case and rows (CSS variables on the rack element).
 *  Several LIGHTS modules add together. */
export function useLightShow(rack: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    let r = 0
    let g = 0
    let b = 0
    return telemetry.subscribe(() => {
      const el = rack.current
      if (!el) return
      let lr = 0
      let lg = 0
      let lb = 0
      let any = false
      for (const m of patchStore.get().modules) {
        if (m.type !== 'lightshow') continue
        const led = telemetry.leds[m.id]
        if (!led) continue
        any = true
        lr += led[0]
        lg += led[1]
        lb += led[2]
      }
      // a little smoothing on the main thread too, so the glow breathes
      r += (Math.min(1, lr) - r) * 0.5
      g += (Math.min(1, lg) - g) * 0.5
      b += (Math.min(1, lb) - b) * 0.5
      if (!any && r + g + b < 0.01) {
        el.style.removeProperty('--show')
        return
      }
      el.style.setProperty('--show', `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${Math.min(0.9, (r + g + b) * 0.6)})`)
    })
  }, [rack])
}
