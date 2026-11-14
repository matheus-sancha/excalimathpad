import type { SceneFile } from './sheetSession.ts'
import type { SheetData, SheetSettings } from './sheetFormat.ts'

/**
 * A sheet in a vault (M4d, docs/spec-v1.md section 7, A sheet in a vault): the
 * file Obsidian's view read, shown in the canvas. The view (`plugin/`) reads
 * the file and refuses a newer or unreadable one itself, so this only ever
 * holds a sheet. It knows no Obsidian, Excalidraw, React or DOM.
 *
 * Writing the sheet back (autosave on `saveKey`) is #136; until then this
 * writes nothing, so viewing never touches the file.
 */
export interface VaultSheet {
  getState: () => { settings: SheetSettings }
  subscribe: (listener: () => void) => () => void
  /** Loads the sheet into the scene once Excalidraw has its starting scene: no undo step. */
  start: () => Promise<void>
  setSettings: (next: SheetSettings) => void
  keepClean: (write: () => void) => void
}

/** What the view read: Excalidraw's part and the block's settings (`readSheet`). */
export interface VaultSheetData {
  scene: SheetData
  settings: SheetSettings
}

export function createVaultSheet(scene: Pick<SceneFile, 'load' | 'ready'>, sheet: VaultSheetData): VaultSheet {
  let state = { settings: sheet.settings }
  let starting: Promise<void> | null = null
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start: () => {
      starting ??= scene.ready().then(() => scene.load(sheet.scene))
      return starting
    },
    setSettings: (next) => {
      if (JSON.stringify(next) === JSON.stringify(state.settings)) return
      state = { settings: next }
      listeners.forEach((listener) => listener())
    },
    keepClean: (write) => write(),
  }
}
