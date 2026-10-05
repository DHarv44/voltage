import { engine } from '../engine'

export type InputStatus = 'off' | 'asking' | 'on' | 'denied' | 'error'

type Fn = () => void

/** The audio interface's input (mic/line) for AUDIO IN modules. Only opened
 *  when you press ENABLE on a module; the browser asks your permission, and
 *  the sound stays on this machine (it only goes into the engine). */
class MicInput {
  status: InputStatus = 'off'
  device = ''
  private stream: MediaStream | null = null
  private disconnect: (() => void) | null = null
  private subs = new Set<Fn>()

  subscribe(fn: Fn): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  private set(status: InputStatus): void {
    this.status = status
    this.subs.forEach((f) => f())
  }

  async enable(): Promise<void> {
    if (this.status === 'on' || this.status === 'asking') return
    if (!navigator.mediaDevices?.getUserMedia) return this.set('error')
    this.set('asking')
    try {
      // Raw input: no echo cancelling, noise gating or auto gain on an instrument.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const dc = engine.connectInput(stream)
      if (!dc) {
        stream.getTracks().forEach((t) => t.stop())
        return this.set('error') // power the rack on first
      }
      this.stream = stream
      this.disconnect = dc
      this.device = stream.getAudioTracks()[0]?.label ?? ''
      this.set('on')
    } catch (err) {
      this.set((err as Error).name === 'NotAllowedError' ? 'denied' : 'error')
    }
  }

  disable(): void {
    this.disconnect?.()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.disconnect = null
    this.set('off')
  }
}

export const micInput = new MicInput()
