import { PR_SLOTS } from '../../modules/specs/pianoroll'
import { drums } from '../songs/parts'
import { Kit, voice, type Jack } from '../starters/kit'
import type { Patch } from '../types'

/** "Voltage": the user's own track (made in Suno), rebuilt from an analysis of
 *  the recording: 115.5 BPM, E minor, Em – C – D – Em two bars each under an
 *  eight-bar supersaw hook, a rolling 16th bass and a pad pumping under a
 *  four-on-the-floor kick. ARRANGER plays the whole 72-bar song: its PAT picks
 *  TR-16's pattern for each section and, smoothed by SLEW, how open the music
 *  is (dark intro, open drops, a sweep down into the breakdown); its PART
 *  gates bring the bass, lead and pluck in and out. */

const BPM = 115.5
/** A note on the roll: bar (0-based), step in the bar, length (16ths), name. */
type Note = [bar: number, step: number, len: number, name: string]
const PC: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
/** A note name → PIANO ROLL row (0 = C2). */
const row = (name: string) => PC[name.slice(0, -1)] + 12 * (Number(name.slice(-1)) - 2)

/** The hook, as played in the second and third drops (bars 1–2 over Em,
 *  3–4 over C, 5–6 over D, 7–8 back on Em with a pickup into the top). */
const HOOK: Note[] = [
  [0, 0, 4, 'B5'], [0, 4, 4, 'A5'], [0, 8, 3, 'G5'], [0, 11, 1, 'E5'], [0, 12, 1, 'G5'], [0, 13, 3, 'E5'],
  [1, 0, 1, 'G5'], [1, 1, 3, 'E5'], [1, 4, 3, 'G5'], [1, 7, 1, 'F#5'], [1, 8, 1, 'G5'], [1, 9, 1, 'D5'], [1, 10, 1, 'B4'], [1, 11, 1, 'A4'], [1, 12, 4, 'B4'],
  [2, 0, 4, 'B5'], [2, 4, 4, 'A5'], [2, 8, 1, 'G5'], [2, 9, 2, 'A5'], [2, 11, 1, 'E5'], [2, 12, 4, 'G5'],
  [3, 0, 7, 'G5'], [3, 7, 1, 'F#5'], [3, 8, 1, 'G5'], [3, 9, 1, 'D5'], [3, 10, 1, 'B4'], [3, 11, 5, 'A4'],
  [4, 0, 3, 'A5'], [4, 3, 1, 'F#5'], [4, 4, 4, 'G5'], [4, 8, 1, 'F#5'], [4, 9, 2, 'G5'], [4, 11, 1, 'D5'], [4, 12, 1, 'F#5'], [4, 13, 3, 'A4'],
  [5, 0, 8, 'A4'], [5, 8, 2, 'B4'], [5, 10, 1, 'G5'], [5, 11, 1, 'F#5'], [5, 12, 2, 'E5'], [5, 14, 2, 'B4'],
  [6, 0, 2, 'B4'], [6, 2, 1, 'D5'], [6, 3, 2, 'E5'], [6, 5, 2, 'G5'], [6, 7, 1, 'F#5'], [6, 8, 1, 'E5'], [6, 9, 1, 'B4'], [6, 10, 1, 'D5'], [6, 11, 2, 'E5'], [6, 13, 2, 'B4'], [6, 15, 2, 'E5'],
  [7, 1, 1, 'B4'], [7, 2, 1, 'D5'], [7, 3, 3, 'E5'], [7, 6, 1, 'G5'], [7, 7, 1, 'F#5'], [7, 8, 1, 'E5'], [7, 9, 1, 'D5'], [7, 10, 1, 'B4'], [7, 11, 1, 'E5'], [7, 12, 1, 'G5'], [7, 13, 1, 'E5'], [7, 14, 1, 'F#5'], [7, 15, 1, 'G5'],
]

/** The pad: Em7, C(add9), D(add9), Em7, two bars each, voiced close. */
const PAD: Note[] = [
  ...['E3', 'G3', 'B3', 'D4'].map((n): Note => [0, 0, 32, n]),
  ...['E3', 'G3', 'C4', 'D4'].map((n): Note => [2, 0, 32, n]),
  ...['F#3', 'A3', 'D4', 'E4'].map((n): Note => [4, 0, 32, n]),
  ...['E3', 'G3', 'B3', 'D4'].map((n): Note => [6, 0, 32, n]),
]

/** The bass's roots, each one pushed three 16ths ahead of its chord. */
const BASS: Note[] = [[0, 0, 29, 'E2'], [1, 13, 32, 'C2'], [3, 13, 32, 'D2'], [5, 13, 35, 'E2']]

