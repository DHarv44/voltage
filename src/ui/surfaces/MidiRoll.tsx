import { useEffect, useRef } from 'react'
import { buffers } from '../../audio/buffers'
import { telemetry } from '../../audio/telemetry'
import { factoryNotes, MF_STRIDE, MFL } from '../../modules/specs/midifile'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const FACTORY = factoryNotes()
/** Beats shown at once (the view pages along with the playhead). */
const VIEW = 16

/** MIDI FILE's screen: the piece as a piano roll, a page of four bars at a
 *  time, the playhead running through it. */
export function MidiRoll({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const file = useRef<Float32Array | null>(null)
  const src = inst.params.src

  useEffect(() => {
    let alive = true
    void buffers.read(mod, 0).then((b) => {
      if (alive) file.current = b ? b.data : null
    })
    return () => {
      alive = false
    }
  }, [mod, src])

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const d = Math.round(p.src) === 1 && file.current?.length ? file.current : FACTORY
    const led = telemetry.leds[mod]
    const beat = led?.[MFL.beat] ?? 0
    const page = Math.floor(beat / VIEW) * VIEW
    let lo = 127
    let hi = 0
    for (let i = 0; i < d.length; i += MF_STRIDE) {
      lo = Math.min(lo, d[i + 1])
      hi = Math.max(hi, d[i + 1])
    }
    lo -= 2
    hi += 2
    const rh = H / Math.max(12, hi - lo + 1)
    ctx.fillStyle = '#141517'
    ctx.fillRect(0, 0, W, H)
    for (let b = 0; b < VIEW; b++) {
      ctx.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'
      ctx.fillRect((b / VIEW) * W, 0, RES, H)
    }
    for (let i = 0; i < d.length; i += MF_STRIDE) {
      const t = d[i] - page
      if (t + d[i + 3] < 0 || t > VIEW) continue
      ctx.fillStyle = `hsl(${30 + (d[i + 4] - 1) * 22}, 80%, ${45 + (d[i + 2] / 127) * 25}%)`
      ctx.fillRect((t / VIEW) * W, H - (d[i + 1] - lo + 1) * rh, Math.max(RES * 2, (d[i + 3] / VIEW) * W - 1), Math.max(RES, rh - 1))
    }
    ctx.fillStyle = '#ffe08a'
    ctx.fillRect(((beat - page) / VIEW) * W, 0, RES * 1.5, H)
  })

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} />
}
