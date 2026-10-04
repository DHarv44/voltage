export interface JackRef {
  mod: string
  jack: string
}

export interface ModuleInst {
  id: string
  type: string
  row: number
  hp: number
  /** Fixes this unit's component tolerances and drift character for life. */
  seed: number
  params: Record<string, number>
}

export interface Cable {
  id: string
  /** Always an output jack. */
  from: JackRef
  /** Always an input jack. */
  to: JackRef
  color: string
}

export interface Patch {
  rows: number
  modules: ModuleInst[]
  cables: Cable[]
}