/** An eight-bar PIANO ROLL holding these notes (every other slot empty). */
function roll(k: Kit, notes: Note[], voices: number): string {
  const p: Record<string, number> = { bars: 8, voices, view: 10 }
  for (let i = 0; i < PR_SLOTS; i++) {
    const n = notes[i]
    p[`s${i}`] = n ? n[0] * 16 + n[1] : -1
    if (!n) continue
    p[`l${i}`] = n[2]
    p[`n${i}`] = row(n[3])
    p[`v${i}`] = 0.85
  }
  return k.add('pianoroll', p)
}

/** The song: [bars, pattern (A intro, B breakdown, C drop, D fill), parts]. */
const BASS_P = 1
const LEAD_P = 2
const PLUCK_P = 4
const SONG: [number, number, number][] = [
  [7, 0, BASS_P | PLUCK_P], // intro: bass and pluck through a closed filter
  [1, 3, BASS_P | PLUCK_P], // kick roll, the filter flying open
  [16, 2, BASS_P | PLUCK_P], // drop 1
  [7, 2, BASS_P | PLUCK_P],
  [1, 3, BASS_P | PLUCK_P], // kick roll and a beat of silence
  [15, 2, BASS_P | LEAD_P | PLUCK_P], // drop 2: the hook on the supersaw
  [1, 3, LEAD_P | PLUCK_P],
  [7, 1, BASS_P | PLUCK_P], // breakdown: no drums, the filter sweeps half shut
  [1, 3, BASS_P | PLUCK_P],
  [13, 2, BASS_P | LEAD_P | PLUCK_P], // drop 3
  [1, 3, LEAD_P | PLUCK_P],
  [2, 0, 0], // the pad alone, closing
]

/** A gate passed only while an ARRANGER part plays (a VCA as a switch). */
function onlyIn(k: Kit, gate: Jack, part: Jack): Jack {
  const v = k.add('vca', { gain: 0, cv: 1 })
  k.wire(gate, [v, 'in'])
  k.wire(part, [v, 'cv'])
  return [v, 'out']
}

