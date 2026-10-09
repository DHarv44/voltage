import type { Lesson } from '../types'
import { powerStep } from './common'
import { lockstepRack } from './racks'

// LOCKSTEP's tracks and pages, as the lesson uses them
const BASS = 1
const HATS = 2
const FM = 0
const AMP = 1
const FX = 2

/** Parameter locks: a knob setting that belongs to one step. */
export const plocks: Lesson = {
  id: 'plocks',
  title: 'Groovebox: parameter locks',
  summary: 'Lock a knob on a single step: an open hat in a closed pattern, a hat thrown to one side, one growling bass note.',
  build: lockstepRack,
  steps: [
    {
      text: 'This picks up where the groovebox lesson left off: LOCKSTEP patched to OUT. Its signature trick is the parameter lock: a knob setting that belongs to one step only. Every other step keeps the knob as it is.',
    },
    powerStep('Switch on.'),
    {
      text: 'Start it playing.',
      task: 'Press ▶ PLAY on LOCKSTEP’s face.',
      listen: 'The groove: kick, bass, hats and bell.',
      target: { mod: 'ls', param: 'run' },
      action: { kind: 'set', mod: 'ls', param: 'run', value: 1 },
    },
    {
      text: 'First pick the hats.',
      task: 'Press T3 (the hats).',
      listen: 'The step keys show the hat pattern: short, closed hats.',
      target: { mod: 'ls', param: 'trk' },
      action: { kind: 'set', mod: 'ls', param: 'trk', value: HATS },
    },
    {
      text: 'Right-clicking (or holding) a step key picks that step: it gets an orange outline, and the knobs now lock onto it instead of changing the whole track. On the AMP page, the second knob is DECAY: how long a hit rings.',
      task: 'Right-click step 7, press AMP, then turn DECAY up to about 45 %.',
      listen: 'Step 7 alone rings out: an open hat in a closed pattern. Its key shows an orange dot (a lock).',
      action: { kind: 'lock', mod: 'ls', track: HATS, step: 6, page: AMP, knob: 1, value: 0.45 },
    },
    {
      text: 'A step can lock several knobs at once. On the FX page the third knob is PAN.',
      task: 'With step 7 still picked, press FX and turn PAN right down.',
      listen: 'That open hat now jumps to the left, the rest stay where they were.',
      action: { kind: 'lock', mod: 'ls', track: HATS, step: 6, page: FX, knob: 2, value: 0.05 },
    },
    {
      text: 'DONE lets go of the step, so the knobs go back to changing the whole track. Locks stay where you set them.',
    },
    {
      text: 'Now the bass. One note that growls more than the others gives a line its character.',
      task: 'Press T2, right-click step 11, press FM, and turn DEPTH up to about 90 %.',
      listen: 'Step 11’s bass note is brassy and growling; the rest stay round.',
      action: { kind: 'lock', mod: 'ls', track: BASS, step: 10, page: FM, knob: 1, value: 0.9 },
    },
    {
      text: 'That’s parameter locking: any of the knobs on FM, AMP, FX and LFO can be locked per step. UNLOCK (with a step picked) clears its locks; double-click a knob to clear just that one. Locks are kept per pattern, so A–D can each have their own.',
    },
  ],
}
