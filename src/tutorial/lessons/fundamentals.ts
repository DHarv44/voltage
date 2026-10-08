import type { Lesson } from '../types'
import { drums } from './drums'
import { effects } from './effects'
import { envelopes } from './envelopes'
import { filters } from './filters'
import { firstSound } from './firstSound'
import { modulation } from './modulation'
import { sequencing } from './sequencing'

/** The course: one continuous build, from an empty case to a whole track.
 *  Each lesson starts where the previous one ended (racks.ts rebuilds that
 *  for anyone opening a lesson directly). */
export const FUNDAMENTALS: Lesson[] = [firstSound, filters, envelopes, modulation, sequencing, drums, effects]
