import type { Visibility } from '../../cloud/api'

/** Who can open a rack saved online, in the words the menus use. */
export const VISIBILITY: { id: Visibility; name: string; what: string }[] = [
  { id: 'private', name: 'Private', what: 'Only you (this browser, or devices you give your code to).' },
  { id: 'unlisted', name: 'Link only', what: 'Anyone you send the link to.' },
  { id: 'public', name: 'Public', what: 'Listed in the gallery once the admin has had a look.' },
]

/** Copy to the clipboard; if the browser won't, show it to copy by hand
 *  (`ask`) or just say it didn't work. */
export async function copy(text: string, ask = true): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    if (ask) window.prompt('Copy this:', text)
    return false
  }
}
