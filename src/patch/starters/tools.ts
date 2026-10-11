import { beat, bits, melody, mix, toOut, voice, type Kit } from './kit'
import type { Starter } from './types'

/** A tune on one side of the rack heard through SEND → RECEIVE on the other. */
function wireless(k: Kit): void {
  const m = melody(k, { bpm: 104 })
  const v = voice(k, m.pitch, m.gate, { filter: { type: 'vcf', params: { cutoff: 900, res: 0.3 }, out: 'lp4' } })
  const s = k.add('send', { ch: 0 })
  k.wire(v.out, [s, 'in'])
  const r = k.add('recv', { ch: 0 })
  const plate = k.add('plate', { decay: 0.55, mix: 0.25 })
  k.wire([r, 'out'], [plate, 'in'])
  toOut(k, [plate, 'l'], [plate, 'r'], 0.55)
}

/** The utilities' ready-to-play rigs. */
export const TOOL_STARTERS: Record<string, Starter> = {
  send: {
    howTo: 'A tune patched into SEND, heard from RECEIVE through a plate: no cable between them. Turn either CHANNEL away from A and the sound stops; set both to the same letter and it’s back. Add another SEND on A and the two add up.',
    build: wireless,
  },
  recv: {
    howTo: 'RECEIVE picking up the SEND on channel A (a tune) and playing it into a plate, with no cable between them. Change the channel on both to move the link; any number of RECEIVEs can listen to one channel.',
    build: wireless,
  },
  midiout: {
    howTo: 'A tune played here and sent out as MIDI notes on channel 1, an LFO sent as the mod wheel (CC 1): plug in a MIDI synth or open a soft synth and it plays along. Pick the MIDI CH and the CC numbers to suit what you’re playing.',
    build(k) {
      const m = melody(k, { bpm: 100 })
      const v = voice(k, m.pitch, m.gate)
      const mo = k.add('midiout')
      k.wire(m.pitch, [mo, 'voct'])
      k.wire(m.gate, [mo, 'gate'])
      const lfo = k.add('lfo', { rate: 0.2 })
      const at = k.add('atten', { a: 0.5 })
      k.wire([lfo, 'tri'], [at, 'a'])
      k.wire([at, 'a'], [mo, 'cva'])
      toOut(k, v.out, undefined, 0.5)
    },
  },
  ratchet: {
    howTo: 'A beat with a second snare fired by RATCHET: on the last step of each bar a burst of COUNT hits that SPEEDs UP into the downbeat. Turn COUNT; switch the SPACING; ×N is the clock multiplied (try it on a hi-hat).',
    build(k) {
      const b = beat(k, { bpm: 100, tracks: { a3: bits(14) } })
      const r = k.add('ratchet', { n: 4, curve: 1 })
      k.wire([b.clock, 'x4'], [r, 'clk'])
      k.wire([b.tr, 't4'], [r, 'trig'])
      const sn = k.add('snare', { tune: 240, snappy: 0.8, decay: 0.12 })
      k.wire([r, 'burst'], [sn, 'trig'])
      toOut(k, mix(k, [b.out, [sn, 'out']], [0.9, 0.55]), undefined, 0.55)
    },
  },
  gatedelay: {
    howTo: 'Every kick, delayed an eighth by GATE DELAY, strikes a rim on the offbeat: a second part made out of the first. Turn DELAY short for a flam, long for a call and answer; LENGTH sets how long the delayed gates last.',
    build(k) {
      const b = beat(k, { bpm: 110 })
      const g = k.add('gatedelay', { delay: 0.2727, len: 0.03 })
      k.wire([b.tr, 't1'], [g, 'in'])
      const pc = k.add('perc')
      k.wire([g, 'out'], [pc, 'rim'])
      toOut(k, mix(k, [b.out, [pc, 'mix']], [0.9, 0.6]), undefined, 0.55)
    },
  },
  compare: {
    howTo: 'A slow LFO watched by COMPARE: each time it CROSSes the LEVEL a kick hits, and while it’s INSIDE the window a drone sounds. Move LEVEL and WINDOW; raise HYSTERESIS to see how it stops chattering on noisy signals.',
    build(k) {
      const lfo = k.add('lfo', { rate: 0.4 })
      const c = k.add('compare', { thr: 0, win: 4 })
      k.wire([lfo, 'sin'], [c, 'in'])
      const kick = k.add('kick', { decay: 0.5 })
      k.wire([c, 'cross'], [kick, 'trig'])
      const d = voice(k, null, [c, 'inside'], { osc: { type: 'vco', params: { coarse: -1 }, out: 'saw' }, env: { a: 0.3, s: 0.8, r: 0.6 } })
      toOut(k, mix(k, [[kick, 'out'], d.out], [0.8, 0.5]), undefined, 0.55)
    },
  },
  cvmath: {
    howTo: 'A melody (A) transposed by a slow two-step sequence (B) through CV MATH’s A+B: the tune moves through keys. Turn OCTAVE; patch MIN or MAX to hear the lower or higher of the two lines instead.',
    build(k) {
      const m = melody(k, { bpm: 108 })
      const sb = k.add('seq8', { len: 2, s1: 0, s2: 5 / 12, g1: 1, g2: 1 })
      k.wire([m.clock, 'bar'], [sb, 'clk'])
      const c = k.add('cvmath')
      k.wire(m.pitch, [c, 'a'])
      k.wire([sb, 'cv'], [c, 'b'])
      toOut(k, voice(k, [c, 'sum'], m.gate).out, undefined, 0.5)
    },
  },
  xfade: {
    howTo: 'One oscillator’s saw (A) and square (B) through XFADE, an LFO sweeping between them: the tone morphs as the tune plays. Take the LFO out and move A ↔ B by hand; LINEAR is for fading CVs.',
    build(k) {
      const m = melody(k, { bpm: 96 })
      const vco = k.add('vco', { coarse: -1 })
      k.wire(m.pitch, [vco, 'voct'])
      const x = k.add('xfade')
      k.wire([vco, 'saw'], [x, 'a'])
      k.wire([vco, 'sqr'], [x, 'b'])
      const lfo = k.add('lfo', { rate: 0.15 })
      k.wire([lfo, 'tri'], [x, 'cv'])
      toOut(k, voice(k, null, m.gate, { audio: [x, 'out'] }).out, undefined, 0.5)
    },
  },
  split: {
    howTo: 'PROGRESSION’s chords split by SPLIT into their notes, each on its own oscillator, panned apart: a poly cable taken to pieces. Re-patch one note to a different sound.',
    build(k) {
      const clock = k.add('clock', { bpm: 84 })
      const prog = k.add('progression', { mood: 0.4 })
      k.wire([clock, 'bar'], [prog, 'clk'])
      const s = k.add('split')
      k.wire([prog, 'notes'], [s, 'in'])
      const oscs = [1, 2, 3].map((i) => {
        const o = k.add('vco', { coarse: -1 })
        k.wire([s, `o${i}`], [o, 'voct'])
        return [o, i === 2 ? 'sqr' : 'saw'] as [string, string]
      })
      const f = voice(k, null, [clock, 'x1'], { audio: mix(k, oscs, [0.5, 0.35, 0.5]), env: { a: 0.02, d: 0.5, s: 0.5, r: 0.4 } })
      toOut(k, f.out, undefined, 0.5)
    },
  },
  merge: {
    howTo: 'Three SEQ-8 lines MERGEd into one poly cable and played as chords by HALCYON: three monophonic parts become one polyphonic voice. Change any line’s steps.',
    build(k) {
      const clock = k.add('clock', { bpm: 92 })
      const lines = [
        [0, 0, 5, 5, 7, 7, 3, 3],
        [3, 3, 9, 9, 10, 10, 7, 7],
        [7, 7, 12, 12, 14, 14, 10, 10],
      ].map((notes) => {
        const p: Record<string, number> = {}
        notes.forEach((n, i) => {
          p[`s${i + 1}`] = n / 12
          p[`g${i + 1}`] = 1
        })
        const s = k.add('seq8', p)
        k.wire([clock, 'x1'], [s, 'clk'])
        return s
      })
      const mg = k.add('merge')
      lines.forEach((s, i) => k.wire([s, 'cv'], [mg, `i${i + 1}`]))
      const h = k.add('halcyon', { r: 0.4 })
      k.wire([mg, 'out'], [h, 'voct'])
      k.wire([lines[0], 'gate'], [h, 'gate'])
      toOut(k, [h, 'l'], [h, 'r'], 0.5)
    },
  },
  unison: {
    howTo: 'A tune stacked four voices deep by UNISON and played on HALCYON: one note becomes a fat, detuned lead. Turn DETUNE up for a supersaw, VOICES down to 1 to hear the difference.',
    build(k) {
      const m = melody(k, { bpm: 100 })
      const u = k.add('unison', { n: 4, det: 0.14 })
      k.wire(m.pitch, [u, 'voct'])
      k.wire(m.gate, [u, 'gate'])
      const h = k.add('halcyon', { pulse: 0, sub: 0.2, cutoff: 3000, chorus: 0, s: 0.7 })
      k.wire([u, 'pv'], [h, 'voct'])
      k.wire([u, 'pg'], [h, 'gate'])
      toOut(k, [h, 'l'], [h, 'r'], 0.5)
    },
  },
  notes: {
    howTo: 'A tune with a NOTES panel beside it: click the panel and write how the patch works, what to turn, who made it. The words are kept with the rack and travel in its share link. Right-click to make it wider.',
    build(k) {
      const m = melody(k, { bpm: 100 })
      toOut(k, voice(k, m.pitch, m.gate).out, undefined, 0.5)
      k.add('notes')
    },
  },
}
