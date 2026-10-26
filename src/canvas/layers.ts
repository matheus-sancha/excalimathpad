/**
 * Where overlay content sits among Excalidraw's own DOM layers. They share
 * one stacking context with the overlay: the shell's stage (`isolation:
 * isolate`), where neither slot sets a z-index, on purpose.
 *
 * Excalidraw 0.18.1 (`--zIndex-*` in its packaged `index.css`): canvas 1,
 * interactiveCanvas 2, svgLayer 3, wysiwyg 3 (its own text editor),
 * canvasButtons 3 (element link buttons), layerUI 4 (toolbar, panels, menus),
 * then eye-dropper, hyperlink, modal, popup, toast above that.
 *
 * We use 2: a tie with the interactive canvas, which the overlay wins only by
 * coming later in the DOM (the AppShell renders the overlay slot after the
 * canvas slot). So math paints above the drawing and selection handles, and
 * below Excalidraw's text editor, laser/SVG layer, link buttons and UI.
 *
 * These are CSS internals, not public API. `layers.test.ts` reads them from
 * the installed package, so an Excalidraw upgrade that moves them fails CI.
 */
export const ABOVE_DRAWING_BELOW_UI_Z_INDEX = 2
