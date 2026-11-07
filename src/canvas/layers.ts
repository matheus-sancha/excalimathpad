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
 * Also at 2, as a literal rather than a `--zIndex-*` variable (so the
 * contract test cannot see it): `.excalidraw__embeddable-container`. Math
 * wins that tie too, so it paints over embeds and takes clicks where they
 * overlap. Accepted while the sheet has no embeds (M1).
 *
 * These are CSS internals, not public API. `layers.test.ts` reads them from
 * the installed package, so an Excalidraw upgrade that moves them fails CI.
 */
export const ABOVE_DRAWING_BELOW_UI_Z_INDEX = 2

/**
 * Excalidraw's dark theme: a filter over its canvas (`--theme-filter` on
 * `.excalidraw.theme--dark`), not a second palette. The overlay isn't inside
 * that element, so in dark mode it takes the same filter, and math darkens
 * exactly as drawings do (#50). Print builds its own views, so it stays light.
 * `layers.test.ts` reads it from the installed package.
 */
export const DARK_THEME_FILTER = 'invert(93%) hue-rotate(180deg)'
