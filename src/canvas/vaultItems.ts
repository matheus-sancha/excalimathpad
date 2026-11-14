/**
 * The class on the canvas's box in an Obsidian tab. `SheetCanvas.css` hides,
 * under it, what `VAULT_HIDDEN` names; `vaultItems.excalidraw.test.tsx` holds
 * the contract against the installed package.
 */
export const VAULT_CLASS = 'sheet-canvas--vault'

/**
 * Excalidraw's items hidden in the plugin (docs/spec-v1.md section 8, Inside
 * an Obsidian tab), by the selectors `SheetCanvas.css` hides under
 * `VAULT_CLASS`. Excalidraw 0.18.1 has no prop for any of them. Web Embed and
 * Mermaid to Excalidraw share one test id there, and the Generate heading over
 * them is a plain `div`, left empty once they go. Its command palette needs no
 * hiding: the package doesn't render it unless the host does.
 */
export const VAULT_HIDDEN = {
  /** Web Embed and Mermaid to Excalidraw, in More tools. */
  embedAndMermaid: '.App-toolbar__extra-tools-dropdown [data-testid="toolbar-embeddable"]',
  /** More tools' Generate heading. */
  generateHeading: '.App-toolbar__extra-tools-dropdown .dropdown-menu-container > div:not([class])',
  /** Browse libraries, in the library. */
  browseLibraries: '.library-menu-browse-button',
  /** Copy to clipboard as SVG, in the context menu. */
  copyAsSvg: '.context-menu [data-testid="copyAsSvg"]',
} as const
