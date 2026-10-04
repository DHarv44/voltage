/** General MIDI drum notes, in pad order: kick, snare, clap, closed hat,
 *  open hat, low / mid / high tom. Number keys 1–8 send these on channel 10. */
export const GM_PADS = [36, 38, 39, 42, 46, 41, 43, 45]

/** Pad index for a channel-10 note: GM drum notes first, otherwise pad
 *  controllers that send chromatic notes from C1 (36). −1 if unmapped. */
export function padForNote(note: number): number {
  const gm = GM_PADS.indexOf(note)
  if (gm >= 0) return gm
  return note >= 36 && note < 36 + GM_PADS.length ? note - 36 : -1
}
