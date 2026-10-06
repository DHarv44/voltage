import { withoutRow } from '../../patch/rowOps'
import { actions, patchStore } from '../../patch/store'
import { Dialog } from '../Dialog'
import { useMenuBox } from './useMenuBox'

export interface RowMenuState {
  row: number
  x: number
  y: number
}

const modules = (n: number) => `${n} module${n === 1 ? '' : 's'}`

/** Right-click on an empty part of a row: Remove row. An empty row goes at
 *  once; one with modules in it asks first (`onAsk`). */
export function RowMenu({ menu, onClose, onAsk }: { menu: RowMenuState; onClose: () => void; onAsk: (row: number) => void }) {
  const box = useMenuBox(menu.x, menu.y, onClose)
  const p = patchStore.get()
  const only = p.rows <= 1
  const remove = () => {
    if (p.modules.some((m) => m.row === menu.row)) onAsk(menu.row)
    else actions.removeRowAt(menu.row, 'delete')
    onClose()
  }
  return (
    <div ref={box} className="ctx-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ctx-title">Row {menu.row + 1}</div>
      <button className="danger" disabled={only} title={only ? "The only row can't be removed" : undefined} onClick={remove}>
        Remove row
      </button>
    </div>
  )
}

/** Removing a row with modules in it: move them to free space in the other
 *  rows (only offered if they all fit), remove them too, or cancel. */
export function RemoveRowDialog({ row, onClose }: { row: number; onClose: () => void }) {
  const p = patchStore.get()
  const n = p.modules.filter((m) => m.row === row).length
  const canMove = withoutRow(p, row, 'move') !== null
  return (
    <Dialog
      title={`Remove row ${row + 1}?`}
      onCancel={onClose}
      actions={[
        {
          label: `Move ${n === 1 ? 'it' : 'them'} to other rows`,
          onClick: () => actions.removeRowAt(row, 'move'),
          disabled: !canMove,
          note: canMove ? undefined : 'Not enough free space in the other rows to move them: add a row or make room first.',
        },
        { label: `Remove ${n === 1 ? 'it' : 'them'} too`, onClick: () => actions.removeRowAt(row, 'delete'), danger: true },
      ]}
    >
      It has {modules(n)} in it. Move {n === 1 ? 'it' : 'them'} into free space in the other rows, or remove {n === 1 ? 'it' : 'them'} with the row?
      (Ctrl+Z undoes either.)
    </Dialog>
  )
}
