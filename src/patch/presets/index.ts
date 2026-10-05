import { SPECS } from '../../modules'
import { hpOf } from '../../modules/size'
import { fits } from '../layout'
import { sanitize } from '../persist'
import type { Patch } from '../types'
import { ambient, classicMono, monoLead, westCoast } from './synths'
import { acidHouse, drumKit, loopJam } from './rhythm'
import { euclidPolyrhythm, jellyDream, polyStrings, studioBleeps, studioClassic, tapeAmbient } from './more'
import { pocketBand, pocketBass, pocketBoomBap, pocketElectro, pocketLofi } from './pocket'

export interface Preset {
  id: string
  name: string
  description: string
  /** What to do once it's loaded. */
  howTo: string
  build: () => Patch
}

/** Preset racks: each one is a complete patch that does something different. */
export const PRESETS: Preset[] = [
  {
    id: 'classic',
    name: 'Classic Mono Synth',
    description: 'Two detuned VCOs → ladder filter → VCA, two envelopes, PWM from an LFO.',
    howTo: 'Power on and play keys A–K.',
    build: classicMono,
  },
  {
    id: 'mono-lead',
    name: 'MONO-1 Lead',
    description: 'The semi-modular voice through a BBD echo and a spring tank.',
    howTo: 'Power on and play keys A–K.',
    build: monoLead,
  },
  {
    id: 'acid-house',
    name: 'Acid House',
    description: 'GROOVE-1 beat clocking SEQ-8 into a squelchy MONO-1 bassline with echo.',
    howTo: 'Power on: it plays itself. Tweak MONO-1 CUTOFF and RESONANCE.',
    build: acidHouse,
  },
  {
    id: 'drum-kit',
    name: 'Modular Drum Kit',
    description: 'TR-16 sequencing discrete KICK, SNARE, CLAP and HATS, A→B chained fill.',
    howTo: 'Power on: it plays itself. Edit steps on TR-16.',
    build: drumKit,
  },
  {
    id: 'loop-jam',
    name: 'Loop Jam',
    description: 'One clock drives GROOVE-1 and LOOP; MONO-1 on the keys. Bar-synced looping.',
    howTo: 'Power on, press LOOP REC, play keys, press REC again to close the loop.',
    build: loopJam,
  },
  {
    id: 'ambient',
    name: 'Generative Ambient',
    description: 'Clocked S&H picks pentatonic notes over a drone; long BBD and deep spring.',
    howTo: 'Power on and let it play.',
    build: ambient,
  },
  {
    id: 'poly-strings',
    name: 'Poly Strings',
    description: 'Six-voice poly synth on poly cables: P-VCO → P-LADDER → P-VCA, ensemble chorus, plate.',
    howTo: 'Power on and play chords on keys A–K.',
    build: polyStrings,
  },
  {
    id: 'studio-classic',
    name: 'STUDIO-3 Classic',
    description: 'The 2600-style unit as a fat lead: cross-mod VCOs, resonant filter, spring.',
    howTo: 'Power on and play keys A–K.',
    build: studioClassic,
  },
  {
    id: 'studio-bleeps',
    name: 'STUDIO-3 S&H Bleeps',
    description: 'Classic self-patch: LFO → GATE retriggers, S&H noise → PITCH for random computer bleeps.',
    howTo: 'Power on: it plays itself. Try LFO RATE and the attenuator.',
    build: studioBleeps,
  },
  {
    id: 'euclid',
    name: 'Euclidean Polyrhythm',
    description: '16- and 12-step Euclidean cycles on analog drums, Turing machine melodic toms.',
    howTo: 'Power on: it plays itself. Turn the HITS knobs.',
    build: euclidPolyrhythm,
  },
  {
    id: 'tape-ambient',
    name: 'Tape-Loop Ambient',
    description: 'Slow Turing melody in Dorian on a morphing wavetable, through worn tape echo and a plate.',
    howTo: 'Power on and let it drift.',
    build: tapeAmbient,
  },
  {
    id: 'jelly-dream',
    name: 'Jellyfish Dream',
    description: 'A VISION jellyfish plays the melody: each bell stroke is a note, its tentacles morph the tone, the note colours the jelly.',
    howTo: 'Power on and watch. Turn VISION RATE for a busier jelly.',
    build: jellyDream,
  },
  {
    id: 'west-coast',
    name: 'West Coast Plucks',
    description: 'Random notes, a sine wavefolded by its own envelope, into a spring.',
    howTo: 'Power on and let it play.',
    build: westCoast,
  },
  {
    id: 'pocket-boombap',
    name: 'Pocket Boom Bap',
    description: 'POCKET at 90 bpm with heavy swing: lazy kick, fat snare, a locked ghost kick, through worn tape.',
    howTo: 'Power on: it plays itself. WRITE on: pick a sound, toggle its steps.',
    build: pocketBoomBap,
  },
  {
    id: 'pocket-electro',
    name: 'Pocket Electro',
    description: 'POCKET at 128: broken kick, ticking hats, a BLIP riff written with per-step pitch locks, laser ZAPs, BBD echo.',
    howTo: 'Power on: it plays itself. Select BLIP and right-click a step to see its lock.',
    build: pocketElectro,
  },
  {
    id: 'pocket-lofi',
    name: 'Pocket Lo-fi',
    description: 'POCKET at 78 with deep swing: soft kick, rim snare, a slow pentatonic BLIP melody, warbly tape and a dark plate.',
    howTo: 'Power on and let it loop. Try TAPE AGE and WOW.',
    build: pocketLofi,
  },
  {
    id: 'pocket-band',
    name: 'Pocket Band',
    description: 'The POCKET family together: drums keep time; POCKET BASS (acid, with a slide) and POCKET MELODY (bells, an arpeggio and a closing chord) follow its CLK. C minor.',
    howTo: 'Power on: it plays itself. On BASS or MELODY, drag a step up/down to change its note, right-click it for slide/accent or chord/arp.',
    build: pocketBand,
  },
  {
    id: 'pocket-bass',
    name: 'Pocket + Bassline',
    description: 'POCKET clocks a MONO-1 bassline; a VISION jelly pulses every two beats, takes its colour from the bass notes, and each glowing stroke opens the filter.',
    howTo: 'Power on: it plays itself. Change POCKET BPM and the bass and jelly follow; turn ATTN for more or less "wow".',
    build: pocketBass,
  },
]

/** Dev check: every preset builds, all its cables survive validation, nothing overlaps. */
export function validatePresets(): string[] {
  const errors: string[] = []
  for (const pr of PRESETS) {
    const p = pr.build()
    const clean = sanitize(p)
    if (!clean) errors.push(`${pr.id}: invalid patch`)
    else if (clean.cables.length !== p.cables.length) errors.push(`${pr.id}: ${p.cables.length - clean.cables.length} invalid cable(s)`)
    for (const m of p.modules) {
      if (!SPECS[m.type]) errors.push(`${pr.id}: unknown module ${m.type}`)
      else if (!fits(p, m.row, m.hp, hpOf(m), m.id)) errors.push(`${pr.id}: ${m.type} overlaps or overflows`)
      for (const k of Object.keys(m.params))
        if (SPECS[m.type] && !SPECS[m.type].params.some((ps) => ps.id === k)) errors.push(`${pr.id}: ${m.type} has no param ${k}`)
    }
  }
  return errors
}
