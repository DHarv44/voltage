import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { FM_ALGO_NAMES, FM_ALGOS, FM_PATCHES } from '../../modules/specs/fmPatches'
import { FML, SWARM_OFFSETS, swarmDetune, swarmMix } from '../../modules/specs/synthVoices'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"

function useCanvas(inst: SurfaceProps['inst'], w: number, h: number) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = () => patchStore.get().modules.find((m) => m.id === inst.id)?.params ?? inst.params
  return { ref, W, H, live }
}

function Canvas({ c, x, y, w, h }: { c: ReturnType<typeof useCanvas>; x: number; y: number; w: number; h: number }) {
  return (
    <canvas
      ref={c.ref}
      className="surface-canvas"
      width={c.W}
      height={c.H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none' }}
    />
  )
}

/** A row of voice dots (lit while each note sounds). */
function voiceDots(ctx: CanvasRenderingContext2D, led: ArrayLike<number> | undefined, from: number, x0: number, y: number, step: number, r: number, on: string) {
  for (let v = 0; v < 8; v++) {
    const e = led?.[from + v] ?? 0
    ctx.globalAlpha = 0.18 + 0.82 * Math.min(1, e * 1.5)
    ctx.fillStyle = e > 0.01 ? on : '#33403a'
    ctx.beginPath()
    ctx.arc(x0 + v * step, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** FM-4's screen: the sound and its algorithm drawn as a wiring diagram
 *  (modulators above what they bend, carriers on the output line), each
 *  operator lit by its envelope on the newest note; the eight notes below. */
export function Fm4Screen({ inst, x, y, w, h }: SurfaceProps) {
  const c = useCanvas(inst, w, h)
  useFrame(c.ref, () => {
    const ctx = c.ref.current?.getContext('2d')
    if (!ctx) return
    const { W, H } = c
    const p = c.live()
    const led = telemetry.leds[inst.id]
    const patch = FM_PATCHES[Math.round(p.voice ?? 0)]
    const a = Math.round(p.algo ?? 0)
    const ai = a === 0 ? patch.algo : a - 1
    const algo = FM_ALGOS[ai]
    const amber = '#ffb347'
    ctx.fillStyle = '#100d09'
    ctx.fillRect(0, 0, W, H)

    // left: the sound's name, the algorithm, the notes
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = amber
    ctx.font = `700 ${Math.round(H * 0.3)}px ${FONT}`
    ctx.fillText(patch.name, W * 0.04, H * 0.38)
    ctx.font = `${Math.round(H * 0.16)}px ${FONT}`
    ctx.fillStyle = 'rgba(255,179,71,0.7)'
    ctx.fillText(`ALGO ${FM_ALGO_NAMES[ai]}${a === 0 ? '' : ' *'}`, W * 0.04, H * 0.62)
    voiceDots(ctx, led, FML.voices, W * 0.06, H * 0.82, W * 0.045, H * 0.045, amber)

    // right: the wiring. Depth 0 = carriers; a modulator sits one above the deepest thing it bends.
    const depth = [0, 0, 0, 0]
    for (let k = 1; k < 4; k++) {
      if ((algo.carriers >> k) & 1) continue
      let d = 0
      for (let t = 0; t < k; t++) if ((algo.mods[t] >> k) & 1) d = Math.max(d, depth[t] + 1)
      depth[k] = d
    }
    const rows = Math.max(...depth) + 1
    const dx0 = W * 0.5
    const dw = W * 0.46
    const gapY = rows > 1 ? (H * 0.66) / (rows - 1) : 0
    const box = Math.min(H * 0.2, (dw / 5) * 0.8, rows > 1 ? gapY * 0.72 : H)
    const rowY = (d: number) => (rows > 1 ? H * 0.78 - d * gapY : H * 0.5)
    const pos: [number, number][] = []
    for (let d = 0; d < rows; d++) {
      const inRow = [0, 1, 2, 3].filter((k) => depth[k] === d)
      inRow.forEach((k, i) => (pos[k] = [dx0 + (dw * (i + 0.5)) / inRow.length, rowY(d)]))
    }
    ctx.strokeStyle = 'rgba(255,179,71,0.55)'
    ctx.lineWidth = Math.max(1, H * 0.018)
    // the output line under the carriers
    ctx.beginPath()
    ctx.moveTo(dx0 + dw * 0.05, H * 0.94)
    ctx.lineTo(dx0 + dw * 0.95, H * 0.94)
    ctx.stroke()
    for (let k = 0; k < 4; k++) {
      const [px, py] = pos[k]
      if ((algo.carriers >> k) & 1) {
        ctx.beginPath()
        ctx.moveTo(px, py + box / 2)
        ctx.lineTo(px, H * 0.94)
        ctx.stroke()
      }
      for (let t = 0; t < 3; t++)
        if ((algo.mods[t] >> k) & 1) {
          ctx.beginPath()
          ctx.moveTo(px, py + box / 2)
          ctx.lineTo(pos[t][0], pos[t][1] - box / 2)
          ctx.stroke()
        }
    }
    // operator 4's feedback loop
    const fb = Math.min(1, patch.fb * 2 * (p.fb ?? 0.5))
    if (fb > 0.01) {
      const [px, py] = pos[3]
      ctx.globalAlpha = 0.3 + 0.7 * fb
      ctx.beginPath()
      ctx.arc(px + box * 0.5, py, box * 0.42, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.round(box * 0.62)}px ${FONT}`
    for (let k = 0; k < 4; k++) {
      const [px, py] = pos[k]
      const e = led?.[FML.ops + k] ?? 0
      const carrier = (algo.carriers >> k) & 1
      ctx.fillStyle = `rgba(255,179,71,${0.12 + 0.88 * Math.min(1, e)})`
      ctx.beginPath()
      ctx.roundRect(px - box / 2, py - box / 2, box, box, box * 0.2)
      ctx.fill()
      ctx.lineWidth = carrier ? Math.max(1.5, H * 0.03) : Math.max(1, H * 0.015)
      ctx.strokeStyle = amber
      ctx.stroke()
      ctx.fillStyle = e > 0.5 ? '#100d09' : amber
      ctx.fillText(String(k + 1), px, py + box * 0.04)
    }
  })
  return <Canvas c={c} x={x} y={y} w={w} h={h} />
}

/** SWARM's screen: the seven saws, spread in pitch by DETUNE (top lane) and
 *  across the stereo field by SPREAD (bottom lane), sized by MIX; the eight
 *  notes down the side. */
export function SwarmScreen({ inst, x, y, w, h }: SurfaceProps) {
  const c = useCanvas(inst, w, h)
  useFrame(c.ref, () => {
    const ctx = c.ref.current?.getContext('2d')
    if (!ctx) return
    const { W, H } = c
    const p = c.live()
    const led = telemetry.leds[inst.id]
    const cyan = '#7fe0ff'
    ctx.fillStyle = '#081215'
    ctx.fillRect(0, 0, W, H)
    const det = swarmDetune(Math.min(1, Math.max(0, p.detune ?? 0.45)))
    const [centre, side] = swarmMix(p.mix ?? 0.65)
    const spread = p.spread ?? 0.7
    const x0 = W * 0.16
    const lw = W * 0.7
    const mid = x0 + lw / 2
    ctx.font = `${Math.round(H * 0.15)}px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(127,224,255,0.6)'
    ctx.fillText('PITCH', W * 0.02, H * 0.3)
    ctx.fillText('L · R', W * 0.02, H * 0.74)
    ctx.strokeStyle = 'rgba(127,224,255,0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(mid, H * 0.06)
    ctx.lineTo(mid, H * 0.94)
    ctx.stroke()
    for (let i = 0; i < 7; i++) {
      const lvl = Math.max(0.05, i === 3 ? centre : side)
      // pitch lane: a bar per saw, its offset from the note, its height its level
      // (square-root scale: a few cents of detune still shows as a fan)
      const off = (SWARM_OFFSETS[i] * det) / 0.115
      const px = mid + Math.sign(off) * Math.sqrt(Math.abs(off)) * (lw / 2)
      const bh = H * 0.36 * Math.min(1, lvl)
      ctx.fillStyle = i === 3 ? '#ffffff' : cyan
      ctx.fillRect(px - W * 0.006, H * 0.48 - bh, W * 0.012, bh)
      // stereo lane: where it sits left to right
      const sx = mid + ((i - 3) / 3) * spread * (lw / 2)
      ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, lvl)
      ctx.beginPath()
      ctx.arc(sx, H * 0.74, H * 0.05 + H * 0.05 * Math.min(1, lvl), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // the notes, down the right side
    for (let v = 0; v < 8; v++) {
      const e = led?.[v] ?? 0
      ctx.globalAlpha = 0.18 + 0.82 * Math.min(1, e)
      ctx.fillStyle = e > 0.01 ? cyan : '#2a3a40'
      ctx.beginPath()
      ctx.arc(W * 0.94, H * (0.1 + v * 0.115), H * 0.04, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })
  return <Canvas c={c} x={x} y={y} w={w} h={h} />
}
