# Context

Excalimathpad is a single-user, browser-only "calc sheet": the Excalidraw
whiteboard with a layer of live, unit-aware math on top (Mathcad-style). It is
a Vite + React + TypeScript app that builds to static files; there is no
server. v1 target: one sheet, for Matheus's own use.

## Entry points

- `index.html` → `src/main.tsx` — the only runtime entry; mounts `App`.
- `npm run dev | build | preview | test | lint | check` — see `package.json`.
- `.github/workflows/ci.yml` — runs `npm run check` on pushes to `main`
  and on pull requests.

## Modules

- **App** (`src/App.tsx`) — composition root. Decides what fills each shell
  slot and seeds the sheet (one math element for the #2 spike). Depends on:
  shell, canvas, overlay.
- **shell** (`src/shell/`) — full-viewport layout with three slots: `canvas`,
  `overlay` (stacked exactly over the canvas, pointer-transparent by default)
  and `sidePanel` (docked right). Empty (falsy) slots render nothing. Neither
  slot sets a z-index (see Load-bearing). Interface: the `AppShell` props.
  Depends on: nothing.
- **canvas** (`src/canvas/`) — everything that knows Excalidraw. `SheetCanvas`
  is the official, unforked component; its `onReady` hands out a
  `SheetCanvasHandle`: Excalidraw's imperative API plus `forwardWheel`.
  `mathAnchor.ts` defines a math element's anchor (a rectangle with
  `customData.kind === "math"`, ADR 0002). `layers.ts` records where overlay
  content sits among Excalidraw's DOM layers. The only module that imports
  Excalidraw at runtime; tests may too, and other modules may import its
  types. This is ADR 0001's engineering rule as amended in ADR 0002. Depends
  on: `@excalidraw/excalidraw`.
- **math** (`src/math/`) — the engine. Interface: `evaluateBlock(source)` →
  one `LineResult` (value | error | empty) per line; never throws; the scope
  is per block for now (#3 makes it sheet-wide). Every known route for an
  expression to change the shared math.js instance is closed, each with a
  test: `createUnit`, `config`, `import` and the parser functions are
  disabled in the namespace (scope-only stubs are bypassed via `parser()`),
  and `typed` is shadowed in each block's scope (it cannot be overridden in
  the namespace without breaking math.js). App code must evaluate only
  through `evaluateBlock`: math.js functions that depend on the disabled
  names (`help`, `rationalize`, a `parser()`'s methods) no longer work. The
  only module that imports `mathjs`. Depends on: `mathjs`.
- **overlay** (`src/overlay/`) — renders math elements over the canvas.
  `MathOverlay` subscribes to the scene (`onChange`, `onScrollChange`) and
  places each element from its anchor's scene position via `viewport.ts`
  (`sceneToStage`, pure). Source text is held here, in memory, keyed by
  anchor id (persistence is open). Depends on: canvas (anchor and layer
  contracts, API types), math.
- **test setup** (`src/test/`) — jsdom stubs for browser APIs Excalidraw
  touches on mount (canvas, fonts, matchMedia, ResizeObserver). Not app code.

Planned (not built): recalculation across elements (#3), persistence, a side
panel, an "add math" tool.

## Domain

The core loop: define variables with units, see results inline, edit an input
and everything downstream recalculates (#3). Engine: math.js, client-side.

- **Math element** — a block of math.js source, one statement per line
  (assignment is plain `=`), anchored at a scene position, plus one
  **result** per line: a value with unit (`20 V`), an error (message), or
  empty.
- **Anchor** — the Excalidraw rectangle that carries a math element's
  position, size and rotation. Excalidraw owns it (move, select, delete,
  undo); the overlay only reads it.
- **Viewport** — `scrollX`, `scrollY`, `zoom` from Excalidraw's app state.
- Invariants: scene coordinates are the only stored position, and the screen
  position is always derived as `(scene + scroll) * zoom`. Evaluation never
  throws, a failed line does not stop the lines after it, and the same source
  gives the same results however often it is evaluated and whatever other
  blocks contain (every known route for a line to change the engine is
  closed; see **math**).

## Load-bearing

- **Excalidraw is wrapped, never forked or patched** ([ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md)).
  Math lives outside it, in the overlay and side panel. Reaching into
  Excalidraw internals or patching `node_modules` breaks upgrades.
- **Every ancestor of the canvas has a definite height** (`src/index.css`,
  `AppShell.css`). Excalidraw fills 100% of its container; a zero-height
  ancestor renders nothing, silently.
- **Overlay and canvas share one positioned box** (`.app-shell__stage`). The
  overlay maps scene coordinates to coordinates relative to that box; moving
  either out of it breaks the mapping.
- **Overlay z-order sits between Excalidraw's layers** (`src/canvas/layers.ts`).
  Math is at z-index 2: it ties with Excalidraw's interactive canvas and wins
  only by coming later in the DOM, so it paints above the drawing (1) and
  selection handles, and below Excalidraw's text editor, SVG/laser layer and
  link buttons (all 3) and its toolbar and panels (4). Excalidraw's embed
  container is also at 2 (a CSS literal the contract test cannot read), so
  math paints over embeds; accepted while sheets have none. This works only
  because the stage (`isolation: isolate`) is the one stacking context and
  neither slot sets a z-index or creates one; isolating the canvas slot makes
  math cover Excalidraw's toolbar and take its clicks. Excalidraw's z-indexes
  are CSS internals; `layers.test.ts` reads them from the installed package,
  so an upgrade that moves them fails CI.
- **Wheel over math is forwarded** to Excalidraw's canvas
  (`SheetCanvasHandle.forwardWheel`): Excalidraw listens for `wheel` on its
  own container, which the overlay is not inside. Without it, scrolling over
  a math element does nothing and ctrl+wheel zooms the browser page.
- **Static-only build** with relative `base` (`vite.config.ts`). Adding a
  server dependency breaks the deploy model.

## Incidental

- Excalidraw loads its canvas fonts (Excalifont etc.) from the esm.sh CDN by
  default; UI fonts are bundled. Fine online; self-host them if offline use
  matters (`window.EXCALIDRAW_ASSET_PATH`).
- The production bundle is large. The entry chunk (`index-*.js`) is about
  1.96 MB (597 kB gzip): math.js `create(all)` is about 180 kB gzip of that
  (accepted for v1; trimming to fewer factories is a later follow-up) and
  nearly all the rest is Excalidraw. A separate ~1.8 MB chunk is loaded only
  by Excalidraw's font-subset worker. Vite's chunk-size warning is expected.
- `npm audit` reports advisories in Excalidraw's transitive deps (mermaid,
  katex, nanoid, lodash-es); the only "fix" downgrades Excalidraw to 0.17.
- `test.server.deps.inline` for Excalidraw in `vite.config.ts` exists because
  its ESM build imports JSON without import attributes, which Node rejects.
- The seeded anchor has a fixed size; source longer than three lines
  overflows its border (spike limitation). The textarea has one row per line
  so it never scrolls, which keeps each result beside its line.

## Decisions

- [ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md) — wrap the npm
  Excalidraw component unforked; math is an overlay + side panel around it.
- [ADR 0002](docs/adr/0002-math-elements-anchor-to-excalidraw-rectangles.md) —
  math elements anchor to a marked Excalidraw rectangle; the overlay renders
  them; persistence stays open.
