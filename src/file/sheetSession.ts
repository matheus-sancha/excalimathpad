import type { FileAccess, PickedFile, SheetFileHandle } from './fileAccess.ts'
import type { RecoveryStore } from './recovery.ts'
import {
  DEFAULT_SETTINGS,
  readSheet,
  SHEET_EXTENSION,
  writeSheet,
  type SheetData,
  type SheetSettings,
} from './sheetFormat.ts'

/**
 * The open sheet's file: save, save as, open and the recovery copy
 * (docs/spec-v1.md section 7). Everything outside the browser tab reaches it
 * through the ports below, so this module knows no Excalidraw, React or DOM.
 */

/** The scene half of the file (`src/canvas/sceneFile.ts`). */
export interface SceneFile {
  /** Excalidraw's own JSON for the scene, without the block. */
  serialize(): string
  /** Replaces the scene, as no undo step, and clears undo. */
  load(scene: SheetData): void
  /** Equal keys mean nothing to save (see `saveKey`). */
  saveKey(): string
  onChange(listener: () => void): () => void
  /** Resolves once the starting scene is in: a key taken earlier would be stale. */
  ready(): Promise<void>
}

/** The overlay's line edit (`MathOverlay`). */
export interface LineControl {
  /** Writes the typed line to the scene and keeps it open. */
  commitLine(): void
  /** Writes the typed line and closes the edit. */
  leaveLine(): void
}

export interface SessionDialogs {
  askRestore(name: string | null): Promise<'restore' | 'discard'>
  askSaveChanges(name: string | null): Promise<'save' | 'dont-save' | 'cancel'>
  /** A message the user reads and dismisses (section 13's wording). */
  message(text: string): void
}

export interface SessionState {
  /** The file name, extension included, or null while untitled. */
  name: string | null
  dirty: boolean
}

export interface SheetSession {
  getState(): SessionState
  subscribe(listener: () => void): () => void
  /** Offers the recovery copy, then takes the clean mark. Runs once. */
  start(): Promise<void>
  /** Listens to the scene. Returns the way to stop. */
  attach(): () => void
  save(): Promise<boolean>
  saveAs(): Promise<boolean>
  /** Opens a file: the picked or dropped one, or one from the picker. */
  open(file?: PickedFile): Promise<void>
  /** Runs a scene write that mustn't make a clean sheet dirty (auto-size, style restore). */
  keepClean(write: () => void): void
  /** Writes a pending recovery copy now, as the page goes away. */
  flushRecovery(): void
  readonly settings: SheetSettings
}

export interface SessionPorts {
  scene: SceneFile
  files: FileAccess
  recovery: RecoveryStore
  dialogs: SessionDialogs
  line: LineControl
  /** How long after the last change the recovery copy is written. */
  recoveryDelayMs?: number
}

export const MESSAGES = {
  newer: 'This sheet was saved by a newer Excalimathpad. Update the app.',
  notASheet: "This file isn't a sheet, so it wasn't opened.",
  saveFailed: (name: string, reason: string) => `Couldn't save ${name}: ${reason}`,
}

