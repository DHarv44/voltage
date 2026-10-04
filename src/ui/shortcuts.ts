import { history } from '../patch/store'

/** Global editing shortcuts: Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl+Y redo.
 *  Ignored while typing in a text field (those keep their own undo). */
export function initShortcuts(): void {
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault()
      history.undo()
    } else if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault()
      history.redo()
    }
  })
}
