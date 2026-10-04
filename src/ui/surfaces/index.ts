import type { ComponentType } from 'react'
import type { SurfaceProps } from './common'
import { Turntable } from './Turntable'

/** Played instrument surfaces, by the `name` a spec's surface control uses. */
export const SURFACES: Record<string, ComponentType<SurfaceProps>> = {
  turntable: Turntable,
}
