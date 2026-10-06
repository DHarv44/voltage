import { useSyncExternalStore } from 'react'
import { withoutRow } from '../../patch/rowOps'
import { actions, patchStore } from '../../patch/store'
import { useMenuBox } from './useMenuBox'

export interface RowMenuState {
  row: number
  x: number
  y: number
}

const modules = (n: number) => `${n} module${n === 1 ? '' : 's'}`

/** Right-click on an empty part of a row: add a row below it, or remove it.
 *  A row with modules in it offers to move them into free space in the other
 *  rows (only if they all fit) or to remove them with the row. */
export function RowMenu({ menu, onClose }: { menu: RowMenuState; onClose: () => void }) {
  const box = useMenuBox(menu.x, menu.y, onClose)
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const n = patch.modules.filter((m) => m.row === menu.row).length
  const only = patch.rows <= 1
  const canMove = n > 0 && withoutRow(patch, menu.row, 'move') !== null
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  return (
    <div ref={box} className="ctx-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ctx-title">
        Row {menu.row + 1}
        {n > 0 ? ` · ${modules(n)}` : ' · empty'}
      </div>
      <button onClick={run(() => actions.insertRow(menu.row + 1))}>Add a row below</button>
      {only ? (
        <div className="ctx-note">The only row can't be removed.</div>
      ) : n === 0 ? (
        <button className="danger" onClick={run(() => actions.removeRowAt(menu.row, 'delete'))}>
          Remove row
        </button>
      ) : (
        <>
          <div className="ctx-note">Remove this row and…</div>
          <button disabled={!canMove} onClick={run(() => actions.removeRowAt(menu.row, 'move'))}>
            …move its {modules(n)} to free space in other rows
          </button>
          {!canMove && <div className="ctx-note">Not enough free space in the other rows: add a row or make room first.</div>}
          <button className="danger" onClick={run(() => actions.removeRowAt(menu.row, 'delete'))}>
            …remove its {modules(n)} too
          </button>
        </>
      )}
    </div>
  )
}
