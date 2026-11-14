import { Plugin } from 'obsidian'
import type { PanelMemory } from '../src/panel/panelMemory.ts'
import { SHEET_EXTENSION_NAME, SheetView, VIEW_TYPE } from './SheetView.ts'

/** What the plugin keeps in its `data.json` (docs/spec-v1.md section 12a, Data protection). */
interface PluginData {
  /** The Sheet panel's open state, as `PanelMemory` remembers it. */
  sheetPanel?: boolean
}

/**
 * The Obsidian plugin (docs/spec-v1.md section 12a, ADR 0006): one view type
 * for `.excalimathpad` files. `plugin/` is the only code that imports
 * `obsidian`; the app itself is `src/`, built a second time by
 * `esbuild.plugin.mjs`. Commands, the ribbon and the folder menu arrive with
 * New sheet (#136) and the chrome (#137).
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
  }
}

/** `data.json` as read: anything that isn't ours is dropped. */
function readData(value: unknown): PluginData {
  if (typeof value !== 'object' || value === null) return {}
  const open = (value as PluginData).sheetPanel
  return typeof open === 'boolean' ? { sheetPanel: open } : {}
}
