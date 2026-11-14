import { Notice, Plugin, TFolder, type TAbstractFile } from 'obsidian'
import { emptyScene } from '../src/canvas/sceneFile.ts'
import { DEFAULT_SETTINGS, writeSheet } from '../src/file/sheetFormat.ts'
import type { PanelMemory } from '../src/panel/panelMemory.ts'
import { freeSheetPath, NEW_SHEET_BASE } from './names.ts'
import { createFailedNotice, errorReason, SHEET_EXTENSION_NAME, SheetView, VIEW_TYPE } from './SheetView.ts'

/** What the plugin keeps in its `data.json` (docs/spec-v1.md section 12a, Data protection). */
interface PluginData {
  /** The Sheet panel's open state, as `PanelMemory` remembers it. */
  sheetPanel?: boolean
}

/** The words of New sheet, in the command palette, on the ribbon and in a folder's menu. */
export const NEW_SHEET = 'New sheet'

/** The ribbon's and the folder menu's icon (Lucide, as Obsidian ships it). */
export const NEW_SHEET_ICON = 'calculator'

/**
 * The Obsidian plugin (docs/spec-v1.md section 12a, ADR 0006): one view type
 * for `.excalimathpad` files, and New sheet (section 7, A sheet in a vault).
 * `plugin/` is the only code that imports `obsidian`; the app itself is `src/`,
 * built a second time by `esbuild.plugin.mjs`. The other commands arrive with
 * the chrome (#137).
 */
export default class ExcalimathpadPlugin extends Plugin {
  private stored: PluginData = {}

  async onload() {
    this.stored = readData(await this.loadData())
    const memory: PanelMemory = {
      rememberedOpen: () => this.stored.sheetPanel ?? null,
      rememberOpen: (open) => {
        if (this.stored.sheetPanel === open) return
        this.stored = { ...this.stored, sheetPanel: open }
        void this.saveData(this.stored)
      },
    }
    this.registerView(VIEW_TYPE, (leaf) => new SheetView(leaf, memory))
    this.registerExtensions([SHEET_EXTENSION_NAME], VIEW_TYPE)

    this.addCommand({ id: 'new-sheet', name: NEW_SHEET, callback: () => void this.newSheet() })
    this.addRibbonIcon(NEW_SHEET_ICON, NEW_SHEET, () => void this.newSheet())
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file: TAbstractFile) => {
        if (!(file instanceof TFolder)) return
        menu.addItem((item) =>
          item
            .setTitle(NEW_SHEET)
            .setIcon(NEW_SHEET_ICON)
            .onClick(() => void this.newSheet(file)),
        )
      }),
    )
  }

  /**
   * Creates an empty sheet (format 1, default settings) and opens it in a new
   * tab, on the welcome screen. It goes in `folder` (a folder's menu), else
   * where Obsidian's *Default location for new notes* puts a note. It is named
   * `Untitled`, then `Untitled 1`, `Untitled 2`…, never over a file.
   */
  async newSheet(folder?: TFolder) {
    const { vault, workspace, fileManager } = this.app
    const parent = folder ?? fileManager.getNewFileParent(workspace.getActiveFile()?.path ?? '')
    const path = freeSheetPath(parent.path, NEW_SHEET_BASE, (at) => vault.getAbstractFileByPath(at) !== null)
    let file
    try {
      file = await vault.create(path, writeSheet(emptyScene(), DEFAULT_SETTINGS))
    } catch (error) {
      new Notice(createFailedNotice(path.slice(path.lastIndexOf('/') + 1), errorReason(error)))
      return
    }
    await workspace.getLeaf('tab').openFile(file)
  }
}

/** `data.json` as read: anything that isn't ours is dropped. */
function readData(value: unknown): PluginData {
  if (typeof value !== 'object' || value === null) return {}
  const open = (value as PluginData).sheetPanel
  return typeof open === 'boolean' ? { sheetPanel: open } : {}
}

