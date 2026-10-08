import { track } from '../pointer'

/** Touch has no hover, so a finger held still on a control shows its tooltip. */
const HOLD_MS = 450
/** How far a finger may wobble and still be "held still" (px). */
const SLOP = 12
/** Once the finger lifts, the tooltip stays this long to be read. */
const LINGER_MS = 2500

let lingerTimer: number | undefined

/** A touch press on a control: after HOLD_MS without moving, `show` (the
 *  tooltip); once the finger moves past the slop, `moved(ev)` (the control's
 *  own drag starts there, so nothing jumps) and the tooltip goes. On lift,
 *  a shown tooltip lingers, then `hide`. Returns whether the press became a
 *  hold (a tap that held shouldn't also click). */
export function holdForTip(e: { clientX: number; clientY: number }, show: () => void, hide: () => void, moved: (ev: PointerEvent) => void): { held: () => boolean } {
  const sx = e.clientX
  const sy = e.clientY
  let held = false
  let gone = false
  window.clearTimeout(lingerTimer)
  const timer = window.setTimeout(() => {
    held = true
    show()
  }, HOLD_MS)
  track(
    (ev) => {
      if (gone || Math.hypot(ev.clientX - sx, ev.clientY - sy) < SLOP) return
      gone = true
      window.clearTimeout(timer)
      if (held) hide()
      moved(ev)
    },
    () => {
      window.clearTimeout(timer)
      if (held && !gone) lingerTimer = window.setTimeout(hide, LINGER_MS)
    },
  )
  return { held: () => held }
}
