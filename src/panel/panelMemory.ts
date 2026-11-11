/**
 * Whether the Sheet panel was last open, per browser (docs/spec-v1.md section
 * 8): in `localStorage`, never in the file, so opening or closing it never
 * makes the sheet dirty. Storage can be missing or throw (a private window,
 * blocked site data); the panel then opens on a wide window as if new.
 */
const KEY = 'excalimathpad.sheetPanel'

export function rememberedOpen(storage: Storage | null = safeStorage()): boolean | null {
  try {
    const value = storage?.getItem(KEY)
    return value === 'open' ? true : value === 'closed' ? false : null
  } catch {
    return null
  }
}

export function rememberOpen(open: boolean, storage: Storage | null = safeStorage()) {
  try {
    storage?.setItem(KEY, open ? 'open' : 'closed')
  } catch {
    // Not remembered: the next launch opens it on a wide window.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
