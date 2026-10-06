import { engine } from '../../audio/engine'
import { SPECS } from '../../modules'
import { railHp } from '../../patch/layout'
import { buildStarter, STARTERS } from '../../patch/starters'
import { actions, patchStore } from '../../patch/store'
import { rackView } from '../rack/rackView'
import { toast } from '../Toast'

/** Add a module's ready-to-play rig below the rack (one undo step), bring it
 *  into view and say what it does. */
export function loadStarter(type: string): void {
  const rig = buildStarter(type, railHp(patchStore.get()))
  if (!rig) return
  const row = actions.mountRig(rig)
  requestAnimationFrame(() => rackView.reveal(row))
  const s = STARTERS[type]
  const power = engine.getStatus().power ? '' : ' Turn the POWER on to hear it.'
  toast.show(`Ready-to-play ${SPECS[type].name}`, `${s.howTo}${power} (Ctrl+Z takes it away again.)`)
}
