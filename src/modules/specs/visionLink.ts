import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec } from '../types'
import { BLACK } from './panels'
import { GLASS_GAP, GLASS_TOP, rowsThatFit, SCREEN_SIZES, TOUCH_OUTPUTS, VISION_INPUTS, VISION_LEDS, VISION_OUTPUTS, VISION_PARAMS, VISION_SCENES, VISION_SETTINGS, VS } from './vision'

/** On the CORE there is no glass, so its scene knob only picks which scene's
 *  movement comes OUT of the jacks (every scene lives at once; VIEWs show any). */
const CORE_PARAMS: ModuleSpec['params'] = VISION_PARAMS.map((p) => (p.id === 'scene' ? { ...p, label: 'OUT' } : p))

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jin = (jack: string): Control => ({ kind: 'in', jack, x: 0, y: 0 })
const jout = (jack: string): Control => ({ kind: 'out', jack, x: 0, y: 0 })
const CORE_W = 10 * HP_MM
const core = packRows(
  [
    [knob('scene'), knob('rate'), knob('hue')],
    [knob('glow'), knob('count'), null],
    [jin('trig'), jin('feed'), jin('glow')],
    [jin('hue'), jin('move'), jin('rst')],
    [jin('clk'), jin('x'), jin('y')],
    [jout('gate'), jout('sway'), jout('grow')],
    [jout('light'), jout('depth'), jout('link')],
  ],
  { params: CORE_PARAMS, inputs: VISION_INPUTS, outputs: VISION_OUTPUTS },
  CORE_W,
  { grid: true, maxPitch: 15.4 },
)

/** VISION's creature engine without the glass: the same scenes, CV in and CV
 *  out, at a fraction of the width. Patch LINK into any number of VISION VIEW
 *  modules to watch it (each picks its own scene and has its own jacks). */
export const visioncore: ModuleSpec = {
  type: 'visioncore',
  title: 'VISION CORE',
  name: 'Vision Core',
  tagline: 'The VISION creature engine with no screen: patch LINK to any number of VISION VIEWs, each watching (and playing) its own scene',
  category: 'Visuals',
  hp: 10,
  panel: BLACK,
  inputs: VISION_INPUTS,
  outputs: VISION_OUTPUTS,
  params: CORE_PARAMS,
  leds: VISION_LEDS,
  settings: VISION_SETTINGS,
  controls: [{ kind: 'led', index: VS.gate, x: CORE_W / 2, y: 2.9, color: '#5ef2ff' }, ...core.controls],
}

/** What a VISION VIEW shows: the linked tank's OUT scene (= CORE), or any other. */
export const VIEW_SCENES = ['= CORE', ...VISION_SCENES] as const

const VIEW_INPUTS: ModuleSpec['inputs'] = [{ id: 'link', label: 'LINK' }]
/** A VIEW plays the scene it shows: the same outputs as the tank, for that scene. */
export const VIEW_OUTPUTS: ModuleSpec['outputs'] = [...VISION_OUTPUTS.filter((j) => j.id !== 'link'), ...TOUCH_OUTPUTS]
const VIEW_PARAMS: ModuleSpec['params'] = [
  { id: 'scene', label: 'SCENE', min: 0, max: VIEW_SCENES.length - 1, def: 0, stepped: true, options: [...VIEW_SCENES] },
]
const VIEW_CONTROLS: Control[] = [knob('scene'), jin('link'), ...VIEW_OUTPUTS.map((j) => jout(j.id))]

/** A screen for a VISION or VISION CORE: patch its LINK into this LINK. Add
 *  as many as you like; each picks its own scene (= CORE follows the tank's
 *  OUT knob), has its own jacks for that scene, and its own pan and zoom on
 *  the 3D tank (scroll or pinch to zoom, middle-drag or two fingers to pan). */
export const visionview: ModuleSpec = {
  type: 'visionview',
  title: 'VISION VIEW',
  name: 'Vision View',
  tagline: 'A viewport onto a linked VISION / VISION CORE: its own scene, its own jacks for that scene, its own pan and zoom',
  category: 'Visuals',
  hp: 20,
  panel: BLACK,
  inputs: VIEW_INPUTS,
  outputs: VIEW_OUTPUTS,
  params: VIEW_PARAMS,
  leds: 1,
  controls: viewLayout(20),
  sizes: SCREEN_SIZES,
  layout: viewLayout,
}

/** VISION VIEW's panel at any width: nearly all glass (edge to edge, over the
 *  title), its controls packed in as few rows as fit along the bottom, the
 *  scene's gate LED on the top edge. */
function viewLayout(hp: number): Control[] {
  const w = hp * HP_MM
  const { controls, top } = packRows(rowsThatFit(VIEW_CONTROLS, w), { params: VIEW_PARAMS, inputs: VIEW_INPUTS, outputs: VIEW_OUTPUTS }, w, { grid: true, maxPitch: 13.5 })
  return [
    { kind: 'vision', x: 2.5, y: GLASS_TOP, w: w - 5, h: top - GLASS_GAP - GLASS_TOP, linked: true },
    { kind: 'led', index: 0, x: w / 2, y: 2.9, color: '#5ef2ff' },
    ...controls,
  ]
}
