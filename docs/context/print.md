# print

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**print** (`src/print/`) — the print pages (spec section 11, M5). `pages.ts` (pure) is
`printPages(input): PrintLayout`, the same in both homes, computed at print time and never
stored (spec section 2, Print pages). Its `PrintInput` is the scene's boxes, as plain numbers in
scene units: `drawings` (every drawing's axis-aligned bounds, Excalidraw text included, never a
math anchor), `elements` (`PrintElement`: each math element's id, its anchor's box and angle, and
its `rows`, `PrintRow`s from the element's top) and `page` (`PageSetting`, the file's
`settings.page`). It returns the paper and its furniture in CSS px (`paperOf`: margins
`MARGIN_MM`, the footer's band `FOOTER_MM`), the room a page holds, the `scale` (shrink only,
capped at 1), the content's bounds (its left edge prints at the left margin) and the `pages`:
each a slice of the scene from `top` to `bottom`, the table headers repeated above it
(`headers`, by element id and line, and the `headerRoom` they take) and how it `end`s (`last`,
`gap` or the fallback `cut`). The break rules are spec section 11, Page breaks and As built
(#80); `pages.test.ts` holds each one without a browser.

The rows come from the overlay: `printRows(body)` (`src/overlay/printRows.ts`) reads a math
element's laid-out body (the title, a failed element's notice, each line and comment row, a plot
line whole, a table line as its line, header row and rows), in scene units whatever the canvas's
zoom. jsdom lays nothing out, so `scripts/panel-run.mjs` bundles both and checks the breaks on
boxes Chromium lays out: the pump sheet on all four pages, staggered elements, a tall rectangle
and a heading (spec section 17, M5, in [the history](../spec-history.md#17-verify-first)).

**The print view** (`printView.ts`, M5, #81; spec section 11, As built (#81), and section 14,
Print) is plain DOM built into any document (`doc.importNode` of each copy), so the web's page and
the plugin's frame share it. `buildPrintView(doc, PrintParts)` takes the layout, the elements
(`PrintElementView`: place, laid-out size, rows and the overlay's `.math-element` to copy), each
page's drawings (`PageDrawings`: one SVG and its scene top-left, or null), the footer's name and date
(`printDate`), the overlay's `--math-*` colours and `rowNodes` (`printRowNodes`, so the Nth node of a
copy is its Nth measured row). It returns an unattached root (`PRINT_VIEW_CLASS`); each row is marked
shown or hidden for its page, and a split table's header is a copy with only that row shown.
`printCss(layout)` is the `@page` rule and section 14's recipe, and in print shows the view alone.

**Print…** (`printSheet.ts`): `printSheet(PrintRoute)` reads `SheetToPrint` (the drawings' boxes, the
elements, the Page, the colours, `drawingsOn(top, bottom)` and `rowNodes`), lays out with
`printPages`, exports each page's drawings, builds the view, adds its styles with `adoptStyles`
(constructed style sheets, never a `<style>`), awaits `doc.fonts.ready` and two frames, sets the
route's `title` to its plain name, calls `print()` and, when it returns, takes everything off and puts
the title back. A throw before the dialog calls `notify(PRINT_FAILED)` and leaves nothing behind.
`styles` is CSS the document lacks, for a frame. `printView.test.ts` and `printSheet.test.ts` hold it
in jsdom; the **print run** (`scripts/print-run.mjs`, read back by `scripts/pdf-read.mjs`) holds the
web's Print… in real Chromium PDFs.

The parts it is given come from the modules that know them: the drawings from `src/canvas/printScene.ts`
(`drawingBoxes`, `anchorPlaces`, `drawingsSvg`), the views and rows from `src/overlay/printRows.ts`
(`printViews`, `printRowNodes`), put together in App (`sheetToPrint`). The web's route is App's
`printOnTheWeb`: the page's own document, `window.print()`, `document.title` and Excalidraw's toast.

**The plugin's route** (spec section 11, Changed on 2026-11-16 and As built (#81, the plugin's route))
is `plugin/print.ts` ([plugin](plugin.md)): `printInFrame` makes a hidden `srcdoc` frame in the view's
window (`containerEl.doc`), calls `printSheet` with its document, `styles` (`appStyles`: the view
document's sheets that hold the app's cascade layer, as text), the window's title, Obsidian's `Notice`
and a `print` that shows the paper's notice (`paperNotice`), waits two frames and the frame's fonts, and
calls the frame's `contentWindow.print()`; then removes the frame. The print run holds it in the built
plugin, printing the frame's document from a page of its own; the pop-out run prints from each window.
Depends on: nothing.
