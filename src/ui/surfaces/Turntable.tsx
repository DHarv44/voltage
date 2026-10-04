import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { TTL } from '../../modules/specs/turntable'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'
import { paintPlatter } from './turntableDraw'

const RPS_33 = 100 / 3 / 60

/** The platter. Left-drag on the record to scratch (the hand's rotation is the
 *  record's rotation); let go and the motor takes it back to speed. */
export function Turntable({ inst, spec, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  // Engine angle arrives at 30 Hz; extrapolate with the reported speed between frames.
  const seen = useRef({ frames: -1, angle: 0, speed: 0, at: 0, unwrapped: 0 })
  const hand = useRef<{ start: number; revs: number; base: number } | null>(null)

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    const led = telemetry.leds[mod]
    if (!ctx) return
    const s = seen.current
    if (led && telemetry.frames !== s.frames) {
      s.frames = telemetry.frames
      // Unwrap the 0..1 engine angle so drawing never jumps backwards.
      let d = led[TTL.angle] - s.angle
      d -= Math.round(d)
      s.unwrapped += d
      s.angle = led[TTL.angle]
      s.speed = led[TTL.speed]
      s.at = now
    }
    const h = hand.current
    const angle = h ? h.base + h.revs : s.unwrapped + s.speed * RPS_33 * Math.min(0.1, now - s.at)
    paintPlatter(
      ctx,
      W,
      H,
      {
        angle,
        pos: led?.[TTL.pos] ?? 0,
        held: !!h,
        motor: (led?.[TTL.motor] ?? 0) > 0.5,
        rec: (led?.[TTL.rec] ?? 0) > 0.5,
        pressing: (led?.[TTL.pressing] ?? 0) > 0.5,
        accent: spec.panel.accent,
      },
      now,
    )
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const cx = r.left + r.width * 0.47
    const cy = r.top + r.height * 0.52
    const R = Math.min(r.width, r.height) * 0.46 * 0.92
    if (Math.hypot(e.clientX - cx, e.clientY - cy) > R) return // grabbing the plinth moves the panel
    e.stopPropagation()
    e.preventDefault()
    const ang = (ev: { clientX: number; clientY: number }) => Math.atan2(ev.clientY - cy, ev.clientX - cx) / (Math.PI * 2)
    let last = ang(e)
    const s = seen.current
    hand.current = { start: last, revs: 0, base: s.unwrapped + s.speed * RPS_33 * Math.min(0.1, performance.now() / 1000 - s.at) }
    sendSurface(mod, 'hand', 0, 0, true)
    track(
      (ev) => {
        const a = ang(ev)
        let d = a - last
        d -= Math.round(d) // across the ±½-turn seam
        last = a
        hand.current!.revs += d
        sendSurface(mod, 'hand', hand.current!.revs, 0, true)
      },
      () => {
        const h = hand.current!
        seen.current.unwrapped = h.base + h.revs
        hand.current = null
        sendSurface(mod, 'hand', h.revs, 0, false)
      },
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'grab' }}
      onPointerDown={down}
    />
  )
}
