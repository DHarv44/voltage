import { RackBuilder } from '../../patch/presets/builder'
import type { Lesson, Step } from '../types'

/** Every lesson starts from an empty case: you build the patch yourself. */
export const emptyRack: Lesson['build'] = () => ({ patch: new RackBuilder().build(1), mods: {} })

export const powerStep = (text: string): Step => ({
  text,
  task: 'Press POWER ON at the top left.',
  target: { ui: 'power' },
  action: { kind: 'power' },
})

/** OUT starts fairly loud; turn it down before anything sounds. */
export const volumeStep = (text = 'Protect your ears before anything sounds: OUT’s VOLUME starts fairly high.'): Step => ({
  text,
  task: 'Turn OUT’s VOLUME down to about 30 %.',
  target: { mod: 'out', param: 'vol' },
  action: { kind: 'set', mod: 'out', param: 'vol', value: 0.3 },
})
