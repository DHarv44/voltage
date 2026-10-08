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
