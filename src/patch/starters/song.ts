import { hits, TRACK, type Bar } from '../songs/parts'
import { mix, toOut, voice, type Jack, type Kit } from './kit'
import type { Starter } from './types'

/** TR-16 params for up to four bars (A–D), each a Bar of x-strings. */
function trBars(bars: Bar[]): Record<string, number> {
  const p: Record<string, number> = {}
  bars.forEach((bar, b) => {
    for (const part of Object.keys(TRACK) as (keyof typeof TRACK)[]) p[`${'abcd'[b]}${TRACK[part]}`] = bar[part] ? hits(bar[part]!) : 0
  })
  return p
}

/** TR-16 → kick, snare, clap, hats → a mixer; returns the TR, the kick and the mix. */
function kit(k: Kit, bars: Bar[]): { tr: string; kick: Jack; out: Jack } {
  const tr = k.add('tr16', trBars(bars))
  const kick = k.add('kick', { tune: 50, decay: 0.45, punch: 0.6 })
  const snare = k.add('snare', { tune: 200, snappy: 0.75 })
  const clap = k.add('clap')
  const hats = k.add('hats', { chd: 0.03, ohd: 0.25 })
  k.wire([tr, 't1'], [kick, 'trig'])
  k.wire([tr, 't2'], [snare, 'trig'])
  k.wire([tr, 't3'], [clap, 'trig'])
  k.wire([tr, 't4'], [hats, 'ch'])
  k.wire([tr, 't5'], [hats, 'oh'])
  k.wire([tr, 'acc'], [kick, 'acc'])
  return { tr, kick: [kick, 'out'], out: mix(k, [[kick, 'out'], [snare, 'out'], [clap, 'out'], [hats, 'mix']], [0.9, 0.6, 0.55, 0.4]) }
}

/** A, B, C, D for ARRANGER XL's factory song: intro hats, the verse beat, a
 *  build with a snare filling in, the chorus with claps and open hats.
 *  Track 8 is the bass player's rhythm. */
