import type { Lesson } from '../types'
import { FUNDAMENTALS } from './fundamentals'
import { omnichordLesson, thereminLesson } from './instruments'
import { polyphony } from './polyphony'
import { semimodular } from './semimodular'
import { grooveLesson, lockstepLesson } from './systems'
import { acidTour } from './tours'
import { jellyTour, stringsTour, westTour } from './tours2'

export interface Course {
  title: string
  /** A line under the title in the Learn menu. */
  note: string
  lessons: Lesson[]
  /** Each lesson starts where the last ended ("Next lesson" keeps your rack). */
  continuous: boolean
}

export const COURSES: Course[] = [
  {
    title: 'Synth fundamentals',
    note: 'One continuous course: each lesson picks up where the last one ended, so you can start anywhere.',
    lessons: FUNDAMENTALS,
    continuous: true,
  },
  {
    title: 'Beyond the basics',
    note: 'Lessons on their own, each starting from an empty case.',
    lessons: [polyphony, semimodular, grooveLesson, lockstepLesson, thereminLesson, omnichordLesson],
    continuous: false,
  },
  {
    title: 'Tours of the factory racks',
    note: 'A factory rack, module by module: who does what, and the knobs to play.',
    lessons: [acidTour, jellyTour, stringsTour, westTour],
    continuous: false,
  },
]

/** The course a lesson belongs to. */
export const courseOf = (lesson: Lesson): Course | undefined => COURSES.find((c) => c.lessons.includes(lesson))
