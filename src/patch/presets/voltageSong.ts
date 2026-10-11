import { chordCode } from '../../modules/specs/combo/chords'
import { Kit, voice, type Jack } from '../starters/kit'
import type { Patch } from '../types'
import { BASS, HOOK, onlyIn, roll, songDrums } from './voltageSongParts'

/** "Voltage": the user's own track (made in Suno), rebuilt from an analysis of
 *  the recording: 115.5 BPM, E minor, Em – C – D – Em two bars each under an
 *  eight-bar lead hook, a rolling 16th bass and a dark pad pumping under a
 *  four-on-the-floor kick. ARRANGER XL plays the whole 72-bar song and clocks
 *  it: its PAT picks TR-16's pattern and (smoothed by SLEW) how bright and
 *  loud each section is; its parts bring things in and out, falling silent on
 *  the beat before each drop; its RAMP drives a RISER into the drops. CHORD
 *  TRACK holds the chords. */

const BPM = 115.5
/** Parts: 1 drums, 2 bass, 3 piano, 4 lead, 5 pad, 6 a fill bar (the mix
 *  dips and swells back into the drop). */
const DR = 1
const BA = 2
const PI = 4
const LE = 8
const PA = 16
const FILL = 32
/** The song: [name, bars, pattern, parts, transition]. The letters climb in
 *  brightness and level (A intro, B breakdown, C fill, D drop); a DROP
 *  silences the fill's last beat, as the original does. Names index
 *  XL_NAMES (1 INTRO, 5 DROP, 6 BREAK, 8 BUILD, 10 OUTRO). */
const SONG: [number, number, number, number, number][] = [
  [1, 7, 0, DR | BA | PI | PA, 0], // intro: bass and piano through a closed filter
  [8, 1, 2, DR | BA | PI | PA | FILL, 0], // the roll builds, the filter opening
  [5, 16, 3, DR | BA | PI | PA, 3], // drop 1
  [5, 7, 3, DR | BA | PI | PA, 0],
  [8, 1, 2, DR | BA | PI | PA | FILL, 0],
  [5, 15, 3, DR | BA | LE | PA, 3], // drop 2: the hook moves from the piano to the lead
  [8, 1, 2, DR | LE | PA | FILL, 0],
  [6, 7, 1, BA | PI | PA, 0], // breakdown: no drums, the filter half shut
  [8, 1, 2, DR | BA | PI | PA | FILL, 0],
  [5, 13, 3, DR | BA | LE | PA, 3], // drop 3
  [8, 1, 2, DR | LE | PA | FILL, 0],
  [10, 2, 0, PA, 0], // the pad alone, closing
]

/** The chords, a bar each, held over the next: Em7, C(add9), D(add9), Em7. */
const CHORDS: [number, number][] = [[0, chordCode(4, 4)], [2, chordCode(0, 12)], [4, chordCode(2, 12)], [6, chordCode(4, 4)]]

