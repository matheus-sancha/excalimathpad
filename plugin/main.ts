import { Notice, Plugin, TFolder, type TAbstractFile } from 'obsidian'
import { emptyScene } from '../src/canvas/sceneFile.ts'
import { DEFAULT_SETTINGS, writeSheet } from '../src/file/sheetFormat.ts'
import { isSheetTheme, type SheetTheme } from '../src/canvas/theme.ts'
import type { SheetCommands } from '../src/App.tsx'
import { freeSheetPath, NEW_SHEET_BASE } from './names.ts'
import {
  createFailedNotice,
  errorReason,
  SHEET_EXTENSION_NAME,
  SheetView,
  VIEW_TYPE,
  type SheetMemory,
} from './SheetView.ts'

/** What the plugin keeps in its `data.json` (docs/spec-v1.md section 12a, Data protection). */
interface PluginData {
  /** The Sheet panel's open state, as `PanelMemory` remembers it. */
  sheetPanel?: boolean
  /** Light or dark, as last chosen with ☰ Dark mode (section 8, Inside an Obsidian tab). */
  theme?: SheetTheme
}

/** The words of New sheet, in the command palette, on the ribbon and in a folder's menu. */
export const NEW_SHEET = 'New sheet'

/** The ribbon's and the folder menu's icon (Lucide, as Obsidian ships it). */
export const NEW_SHEET_ICON = 'calculator'

/**
 * The commands that act on the active sheet tab, and are offered only while
 * one is active (docs/spec-v1.md section 8, Inside an Obsidian tab). None has
 * a default hotkey. Print… arrives with M5.
 */
export const SHEET_COMMANDS: readonly { id: string; name: string; run: keyof SheetCommands }[] = [
  { id: 'add-math', name: 'Add math', run: 'addMath' },
  { id: 'toggle-math-settings', name: 'Toggle Math settings', run: 'toggleMathSettings' },
  { id: 'open-math-guide', name: 'Open Math guide', run: 'openMathGuide' },
]

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
    const memory: SheetMemory = {
      panel: {
        rememberedOpen: () => this.stored.sheetPanel ?? null,
        rememberOpen: (open) => this.remember({ sheetPanel: open }),
      },
      theme: {
        rememberedTheme: () => this.stored.theme ?? null,
        rememberTheme: (theme) => this.remember({ theme }),
      },
    }
    this.registerView(VIEW_TYPE, (leaf) => new SheetView(leaf, memory))
    this.registerExtensions([SHEET_EXTENSION_NAME], VIEW_TYPE)

    this.addCommand({ id: 'new-sheet', name: NEW_SHEET, callback: () => void this.newSheet() })
    for (const command of SHEET_COMMANDS) {
      this.addCommand({
        id: command.id,
        name: command.name,
        checkCallback: (checking) => {
          const commands = this.app.workspace.getActiveViewOfType(SheetView)?.commands
          if (!commands) return false
          if (!checking) commands[command.run]()
          return true
        },
      })
    }
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

  /** Writes `change` into `data.json`, if it changes anything. */
  private remember(change: PluginData) {
    const next = { ...this.stored, ...change }
    if (next.sheetPanel === this.stored.sheetPanel && next.theme === this.stored.theme) return
    this.stored = next
    void this.saveData(this.stored)
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
  const { sheetPanel, theme } = value as Record<string, unknown>
  return {
    ...(typeof sheetPanel === 'boolean' && { sheetPanel }),
    ...(isSheetTheme(theme) && { theme }),
  }
}

