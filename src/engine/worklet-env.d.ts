// Globals of the AudioWorkletGlobalScope (not part of lib.dom).
declare const sampleRate: number
/** The audio frame the block being processed starts at. */
declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void