const SONG_BEATS: Bar[] = [
  { ch: '..x...x...x...x.' },
  { kick: 'x...x...x...x...', snare: '....x.......x...', ch: 'x.x.x.x.x.x.x.x.', tom: 'x..x..x.x..x..x.' },
  { kick: 'x...x...x...x...', snare: '....x...x.x.xxxx', ch: 'xxxxxxxxxxxxxxxx', tom: 'x.x.x.x.x.x.x.x.' },
  { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xx.xxx.xxx.xxx.x', oh: '..x...x...x...x.', tom: 'x..x..x.x..x..x.' },
]

export const SONG_STARTERS: Record<string, Starter> = {
  arrangerxl: {
    howTo:
      'A whole song from ARRANGER XL: it clocks the rack, PAT picks TR-16’s beat for each section, the LEVELs bring drums, bass, keys and pad in and out (the intros and outros FADE), KEY moves CHORD TRACK, and before each chorus RAMP drives a RISER into the DROP. Click a block to see its settings along the bottom; click or scroll them to change; click lane cells to change who plays.',
    build(k) {
      const xl = k.add('arrangerxl', { tempo: 112 })
      const d = kit(k, SONG_BEATS)
      k.wire([xl, 'clko'], [d.tr, 'clk'])
      k.wire([xl, 'rsto'], [d.tr, 'rst'])
      k.wire([xl, 'pat'], [d.tr, 'pat'])
      const ct = k.add('chordtrack')
      k.wire([xl, 'clko'], [ct, 'clk'])
      k.wire([xl, 'rsto'], [ct, 'rst'])
      k.wire([xl, 'trans'], [ct, 'trans'])
      const keys = k.add('fm4', { voice: 0, bright: 0.55, decay: 0.4, level: 0.6 })
      k.wire([ct, 'notes'], [keys, 'voct'])
      k.wire([ct, 'gate'], [keys, 'gate'])
      const pad = k.add('swarm', { detune: 0.3, mix: 0.45, cutoff: 1800, att: 0.4, rel: 1.2, level: 0.5 })
      k.wire([ct, 'notes'], [pad, 'voct'])
      k.wire([ct, 'gate'], [pad, 'gate'])
      const bass = voice(k, [ct, 'root'], [d.tr, 't8'], { filter: { type: 'vcf', params: { cutoff: 420, res: 0.3 }, out: 'lp4' }, env: { d: 0.2, s: 0.5, r: 0.08 } })
      const riser = k.add('riser', { noise: 0.6, tone: 0.35, level: 0.5 })
      k.wire([xl, 'ramp'], [riser, 'ramp'])
      k.wire([xl, 'clko'], [riser, 'clk'])
      const roll = k.add('snare', { tune: 230, decay: 0.1, snappy: 0.9 })
      k.wire([riser, 'rollo'], [roll, 'trig'])
      // the parts' levels: 1 drums, 2 bass, 3 keys, 5 pad
      const vm = k.add('vcamix')
      const ins: Jack[] = [d.out, bass.out, [keys, 'out'], [pad, 'l']]
      ins.forEach((src, i) => k.wire(src, [vm, `in${i + 1}`]))
      ;['l1', 'l2', 'l3', 'l5'].forEach((l, i) => k.wire([xl, l], [vm, `cv${i + 1}`]))
      toOut(k, mix(k, [[vm, 'mix'], [riser, 'l'], [roll, 'out']], [0.8, 0.6, 0.45]), undefined, 0.85)
    },
  },
  chordtrack: {
    howTo:
      'CHORD TRACK’s chords (Am, F, C, G) voice-led onto a SWARM pad, its ROOT playing a bass in eighths. Click the top of a bar for the next root, the bottom for the next kind of chord, scroll to move the root; click a bar’s right edge for a change on its half; right-click to clear. Try VOICING.',
    build(k) {
      const clock = k.add('clock', { bpm: 96 })
      const ct = k.add('chordtrack')
      k.wire([clock, 'x4'], [ct, 'clk'])
      k.wire([clock, 'rst'], [ct, 'rst'])
      const pad = k.add('swarm', { detune: 0.35, mix: 0.5, cutoff: 2400, att: 0.08, rel: 0.6, level: 0.5 })
      k.wire([ct, 'notes'], [pad, 'voct'])
      k.wire([ct, 'gate'], [pad, 'gate'])
      const bass = voice(k, [ct, 'root'], [clock, 'x2'], { filter: { type: 'vcf', params: { cutoff: 380, res: 0.3 }, out: 'lp4' }, env: { d: 0.18, s: 0.4, r: 0.06 } })
      const plate = k.add('plate', { decay: 0.6, mix: 0.25 })
      k.wire(mix(k, [[pad, 'l'], bass.out], [0.7, 0.75]), [plate, 'in'])
      toOut(k, [plate, 'l'], [plate, 'r'], 0.55)
    },
  },
  riser: {
    howTo:
      'A groove whose last two bars of every eight are a build: ARRANGER’s part 2 holds RISER’s GATE, the noise and tone climb, ROLL speeds a snare up on the clock, and when the gate falls the drop lands with an IMPACT and a downlifter. Try BRIGHT, TONE and IMPACT; patch SWEEP to a filter’s CV to open it into the drop.',
    build(k) {
      const clock = k.add('clock', { bpm: 124 })
      const d = kit(k, [{ kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'x.xxx.xxx.xxx.xx', oh: '..x...x...x...x.' }])
      k.wire([clock, 'x4'], [d.tr, 'clk'])
      k.wire([clock, 'rst'], [d.tr, 'rst'])
      const ar = k.add('arranger', { len: 2, b0: 6, p0: 0, m0: 1, b1: 2, p1: 0, m1: 2 })
      k.wire([clock, 'x4'], [ar, 'clk'])
      k.wire([clock, 'rst'], [ar, 'rst'])
      const riser = k.add('riser', { len: (2 * 4 * 60) / 124 })
      k.wire([ar, 'g2'], [riser, 'gate'])
      k.wire([clock, 'x4'], [riser, 'clk'])
      const roll = k.add('snare', { tune: 230, decay: 0.1, snappy: 0.9 })
      k.wire([riser, 'rollo'], [roll, 'trig'])
      const drums = k.add('vca', { gain: 0, cv: 1 })
      k.wire(d.out, [drums, 'in'])
      k.wire([ar, 'g1'], [drums, 'cv'])
      const l = mix(k, [[drums, 'out'], [riser, 'l'], [roll, 'out']], [0.85, 0.7, 0.5])
      const r = mix(k, [[drums, 'out'], [riser, 'r'], [roll, 'out']], [0.85, 0.7, 0.5])
      toOut(k, l, r, 0.5)
    },
  },
}
