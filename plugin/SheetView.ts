import { Notice, TextFileView, TFile, type TAbstractFile, type WorkspaceLeaf } from 'obsidian'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App, { type SheetCommands } from '../src/App.tsx'
import type { ThemeMemory } from '../src/canvas/theme.ts'
import { readSheet, SHEET_EXTENSION } from '../src/file/sheetFormat.ts'
import { MESSAGES } from '../src/file/sheetSession.ts'
import type { VaultSheet } from '../src/file/vaultSheet.ts'
import type { PanelMemory } from '../src/panel/panelMemory.ts'
import { pickVaultImage } from './ImagePicker.ts'
import { conflictBase, freeSheetPath } from './names.ts'

/** The view type registered for `.excalimathpad` files. */
export const VIEW_TYPE = 'excalimathpad-sheet'

/** The extension Obsidian registers, without its dot. */
export const SHEET_EXTENSION_NAME = SHEET_EXTENSION.slice(1)

/** Section 13, In a vault. */
export const NO_LOOKBEHIND = 'Excalimathpad needs iOS 16.4 or later.'

/** Section 13, In a vault: an outside change met unwritten work. Names without extensions. */
export const conflictNotice = (sheet: string, copy: string) =>
  `${sheet} changed elsewhere. Your version was saved beside it as ${copy}.`

/** Section 13, In a vault: a write that fails. The file's name with its extension. */
export const writeFailedNotice = (file: string, reason: string) =>
  `Couldn't save ${file}: ${reason}. Your work is still open.`

/** New sheet couldn't create its file (a write that fails, with no work to keep). */
export const createFailedNotice = (file: string, reason: string) => `Couldn't create ${file}: ${reason}.`

/**
 * Whether this device's JavaScript has regex lookbehind, which Excalidraw's
 * text wrapping builds at run time: iOS below 16.4 has none (section 12a).
 */
export function hasLookbehind(make: (source: string) => unknown = (source) => new RegExp(source)): boolean {
  try {
    make('(?<=a)b')
    return true
  } catch {
    return false
  }
}

/** What the plugin remembers in `data.json` for every sheet tab (section 12a, Data protection). */
export interface SheetMemory {
  panel: PanelMemory
  theme: ThemeMemory
}

export interface SheetViewOptions {
  /** Tests stand in a device without lookbehind. */
  lookbehind?: () => boolean
  /** The clock a conflict copy is named by. */
  now?: () => Date
}

/**
 * A `.excalimathpad` file in its own tab (docs/spec-v1.md sections 7 and 12a):
 * the same `<App>` as the web, mounted on the view's `contentEl` with a vault
 * home, so its own listeners bind to this view and nothing else.
 *
 * - A device without lookbehind, a newer `format` and a file that isn't a
 *   sheet each show their message in the view, and nothing mounts or writes.
 * - **Autosave** (section 7, A sheet in a vault): a line commit or a scene
 *   change the file doesn't hold asks Obsidian to save (`requestSave`, 2 s);
 *   closing the tab, Obsidian quitting and "Save current file" save at once,
 *   committing an open line first. Only a change of the sheet's `saveKey`
 *   writes, so viewing never touches the file.
 * - **An outside change** (sync, git, another app, another tab) reloads an idle
 *   tab in place. A busy one (unwritten work or a line open) leaves the outside
 *   version in the file, writes its own beside it as a conflict copy that
 *   never overwrites a file, says so in a notice, then reloads.
 * - **A failed write** says so in a notice and leaves the work unwritten, so the
 *   next change or close writes again.
 */
export class SheetView extends TextFileView {
  private root: Root | null = null
  private readonly memory: SheetMemory
  /**
   * What Obsidian's Add math and Toggle Math settings do in this tab; null
   * until its canvas is up, and while it shows a message instead of a sheet.
   */
  commands: SheetCommands | null = null
  private readonly lookbehind: () => boolean
  private readonly now: () => Date
  /** The sheet the app hands back once its canvas is up. */
  private sheet: VaultSheet | null = null
  /**
   * The file's text as this view last read or wrote it. An event carrying the
   * same text is this view's own write, or one it has already taken.
   */
  private known: string | null = null
  /** Set while an outside change is being taken in: no save may run meanwhile. */
  private reconciling = false
  /** The last save, queued after the one before it: one write at a time. */
  private saving: Promise<void> = Promise.resolve()
  /** Set while the file is being read for an outside change; `recheck` asks for one more read. */
  private checking = false
  private recheck = false

  constructor(leaf: WorkspaceLeaf, memory: SheetMemory, options: SheetViewOptions = {}) {
    super(leaf)
    this.memory = memory
    this.lookbehind = options.lookbehind ?? hasLookbehind
    this.now = options.now ?? (() => new Date())
  }

  getViewType(): string {
    return VIEW_TYPE
  }

  onload(): void {
    super.onload()
    // Obsidian doesn't document what a TextFileView does when its file changes
    // on disk, so the view hears it itself; `setViewData` below covers the other way.
    this.registerEvent(
      this.app.vault.on('modify', (file: TAbstractFile) => {
        if (file instanceof TFile && file.path === this.file?.path) void this.checkOutside()
      }),
    )
    this.registerEvent(this.app.workspace.on('quit', (tasks) => tasks.add(() => this.save())))
  }

