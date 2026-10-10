import { chordCode, LISTEN_QUALITIES, QUALITIES, templateScore } from '../../../modules/specs/combo/chords'
import type { Learner } from './learner'

/** A part worked out from what was played. */
export interface Learned {
  ok: boolean
  /** Why it couldn't (shown on the screen). */
  why: string
  beats: number
  meter: number
  bpm: number
  /** The chord on every beat (codes; −1 none). */
  chords: Int16Array
  /** It was played with a shuffle or swing. */
  swing: boolean
}

const ALL_QUALITIES = QUALITIES.map((_, i) => i)
/** How likely a part is to be this many bars long. */
const BARS_PRIOR: Record<number, number> = { 1: 0.35, 2: 0.6, 4: 1, 8: 1, 12: 0.75, 16: 0.9, 24: 0.5, 32: 0.7, 48: 0.4 }
const scratch = new Float64Array(12)
const scratchBass = new Float64Array(12)

/** Work a taught part out: the press that started it and the press that
 *  ended it were both on its first downbeat, so its length is a whole number
 *  of bars. Every bar count and meter whose tempo is plausible is weighed by
 *  how usual that many bars are, how usual the tempo is, how well the strums
 *  land on its beats, and how well the chord changes land on its bar lines;
 *  then a chord is named for every beat (holding the last one through
 *  silences and near-ties, so it doesn't flicker). */
export function analyse(L: Learner, seconds: number, fixedMeter: number): Learned {
  const fail = (why: string): Learned => ({ ok: false, why, beats: 0, meter: 4, bpm: 0, chords: new Int16Array(0), swing: false })
  const F = L.frames
  if (seconds < 1 || F < 12) return fail('TOO SHORT')
  // running sums, and the onset envelope (flux above its local average)
  const sc = L.sumChroma
  const se = L.sumEnergy
  sc.fill(0, 0, 12)
  se[0] = 0
  let fluxSum = 0
  const sb = L.sumBass
  sb.fill(0, 0, 12)
  for (let f = 0; f < F; f++) {
    for (let p = 0; p < 12; p++) {
      sc[(f + 1) * 12 + p] = sc[f * 12 + p] + L.chroma[f * 12 + p]
      sb[(f + 1) * 12 + p] = sb[f * 12 + p] + L.bass[f * 12 + p]
    }
    se[f + 1] = se[f] + L.energy[f]
    fluxSum += L.flux[f]
  }
  if (se[F] / F < 1e-4) return fail('NOTHING HEARD')
  const span = Math.max(2, Math.round(0.4 / L.frameSec))
  let oMean = 0
  for (let f = 0; f < F; f++) {
    let local = 0
    let n = 0
    for (let g = Math.max(0, f - span); g < Math.min(F, f + span); g++, n++) local += L.flux[g]
    L.onset[f] = Math.max(0, L.flux[f] - local / n)
    oMean += L.onset[f]
  }
  oMean = oMean / F + 1e-9 + (fluxSum === 0 ? 1 : 0)

  // the candidates: every meter and bar count with a plausible tempo
  const meters = fixedMeter === 3 || fixedMeter === 4 ? [fixedMeter] : [4, 3]
  let best = { score: -Infinity, beats: 0, meter: 4 }
  for (const m of meters) {
    for (let bars = 1; bars <= 48; bars++) {
      const beats = m * bars
      const bpm = (60 * beats) / seconds
      if (bpm < 45 || bpm > 230) continue
      const tempoLike = Math.exp(-((Math.log2(bpm / 105) / 0.5) ** 2) / 2)
      const beatHits = onBeats(L, beats, seconds, oMean, 0)
      const downHits = onBeats(L, beats, seconds, oMean, m)
      let score = Math.log(BARS_PRIOR[bars] ?? 0.12) + Math.log(tempoLike + 1e-3) + 1.6 * beatHits + 0.5 * (downHits - beatHits)
      if (score > best.score - 3) {
        // chord changes on bar lines say the meter (and the bar count) is right
        const chords = chordsFor(L, beats, seconds, m)
        score += 1.4 * changesOnBars(chords, m)
        if (score > best.score) best = { score, beats, meter: m }
      }
    }
  }
  if (!best.beats) return fail('TEMPO?')
  const chords = chordsFor(L, best.beats, seconds, best.meter)
  if (chords[0] < 0) return fail('NO CHORDS')
  return { ok: true, why: '', beats: best.beats, meter: best.meter, bpm: (60 * best.beats) / seconds, chords, swing: swingOf(L, best.beats, seconds, oMean) }
}

/** How strongly the onsets land on these beats (every `every`th beat only,
 *  for downbeats; 0 = all), against the average. */
