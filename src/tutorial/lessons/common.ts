import type { Step } from '../types'

export { emptyRack } from './racks'

/** Skipped when the rack is already on (continuing from the last lesson). */
export const powerStep = (text: string, listen?: string): Step => ({
  text,
  task: 'Switch POWER on, in the middle of the top bar.',
  listen,
  target: { ui: 'power' },
  action: { kind: 'power' },
  skipIfDone: true,
})

/** OUT starts fairly loud; turn it down before anything sounds. */
export const volumeStep = (text = 'Protect your ears before anything sounds: OUT’s VOLUME starts fairly high.'): Step => ({
  text,
  task: 'Turn OUT’s VOLUME down to about 30 %.',
  target: { mod: 'out', param: 'vol' },
  action: { kind: 'set', mod: 'out', param: 'vol', value: 0.3 },
})
