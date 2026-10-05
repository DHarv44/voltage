import type { ParamSpec } from '../../modules/types'
import { formatParam, fromNorm, toNorm } from '../../modules/params'
import { track } from '../pointer'

/** How every knob behaves, whatever draws it (the SVG panel knob, or a knob
 *  painted on a surface canvas like the POCKETs'): its sweep, its tick marks,
 *  drag and wheel gestures, reset and tooltip. */

/** The pointer sweeps 270°, from −135° (min) to +135° (max). */
export const SWEEP = 270
export const knobAngle = (ps: ParamSpec, value: number) => -SWEEP / 2 + SWEEP * toNorm(ps, value)

/** More detents than this and a stepped knob just gets the plain scale. */
const MAX_DETENT_TICKS = 25
const PLAIN = Array.from({ length: 11 }, (_, i) => ({ angle: -135 + i * 27, major: i === 0 || i === 5 || i === 10 }))

/** Tick marks. A stepped knob gets one per position, exactly where the pointer
 *  lands (ends long); a continuous knob gets the plain 11-mark scale. */
export function knobTicks(ps: ParamSpec): { angle: number; major: boolean }[] {
  const n = ps.max - ps.min + 1
  if (!ps.stepped || n > MAX_DETENT_TICKS || n < 2) return PLAIN
  return Array.from({ length: n }, (_, i) => ({ angle: knobAngle(ps, ps.min + i), major: i === 0 || i === n - 1 }))
}

/** Pixels of drag for a full sweep (Shift: fine). */
const DRAG_PX = 220
const DRAG_PX_FINE = 1200
/** Wheel notches for a full sweep of a continuous knob (Shift: fine). */
const WHEEL_STEPS = 50
const WHEEL_STEPS_FINE = 250

/** Should this pointer button turn a knob? Left or middle; right falls through
 *  to the panel's menu. */
export const turnsKnob = (e: { button: number }) => e.button === 0 || e.button === 1

/** Drag up/down to turn (left or middle button; Shift: fine). Stepped knobs
 *  land on their detents. `set` is only called when the value changes. */
export function dragKnob(e: { clientY: number }, ps: ParamSpec, value: number, set: (v: number) => void, done?: () => void): void {
  const d = { y: e.clientY, n: toNorm(ps, value), v: value }
  track(
    (ev) => {
      d.n = Math.min(1, Math.max(0, d.n + (d.y - ev.clientY) / (ev.shiftKey ? DRAG_PX_FINE : DRAG_PX)))
      d.y = ev.clientY
      const v = fromNorm(ps, d.n)
      if (v !== d.v) {
        d.v = v
        set(v)
      }
    },
    () => done?.(),
  )
}

/** A wheel turner with its own fractional-notch memory (smooth trackpads and
 *  high-res wheels). Up = clockwise. Stepped knobs move one detent per whole
 *  notch. Returns the new value, or null for "no change yet". */
export function wheelTurner() {
  let acc = 0
  return (e: { deltaY: number; deltaMode: number; shiftKey: boolean }, ps: ParamSpec, value: number): number | null => {
    acc += -e.deltaY / (e.deltaMode === 1 ? 3 : 100)
    let next: number
    if (ps.stepped) {
      const notches = Math.trunc(acc)
      if (!notches) return null
      acc -= notches
      next = Math.min(ps.max, Math.max(ps.min, value + notches))
    } else {
      next = fromNorm(ps, toNorm(ps, value) + acc / (e.shiftKey ? WHEEL_STEPS_FINE : WHEEL_STEPS))
      acc = 0
    }
    return next === value ? null : next
  }
}

/** The tooltip every knob shows: what it is, where it is, and how to use it. */
export function knobTooltip(ps: ParamSpec, value: number, label = ps.label): string {
  const how = ps.stepped
    ? `Scroll or drag to choose${ps.options ? ` (${ps.options.join(' / ')})` : ''}`
    : 'Scroll or drag to turn (Shift: fine)'
  return `${label || ps.label}: ${formatParam(ps, value)}\n${how} · double-click: ${formatParam(ps, ps.def)}`
}
