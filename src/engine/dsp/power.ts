/** The rack's shared power supply. With SAG on, heavy total output current
 *  pulls the ±12 V rails down (outputs clip earlier) and oscillator expo
 *  converters go very slightly flat, like an overloaded real case.
 *  CROSSTALK adds a faint (−56 dB) bleed between neighbouring jacks. */
export const power = {
  /** Soft-clip ceiling used by rails() (V). */
  rail: 11,
  /** Pitch offset applied by oscillators (octaves, ≤ 0). */
  pitchSag: 0,
  sagOn: false,
  crosstalk: false,
}

export const NOMINAL_RAIL = 11
export const CROSSTALK = 0.0015
