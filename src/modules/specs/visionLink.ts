import { HP_MM, type Control, type ModuleSpec } from '../types'
import { BLACK } from './panels'
import { columns, SCREEN_SIZES, VISION_INPUTS, VISION_LEDS, VISION_OUTPUTS, VISION_PARAMS, VISION_SCENES, VS } from './vision'

/** Camera angles a VISION VIEW can take, in every scene: WIDE (the whole
 *  scene, straight on), ANGLE (another side of it: the jelly's tank end, the
 *  garden from eye level, the sky overhead, the plate at a slant) and CLOSE
 *  (following the subject: the jelly, the newest bloom, a firefly). */
export const VIEW_CAMS = ['WIDE', 'ANGLE', 'CLOSE'] as const

const C3 = [10, 25.4, 40.8]

/** VISION's creature engine without the glass: the same scenes, CV in and CV
 *  out, at a fraction of the width. Patch LINK into any number of VISION VIEW
 *  modules to watch it (each can use its own camera). */
export const visioncore: ModuleSpec = {
  type: 'visioncore',
  title: 'VISION CORE',
  name: 'Vision Core',
  tagline: 'The VISION creature engine with no screen: patch LINK to any number of VISION VIEWs',
  category: 'Visuals',
  hp: 10,
  panel: BLACK,
  inputs: VISION_INPUTS,
  outputs: VISION_OUTPUTS,
  params: VISION_PARAMS,
  leds: VISION_LEDS,
  controls: [
    { kind: 'knob', param: 'scene', x: 14, y: 26, size: 'S' },
    { kind: 'knob', param: 'rate', x: 36.8, y: 26, size: 'S' },
    { kind: 'knob', param: 'hue', x: 14, y: 46, size: 'S' },
    { kind: 'knob', param: 'glow', x: 36.8, y: 46, size: 'S' },
    { kind: 'in', jack: 'trig', x: C3[0], y: 68 },
    { kind: 'in', jack: 'feed', x: C3[1], y: 68 },
    { kind: 'in', jack: 'glow', x: C3[2], y: 68 },
    { kind: 'in', jack: 'hue', x: C3[0], y: 83 },
    { kind: 'in', jack: 'move', x: C3[1], y: 83 },
    { kind: 'led', index: VS.gate, x: C3[2], y: 83, color: '#5ef2ff' },
    { kind: 'out', jack: 'gate', x: C3[0], y: 100 },
    { kind: 'out', jack: 'sway', x: C3[1], y: 100 },
    { kind: 'out', jack: 'grow', x: C3[2], y: 100 },
    { kind: 'out', jack: 'light', x: C3[0], y: 114.5 },
    { kind: 'out', jack: 'link', x: C3[2], y: 114.5 },
  ],
}

/** What a VISION VIEW shows: the linked tank's own scene, or any other. */
export const VIEW_SCENES = ['LINKED', ...VISION_SCENES] as const

/** A screen for a VISION or VISION CORE: patch its LINK into this LINK. Add
 *  as many as you like; each picks its own scene (LINKED follows the tank's
 *  SCENE knob) and its own camera on the 3D tank. */
export const visionview: ModuleSpec = {
  type: 'visionview',
  title: 'VISION VIEW',
  name: 'Vision View',
  tagline: 'A viewport onto a linked VISION / VISION CORE tank, with its own camera (front, side, close-up)',
  category: 'Visuals',
  hp: 20,
  panel: BLACK,
  inputs: [{ id: 'link', label: 'LINK' }],
  outputs: [],
  params: [
    { id: 'scene', label: 'SCENE', min: 0, max: VIEW_SCENES.length - 1, def: 0, stepped: true, options: [...VIEW_SCENES] },
    { id: 'cam', label: 'CAMERA', min: 0, max: VIEW_CAMS.length - 1, def: 0, stepped: true, options: [...VIEW_CAMS] },
  ],
  controls: viewLayout(20),
  sizes: SCREEN_SIZES,
  layout: viewLayout,
}

/** VISION VIEW's panel at any width: nearly all glass (edge to edge, over the
 *  title), with its three controls in one slim row along the bottom. */
function viewLayout(hp: number): Control[] {
  const c = columns(hp * HP_MM, 3, 30)
  return [
    { kind: 'vision', x: 3, y: 5.5, w: hp * HP_MM - 6, h: 107, linked: true },
    { kind: 'knob', param: 'scene', x: c[0], y: 119.5, size: 'S' },
    { kind: 'knob', param: 'cam', x: c[1], y: 119.5, size: 'S' },
    { kind: 'in', jack: 'link', x: c[2], y: 119.5 },
  ]
}
