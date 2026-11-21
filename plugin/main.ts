import { Notice, Platform, Plugin, TFolder, type TAbstractFile } from 'obsidian'
import { emptyScene } from '../src/canvas/sceneFile.ts'
import { DEFAULT_SETTINGS, writeSheet } from '../src/file/sheetFormat.ts'
import { isSheetTheme, type SheetTheme } from '../src/canvas/theme.ts'
import { DEFAULT_LANGUAGE, isSheetLanguage, type SheetLanguage } from '../src/canvas/language.ts'
import type { SheetCommands } from '../src/App.tsx'
import { wordsFor, type Words } from '../src/text/words.ts'
import { freeSheetPath } from './names.ts'
import { errorReason, SHEET_EXTENSION_NAME, SheetView, VIEW_TYPE, type SheetMemory } from './SheetView.ts'

/** What the plugin keeps in its `data.json` (docs/spec-v1.md section 12a, Data protection). */
interface PluginData {
  /** The Sheet panel's open state, as `PanelMemory` remembers it. */
  sheetPanel?: boolean
  /** The Sheet panel's width in px, as last dragged (section 8, Sheet panel, M4e). */
  sheetPanelWidth?: number
  /** Light or dark, as last chosen with ☰ Dark mode (section 8, Inside an Obsidian tab). */
  theme?: SheetTheme
  /** Excalidraw's language, as last chosen with ☰ → Language (section 8, Language, 0.5.0). */
  language?: SheetLanguage
}

/** The ribbon's and the folder menu's icon (Lucide, as Obsidian ships it). */
export const NEW_SHEET_ICON = 'calculator'

/**
 * The commands that act on the active sheet tab, and are offered only while
 * one is active (docs/spec-v1.md section 8, Inside an Obsidian tab). None has
 * a default hotkey. Print… (M5, section 11) is registered on a computer only:
 * on a phone or tablet there is no such command. `name` is the key of its
 * words in the table's `vault` group, worded at `onload` (section 8, Language).
 */
export const SHEET_COMMANDS: readonly {
  id: string
  name: 'addMath' | 'toggleMathSettings' | 'openMathGuide' | 'print'
  run: keyof SheetCommands
  computer?: true
}[] = [
  { id: 'add-math', name: 'addMath', run: 'addMath' },
  { id: 'toggle-math-settings', name: 'toggleMathSettings', run: 'toggleMathSettings' },
  { id: 'open-math-guide', name: 'openMathGuide', run: 'openMathGuide' },
  { id: 'print', name: 'print', run: 'print', computer: true },
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
        rememberedWidth: () => this.stored.sheetPanelWidth ?? null,
        rememberWidth: (width) => this.remember({ sheetPanelWidth: width }),
      },
      theme: {
        rememberedTheme: () => this.stored.theme ?? null,
        rememberTheme: (theme) => this.remember({ theme }),
      },
      language: {
        rememberedLanguage: () => this.stored.language ?? null,
        rememberLanguage: (language) => this.remember({ language }),
      },
    }
    this.registerView(VIEW_TYPE, (leaf) => new SheetView(leaf, memory))
    this.registerExtensions([SHEET_EXTENSION_NAME], VIEW_TYPE)

    // Registered once, in the language `data.json` holds at load: the palette,
    // the ribbon and the folder item change after a restart (section 8, Language).
    const { vault: text } = this.words()
    this.addCommand({ id: 'new-sheet', name: text.newSheet, callback: () => void this.newSheet() })
    for (const command of SHEET_COMMANDS) {
      if (command.computer && Platform.isMobile) continue
      this.addCommand({
        id: command.id,
        name: text[command.name],
        checkCallback: (checking) => {
          const run = this.app.workspace.getActiveViewOfType(SheetView)?.commands?.[command.run]
          if (!run) return false
          if (!checking) run()
          return true
        },
      })
    }
    this.addRibbonIcon(NEW_SHEET_ICON, text.newSheet, () => void this.newSheet())
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file: TAbstractFile) => {
        if (!(file instanceof TFolder)) return
        menu.addItem((item) =>
          item
            .setTitle(text.newSheet)
            .setIcon(NEW_SHEET_ICON)
            .onClick(() => void this.newSheet(file)),
        )
      }),
    )
  }

  /** The plugin's words in the language `data.json` holds now. */
  private words(): Words {
    return wordsFor(this.stored.language ?? DEFAULT_LANGUAGE)
  }

  /** Writes `change` into `data.json`, if it changes anything. */
  private remember(change: PluginData) {
    const next = { ...this.stored, ...change }
    if (
      next.sheetPanel === this.stored.sheetPanel &&
      next.sheetPanelWidth === this.stored.sheetPanelWidth &&
      next.theme === this.stored.theme &&
      next.language === this.stored.language
    ) {
      return
    }
    this.stored = next
    void this.saveData(this.stored)
  }

  /**
   * Creates an empty sheet (format 1, default settings) and opens it in a new
   * tab, on the welcome screen. It goes in `folder` (a folder's menu), else
   * where Obsidian's *Default location for new notes* puts a note. It is named
   * `Untitled`, then `Untitled 1`, `Untitled 2`… (`Sem título`… in Português:
   * the language at creation), never over a file.
   */
  async newSheet(folder?: TFolder) {
    const { vault, workspace, fileManager } = this.app
    const parent = folder ?? fileManager.getNewFileParent(workspace.getActiveFile()?.path ?? '')
    const text = this.words().vault
    const path = freeSheetPath(parent.path, text.untitled, (at) => vault.getAbstractFileByPath(at) !== null)
    let file
    try {
      file = await vault.create(path, writeSheet(emptyScene(), DEFAULT_SETTINGS))
    } catch (error) {
      // Worded again: the language may have changed while the file was being created.
      new Notice(this.words().vault.createFailed(path.slice(path.lastIndexOf('/') + 1), errorReason(error)))
      return
    }
    await workspace.getLeaf('tab').openFile(file)
  }
}

/** `data.json` as read: anything that isn't ours is dropped. */
function readData(value: unknown): PluginData {
  if (typeof value !== 'object' || value === null) return {}
  const { sheetPanel, sheetPanelWidth, theme, language } = value as Record<string, unknown>
  return {
    ...(typeof sheetPanel === 'boolean' && { sheetPanel }),
    ...(typeof sheetPanelWidth === 'number' && Number.isFinite(sheetPanelWidth) && { sheetPanelWidth }),
    ...(isSheetTheme(theme) && { theme }),
    ...(isSheetLanguage(language) && { language }),
  }
}