export function voltageSong(): Patch {
  const k = new Kit(104)
  const d = drums(k, {
    bpm: BPM,
    bars: [
      { ch: '..x...x...x...x.' },
      {},
      { kick: 'x...x...x...x...', clap: '....x.......x...', ch: 'xx.xxx.xxx.xxx.x', oh: '..x...x...x...x.', acc: '..x...x...x...x.' },
      { kick: 'xxxxxxxxxxxx....', snare: '....x.x.xxxx....', acc: '........xxxx....' },
    ],
    kick: { tune: 50, decay: 0.45, punch: 0.7, drive: 0.35 },
    clap: { tone: 1300, decay: 0.25 },
    snare: { tune: 210, decay: 0.12, snappy: 0.8 },
    hats: { chd: 0.03, ohd: 0.22, tone: 10500 },
  })
  const ar = k.add('arranger', {
    len: SONG.length,
    loop: 1,
    ...Object.fromEntries(SONG.flatMap(([b, pat, m], i) => [[`b${i}`, b], [`p${i}`, pat], [`m${i}`, m]])),
  })
  k.wire([d.clock, 'x4'], [ar, 'clk'])
  k.wire([d.clock, 'rst'], [ar, 'rst'])
  k.wire([ar, 'pat'], [d.tr, 'pat'])
  // the section's brightness: PAT (1.25 … 8.75 V) smoothed into the filters
  const bright = k.add('slew', { rise: 0.9, fall: 3 })
  k.wire([ar, 'pat'], [bright, 'in'])
  const clocked = (id: string) => {
    k.wire([d.clock, 'x4'], [id, 'clk'])
    k.wire([d.clock, 'rst'], [id, 'rst'])
    return id
  }

  // the pad: a supersaw on the chords, opened and closed by the section
  const padRoll = clocked(roll(k, PAD, 4))
  const pad = k.add('swarm', { detune: 0.4, mix: 0.55, spread: 0.85, cutoff: 130, res: 0.1, cvamt: 0.95, att: 0.03, rel: 0.35, level: 0.5 })
  k.wire([padRoll, 'pitch'], [pad, 'voct'])
  k.wire([padRoll, 'gate'], [pad, 'gate'])
  k.wire([bright, 'out'], [pad, 'cut'])

  // the bass: the roots rolling on the three 16ths after each kick
  const bassRoll = clocked(roll(k, BASS, 1))
  const roll16 = k.add('seq8', { len: 4, ...Object.fromEntries([1, 2, 3, 4].flatMap((s) => [[`s${s}`, 0], [`g${s}`, s === 1 ? 0 : 1]])) })
  k.wire([d.clock, 'x4'], [roll16, 'clk'])
  k.wire([d.clock, 'rst'], [roll16, 'reset'])
  const bass = voice(k, [bassRoll, 'pitch'], onlyIn(k, [roll16, 'gate'], [ar, 'g1']), {
    osc: { type: 'vco', out: 'saw' },
    filter: { type: 'vcf', params: { cutoff: 260, res: 0.3, cv: 0.35 }, out: 'lp4' },
    env: { a: 0.002, d: 0.1, s: 0.45, r: 0.04 },
  })

  // the hook: one roll, two voices: a pluck all song, the supersaw lead in drops 2 and 3
  const hook = clocked(roll(k, HOOK, 1))
  const pluck = voice(k, [hook, 'pitch'], onlyIn(k, [hook, 'gate'], [ar, 'g3']), {
    osc: { type: 'vco', params: { coarse: -1 }, out: 'saw' },
    filter: { type: 'vcf', params: { cutoff: 200, res: 0.25, cv: 0.75 }, out: 'lp2' },
    filterCv: [bright, 'out'],
    env: { a: 0.001, d: 0.16, s: 0, r: 0.12 },
  })
  const echo = k.add('bbd', { time: (60 / BPM) * 0.75, fb: 0.35, mix: 0.3, mod: 0.1 })
  k.wire(pluck.out, [echo, 'in'])
  const vib = k.add('lfo', { rate: 5.5 })
  const lead = k.add('swarm', { detune: 0.3, mix: 0.6, spread: 0.6, cutoff: 7500, res: 0.12, att: 0.008, rel: 0.18, level: 0.42 })
  // the pitch plus a touch of vibrato (±5 V × 0.005: about a third of a semitone)
  const leadPitch = k.add('mixer', { l1: 1, l2: 0.005, l3: 0, l4: 0, master: 1 })
  k.wire([hook, 'pitch'], [leadPitch, 'in1'])
  k.wire([vib, 'tri'], [leadPitch, 'in2'])
  k.wire([leadPitch, 'out'], [lead, 'voct'])
  k.wire(onlyIn(k, [hook, 'gate'], [ar, 'g2']), [lead, 'gate'])

  // the mix: everything but the drums pumps under the kick, a plate on the send
  const drm = k.add('mixer', { l1: 0.65, l2: 0.7, l3: 0.5, l4: 0, master: 0.9 })
  k.wire(d.clap!, [drm, 'in1'])
  k.wire(d.hats!, [drm, 'in2'])
  k.wire(d.snare!, [drm, 'in3'])
  const music = k.add('mixer', { l1: 0.6, l2: 0.55, l3: 0.55, l4: 0, master: 0.9 })
  k.wire([echo, 'out'], [music, 'in1'])
  k.wire([lead, 'l'], [music, 'in2'])
  k.wire([lead, 'r'], [music, 'in3'])
  // the section's level too: the same smoothed PAT rides four VCAs (gain =
  // 0.2 + PAT/10), so the intro sits ~8 dB under the drops, the breakdown
  // ~3 dB, and the fills swell a little louder into each drop
  const ride = k.add('vcamix', { lvl1: 0.2, lvl2: 0.2, lvl3: 0.2, lvl4: 0.2 })
  ;[bass.out, [pad, 'l'] as Jack, [pad, 'r'] as Jack, [music, 'out'] as Jack].forEach((src, i) => {
    k.wire(src, [ride, `in${i + 1}`])
    k.wire([bright, 'out'], [ride, `cv${i + 1}`])
  })
  const c = k.add('console', {
    lvl1: 0.85, lvl2: 0.72, snd2: 0.12, duck2: 0.15,
    lvl3: 0.85, duck3: 0.75,
    lvl4: 0.55, pan4: -0.65, snd4: 0.3, duck4: 0.8,
    lvl5: 0.55, pan5: 0.65, snd5: 0.3, duck5: 0.8,
    lvl6: 0.72, snd6: 0.35, duck6: 0.45,
    rel: 0.22, ret: 0.5, master: 0.8,
  })
  k.wire(d.kick!, [c, 'in1'])
  k.wire([drm, 'out'], [c, 'in2'])
  for (let i = 1; i <= 4; i++) k.wire([ride, `out${i}`], [c, `in${i + 2}`])
  k.wire(d.kick!, [c, 'sc'])
  const plate = k.add('plate', { decay: 0.7, damp: 0.55, mix: 1 })
  k.wire([c, 'send'], [plate, 'in'])
  k.wire([plate, 'l'], [c, 'retL'])
  k.wire([plate, 'r'], [c, 'retR'])
  const master = k.add('master', { drive: 5, low: 1.5, high: 1 })
  k.wire([c, 'l'], [master, 'l'])
  k.wire([c, 'r'], [master, 'r'])
  const out = k.add('output', { vol: 1 })
  k.wire([master, 'l'], [out, 'l'])
  k.wire([master, 'r'], [out, 'r'])
  return k.build()
}
