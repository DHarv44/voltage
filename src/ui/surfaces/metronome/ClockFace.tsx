import { useRef } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { CLKL } from '../../../modules/specs/sequencing'
import { patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { RES, useFrame, type SurfaceProps } from '../common'
import { drawBeats, drawTempo, FONT } from './draw'

const ON = '#ffb02e'

/** CLOCK's screen: the tempo, the four beats of the bar (1 bigger, the one
 *  playing lit and fading across the beat) and the bar count, so you can see
 *  the rack's time without patching a METRONOME. */
export function ClockFace({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const led = telemetry.leds[mod]
    const beat = led?.[CLKL.beat] ?? -1
    ctx.fillStyle = '#121315'
    ctx.fillRect(0, 0, W, H)
    drawTempo(ctx, p.bpm ?? 120, W * 0.36, H * 0.32, H * 0.42, '#f3e7cf', (p.sync ?? 0) >= 0.5 ? 'MIDI' : 'BPM')
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(H * 0.17)}px ${FONT}`
    ctx.fillStyle = beat >= 0 ? 'rgba(243,231,207,0.75)' : 'rgba(243,231,207,0.35)'
    ctx.fillText(beat >= 0 ? `BAR ${(led?.[CLKL.bar] ?? 0) + 1}.${beat + 1}` : 'STOPPED', W * 0.96, H * 0.32)
    drawBeats(ctx, { x: W * 0.04, y: H * 0.6, w: W * 0.92, h: H * 0.34 }, 4, beat, { on: ON, off: '#2c2a26', flash: led?.[CLKL.flash] })
  })

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none' }} />
}
