import type { Patch } from '../types'
import { RackBuilder, st } from './builder'

/** GROOVE-1 house beat driving an acid bassline on MONO-1 via SEQ-8,
 *  with a dotted-eighth BBD echo on the bass. */
export function acidHouse(): Patch {
  const b = new RackBuilder()
  const groove = b.add('groove', 0, 0, { run: 1, tempo: 124, swing: 0.12, vol: 0.55 })
  const mono = b.add('mono', 0, 40, {
    tune: -2, wave: 0, cutoff: 380, res: 0.85, envamt: 0.55, drive: 2, a: 0.002, d: 0.18, s: 0, r: 0.1, pwm: 0, vol: 0.5,
  })
  const bbd = b.add('bbd', 0, 80, { time: 0.363, fb: 0.4, mix: 1, mod: 0.1 })
  const out = b.add('output', 0, 90, { vol: 0.45 })
  const notes = [0, 0, 12, 0, 3, 0, 7, 10]
  const gates = [1, 1, 1, 0, 1, 0, 1, 1]
  const seqParams: Record<string, number> = { len: 8, quant: 1 }
  notes.forEach((n, i) => {
    seqParams[`s${i + 1}`] = st(n)
    seqParams[`g${i + 1}`] = gates[i]
  })
  const seq = b.add('seq8', 1, 0, seqParams)
  const scope = b.add('scope', 1, 18, { time: 0.02 })
  b.wire(groove, 'clk', seq, 'clk')
  b.wire(seq, 'cv', mono, 'pitch')
  b.wire(seq, 'gate', mono, 'gate')
  b.wire(mono, 'vca', bbd, 'in')
  b.wire(bbd, 'wet', out, 'l')
  b.wire(mono, 'vcf', scope, 'ch1')
  b.wire(mono, 'env', scope, 'ch2')
  return b.build()
}

/** Discrete drum modules sequenced by TR-16 (A→B chain with a snare-roll fill),
 *  mixed, into a short spring room. */
export function drumKit(): Patch {
  const b = new RackBuilder()
  const tr = b.add('tr16', 0, 0, {
    pat: 2, swing: 0.08,
    a0: 0x1111, a1: 0x0000, a2: 0x1010, a3: 0xaaaa, a4: 0x4444, a8: 0x1111,
    b0: 0x1111, b1: 0xf000, b2: 0x1010, b3: 0xaaaa, b4: 0x4444, b8: 0x1111,
  })
  const clock = b.add('clock', 0, 32, { bpm: 128 })
  const kick = b.add('kick', 0, 40, { decay: 0.6, punch: 0.6, drive: 0.35 })
  const snare = b.add('snare', 0, 46)
  const clap = b.add('clap', 0, 52)
  const hats = b.add('hats', 0, 58, { ohd: 0.3 })
  const mix = b.add('mixer', 0, 66, { l1: 0.9, l2: 0.7, l3: 0.6, l4: 0.5, master: 0.8 })
  const spring = b.add('spring', 0, 74, { decay: 0.3, mix: 0.15 })
  const out = b.add('output', 0, 82)
  const scope = b.add('scope', 0, 88, { time: 0.05 })
  b.wire(clock, 'x4', tr, 'clk')
  b.wire(tr, 't1', kick, 'trig')
  b.wire(tr, 't2', snare, 'trig')
  b.wire(tr, 't3', clap, 'trig')
  b.wire(tr, 't4', hats, 'ch')
  b.wire(tr, 't5', hats, 'oh')
  b.wire(tr, 'acc', kick, 'acc')
  b.wire(kick, 'out', mix, 'in1')
  b.wire(snare, 'out', mix, 'in2')
  b.wire(clap, 'out', mix, 'in3')
  b.wire(hats, 'mix', mix, 'in4')
  b.wire(mix, 'out', spring, 'in')
  b.wire(spring, 'out', out, 'l')
  b.wire(mix, 'out', scope, 'ch1')
  return b.build()
}

/** Everything runs off one CLOCK: GROOVE-1 plays, MONO-1 is on the keys,
 *  both feed LOOP, whose recording snaps to the bar. Press REC, play, press REC. */
export function loopJam(): Patch {
  const b = new RackBuilder()
  const groove = b.add('groove', 0, 0, { run: 1, vol: 0 })
  const mono = b.add('mono', 0, 40, { vol: 0 })
  const clock = b.add('clock', 0, 80, { bpm: 120 })
  const mix = b.add('mixer', 0, 88, { l1: 0.8, l2: 0.8, l3: 0, l4: 0 })
  const loop = b.add('loop', 1, 0, { wow: 0.15 })
  const out = b.add('output', 1, 12, { vol: 0.55 })
  const scope = b.add('scope', 1, 18, { time: 0.05 })
  b.wire(clock, 'x4', groove, 'clk')
  b.wire(clock, 'rst', groove, 'rst')
  b.wire(clock, 'bar', loop, 'clk')
  b.wire(clock, 'rst', loop, 'rst')
  b.wire(groove, 'mix', mix, 'in1')
  b.wire(mono, 'vca', mix, 'in2')
  b.wire(mix, 'out', loop, 'in')
  b.wire(loop, 'out', out, 'l')
  b.wire(loop, 'wet', scope, 'ch1')
  b.wire(mix, 'out', scope, 'ch2')
  return b.build()
}
