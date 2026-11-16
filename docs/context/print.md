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

Nothing draws the pages yet: the print view, the footer, Print… and the frame it prints in are
#81 (spec section 11, Print flow, and section 14, Print). The drawings' boxes are to come from
the scene in `src/canvas/`, the only code that knows Excalidraw (0.18.1 exports
`getCommonBounds`). Depends on: nothing.
