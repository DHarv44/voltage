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
  combo: {
    howTo:
      'COMBO’s own drummer and bass player on a blues shuffle in A (already taught). Turn GENRE and STYLE; press PART 1 for high intensity. Teach it your part: patch AUDIO IN to IN (or keys to V/OCT + GATE), select an empty part, press BAND, play, press BAND on the same downbeat. Press LOOPER while the band plays to loop yourself over the part.',
    build(k) {
      const c = k.add('combo', taught([[9, 2], [9, 2], [2, 2], [9, 2]], 96, 0, 1))
      toOut(k, [c, 'l'], [c, 'r'], 0.6)
    },
  },
  combofs: {
    howTo:
      'A FOOTSWITCH on COMBO CORE’s LINK. Stomp PART to cue the other part (a second one is taught: it comes in after a fill), BAND to stop (and again to start), hold BAND two seconds (stopped) to forget a part. LOOPER works any linked LOOPER.',
    build(k) {
      const p = taught(AM_F_C_G, 104, 5, 0)
      // a second part: a chorus on C, G, Am, F
      Object.assign(p, {
        n1: 16,
        m1: 4,
        t1: 104,
        g1: 5,
        s1: 5,
        v1: 1,
        c1_0: 0 * 256 + chordCode(0, 0) + 1,
        c1_1: 4 * 256 + chordCode(7, 0) + 1,
        c1_2: 8 * 256 + chordCode(9, 1) + 1,
        c1_3: 12 * 256 + chordCode(5, 0) + 1,
      })
      const core = coreBand(k, p)
      const fs = k.add('combofs')
      k.wire([core, 'link'], [fs, 'link'])
    },
  },
  combolooper: {
    howTo:
      'COMBO’s band with a LOOPER on its LINK, and an FM-4 line from a PIANO ROLL coming into it. Press LOOPER: it records one pass of the part, then plays it in time; press again to overdub, UNDO to take it back. Mute the PIANO ROLL and the loop plays on. Turn COMBO’s TEMPO: STRETCH keeps the loop’s pitch, TAPE doesn’t.',
    build(k) {
      const c = k.add('combo', taught(AM_F_C_G, 92, 5, 2))
      const pr = k.add('pianoroll', { tempo: 92 })
      const fm = k.add('fm4', { voice: 0, level: 0.6 })
      k.wire([pr, 'pitch'], [fm, 'voct'])
      k.wire([pr, 'gate'], [fm, 'gate'])
      k.wire([c, 'clko'], [pr, 'clk'])
      const lp = k.add('combolooper')
      k.wire([c, 'link'], [lp, 'link'])
      k.wire([fm, 'out'], [lp, 'in'])
      toOut(k, mix(k, [[c, 'l'], [lp, 'mix']], [0.7, 0.7]))
    },
  },
  combocore: {
    howTo:
      'COMBO CORE playing rock to Am, F, C, G (already taught), on KICK, SNARE, HATS and a bass voice. Turn GENRE and STYLE; press PART 1 for high intensity. To teach it your own part: press BAND (stopped), play your chords into IN (patch AUDIO IN) or keys into V/OCT + GATE, and press BAND on the same downbeat you started on.',
    build: (k) => void coreBand(k, taught(AM_F_C_G, 100, 2, 0)),
  },
}