export function voltageSong(): Patch {
  const k = new Kit(104)
  const xl = k.add('arrangerxl', {
    tempo: BPM,
    len: SONG.length,
    loop: 1,
    ...Object.fromEntries(SONG.flatMap(([n, b, pat, m, x], i) => [[`n${i}`, n], [`b${i}`, b], [`p${i}`, pat], [`m${i}`, m], [`x${i}`, x]])),
  })
  const clk: Jack = [xl, 'clko']
  const rst: Jack = [xl, 'rsto']
  const d = songDrums(k, clk, rst, [xl, 'pat'])
  // the section's brightness: PAT (1.25 … 8.75 V) smoothed into the filters
  const bright = k.add('slew', { rise: 0.9, fall: 1.2 })
  k.wire([xl, 'pat'], [bright, 'in'])
  // the section's level: the same, less a fill envelope (part 6) that drops
  // the mix ~6 dB as a fill starts and lets it swell back over the bar
  const fillEnv = k.add('adsr', { a: 0.001, d: 2.6, s: 0, r: 0.05 })
  k.wire([xl, 'g6'], [fillEnv, 'gate'])
  const level = k.add('mixer', { l1: 1, l2: 0.52, l3: 0, l4: 0, master: 1 })
  k.wire([bright, 'out'], [level, 'in1'])
  k.wire([fillEnv, 'inv'], [level, 'in2'])
  const clocked = (id: string) => {
    k.wire(clk, [id, 'clk'])
    k.wire(rst, [id, 'rst'])
    return id
  }

  // the pad: CHORD TRACK's chords on barely detuned saws, kept dark (under
  // ~1 kHz in the drops) so the hook has the middle to itself
  const chords = clocked(k.add('chordtrack', { bars: 8, ...Object.fromEntries(Array.from({ length: 8 }, (_, b) => [`c${b}`, (CHORDS.find(([at]) => at === b)?.[1] ?? -1) + 1])) }))
  const pad = k.add('swarm', { detune: 0.15, mix: 0.3, spread: 0.85, cutoff: 110, res: 0.1, cvamt: 0.4, att: 0.03, rel: 0.35, level: 0.6 })
  k.wire([chords, 'notes'], [pad, 'voct'])
  k.wire([chords, 'gate'], [pad, 'gate'])
  k.wire([bright, 'out'], [pad, 'cut'])

  // the bass: the roots rolling on the three 16ths after each kick
  const bassRoll = clocked(roll(k, BASS, 1))
  const roll16 = k.add('seq8', { len: 4, ...Object.fromEntries([1, 2, 3, 4].flatMap((s) => [[`s${s}`, 0], [`g${s}`, s === 1 ? 0 : 1]])) })
  k.wire(clk, [roll16, 'clk'])
  k.wire(rst, [roll16, 'reset'])
  const bass = voice(k, [bassRoll, 'pitch'], onlyIn(k, [roll16, 'gate'], [xl, 'g2']), {
    osc: { type: 'vco', out: 'saw' },
    filter: { type: 'vcf', params: { cutoff: 260, res: 0.3, cv: 0.35 }, out: 'lp4' },
    env: { a: 0.002, d: 0.1, s: 0.45, r: 0.04 },
  })

  // the hook: one roll (an octave under the original), two voices: STAGE's
  // tine electric piano (intro, drop 1, breakdown), then one soft singing
  // lead (drops 2 and 3)
  const hook = clocked(roll(k, HOOK, 1, { oct: -1 }, 1))
  const piano = k.add('stage', { model: 0, voicing: 0.6, bell: 0.7, decay: 0.45, drive: 0.2, trem: 0.15, level: 1 })
  k.wire([hook, 'pitch'], [piano, 'voct'])
  k.wire(onlyIn(k, [hook, 'gate'], [xl, 'g3']), [piano, 'gate'])
  k.wire([hook, 'vel'], [piano, 'vel'])
  // and the section darkens it: ~1.3 kHz in the intro, ~5 kHz in the breakdown, open in the drops
  const pluckTone = k.add('vcf', { cutoff: 700, res: 0.05, cv: 0.75 })
  k.wire([piano, 'l'], [pluckTone, 'in'])
  k.wire([bright, 'out'], [pluckTone, 'cv'])
  const echo = k.add('bbd', { time: (60 / BPM) * 0.75, fb: 0.35, mix: 0.3, mod: 0.1 })
  k.wire([pluckTone, 'lp2'], [echo, 'in'])
  // the lead's vibrato fades in on held notes only (a singer's, not a wobble):
  // ±5 V × 0.005, about a third of a semitone, through a VCA that opens slowly
  const leadGate = onlyIn(k, [hook, 'gate'], [xl, 'g4'])
  const vib = k.add('lfo', { rate: 5.5 })
  const vibEnv = k.add('adsr', { a: 0.35, d: 0.01, s: 1, r: 0.05 })
  const vibVca = k.add('vca', { gain: 0, cv: 1 })
  k.wire(leadGate, [vibEnv, 'gate'])
  k.wire([vib, 'tri'], [vibVca, 'in'])
  k.wire([vibEnv, 'env'], [vibVca, 'cv'])
  const leadPitch = k.add('mixer', { l1: 1, l2: 0.005, l3: 0, l4: 0, master: 1 })
  k.wire([hook, 'pitch'], [leadPitch, 'in1'])
  k.wire([vibVca, 'out'], [leadPitch, 'in2'])
  const lead = voice(k, [leadPitch, 'out'], leadGate, {
    osc: { type: 'vco', out: 'tri' },
    filter: { type: 'vcf', params: { cutoff: 2400, res: 0.05, cv: 0.2 }, out: 'lp2' },
    env: { a: 0.012, d: 0.4, s: 0.75, r: 0.18 },
  })

  // the build into each drop: RISER on ARRANGER XL's RAMP, into the drum bus
  const riser = k.add('riser', { noise: 0.5, tone: 0.25, bright: 0.55, impact: 0.45, down: 0.35, level: 0.5, roll: 0 })
  k.wire([xl, 'ramp'], [riser, 'ramp'])
  k.wire(clk, [riser, 'clk'])

  // the mix: everything but the drums pumps under the kick, a plate on the send
  const drm = k.add('mixer', { l1: 0.65, l2: 0.85, l3: 0.5, l4: 0.45, master: 0.9 })
  k.wire(d.clap, [drm, 'in1'])
  k.wire(d.hats, [drm, 'in2'])
  k.wire(d.snare, [drm, 'in3'])
  k.wire([riser, 'l'], [drm, 'in4'])
  const music = k.add('mixer', { l1: 1, l2: 0.25, l3: 0, l4: 0, master: 1 })
  k.wire([echo, 'out'], [music, 'in1'])
  k.wire(lead.out, [music, 'in2'])
  // the parts that have no gate of their own (drums, pad) follow their LEVELs,
  // so they too fall silent on a drop's last beat
  const parts = k.add('vcamix')
  ;[d.kick, [drm, 'out'] as Jack, [pad, 'l'] as Jack, [pad, 'r'] as Jack].forEach((src, i) => k.wire(src, [parts, `in${i + 1}`]))
  ;['l1', 'l1', 'l5', 'l5'].forEach((l, i) => k.wire([xl, l], [parts, `cv${i + 1}`]))
  // the section's level too: the same smoothed PAT rides four VCAs (gain =
  // LEVEL + PAT/10), so the intro sits well under the drops and the fills
  // swell into each one; the pad rides lowest, since nothing ducks it when
  // the kick is out, the hook least (it carries the breakdown)
  const ride = k.add('vcamix', { lvl1: 0.6, lvl2: 0.35, lvl3: 0.35, lvl4: 0.55 })
  ;[bass.out, [parts, 'out3'] as Jack, [parts, 'out4'] as Jack, [music, 'out'] as Jack].forEach((src, i) => {
    k.wire(src, [ride, `in${i + 1}`])
    k.wire([level, 'out'], [ride, `cv${i + 1}`])
  })
  const c = k.add('console', {
    lvl1: 0.87, lvl2: 0.74, snd2: 0.12, duck2: 0.15,
    lvl3: 0.58, duck3: 0.75,
    lvl4: 0.32, pan4: -0.65, snd4: 0.18, duck4: 0.95,
    lvl5: 0.32, pan5: 0.65, snd5: 0.18, duck5: 0.95,
    lvl6: 1, snd6: 0.25, duck6: 0.45,
    rel: 0.22, ret: 0.5, master: 0.8,
  })
  // the drums ride the section too (gain 0.4 + 0.6 × level/10): softer
  // hats in the intro, and each fill dips and swells instead of slamming in
  const drumRide = [[parts, 'out1'] as Jack, [parts, 'out2'] as Jack].map((src): Jack => {
    const v = k.add('vca', { gain: 0.4, cv: 0.6 })
    k.wire(src, [v, 'in'])
    k.wire([level, 'out'], [v, 'cv'])
    return [v, 'out']
  })
  k.wire(drumRide[0], [c, 'in1'])
  k.wire(drumRide[1], [c, 'in2'])
  for (let i = 1; i <= 4; i++) k.wire([ride, `out${i}`], [c, `in${i + 2}`])
  k.wire(d.kick, [c, 'sc'])
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
