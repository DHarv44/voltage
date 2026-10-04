/** Encode stereo float chunks as a 24-bit PCM WAV file. */
export function encodeWav24(chunksL: Float32Array[], chunksR: Float32Array[], sampleRate: number): Blob {
  const frames = chunksL.reduce((n, c) => n + c.length, 0)
  const bytesPerFrame = 6
  const dataSize = frames * bytesPerFrame
  const buf = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))

  str(0, 'RIFF')
  v.setUint32(4, 36 + dataSize, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 2, true) // stereo
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * bytesPerFrame, true)
  v.setUint16(32, bytesPerFrame, true)
  v.setUint16(34, 24, true)
  str(36, 'data')
  v.setUint32(40, dataSize, true)

  const bytes = new Uint8Array(buf)
  let o = 44
  const put = (x: number) => {
    const s = Math.round(Math.max(-1, Math.min(1, x)) * 8388607)
    bytes[o++] = s & 0xff
    bytes[o++] = (s >> 8) & 0xff
    bytes[o++] = (s >> 16) & 0xff
  }
  for (let c = 0; c < chunksL.length; c++) {
    const L = chunksL[c]
    const R = chunksR[c]
    for (let i = 0; i < L.length; i++) {
      put(L[i])
      put(R[i])
    }
  }
  return new Blob([buf], { type: 'audio/wav' })
}
