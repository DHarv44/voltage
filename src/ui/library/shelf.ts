import { settings } from '../settings'

/** How many recently added modules the library keeps. */
const RECENT = 6

/** The library's personal shelves: starred modules and the last few added
 *  from it. Kept in settings, so they survive reloads. */
export const shelf = {
  isFav: (type: string) => settings.get().favs.includes(type),
  toggleFav(type: string): void {
    const favs = settings.get().favs
    settings.set({ favs: favs.includes(type) ? favs.filter((t) => t !== type) : [...favs, type] })
  },
  /** A module was just added from the library. */
  added(type: string): void {
    const recent = settings.get().recent.filter((t) => t !== type)
    settings.set({ recent: [type, ...recent].slice(0, RECENT) })
  },
}
