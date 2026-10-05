import type { ComponentType } from 'react'
import type { SurfaceProps } from './common'
import { Omnichord } from './Omnichord'
import { Theremin } from './Theremin'
import { Turntable } from './Turntable'
import { Treadle } from './Treadle'
import { MusicBox } from './MusicBox'
import { Mouth } from './Mouth'
import { Reels } from './Reels'
import { Tuner } from './Tuner'
import { Room } from './Room'
import { Strike } from './Strike'
import { Tanpura } from './Tanpura'
import { Gamelan } from './Gamelan'
import { Bowl } from './Bowl'
import { DjFaders } from './DjFaders'
import { Harp } from './Harp'
import { Pocket } from './Pocket'
import { Stylophone } from './Stylophone'
import { Bounce } from './Bounce'
import { Orbit } from './Orbit'
import { Life } from './Life'
import { Flock } from './Flock'
import { Chaos } from './Chaos'
import { Ecosystem } from './Ecosystem'
import { Ghost } from './Ghost'
import { Progression } from './Progression'
import { Bandmate } from './Bandmate'
import { AudioIn, Camera, Gamepad } from './Inputs'

/** Played instrument surfaces, by the `name` a spec's surface control uses. */
export const SURFACES: Record<string, ComponentType<SurfaceProps>> = {
  turntable: Turntable,
  theremin: Theremin,
  omnichord: Omnichord,
  treadle: Treadle,
  musicbox: MusicBox,
  mouth: Mouth,
  reels: Reels,
  tuner: Tuner,
  room: Room,
  strike: Strike,
  tanpura: Tanpura,
  gamelan: Gamelan,
  bowl: Bowl,
  djfaders: DjFaders,
  harp: Harp,
  pocket: Pocket,
  stylophone: Stylophone,
  bounce: Bounce,
  orbit: Orbit,
  life: Life,
  flock: Flock,
  chaos: Chaos,
  ecosystem: Ecosystem,
  ghost: Ghost,
  progression: Progression,
  bandmate: Bandmate,
  audioin: AudioIn,
  camera: Camera,
  gamepad: Gamepad,
}
