import { engine } from '../engine'

/** Axes (LX, LY, RX, RY), triggers (LT, RT) and the buttons we pass on. */
export const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB']
/** Standard-mapping indices of those buttons and of the triggers. */
const BUTTON_INDEX = [0, 1, 2, 3, 4, 5]
const LT = 6
const RT = 7

export interface PadState {
  connected: boolean
  name: string
  axes: number[]
  triggers: number[]
  buttons: boolean[]
}

/** Polls the first connected game controller (Gamepad API) while any GAMEPAD
 *  module is on the rack, and sends changes to those modules. Browsers only
 *  reveal a controller after you press one of its buttons. */
class GamepadInput {
  state: PadState = { connected: false, name: '', axes: [0, 0, 0, 0], triggers: [0, 0], buttons: PAD_BUTTONS.map(() => false) }
  private readonly modules = new Set<string>()
  private timer = 0
  private last = ''

  register(id: string): () => void {
    this.modules.add(id)
    if (!this.timer) this.timer = window.setInterval(() => this.poll(), 1000 / 120)
    this.last = ''
    return () => {
      this.modules.delete(id)
      if (!this.modules.size) {
        window.clearInterval(this.timer)
        this.timer = 0
      }
    }
  }

  private poll(): void {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((g) => g?.connected) ?? null
    const s = this.state
    s.connected = !!pad
    s.name = pad?.id ?? ''
    if (pad) {
      for (let i = 0; i < 4; i++) s.axes[i] = Math.abs(pad.axes[i] ?? 0) < 0.06 ? 0 : (pad.axes[i] ?? 0) // dead zone
      s.triggers[0] = pad.buttons[LT]?.value ?? 0
      s.triggers[1] = pad.buttons[RT]?.value ?? 0
      BUTTON_INDEX.forEach((b, k) => (s.buttons[k] = !!pad.buttons[b]?.pressed))
    }
    const key = `${s.axes.map((a) => a.toFixed(3))}|${s.triggers.map((t) => t.toFixed(3))}|${s.buttons.join()}`
    if (key === this.last) return
    this.last = key
    for (const id of this.modules) {
      engine.ui(id, { kind: 'surface', name: 'stickL', x: s.axes[0], y: -s.axes[1], down: true })
      engine.ui(id, { kind: 'surface', name: 'stickR', x: s.axes[2], y: -s.axes[3], down: true })
      engine.ui(id, { kind: 'surface', name: 'triggers', x: s.triggers[0], y: s.triggers[1], down: true })
      s.buttons.forEach((on, k) => engine.ui(id, { kind: 'surface', name: 'btn', x: k, y: on ? 1 : 0, down: on }))
    }
  }
}

export const gamepadInput = new GamepadInput()