export function createSheetSession({
  scene,
  files,
  recovery,
  dialogs,
  line,
  recoveryDelayMs = 500,
}: SessionPorts): SheetSession {
  let name: string | null = null
  let handle: SheetFileHandle | null = null
  let settings = DEFAULT_SETTINGS
  /** Ctrl+S goes to Save as: untitled, or a file that isn't a sheet (a `.excalidraw`). */
  let saveAsOnly = true
  /** The key at the last open or save. Null: dirty until saved (a restored copy). */
  let cleanKey: string | null = ''
  let lastKey = ''
  /** False until the recovery offer is answered: nothing may overwrite the copy before. */
  let started = false
  let starting: Promise<void> | null = null
  let busy = false
  let pendingCopy: ReturnType<typeof setTimeout> | null = null
  let recoveryQueue: Promise<unknown> = Promise.resolve()

  let state: SessionState = { name, dirty: false }
  const listeners = new Set<() => void>()
  const isDirty = () => cleanKey === null || lastKey !== cleanKey
  const publish = () => {
    const next = { name, dirty: started && isDirty() }
    if (next.name === state.name && next.dirty === state.dirty) return
    state = next
    listeners.forEach((listener) => listener())
  }

  // Recovery reads and writes run in order, so a write that started before a
  // save can never land after the save's clear.
  const queueRecovery = (op: () => Promise<unknown>) => {
    recoveryQueue = recoveryQueue.then(op).catch(() => {})
    return recoveryQueue
  }
  const sheetText = () => writeSheet(scene.serialize(), settings)
  const cancelPendingCopy = () => {
    if (pendingCopy !== null) clearTimeout(pendingCopy)
    pendingCopy = null
  }
  const writeCopyNow = () => {
    cancelPendingCopy()
    if (!started || !isDirty()) return
    const copy = { text: sheetText(), name, handle }
    void queueRecovery(() => recovery.write(copy))
  }
  const scheduleCopy = () => {
    cancelPendingCopy()
    pendingCopy = setTimeout(writeCopyNow, recoveryDelayMs)
  }

  /**
   * Re-reads the scene. Excalidraw reports a change only after React commits,
   * so a flow that has just written the line reads the key itself.
   */
  const onSceneChange = () => {
    const key = scene.saveKey()
    if (key === lastKey) return
    lastKey = key
    publish()
    if (started && isDirty()) scheduleCopy()
  }

  /** The sheet as it is now is what the file holds. */
  const markClean = (key: string) => {
    cleanKey = key
    lastKey = scene.saveKey()
    cancelPendingCopy()
    void queueRecovery(() => recovery.clear())
    publish()
    // Changed while the save was in flight: the copy must hold that.
    if (isDirty()) scheduleCopy()
  }

  const adopt = (
    file: { name: string | null; handle: SheetFileHandle | null },
    sheetSettings: SheetSettings,
  ) => {
    name = file.name
    handle = file.handle
    settings = sheetSettings
    saveAsOnly = !handle || !isSheetName(name)
  }

  /** One flow at a time: a key pressed during a dialog or a picker does nothing. */
  const exclusive = async <T>(flow: () => Promise<T>, idle: T): Promise<T> => {
    if (busy || !started) return idle
    busy = true
    try {
      return await flow()
    } finally {
      busy = false
    }
  }

  const doSaveAs = async (): Promise<boolean> => {
    line.commitLine()
    const text = sheetText()
    const key = scene.saveKey()
    let saved
    try {
      saved = await files.saveAs(suggestedName(name), text)
    } catch (error) {
      dialogs.message(MESSAGES.saveFailed(suggestedName(name), reason(error)))
      return false
    }
    if (!saved) return false
    adopt(saved, settings)
    markClean(key)
    return true
  }

  const doSave = async (): Promise<boolean> => {
    if (saveAsOnly || !handle || !name) return doSaveAs()
    line.commitLine()
    const text = sheetText()
    const key = scene.saveKey()
    try {
      await files.save(handle, text)
    } catch (error) {
      dialogs.message(MESSAGES.saveFailed(name, reason(error)))
      return false
    }
    markClean(key)
    return true
  }

  /** Loads a file's text. False when it was refused, with the current sheet untouched. */
  const load = (file: PickedFile): boolean => {
    const read = readSheet(file.text)
    if (read.kind !== 'sheet') {
      dialogs.message(read.kind === 'newer' ? MESSAGES.newer : MESSAGES.notASheet)
      return false
    }
    scene.load(read.scene)
    adopt(file, read.settings)
    return true
  }

  return {
    get settings() {
      return settings
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    start() {
      starting ??= (async () => {
        await scene.ready()
        // Nothing writes the copy before `started`, so this read needs no queue.
        const copy = await recovery.read().catch(() => null)
        let restored = false
        if (copy && (await dialogs.askRestore(copy.name)) === 'restore') {
          const read = readSheet(copy.text)
          if (read.kind === 'sheet') {
            scene.load(read.scene)
            adopt(copy, read.settings)
            restored = true
          }
        }
        if (copy && !restored) await queueRecovery(() => recovery.clear())
        lastKey = scene.saveKey()
        cleanKey = restored ? null : lastKey
        started = true
        publish()
      })()
      return starting
    },

    attach() {
      const stop = scene.onChange(onSceneChange)
      return () => {
        stop()
        writeCopyNow()
      }
    },

    save: () => exclusive(doSave, false),
    saveAs: () => exclusive(doSaveAs, false),

    open: (file) =>
      exclusive(async () => {
        line.leaveLine()
        onSceneChange()
        if (isDirty()) {
          const answer = await dialogs.askSaveChanges(name)
          if (answer === 'cancel') return
          if (answer === 'save' && !(await doSave())) return
        }
        let picked: PickedFile | null | undefined = file
        try {
          picked ??= await files.open()
        } catch {
          dialogs.message(MESSAGES.notASheet)
          return
        }
        if (!picked || !load(picked)) return
        // The user chose not to keep the old sheet's changes, so its copy goes too.
        markClean(scene.saveKey())
      }, undefined),

    keepClean(write) {
      onSceneChange()
      const wasClean = !isDirty()
      write()
      if (wasClean) {
        cleanKey = scene.saveKey()
        lastKey = cleanKey
        publish()
      }
    },

    flushRecovery: () => {
      if (pendingCopy !== null) writeCopyNow()
    },
  }
}

/** True for a file Ctrl+S may write back to: a sheet, not a plain drawing. */
export function isSheetName(name: string | null): boolean {
  return !!name && name.toLowerCase().endsWith(SHEET_EXTENSION)
}

/** Files Excalidraw would load as its own scene if dropped, replacing the sheet. */
export function isSceneFileName(name: string): boolean {
  return /\.(excalimathpad|excalidraw|json)$/i.test(name)
}

/**
 * Hands the session's line port to whatever control the overlay mounts. It is
 * a ref object, so it goes straight into `MathOverlay`'s `control`.
 */
export function createLineRelay(): LineControl & { current: LineControl | null } {
  return {
    current: null,
    commitLine() {
      this.current?.commitLine()
    },
    leaveLine() {
      this.current?.leaveLine()
    },
  }
}

/** What Save as offers: the sheet's name, `pump.excalidraw` as `pump.excalimathpad`. */
export function suggestedName(name: string | null): string {
  if (!name) return `Untitled${SHEET_EXTENSION}`
  if (isSheetName(name)) return name
  return `${name.replace(/\.[^.]*$/, '')}${SHEET_EXTENSION}`
}

/** The name without its extension, for the window title: `pump-sizing`, or `Untitled`. */
export function displayName(name: string | null): string {
  return name ? name.replace(/\.[^.]*$/, '') : 'Untitled'
}

function reason(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}
