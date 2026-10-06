/** SKETCHBOOK's step-record cursor, per module: the face moves it (◀ ▶,
 *  REST) and the keybed writes a note there and moves it on. UI state only;
 *  the pattern itself is the module's params. */
const cursors = new Map<string, number>()

export const sketchCursor = {
  get: (mod: string): number => cursors.get(mod) ?? 0,
  set: (mod: string, step: number, len: number): void => {
    cursors.set(mod, ((step % len) + len) % len)
  },
}
