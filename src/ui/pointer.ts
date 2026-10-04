/** Window-level pointer tracking, attached synchronously so even a very fast
 *  press-drag-release never loses its pointerup, and drags keep working when
 *  the cursor leaves the element they started on. */
export function track(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void): void {
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    onUp(e)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/** Middle-button presses over the rack turn knobs, so the browser's
 *  middle-click autoscroll (which would swallow the drag) is disabled there.
 *  Must cancel `mousedown`: cancelling `pointerdown` doesn't stop autoscroll. */
export function disableRackAutoscroll(): void {
  const block = (e: MouseEvent) => {
    if (e.button === 1 && (e.target as Element | null)?.closest?.('.rack')) e.preventDefault()
  }
  window.addEventListener('mousedown', block, { capture: true })
  window.addEventListener('auxclick', block, { capture: true })
}
