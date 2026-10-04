import { SPECS } from '../../modules'
import { fits } from '../layout'
import { sanitize } from '../persist'
import type { Patch } from '../types'
import { ambient, classicMono, monoLead, westCoast } from './synths'
import { acidHouse, drumKit, loopJam } from './rhythm'
import { synthPop } from './pop'

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
    id: 'harry-styles',
    name: 'Harry Styles Synth-Pop',
    description:
      'Groove-first 173 BPM synth-pop: octave bass on MONO-1, a three-voice I–V–vi–IV pad, a ring-modulated steel-drum bell hook, punchy drums.',
    howTo: 'Power on: it plays itself. Flip GROOVE-1 PATTERN to B for a snare fill.',
    build: synthPop,
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
    id: 'west-coast',
    name: 'West Coast Plucks',
    description: 'Random notes, a sine wavefolded by its own envelope, into a spring.',
    howTo: 'Power on and let it play.',
    build: westCoast,
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
      else if (!fits(p, m.row, m.hp, SPECS[m.type].hp, m.id)) errors.push(`${pr.id}: ${m.type} overlaps or overflows`)
      for (const k of Object.keys(m.params))
        if (SPECS[m.type] && !SPECS[m.type].params.some((ps) => ps.id === k)) errors.push(`${pr.id}: ${m.type} has no param ${k}`)
    }
  }
  return errors
}
