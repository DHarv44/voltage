import { history } from '../patch/store'
import { perform } from './perform'

/** Global shortcuts: Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl+Y redo, ` for
 *  performance mode (Esc leaves it). Letters and numbers belong to the
 *  computer keyboard's notes and pads. Ignored while typing in a text field
 *  (those keep their own undo). */
export function initShortcuts(): void {
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      perform.toggle()
      return
    }
    if (e.key === 'Escape' && perform.get()) {
      perform.set(false)
      return
    }
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
