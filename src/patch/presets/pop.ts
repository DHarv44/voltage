import type { Patch } from '../types'
import { RackBuilder, st } from './builder'

const seqParams = (notes: number[], gates: number[] = []): Record<string, number> => {
  const p: Record<string, number> = { len: notes.length, quant: 1 }
  notes.forEach((n, i) => {
    p[`s${i + 1}`] = st(n)
    p[`g${i + 1}`] = gates[i] ?? 1
  })
  return p
}

/** Driving synth-pop in the spirit of Harry Styles, built groove-first:
 *  - GROOVE-1 drums at 173 BPM.
 *  - MONO-1 bass in eighths: a chord-root sequence (half notes) plus an octave-jump
 *    sequence (eighths), summed in a DC mixer used as a CV adder.
 *  - A three-voice pad: three SEQ-8s each drive one VCO with properly voice-led
 *    I–V–vi–IV triads (A, E, F♯m, D), through a ladder filter with a slow LFO sweep
 *    and a light BBD chorus.
 *  - A ring-modulated "warped steel drum" bell hook on chord tones (no pentatonic line). */
export function synthPop(): Patch {
  const b = new RackBuilder()
  const groove = b.add('groove', 0, 0, {
    run: 1, tempo: 173, swing: 0, vol: 0.55, accent: 0.6,
    bd_tune: 54, bd_decay: 0.32, sd_tune: 205, sd_snap: 0.7, ch_decay: 0.035,
    a0: 0x0941, a1: 0x1010, a2: 0x1010, a3: 0x5555, a4: 0x0000, a5: 0x1010,
    b0: 0x0941, b1: 0xf010, b2: 0x1010, b3: 0x5555, b4: 0x4000, b5: 0xf010,
  })
  const mono = b.add('mono', 0, 40, {
    tune: -2.25, wave: 0.3, pw: 0.4, pwm: 0, cutoff: 520, res: 0.3, envamt: 0.35, drive: 1.6,
    a: 0.003, d: 0.2, s: 0.4, r: 0.08, vol: 0.5,
  })
  const div = b.add('div', 0, 80)
  const out = b.add('output', 0, 86, { vol: 0.6 })

  // Bass = chord root (changes each bar) + octave pattern (eighths).
  const roots = b.add('seq8', 1, 0, seqParams([0, 0, 7, 7, 9, 9, 5, 5]))
  const octaves = b.add('seq8', 1, 18, seqParams([0, 0, 12, 0, 0, 0, 12, 0]))
  const adder = b.add('mixer', 1, 36, { l1: 1, l2: 1, l3: 0, l4: 0, master: 1 })

  // Pad voices, semitones above G#3 (VCO base): A–C#–E, G#–B–E, A–C#–F#, A–D–F#.
  const low = b.add('seq8', 1, 44, seqParams([1, 1, 0, 0, 1, 1, 1, 1]))
  const mid = b.add('seq8', 1, 62, seqParams([5, 5, 3, 3, 5, 5, 6, 6]))
  const top = b.add('seq8', 1, 80, seqParams([8, 8, 8, 8, 10, 10, 10, 10]))

  const base = -4 / 12 // G#3 relative to C4
  const v1 = b.add('vco', 2, 0, { coarse: base })
  const v2 = b.add('vco', 2, 12, { coarse: base, fine: 0.07 })
  const v3 = b.add('vco', 2, 24, { coarse: base, fine: -0.06 })
  const padMix = b.add('mixer', 2, 36, { l1: 0.45, l2: 0.45, l3: 0.45, l4: 0, master: 0.8 })
  const vcf = b.add('vcf', 2, 44, { cutoff: 1400, res: 0.15, cv: 0.25 })
  const vca = b.add('vca', 2, 54, { gain: 0.55 })
  const lfo = b.add('lfo', 2, 60, { rate: 0.15 })
  const chorus = b.add('bbd', 2, 68, { time: 0.018, fb: 0, mix: 0.35, mod: 0.5 })
  const room = b.add('spring', 2, 78, { decay: 0.4, mix: 0.15, tone: 4000 })

  // Clock: GROOVE-1 sixteenths → ÷2 eighths (octave pattern), ÷8 half notes (chords + roots).
  b.wire(groove, 'clk', div, 'clk')
  b.wire(div, 'd2', octaves, 'clk')
  for (const s of [roots, low, mid, top]) b.wire(div, 'd8', s, 'clk')

  // Bass
  b.wire(roots, 'cv', adder, 'in1')
  b.wire(octaves, 'cv', adder, 'in2')
  b.wire(adder, 'out', mono, 'pitch')
  b.wire(octaves, 'gate', mono, 'gate')

  // Pad
  b.wire(low, 'cv', v1, 'voct')
  b.wire(mid, 'cv', v2, 'voct')
  b.wire(top, 'cv', v3, 'voct')
  b.wire(v1, 'saw', padMix, 'in1')
  b.wire(v2, 'saw', padMix, 'in2')
  b.wire(v3, 'saw', padMix, 'in3')
  b.wire(padMix, 'out', vcf, 'in')
  b.wire(lfo, 'tri', vcf, 'cv')
  b.wire(vcf, 'lp4', vca, 'in')
  b.wire(vca, 'out', chorus, 'in')
  b.wire(chorus, 'out', room, 'in')

  // Hook: "warped steel drum" bell. Pitch = chord root (shared with the bass) +
  // a root/fifth/octave rhythm pattern; those intervals exist in all four chords.
  // A sine is ring-modulated by a carrier tracking 2.756× the note (inharmonic,
  // metallic partials), then plucked by a fast exponential VCA and rung in a spring.
  const hookPat = b.add('seq8', 3, 0, seqParams([12, 7, 12, 19, 12, 7, 0, 7], [1, 1, 0, 1, 1, 0, 1, 1]))
  const hookAdd = b.add('mixer', 3, 18, { l1: 1, l2: 1, l3: 0, l4: 0, master: 1 })
  const bell = b.add('vco', 3, 26, { coarse: 0.75 }) // 0 V = A4
  const ringMod = b.add('ring', 3, 38, { freq: 440 * 2.756, mix: 0.75 })
  const bellVca = b.add('vca', 3, 44, { resp: 1 })
  const bellEnv = b.add('adsr', 3, 50, { a: 0.001, d: 0.4, s: 0, r: 0.35 })
  const chime = b.add('spring', 3, 58, { decay: 0.55, mix: 0.3, tone: 6000 })
  const master = b.add('mixer', 3, 66, { l1: 0.9, l2: 0.7, l3: 0, l4: 0, master: 0.9 })

  b.wire(div, 'd2', hookPat, 'clk')
  b.wire(roots, 'cv', hookAdd, 'in1')
  b.wire(hookPat, 'cv', hookAdd, 'in2')
  b.wire(hookAdd, 'out', bell, 'voct')
  b.wire(hookAdd, 'out', ringMod, 'voct')
  b.wire(hookPat, 'gate', bellEnv, 'gate')
  b.wire(bell, 'sin', ringMod, 'x')
  b.wire(ringMod, 'out', bellVca, 'in')
  b.wire(bellEnv, 'env', bellVca, 'cv')
  b.wire(bellVca, 'out', chime, 'in')

  // Final mix: pad + hook → audio out
  b.wire(room, 'out', master, 'in1')
  b.wire(chime, 'out', master, 'in2')
  b.wire(master, 'out', out, 'l')
  return b.build(4)
}
