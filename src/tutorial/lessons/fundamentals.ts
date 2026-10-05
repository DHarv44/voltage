import type { Lesson } from '../types'
import { envelopes } from './envelopes'
import { filters } from './filters'
import { firstSound } from './firstSound'
import { modulation } from './modulation'

/** The fundamentals course. Every lesson starts from an empty rack. */
export const FUNDAMENTALS: Lesson[] = [firstSound, filters, envelopes, modulation]
