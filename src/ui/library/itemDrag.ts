import type { PointerEvent } from 'react'
import { actions } from '../../patch/store'
import { track } from '../pointer'
import { libraryDrag } from '../rack/libraryDrag'
import { shelf } from './shelf'

const DRAG_THRESHOLD = 5

/** Drag a library item onto the rack to place it there (neighbours slide aside
 *  on drop); a plain click adds it to the first free slot. */
export function startItemDrag(type: string, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault() // no text selection while dragging
  const sx = e.clientX
  const sy = e.clientY
  let dragging = false
  track(
    (ev) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return
      dragging = true
      libraryDrag.set({ type, clientX: ev.clientX, clientY: ev.clientY })
    },
    (ev) => {
      if (dragging) libraryDrag.onDrop?.({ type, clientX: ev.clientX, clientY: ev.clientY })
      else if (ev.type === 'pointerup') actions.addModule(type)
      if (dragging || ev.type === 'pointerup') shelf.added(type)
      libraryDrag.set(null)
    },
  )
}
