/** A module being dragged out of the library sidebar. The Library owns the
 *  pointer; the Rack renders the preview and handles the drop. */
export interface LibraryDrag {
  type: string
  clientX: number
  clientY: number
}

let state: LibraryDrag | null = null
const subs = new Set<() => void>()

export const libraryDrag = {
  get: (): LibraryDrag | null => state,
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
  set(next: LibraryDrag | null): void {
    state = next
    subs.forEach((f) => f())
  },
  /** Installed by the Rack: returns true if the module was placed. */
  onDrop: null as ((d: LibraryDrag) => boolean) | null,
}
