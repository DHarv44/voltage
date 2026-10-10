import { buffers } from '../audio/buffers'
import { SCRATCH } from '../patch/persist'
import { rackName } from '../patch/rackName'
import { actions } from '../patch/store'
import { sharedPatch } from '../ui/share/sharedState'
import { cloud } from './api'
import { cloudCurrent } from './current'

/** The rack id in a short link (/p/abc12345), if this page is one. */
export const cloudInPath = (): string | null => location.pathname.match(/^\/p\/([A-Za-z0-9]{8})\/?$/)?.[1] ?? null

/** Load a cloud rack into this (scratch) page: its recordings first, then the
 *  patch; the banner says what it is. */
export async function openCloud(id: string): Promise<void> {
  sharedPatch.set({ kind: 'loading' })
  try {
    const [meta, b] = await Promise.all([cloud.info(id), cloud.open(id)])
    if (!b) return sharedPatch.set({ kind: 'bad', why: 'That rack’s file is damaged.' })
    buffers.adopt(b.recordings)
    actions.load(b.patch)
    if (meta.mine) cloudCurrent.set(meta)
    rackName.set(meta.title || 'Shared rack')
    sharedPatch.set({ kind: 'open', patch: b.patch, title: meta.title, note: meta.note, hadAudio: false, cloudId: id, mine: meta.mine, recordings: b.recordings })
  } catch (e) {
    sharedPatch.set({ kind: 'bad', why: e instanceof Error ? e.message : undefined })
  }
}

/** Called once at startup: a short link opens in a scratch rack, so your own
 *  saved rack is never touched (reloads as one first: true = stop here). */
export function bootCloud(): boolean {
  const id = cloudInPath()
  if (!id) return false
  if (!SCRATCH) {
    location.replace(`${location.pathname}?scratch`)
    return true
  }
  void openCloud(id)
  return false
}
