import { Graph } from '../engine/graph'
import type { ToEngine } from '../engine/protocol'
import type { Patch } from '../patch/types'
import { BounceControllers } from './bounceControllers'

/** What the page sends: the patch, its recordings, how to know it's over. */
export interface BounceJob {
  msg: Extract<ToEngine, { type: 'patch' }>
  /** The patch itself: what MOTION, MACRO and SCENES learned (their targets). */
  patch: Patch
  buffers: { id: string; slot: number; rate: number; data: Float32Array }[]
  rate: number
  /** The longest it may run (s). */
  maxSeconds: number
  /** A song: stop this long (s) after the arranger's END output pulses. */
  watch: { id: string; out: number } | null
  tail: number
}
export type BounceReply = { type: 'progress'; seconds: number } | { type: 'done'; l: Float32Array; r: Float32Array }

const BLOCK = 128
/** Hand back to the event loop this often (ms of work), so CANCEL gets through. */
const SLICE_MS = 100

/** This worker's global, as much of it as we use. */
const ctx = self as unknown as {
  postMessage(m: BounceReply, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent<BounceJob | 'cancel'>) => void) | null
}

let cancelled = false

/** Renders the rack offline (as fast as this core can), into memory. */
async function run(job: BounceJob): Promise<void> {
  const g = new Graph(job.rate)
  g.applyPatch(job.msg)
  for (const b of job.buffers) g.loadBuffer(b.id, b.slot, b.rate, b.data)
  // the knob-movers the page would run
  const moves = job.patch.modules.some((m) => m.type === 'motion' || m.type === 'macro' || m.type === 'scenes') ? new BounceControllers(job.patch, g, job.rate) : null
  const max = Math.ceil((job.maxSeconds * job.rate) / BLOCK) * BLOCK
  const L = new Float32Array(max)
  const R = new Float32Array(max)
  const bl = new Float32Array(BLOCK)
  const br = new Float32Array(BLOCK)
  let n = 0
  let stopAt = max
  let sliceStart = performance.now()
  let reported = 0
  while (n < stopAt && !cancelled) {
    g.process(BLOCK, bl, br)
    moves?.step(BLOCK)
    L.set(bl, n)
    R.set(br, n)
    n += BLOCK
    if (job.watch && stopAt === max) {
      const m = g.getModule(job.watch.id)
      if (m && m.out[job.watch.out] > 1) stopAt = Math.min(max, n + Math.round(job.tail * job.rate))
    }
    if (performance.now() - sliceStart > SLICE_MS) {
      if (n - reported > job.rate / 4) {
        reported = n
        ctx.postMessage({ type: 'progress', seconds: n / job.rate })
      }
      await new Promise((res) => setTimeout(res, 0))
      sliceStart = performance.now()
    }
  }
  if (cancelled) return
  const l = L.slice(0, n)
  const r = R.slice(0, n)
  ctx.postMessage({ type: 'done', l, r }, [l.buffer, r.buffer])
}

ctx.onmessage = (e) => {
  if (e.data === 'cancel') cancelled = true
  else void run(e.data)
}
