/**
 * Whether the Sheet panel was last open, and how wide it was last dragged
 * (docs/spec-v1.md section 8; the width from M4e, #198), never in the file,
 * so opening, closing or resizing it never makes the sheet dirty. Each home
 * keeps it its own way: the web app per browser (`storagePanelMemory`, given
 * `localStorage` by `src/main.tsx`), a vault in the plugin's `data.json`
 * (`plugin/`, section 12a). App knows only this port, so the plugin's bundle
 * never names browser storage.
 */
export interface PanelMemory {
  /** True or false as last remembered; null when nothing is. */
  rememberedOpen(): boolean | null
  rememberOpen(open: boolean): void
  /** The panel's width in px as last remembered; null when none is. The canvas keeps it in range. */
  rememberedWidth(): number | null
  rememberWidth(width: number): void
}

const KEY = 'excalimathpad.sheetPanel'
const WIDTH_KEY = 'excalimathpad.sheetPanelWidth'

/**
 * The memory in a `Storage`. Storage can be missing or throw (a private
 * window, blocked site data); the panel then opens on a wide window as if new.
 */
export function storagePanelMemory(storage: () => Storage | null): PanelMemory {
  return {
    rememberedOpen: () => rememberedOpen(storage()),
    rememberOpen: (open) => rememberOpen(open, storage()),
    rememberedWidth: () => rememberedWidth(storage()),
    rememberWidth: (width) => rememberWidth(width, storage()),
  }
}

/** A memory that lasts as long as the page: what App uses when given none. */
export function sessionPanelMemory(): PanelMemory {
  let open: boolean | null = null
  let width: number | null = null
  return {
    rememberedOpen: () => open,
    rememberOpen: (next) => {
      open = next
    },
    rememberedWidth: () => width,
    rememberWidth: (next) => {
      width = next
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

export function rememberedWidth(storage: Storage | null): number | null {
  try {
    const value = storage?.getItem(WIDTH_KEY)
    const width = value ? Number(value) : NaN
    return Number.isFinite(width) ? width : null
  } catch {
    return null
  }
}

export function rememberWidth(width: number, storage: Storage | null) {
  try {
    storage?.setItem(WIDTH_KEY, String(width))
  } catch {
    // Not remembered: the next launch starts at the default width.
  }
}
