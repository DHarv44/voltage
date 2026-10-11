import { mix, toOut, voice, type Kit } from './kit'
import type { Starter } from './types'

/** The sampler family's ready-to-play rigs. */
export const SAMPLER_STARTERS: Record<string, Starter> = {
  era: {
    howTo:
      'A beat and a bass line through ERA: what a 12-bit drum machine of the late 80s did to them. Step ERA through the generations; turn RATE × down for more grit and fold-back, BITS ± down for noise; MIX back toward the clean sound.',
    build(k) {
      const clock = k.add('clock', { bpm: 94 })
      const tr = k.add('tr16', { a0: 0x0101 | 0x0804, a1: 0x1010, a3: 0x5555 })
      const kick = k.add('kick', { tune: 50, decay: 0.5, punch: 0.6 })
      const snare = k.add('snare', { tune: 190, snappy: 0.7 })
      const hats = k.add('hats', { chd: 0.04 })
      k.wire([clock, 'x4'], [tr, 'clk'])
      k.wire([clock, 'rst'], [tr, 'rst'])
      k.wire([tr, 't1'], [kick, 'trig'])
      k.wire([tr, 't2'], [snare, 'trig'])
      k.wire([tr, 't4'], [hats, 'ch'])
      const seq = k.add('seq8', { s1: 0, s2: 0, s3: 0.25, s4: 0, s5: 0.5833, s6: 0, s7: 0.4167, s8: 0.25 })
      k.wire([clock, 'x2'], [seq, 'clk'])
      const bass = voice(k, [seq, 'cv'], [seq, 'gate'], { osc: { type: 'vco', params: { coarse: -2 }, out: 'saw' }, filter: { type: 'vcf', params: { cutoff: 700, res: 0.3 }, out: 'lp4' }, env: { d: 0.2, s: 0.3, r: 0.1 } })
      const e = k.add('era', { era: 3 })
      k.wire(mix(k, [[kick, 'out'], [snare, 'out'], [hats, 'mix'], bass.out], [0.85, 0.65, 0.4, 0.6]), [e, 'in'])
      toOut(k, [e, 'out'], undefined, 0.55)
    },
  },
  jungle: {
    howTo:
      'JUNGLE playing the factory break at 168 in its own edit (a roll, a reversed snare), stretched by the rack sampler’s cycles, with a sub bass under it. Press EDIT for a new edit; flip STRETCH to REPITCH for the chipmunk version; turn CYCLE for buzzier or stutterier stretching. Click a step, then a slice above, to give it that slice.',
    build(k) {
      const j = k.add('jungle')
      const clock = k.add('clock', { bpm: 168 })
      k.wire([clock, 'x4'], [j, 'clk'])
      k.wire([clock, 'rst'], [j, 'rst'])
      const seq = k.add('seq8', { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0.25, s6: 0.25, s7: 0.0833, s8: 0.0833, g1: 1, g2: 0, g3: 0, g4: 1, g5: 1, g6: 0, g7: 1, g8: 0 })
      k.wire([clock, 'x2'], [seq, 'clk'])
      k.wire([clock, 'rst'], [seq, 'reset'])
      const sub = voice(k, [seq, 'cv'], [seq, 'gate'], { osc: { type: 'vco', params: { coarse: -2 }, out: 'sin' }, filter: { type: 'vcf', params: { cutoff: 300, res: 0 }, out: 'lp4' }, env: { a: 0.005, d: 0.4, s: 0.8, r: 0.2 } })
      toOut(k, mix(k, [[j, 'out'], sub.out], [0.8, 0.75]), undefined, 0.55)
    },
  },
  deck: {
    howTo:
      'DECK playing the break, a choir and orchestra hits, with a bass line beside it. Drag the CROSSFADER right for scene B (the break filtered and crushed, the hits an octave down: a breakdown), back left for the drop. Press REC: the next bar of the bass becomes track 4’s own loop, sliced and playing at once. Click trigs to change them; drag the A and B sliders to make your own scenes.',
    build(k) {
      const clock = k.add('clock', { bpm: 112 })
      const d = k.add('deck')
      k.wire([clock, 'x4'], [d, 'clk'])
      k.wire([clock, 'rst'], [d, 'rst'])
      const seq = k.add('seq8', { s1: 0, s2: 0, s3: 0.25, s4: 0, s5: 0.4167, s6: 0.25, s7: 0.0833, s8: 0, g1: 1, g2: 1, g3: 1, g4: 0, g5: 1, g6: 1, g7: 1, g8: 1 })
      k.wire([clock, 'x2'], [seq, 'clk'])
      k.wire([clock, 'rst'], [seq, 'reset'])
      const bass = voice(k, [seq, 'cv'], [seq, 'gate'], { osc: { type: 'vco', params: { coarse: -2 }, out: 'saw' }, filter: { type: 'vcf', params: { cutoff: 900, res: 0.35 }, out: 'lp4' }, env: { a: 0.002, d: 0.18, s: 0.4, r: 0.08 } })
      k.wire(bass.out, [d, 'in'])
      const m = mix(k, [[d, 'l'], bass.out], [0.85, 0.5])
      const mr = mix(k, [[d, 'r'], bass.out], [0.85, 0.5])
      toOut(k, m, mr, 0.55)
    },
  },
  dustbox: {
    howTo:
      'A boom-bap beat on DUSTBOX’s factory pads (a SEQ-8 picks the pad with PAD and plays it with TRIG). Hold FX for the effect (try STUTTER and TAPE STOP), turn GRIT and COMP. Press RESAMPLE to catch the beat with its effects onto pad 9, then play it from the pads.',
    build(k) {
      const clock = k.add('clock', { bpm: 88 })
      // kick, hat, snare, hat, kick, kick, snare, hat (PAD: 0–2 V picks pads 1–4)
      const seq = k.add('seq8', { s1: 0.1, s2: 1.3, s3: 0.7, s4: 1.3, s5: 0.1, s6: 0.1, s7: 0.7, s8: 1.3, g1: 1, g2: 1, g3: 1, g4: 1, g5: 1, g6: 1, g7: 1, g8: 1 })
      k.wire([clock, 'x2'], [seq, 'clk'])
      k.wire([clock, 'rst'], [seq, 'reset'])
      const db = k.add('dustbox', { tempo: 88 })
      k.wire([seq, 'cv'], [db, 'pcv'])
      k.wire([seq, 'trig'], [db, 'trig'])
      k.wire([clock, 'x4'], [db, 'clk'])
      toOut(k, [db, 'l'], [db, 'r'], 0.55)
    },
  },
  tracker: {
    howTo:
      'TRACKER playing its factory song: a bass line on channel 1, the break’s own kick and snare cut out by the sample offset on channel 2, a bell tune with vibrato on 3, a choir pad on 4. Turn EDIT to REC, click a cell and play the keys to write notes; scroll on a cell’s note, sample or effect; switch the LED filter and the MODEL.',
    build(k) {
      const t = k.add('tracker')
      toOut(k, [t, 'l'], [t, 'r'], 0.55)
    },
  },
  lightpen: {
    howTo:
      'LIGHTPEN’s grid playing the orchestra hit in C minor through its 8-bit converters, into a plate. Click cells on the green screen (a row is a note, lit cells in a row run on as one note); step SOUND to the choir or strings, ERA to later machines. Play the keys over it, or press REC to sample anything into IN and play it pitched.',
    build(k) {
      const lp = k.add('lightpen', { tempo: 100 })
      const plate = k.add('plate', { decay: 0.6, mix: 0.25 })
      k.wire([lp, 'l'], [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'], 0.5)
    },
  },
}
