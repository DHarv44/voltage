import { chordCode } from '../../modules/specs/combo/chords'
import { changeId, partId } from '../../modules/specs/combo/params'
import { mix, toOut, voice, type Kit } from './kit'
import type { Starter } from './types'

/** A part already taught (as if you'd played it): `bars` of [root, quality]
 *  a bar, at `bpm`, in a genre and style. Params for COMBO / COMBO CORE,
 *  with the band set playing. */
export function taught(bars: [number, number][], bpm: number, genre: number, style: number, meter = 4): Record<string, number> {
  const p: Record<string, number> = { run: 1, part: 0, genre, style }
  p[partId('n', 0)] = bars.length * meter
  p[partId('m', 0)] = meter
  p[partId('t', 0)] = bpm
  p[partId('g', 0)] = genre
  p[partId('s', 0)] = style
  p[partId('v', 0)] = 1
  bars.forEach(([r, q], i) => (p[changeId(0, i)] = i * meter * 256 + chordCode(r, q) + 1))
  return p
}

/** A, F, C, G: the four chords half of pop is made of. */
export const AM_F_C_G: [number, number][] = [
  [9, 1],
  [5, 0],
  [0, 0],
  [7, 0],
]

/** COMBO CORE's band on rack modules: its drum gates on KICK, SNARE and
 *  HATS, its bass line on a synth voice. Returns the core. */
export function coreBand(k: Kit, params: Record<string, number>): string {
  const core = k.add('combocore', params)
  const kick = k.add('kick', { decay: 0.5, punch: 0.6 })
  const snare = k.add('snare')
  const hats = k.add('hats', { chd: 0.04 })
  k.wire([core, 'kick'], [kick, 'trig'])
  k.wire([core, 'snare'], [snare, 'trig'])
  k.wire([core, 'hat'], [hats, 'ch'])
  k.wire([core, 'ohat'], [hats, 'oh'])
  k.wire([core, 'acc'], [kick, 'acc'])
  const bass = voice(k, [core, 'bass'], [core, 'bgate'], { filter: { type: 'vcf', params: { cutoff: 700, res: 0.3 }, out: 'lp4' }, env: { d: 0.25, s: 0.6, r: 0.08 } })
  toOut(k, mix(k, [[kick, 'out'], [snare, 'out'], [hats, 'mix'], bass.out], [0.85, 0.7, 0.4, 0.7]))
  return core
}

export const COMBO_STARTERS: Record<string, Starter> = {
  combocore: {
    howTo:
      'COMBO CORE playing rock to Am, F, C, G (already taught), on KICK, SNARE, HATS and a bass voice. Turn GENRE and STYLE; press PART 1 for high intensity. To teach it your own part: press BAND (stopped), play your chords into IN (patch AUDIO IN) or keys into V/OCT + GATE, and press BAND on the same downbeat you started on.',
    build: (k) => void coreBand(k, taught(AM_F_C_G, 100, 2, 0)),
  },
}
