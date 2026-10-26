/**
 * Where overlay content must sit among Excalidraw's own DOM layers, which
 * share the stage's stacking context (AppShell sets no z-index on purpose).
 *
 * Excalidraw 0.18 uses: static canvas 1, interactive canvas 2, SVG layer 3,
 * UI (toolbar, panels, menus) 4, eye-dropper 5. These are CSS internals, not
 * public API: re-check them in the browser on every Excalidraw upgrade.
 */
export const ABOVE_DRAWING_BELOW_UI_Z_INDEX = 3
