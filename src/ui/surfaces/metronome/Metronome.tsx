import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { METL, SUBDIVS } from '../../../modules/specs/metronomes'
import { patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { RES, sendSurface, useFrame, type SurfaceProps } from '../common'
import { drawBeats, drawTempo, FONT } from './draw'

const ON = '#4fc6d6'

/** METRONOME's screen: the tempo (or the tempo it hears at CLK), the beat
 *  lights, the subdivision. Tap it in time to set the tempo. */
export function Metronome({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const tapAt = useRef(0)

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const led = telemetry.leds[mod]
    const following = (led?.[METL.bpm] ?? 0) > 0
    ctx.fillStyle = '#0f1417'
    ctx.fillRect(0, 0, W, H)
    // a tap shows as a quick ring
    const since = now - tapAt.current
    if (since < 250) {
      ctx.strokeStyle = `rgba(79,198,214,${(1 - since / 250) * 0.6})`
      ctx.lineWidth = H * 0.03
      ctx.strokeRect(H * 0.02, H * 0.02, W - H * 0.04, H - H * 0.04)
    }
    drawTempo(ctx, following ? led![METL.bpm] : p.bpm, W / 2, H * 0.36, H * 0.42, '#e8f6f8', following ? 'CLK' : 'BPM')
    const beats = Math.max(1, Math.round(p.beats))
    drawBeats(ctx, { x: W * 0.06, y: H * 0.62, w: W * 0.88, h: H * 0.2 }, beats, led?.[METL.beat] ?? -1, { on: ON, off: '#24343a', flash: led?.[METL.flash] })
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(H * 0.09)}px ${FONT}`
    ctx.fillStyle = 'rgba(232,246,248,0.55)'
    const sub = Math.round(p.sub)
    ctx.fillText(`${beats}/4${sub > 0 ? ` · ${SUBDIVS[sub]}` : ''}`, W * 0.05, H * 0.9)
    ctx.textAlign = 'right'
    ctx.fillText(following ? 'FOLLOWING CLK' : 'TAP TO SET', W * 0.95, H * 0.9)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    tapAt.current = performance.now()
    sendSurface(mod, 'tap', 0, 0, true)
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }}
      onPointerDown={down}
    />
  )
}