  /** What a save writes: the sheet, an open line committed; the file's own text when it holds the sheet. */
  getViewData(): string {
    return this.sheet?.unwritten()?.text ?? this.data
  }

  setViewData(data: string, clear: boolean): void {
    // The same file, read again: maybe an outside change. Obsidian's text may be
    // from before this view's last write, or a write caught half-done (0.1.0's
    // beta), so only the file as it is once this view's writes finish counts.
    if (!clear && this.sheet) return void this.checkOutside()
    this.known = data
    this.data = data
    this.show(data)
  }

  clear(): void {
    this.unmount()
  }

  /**
   * Writes the sheet if, and only if, the file doesn't hold it. Saves run one
   * at a time, so a write never overtakes another and `known` is always the
   * text of the last write that finished or is running.
   */
  save(): Promise<void> {
    const run = this.saving.then(() => this.write())
    this.saving = run.catch(() => undefined)
    return run
  }

  private async write(): Promise<void> {
    const file = this.file
    const sheet = this.sheet
    if (!file || !sheet || this.reconciling) return
    const write = sheet.unwritten()
    if (!write) return
    const before = { known: this.known, data: this.data }
    // Set first: the vault's `modify` event for this write can come before it resolves.
    this.known = write.text
    this.data = write.text
    try {
      await this.app.vault.modify(file, write.text)
    } catch (error) {
      this.known = before.known
      this.data = before.data
      new Notice(writeFailedNotice(file.name, errorReason(error)))
      return
    }
    sheet.written(write)
  }

  async onClose(): Promise<void> {
    this.unmount()
    await super.onClose()
  }

  /**
   * The file may have changed: reads it once this view's own writes have
   * finished, and takes it in only if it differs from what this view last
   * wrote or read. Calls that come during a read ask for one more read after
   * it, so the text taken is never older than the last call.
   */
  private async checkOutside(): Promise<void> {
    if (this.checking) {
      this.recheck = true
      return
    }
    this.checking = true
    try {
      do {
        this.recheck = false
        await this.saving
        const file = this.file
        if (!file) return
        let text: string
        try {
          text = await this.app.vault.read(file)
        } catch {
          return
        }
        if (!this.recheck) this.takeOutside(text)
      } while (this.recheck)
    } finally {
      this.checking = false
    }
  }

  /** The file now holds `text`, written by someone other than this view. */
  private takeOutside(text: string) {
    if (text === this.known) return
    this.known = text
    this.data = text
    const sheet = this.sheet
    if (!sheet || !sheet.busy()) return this.reload(text)
    // Synchronously, so a save requested before can't write over the outside version.
    this.reconciling = true
    const mine = sheet.unwritten()
    if (!mine) {
      this.reconciling = false
      return this.reload(text)
    }
    void this.keepBeside(mine.text).then((kept) => {
      this.reconciling = false
      if (kept) this.reload(text)
    })
  }

  /**
   * Writes this tab's version beside the sheet, in its folder, under a name no
   * file has, and names it in a notice. False if it couldn't be written: the
   * work then stays in the tab, unwritten.
   */
  private async keepBeside(text: string): Promise<boolean> {
    const file = this.file
    if (!file) return false
    const vault = this.app.vault
    const base = conflictBase(file.basename, this.now())
    const path = freeSheetPath(file.parent?.path ?? '/', base, (at) => vault.getAbstractFileByPath(at) !== null)
    const copy = path.slice(path.lastIndexOf('/') + 1)
    try {
      await vault.create(path, text)
    } catch (error) {
      new Notice(writeFailedNotice(copy, errorReason(error)))
      return false
    }
    new Notice(conflictNotice(file.basename, copy.slice(0, -SHEET_EXTENSION.length)))
    return true
  }

  /** Shows the file's new text: in place when it is a sheet and one is showing, else from scratch. */
  private reload(text: string) {
    const read = readSheet(text)
    if (read.kind === 'sheet' && this.sheet) this.sheet.reload({ scene: read.scene, settings: read.settings })
    else this.show(text)
  }

  private show(data: string) {
    this.unmount()
    const content = this.contentEl
    content.empty()
    content.addClass('excalimathpad-view')
    if (!this.lookbehind()) return this.say(NO_LOOKBEHIND)
    const read = readSheet(data)
    if (read.kind !== 'sheet') return this.say(read.kind === 'newer' ? MESSAGES.newer : MESSAGES.notASheet)
    const host = content.createDiv({ cls: 'excalimathpad-view__app' })
    this.root = createRoot(host)
    this.root.render(
      createElement(App, {
        vault: {
          container: content,
          sheet: { scene: read.scene, settings: read.settings },
          connect: (sheet) => {
            this.sheet = sheet
          },
          onUnwritten: () => this.requestSave(),
          pickImage: () => pickVaultImage(this.app),
          theme: this.memory.theme,
          commands: (commands) => {
            this.commands = commands
          },
          onWindowMigrated: (listener) => content.onWindowMigrated(listener),
        },
        panelMemory: this.memory.panel,
      }),
    )
  }

  private say(message: string) {
    this.contentEl.createDiv({ cls: 'excalimathpad-view__message', text: message })
  }

  private unmount() {
    this.root?.unmount()
    this.root = null
    this.sheet = null
    this.commands = null
  }
}

/** The error's own words, without a closing full stop (the notice adds its own). */
export function errorReason(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message ? message.replace(/\.$/, '') : String(error)
}
