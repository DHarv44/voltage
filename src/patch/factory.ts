import { SPECS } from '../modules'
import { defaultParams } from '../modules/params'
import type { ModuleInst } from './types'

export const CABLE_COLORS = ['#d8392b', '#e9b824', '#2f7fd8', '#3aa655', '#e07b24', '#8e5ad1', '#e4e4e4', '#1fb8b8']

let colorIdx = 0
export function nextColor(): string {
  return CABLE_COLORS[colorIdx++ % CABLE_COLORS.length]
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeModule(type: string, row: number, hp: number): ModuleInst {
  return {
    id: uid(type),
    type,
    row,
    hp,
    seed: (Math.random() * 0x7fffffff) | 0,
    params: defaultParams(SPECS[type]),
  }
}
