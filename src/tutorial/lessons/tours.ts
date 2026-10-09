import { PRESETS } from '../../patch/presets'
import type { Lesson } from '../types'
import { powerStep } from './common'

/** A factory rack, with names for the modules a tour talks about: each the
 *  first module of its type, or `type#n` for the n-th. */
export function presetRack(id: string, names: Record<string, string>) {
  return () => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) throw new Error(`no preset ${id}`)
    const patch = preset.build()
    const mods: Record<string, string> = {}
    for (const [name, key] of Object.entries(names)) {
      const [type, nth = '1'] = key.split('#')
      const m = patch.modules.filter((x) => x.type === type)[Number(nth) - 1]
      if (m) mods[name] = m.id
    }
    return { patch, mods }
  }
}

/** The POCKET family as a band: one keeps time, two follow. */
export const pocketTour: Lesson = {
  id: 'tour-pocket',
  title: 'Tour: Pocket Band',
  summary: 'Three calculator-sized POCKETs as a band: the drums keep time, bass and melody follow their clock.',
  build: presetRack('pocket-band', { drums: 'pocket', bass: 'pocketbass', melody: 'pocketmelody', mix: 'mixer' }),
  steps: [
    {
      text: 'Three POCKETs, each a tiny groovebox: drums, an acid bass, a melody. Played together, one has to keep time and the others follow, like a band watching its drummer.',
    },
    powerStep('Switch on: it plays itself.', 'Drums, a bassline with a slide, and a bell melody in C minor.'),
    {
      text: 'The drum POCKET is the drummer: its CLK output pulses every sixteenth note and steps the other two, so they play at its TEMPO.',
      target: { mod: 'drums', jack: 'clko', dir: 'out' },
    },
    {
      text: 'Its RST output pulses whenever it starts, so the others start on beat one with it.',
      target: { mod: 'drums', jack: 'rsto', dir: 'out' },
    },
    {
      text: 'Because the others step on its clock, they also take its swing.',
      task: 'Turn the drum POCKET’s SWING up to about 30 %.',
      listen: 'The whole band shuffles together, bass and melody included.',
      target: { mod: 'drums', param: 'swing' },
      action: { kind: 'set', mod: 'drums', param: 'swing', value: 0.3 },
    },
    {
      text: 'POCKET BASS: sixteen note steps with slides and accents, like the acid boxes. Drag a step up or down to change its note; right-click it for a slide or an accent.',
      target: { mod: 'bass', surface: true },
    },
    {
      text: 'POCKET MELODY plays scale degrees, so it can’t go out of key: each step can be a note, a chord or an arpeggio (right-click a step).',
      target: { mod: 'melody', surface: true },
    },
    {
      text: 'A mixer balances the three, like a band’s sound desk.',
      task: 'Turn the mixer’s level 3 (the melody) up to about 75 %.',
      listen: 'The bells come forward.',
      target: { mod: 'mix', param: 'l3' },
      action: { kind: 'set', mod: 'mix', param: 'l3', value: 0.75 },
    },
    {
      text: 'Any module with a CLK input can join this band: patch the drum POCKET’s CLK into SEQ-8, LATTICE or LOCKSTEP and it plays along.',
    },
  ],
}

/** How the Acid House rack works: who keeps time, who plays, what squelches. */
export const acidTour: Lesson = {
  id: 'tour-acid',
  title: 'Tour: Acid House',
  summary: 'How the factory Acid House rack works, and the knobs that make the squelch.',
  build: presetRack('acid-house', { groove: 'groove', seq: 'seq8', mono: 'mono', echo: 'bbd', scope: 'scope' }),
  steps: [
    {
      text: 'Acid house came from a little bass synth played through a step sequencer, with someone riding the filter knobs live. This rack is built the same way. Let’s see who does what.',
    },
    powerStep('Switch on: it plays itself.', 'A house beat and a squelchy bassline.'),
    {
      text: 'GROOVE-1 is the drum machine, and also the clock: its CLK output steps the sequencer, so the bassline locks to the beat. Turn TEMPO and everything follows.',
      target: { mod: 'groove', param: 'tempo' },
    },
    {
      text: 'SEQ-8 is the bassline: eight steps, one note per knob (step 3 jumps an octave), and gate switches for the rests. Its CV sets MONO-1’s pitch and its GATE plays each note.',
      target: { mod: 'seq', param: 's3' },
    },
    {
      text: 'MONO-1 is the voice: a saw wave into a resonant filter. Resonance makes the filter ring at its cutoff, the whistling “squelch”.',
      task: 'Turn MONO-1’s RESONANCE up to about 100 %.',
      listen: 'A sharper, more vocal squelch on every note.',
      target: { mod: 'mono', param: 'res' },
      action: { kind: 'set', mod: 'mono', param: 'res', value: 1 },
    },
    {
      text: 'The acid move is riding CUTOFF while it plays: open it to brighten the whole line, close it to bury it.',
      task: 'Turn CUTOFF up to about 1 kHz.',
      listen: 'The line opens up, brighter and nastier.',
      target: { mod: 'mono', param: 'cutoff' },
      action: { kind: 'set', mod: 'mono', param: 'cutoff', value: 1000 },
    },
    {
      text: 'DECAY is how long the envelope keeps the filter open after each note: short is a tight blip, longer a wet “yow”.',
      task: 'Turn MONO-1’s DECAY up to about 0.4 s.',
      listen: 'Each note sweeps down more slowly: rounder, rubbery.',
      target: { mod: 'mono', param: 'd' },
      action: { kind: 'set', mod: 'mono', param: 'd', value: 0.4 },
    },
    {
      text: 'The BBD echo repeats the bass a dotted eighth later (0.363 s at 124 BPM), so the echoes fall between the notes and the line sounds busier than it is.',
      target: { mod: 'echo', param: 'time' },
    },
    {
      text: 'The scope shows the filter’s output and its envelope: watch the wave brighten and dull as you turn CUTOFF.',
      target: { mod: 'scope', param: 'time' },
    },
    {
      text: 'Now it’s yours: ride CUTOFF and RESONANCE as it plays, change the steps on SEQ-8, or turn up the GROOVE-1 swing.',
    },
  ],
}
