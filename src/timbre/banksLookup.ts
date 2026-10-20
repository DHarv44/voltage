import { BANK_ALIASES, BANKS, type BankPreset } from './banks'

/** A drum machine's fitted settings by its name or alias (`tr909`,
 *  `RolandTR909`, `lm1`, `dmx` …), or null when we don't know it. */
export function bankPreset(name: string): BankPreset | null {
  const key = name.toLowerCase().replace(/[\s_-]+/g, '')
  return BANKS[key] ?? BANKS[BANK_ALIASES[key] ?? ''] ?? null
}