function onBeats(L: Learner, beats: number, seconds: number, oMean: number, every: number): number {
  const fps = 1 / L.frameSec
  let sum = 0
  let n = 0
  for (let b = 0; b < beats; b += every || 1) {
    const c = Math.round(((b * seconds) / beats) * fps)
    let m = 0
    for (let f = Math.max(0, c - 2); f <= Math.min(L.frames - 1, c + 2); f++) m = Math.max(m, L.onset[f])
    sum += m
    n++
  }
  return Math.log(1 + sum / n / oMean)
}

/** Fill `scratch` / `scratchBass` with frames [a, z)'s chroma; returns its level. */
function window(L: Learner, a: number, z: number): number {
  for (let p = 0; p < 12; p++) {
    scratch[p] = L.sumChroma[z * 12 + p] - L.sumChroma[a * 12 + p]
    scratchBass[p] = L.sumBass[z * 12 + p] - L.sumBass[a * 12 + p]
  }
  return (L.sumEnergy[z] - L.sumEnergy[a]) / Math.max(1, z - a)
}

/** How well `code` explains the window in scratch: its shape, plus a little
 *  for being rooted on the note the bass is playing. */
function fit(code: number): number {
  let top = 0
  for (let p = 0; p < 12; p++) top = Math.max(top, scratchBass[p])
  const bass = top > 0 ? scratchBass[Math.floor(code / 16)] / top : 0
  return templateScore(scratch, Math.floor(code / 16), code % 16) + 0.12 * bass
}

/** The best chord for the window in scratch, and how well it fits. */
function bestChord(qualities: number[]): { code: number; score: number } {
  let code = -1
  let score = -Infinity
  for (let r = 0; r < 12; r++)
    for (const q of qualities) {
      const s = fit(chordCode(r, q))
      if (s > score) {
        score = s
        code = chordCode(r, q)
      }
    }
  return { code, score }
}

/** The chord on every beat. Each bar is heard as a whole first (a chord
 *  still ringing from the bar before can't fool it); a beat only takes a
 *  chord of its own when it clearly says something else (a change mid-bar).
 *  The strum at each window's start is left out; a near-silent beat keeps
 *  the chord before it. */
function chordsFor(L: Learner, beats: number, seconds: number, meter: number): Int16Array {
  const out = new Int16Array(beats).fill(-1)
  const fpb = seconds / L.frameSec / beats // frames a beat
  const at = (b: number) => Math.min(L.frames, Math.max(0, Math.round(b * fpb)))
  const qualities = L.fromCables ? ALL_QUALITIES : LISTEN_QUALITIES
  const meanE = L.sumEnergy[L.frames] / L.frames
  let prev = -1
  for (let bar = 0; bar * meter < beats; bar++) {
    const b0 = bar * meter
    const b1 = Math.min(beats, b0 + meter)
    const e = window(L, at(b0 + 0.2), Math.max(at(b0 + 0.2) + 1, at(b1)))
    const barChord = e < meanE * 0.08 ? prev : bestChord(qualities).code
    for (let b = b0; b < b1; b++) {
      const a = Math.min(L.frames - 1, at(b + 0.15))
      const eb = window(L, a, Math.max(a + 1, at(b + 1)))
      let c = barChord
      if (eb >= meanE * 0.08 && barChord >= 0) {
        const own = bestChord(qualities)
        if (own.code !== barChord && own.score - fit(barChord) > 0.08) c = own.code
      }
      out[b] = c < 0 ? prev : c
      if (out[b] >= 0) prev = out[b]
    }
  }
  // beats before the first chord take the last one (the part goes round)
  let last = -1
  for (let b = beats - 1; b >= 0 && last < 0; b--) last = out[b]
  for (let b = 0; b < beats && out[b] < 0; b++) out[b] = last
  return out
}

/** The share of chord changes that fall on a bar line (0.5 with none). */
function changesOnBars(chords: Int16Array, meter: number): number {
  let on = 0
  let all = 0
  for (let b = 1; b < chords.length; b++)
    if (chords[b] !== chords[b - 1]) {
      all++
      if (b % meter === 0) on++
    }
  return (on + 1) / (all + 2)
}

/** Played with a swing: the strums between the beats land late (near the
 *  triplet, two thirds through the beat) more often than halfway. */
function swingOf(L: Learner, beats: number, seconds: number, oMean: number): boolean {
  const beatS = seconds / beats
  let straight = 0
  let swung = 0
  for (let f = 1; f < L.frames - 1; f++) {
    const o = L.onset[f]
    if (o < oMean * 2 || o < L.onset[f - 1] || o < L.onset[f + 1]) continue
    const frac = ((f * L.frameSec) / beatS) % 1
    if (Math.abs(frac - 0.5) < 0.07) straight++
    else if (Math.abs(frac - 0.667) < 0.07) swung++
  }
  return swung >= 3 && swung > straight * 1.2
}
