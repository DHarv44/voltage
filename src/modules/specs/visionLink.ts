import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec } from '../types'
import { BLACK } from './panels'
import { GLASS_GAP, GLASS_TOP, SCREEN_SIZES, VISION_INPUTS, VISION_LEDS, VISION_OUTPUTS, VISION_PARAMS, VISION_SCENES, VISION_SETTINGS, VS } from './vision'

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
  settings: VISION_SETTINGS,
  controls: [
    { kind: 'knob', param: 'scene', x: 14, y: 23, size: 'S' },
    { kind: 'knob', param: 'rate', x: 36.8, y: 23, size: 'S' },
    { kind: 'knob', param: 'hue', x: 14, y: 39, size: 'S' },
    { kind: 'knob', param: 'glow', x: 36.8, y: 39, size: 'S' },
    { kind: 'knob', param: 'count', x: 14, y: 55, size: 'S' },
    { kind: 'led', index: VS.gate, x: 36.8, y: 55, color: '#5ef2ff' },
    { kind: 'in', jack: 'trig', x: C3[0], y: 70 },
    { kind: 'in', jack: 'feed', x: C3[1], y: 70 },
    { kind: 'in', jack: 'glow', x: C3[2], y: 70 },
    { kind: 'in', jack: 'hue', x: C3[0], y: 85 },
    { kind: 'in', jack: 'move', x: C3[1], y: 85 },
    { kind: 'in', jack: 'rst', x: C3[2], y: 85 },
    { kind: 'out', jack: 'gate', x: C3[0], y: 100 },
    { kind: 'out', jack: 'sway', x: C3[1], y: 100 },
    { kind: 'out', jack: 'grow', x: C3[2], y: 100 },
    { kind: 'out', jack: 'light', x: C3[0], y: 114.5 },
    { kind: 'out', jack: 'link', x: C3[2], y: 114.5 },
  ],
}

/** What a VISION VIEW shows: the linked tank's own scene, or any other. */
export const VIEW_SCENES = ['LINKED', ...VISION_SCENES] as const

const VIEW_INPUTS: ModuleSpec['inputs'] = [{ id: 'link', label: 'LINK' }]
const VIEW_PARAMS: ModuleSpec['params'] = [
  { id: 'scene', label: 'SCENE', min: 0, max: VIEW_SCENES.length - 1, def: 0, stepped: true, options: [...VIEW_SCENES] },
]

/** A screen for a VISION or VISION CORE: patch its LINK into this LINK. Add
 *  as many as you like; each picks its own scene (LINKED follows the tank's
 *  SCENE knob) and has its own pan and zoom on the 3D tank (scroll or pinch to
 *  zoom, middle-drag or two fingers to pan). */
export const visionview: ModuleSpec = {
  type: 'visionview',
  title: 'VISION VIEW',
  name: 'Vision View',
  tagline: 'A viewport onto a linked VISION / VISION CORE tank, with its own scene and its own pan and zoom',
  category: 'Visuals',
  hp: 20,
  panel: BLACK,
  inputs: VIEW_INPUTS,
  outputs: [],
  params: VIEW_PARAMS,
  controls: viewLayout(20),
  sizes: SCREEN_SIZES,
  layout: viewLayout,
}

/** VISION VIEW's panel at any width: nearly all glass (edge to edge, over the
 *  title), with its two controls in one slim row packed along the bottom. */
function viewLayout(hp: number): Control[] {
  const w = hp * HP_MM
  const row: Control[] = [
    { kind: 'knob', param: 'scene', x: 0, y: 0, size: 'S' },
    { kind: 'in', jack: 'link', x: 0, y: 0 },
  ]
  const { controls, top } = packRows([row], { params: VIEW_PARAMS, inputs: VIEW_INPUTS, outputs: [] }, w, { maxPitch: 30 })
  return [{ kind: 'vision', x: 2.5, y: GLASS_TOP, w: w - 5, h: top - GLASS_GAP - GLASS_TOP, linked: true }, ...controls]
}
