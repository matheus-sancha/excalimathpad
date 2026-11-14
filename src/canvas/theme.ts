/** Excalidraw's two modes, the canvas's light or dark (docs/spec-v1.md section 8). */
export type SheetTheme = 'light' | 'dark'

/**
 * Where a home keeps the last light or dark chosen with ☰ Dark mode
 * (Alt+Shift+D). In a vault it is the plugin's `data.json` (docs/spec-v1.md
 * section 8, Inside an Obsidian tab; section 12a, Data protection): every sheet
 * tab opened after the choice opens in that mode, and a tab already open keeps
 * its own. The web remembers none, so a page opens light.
 */
export interface ThemeMemory {
  /** The mode last chosen; null until one is. */
  rememberedTheme(): SheetTheme | null
  rememberTheme(theme: SheetTheme): void
}

export function isSheetTheme(value: unknown): value is SheetTheme {
  return value === 'light' || value === 'dark'
}
