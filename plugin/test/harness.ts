import { App, TFile, type WorkspaceLeaf } from './obsidian.ts'
import ExcalimathpadPlugin from '../main.ts'
import manifestText from '../../manifest.json?raw'
import pumpText from './pump-sizing.excalimathpad?raw'

/** The plugin's manifest as committed. */
export const manifest = JSON.parse(manifestText) as Record<string, unknown>

/** The pump sheet with a plot, an image and CJK text (`pump-sizing.excalimathpad`). */
export const pumpSheet = () => pumpText

export interface Vault {
  app: App
  plugin: ExcalimathpadPlugin
  /** Opens a file in a new tab, as a click in Obsidian's file explorer does. */
  open(path: string): Promise<WorkspaceLeaf>
}

/** A fake vault holding `files`, with the plugin loaded. */
export async function vaultWith(files: Record<string, string>, data: unknown = null): Promise<Vault> {
  const app = new App()
  for (const [path, text] of Object.entries(files)) app.vault.add(path, text)
  const plugin = new ExcalimathpadPlugin(app as never, manifest as never)
  ;(plugin as unknown as { dataJson: unknown }).dataJson = data
  await plugin.onload()
  return {
    app,
    plugin,
    async open(path) {
      const leaf = app.workspace.getLeaf()
      await leaf.openFile(new TFile(path))
      return leaf
    },
  }
}
