import { TextFileView, type WorkspaceLeaf } from 'obsidian'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from '../src/App.tsx'
import { readSheet, SHEET_EXTENSION } from '../src/file/sheetFormat.ts'
import { MESSAGES } from '../src/file/sheetSession.ts'
import type { PanelMemory } from '../src/panel/panelMemory.ts'

/** The view type registered for `.excalimathpad` files. */
export const VIEW_TYPE = 'excalimathpad-sheet'

/** The extension Obsidian registers, without its dot. */
export const SHEET_EXTENSION_NAME = SHEET_EXTENSION.slice(1)

/** Section 13, In a vault. */
export const NO_LOOKBEHIND = 'Excalimathpad needs iOS 16.4 or later.'

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

/**
 * A `.excalimathpad` file in its own tab (docs/spec-v1.md sections 7 and 12a):
 * the same `<App>` as the web, mounted on the view's `contentEl` with a vault
 * home, so its own listeners bind to this view and nothing else.
 *
 * - A device without lookbehind, a newer `format` and a file that isn't a
 *   sheet each show their message in the view, and nothing mounts.
 * - Until autosave arrives (#136) the view never writes: `save` does nothing,
 *   and `getViewData` hands back the text exactly as read.
 */
export class SheetView extends TextFileView {
  private root: Root | null = null
  private readonly memory: PanelMemory
  private readonly lookbehind: () => boolean

  constructor(leaf: WorkspaceLeaf, memory: PanelMemory, lookbehind: () => boolean = hasLookbehind) {
    super(leaf)
    this.memory = memory
    this.lookbehind = lookbehind
  }

  getViewType(): string {
    return VIEW_TYPE
  }

  getViewData(): string {
    return this.data
  }

  setViewData(data: string): void {
    this.data = data
    this.show(data)
  }

  clear(): void {
    this.unmount()
  }

  /** Writing is #136's autosave; until then viewing never touches the file. */
  async save(): Promise<void> {}

  async onClose(): Promise<void> {
    this.unmount()
    await super.onClose()
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
        vault: { container: content, sheet: { scene: read.scene, settings: read.settings } },
        panelMemory: this.memory,
      }),
    )
  }

  private say(message: string) {
    this.contentEl.createDiv({ cls: 'excalimathpad-view__message', text: message })
  }

  private unmount() {
    this.root?.unmount()
    this.root = null
  }
}
