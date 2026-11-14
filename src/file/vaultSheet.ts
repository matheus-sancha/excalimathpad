import type { LineControl, SceneFile } from './sheetSession.ts'
import { writeSheet, type SheetData, type SheetSettings } from './sheetFormat.ts'

/**
 * A sheet in a vault (M4d, docs/spec-v1.md section 7, A sheet in a vault): the
 * file Obsidian's view read, shown in the canvas and written back by the view
 * as Obsidian's own views autosave. It knows no Obsidian, Excalidraw, React or
 * DOM: the view (`plugin/SheetView.ts`) does the reading and writing, and
 * refuses a newer or unreadable file itself, so this only ever holds a sheet.
 *
 * Only a change of what a save would write (the scene's `saveKey` and the
 * settings) counts, so opening, selecting, scrolling, zooming or a theme change
 * never makes the sheet unwritten, and the file is never touched by viewing.
 */
export interface VaultSheet {
  getState: () => { settings: SheetSettings }
  subscribe: (listener: () => void) => () => void
  /** Loads the sheet into the scene once Excalidraw has its starting scene: no undo step. */
  start: () => Promise<void>
  /** Listens to the scene, calling `onUnwritten` on each change the file doesn't hold. */
  attach: () => () => void
  setSettings: (next: SheetSettings) => void
  /** Runs a scene write that mustn't make a written sheet unwritten (auto-size, style restore). */
  keepClean: (write: () => void) => void
  /**
   * What the view should write: the sheet with an open line committed first (it
   * stays open). Null when the file already holds it, or before the sheet loads.
   */
  unwritten: () => VaultWrite | null
  /** The file now holds `write`. */
  written: (write: VaultWrite) => void
  /** True with unwritten work or a line open: an outside change can't just replace it. */
  busy: () => boolean
  /**
   * Replaces the sheet with a new version of its file (an outside change): no
   * undo step, the history cleared, scroll and zoom kept, any open line closed.
   */
  reload: (sheet: VaultSheetData) => void
}

/** What the view read: Excalidraw's part and the block's settings (`readSheet`). */
export interface VaultSheetData {
  scene: SheetData
  settings: SheetSettings
}

/** A write the view makes: the file's text and the key it was taken at. */
export interface VaultWrite {
  text: string
  key: string
}

/** The overlay's line edit, as the relay hands it over (`createLineRelay`). */
export interface VaultLine extends LineControl {
  /** Whether a line or a title is open for typing. */
  isOpen(): boolean
}

export interface VaultSheetPorts {
  scene: Pick<SceneFile, 'serialize' | 'load' | 'saveKey' | 'onChange' | 'ready'>
  line: VaultLine
  sheet: VaultSheetData
  /** The sheet now differs from its file: the view asks Obsidian to save. */
  onUnwritten: () => void
}

export function createVaultSheet({ scene, line, sheet, onUnwritten }: VaultSheetPorts): VaultSheet {
  /** What `start` loads: the file as read, or a newer version that came before Excalidraw was ready. */
  let first = sheet.scene
  let settings = sheet.settings
  let state = { settings }
  /** The key the file holds: at the load, the last write or the last reload. */
  let writtenKey = ''
  let lastKey = ''
  let started = false
  /** Set while a `keepClean` write runs on a written sheet: its change isn't work. */
  let quiet = false
  let starting: Promise<void> | null = null
  const listeners = new Set<() => void>()

  const currentKey = () => `${scene.saveKey()}|${JSON.stringify(settings)}`
  const publish = () => {
    if (state.settings === settings) return
    state = { settings }
    listeners.forEach((listener) => listener())
  }
  /** The sheet as it is now is what the file holds. */
  const markWritten = () => {
    writtenKey = currentKey()
    lastKey = writtenKey
  }
  /**
   * Re-reads the scene. Excalidraw reports a change only after React commits,
   * so a flow that has just written the line reads the key itself.
   */
  const onSceneChange = () => {
    if (!started || quiet) return
    const key = currentKey()
    if (key === lastKey) return
    lastKey = key
    if (key !== writtenKey) onUnwritten()
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start: () => {
      starting ??= scene.ready().then(() => {
        scene.load(first)
        markWritten()
        started = true
      })
      return starting
    },
    attach: () => scene.onChange(onSceneChange),
    setSettings: (next) => {
      if (JSON.stringify(next) === JSON.stringify(settings)) return
      settings = next
      publish()
      onSceneChange()
    },
    keepClean: (write) => {
      onSceneChange()
      const wasWritten = started && lastKey === writtenKey
      quiet = wasWritten
      try {
        write()
      } finally {
        quiet = false
      }
      if (wasWritten) markWritten()
    },
    unwritten: () => {
      if (!started) return null
      line.commitLine()
      onSceneChange()
      const key = currentKey()
      if (key === writtenKey) return null
      return { text: writeSheet(scene.serialize(), settings), key }
    },
    written: (write) => {
      writtenKey = write.key
    },
    busy: () => line.isOpen() || (started && currentKey() !== writtenKey),
    reload: (next) => {
      settings = next.settings
      publish()
      // Before Excalidraw is ready, `start` loads this version instead.
      if (!started) {
        first = next.scene
        return
      }
      line.leaveLine()
      scene.load(next.scene, { keepView: true })
      markWritten()
    },
  }
}
