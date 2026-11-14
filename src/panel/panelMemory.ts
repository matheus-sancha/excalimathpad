/**
 * Whether the Sheet panel was last open (docs/spec-v1.md section 8), never in
 * the file, so opening or closing it never makes the sheet dirty. Each home
 * keeps it its own way: the web app per browser (`storagePanelMemory`, given
 * `localStorage` by `src/main.tsx`), a vault in the plugin's `data.json`
 * (`plugin/`, section 12a). App knows only this port, so the plugin's bundle
 * never names browser storage.
 */
export interface PanelMemory {
  /** True or false as last remembered; null when nothing is. */
  rememberedOpen(): boolean | null
  rememberOpen(open: boolean): void
}

const KEY = 'excalimathpad.sheetPanel'

/**
 * The memory in a `Storage`. Storage can be missing or throw (a private
 * window, blocked site data); the panel then opens on a wide window as if new.
 */
export function storagePanelMemory(storage: () => Storage | null): PanelMemory {
  return {
    rememberedOpen: () => rememberedOpen(storage()),
    rememberOpen: (open) => rememberOpen(open, storage()),
  }
}

/** A memory that lasts as long as the page: what App uses when given none. */
export function sessionPanelMemory(): PanelMemory {
  let open: boolean | null = null
  return {
    rememberedOpen: () => open,
    rememberOpen: (next) => {
      open = next
    },
  }
}

export function rememberedOpen(storage: Storage | null): boolean | null {
  try {
    const value = storage?.getItem(KEY)
    return value === 'open' ? true : value === 'closed' ? false : null
  } catch {
    return null
  }
}

export function rememberOpen(open: boolean, storage: Storage | null) {
  try {
    storage?.setItem(KEY, open ? 'open' : 'closed')
  } catch {
    // Not remembered: the next launch opens it on a wide window.
  }
}
