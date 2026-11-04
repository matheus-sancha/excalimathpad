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
  slot and seeds the sheet (two anchors with their source: inputs above,
  `U = I * R` below). Depends on:
  shell, canvas, overlay.
- **shell** (`src/shell/`) — full-viewport layout with three slots: `canvas`,
  `overlay` (stacked exactly over the canvas, pointer-transparent by default)
  and `sidePanel` (docked right). Empty (falsy) slots render nothing. Neither
  slot sets a z-index (see Load-bearing). Interface: the `AppShell` props.
  Depends on: nothing.
- **canvas** (`src/canvas/`) — everything that knows Excalidraw. `SheetCanvas`
  is the official, unforked component; its `onReady` hands out a
  `SheetCanvasHandle`: Excalidraw's imperative API plus `forwardWheel` and
  `focusCanvas`. `mathAnchor.ts` defines a math element's anchor (a rectangle
  with `customData.kind === "math"` and `customData.source`, ADR 0002) and
  `writeAnchorSource`, the only way source enters the scene. `layers.ts` records where overlay
  content sits among Excalidraw's DOM layers. The only module that imports
  Excalidraw at runtime; tests may too, and other modules may import its
  types. This is ADR 0001's engineering rule as amended in ADR 0002. Depends
  on: `@excalidraw/excalidraw`.
- **math** (`src/math/`) — the engine. Interface: `evaluateSheet(blocks)`,
  with blocks `{ id, source }` already in reading order → one `LineResult`
  (value | error | empty) per line, keyed by block id; never throws. A plain
  input and any line whose value is a function are empty, and their value still
  reaches the lines below. All lines
  share one scope, fresh for every call (ADR 0003). Each line is parsed once
  (captured `parse`) to know what it defines, which turns "Undefined symbol"
  into "defined below" / "has an error above". Every known route for an
  expression to change the shared math.js instance is closed, each with a
  test: `createUnit`, `config`, `import` and the parser functions are
  disabled in the namespace (scope-only stubs are bypassed via `parser()`),
  and `typed` is shadowed in each run's scope (it cannot be overridden in
  the namespace without breaking math.js). Parsed Nodes from `simplifyCore`
  / `simplifyConstant` evaluate against the namespace, where `typed` is the
  real registry, so its mutators (`clear`, `addConversion`, ...) are also
  disabled in place on `math.typed`. Results format in a fixed unit
  system, SI, so units read elsewhere never change how a result shows
  (#25, ADR 0003). A result math.js simplifies shows in SI units with an
  SI prefix (`5 ft * 2 ft` is `0.9290304 m^2`, `2 cm * 3 cm` is
  `600 mm^2`); one whose units it keeps shows as written (`1 psi`,
  `60 mi / h`); `to` converts. App code must evaluate only
  through `evaluateSheet`: math.js functions that depend on the disabled
  names (`help`, `rationalize`, a `parser()`'s methods) no longer work. The
  only module that imports `mathjs`. Depends on: `mathjs`.
- **overlay** (`src/overlay/`) — renders math elements over the canvas.
  `MathOverlay` subscribes to the scene (`onChange`, `onScrollChange`) and
  places each element from its anchor's scene position via `viewport.ts`
  (`sceneToStage`, pure). It reads source from the anchors and holds the sheet's
  one **line edit**; `lineEdit.ts` (pure) decides what each way of leaving a
  line writes. It owns the sheet's evaluation: it sorts anchors with
  `readingOrder.ts` (pure) and runs `evaluateSheet` on every keystroke, every
  source change and every change of order, then hands each `MathElementView`
  its results. A row opens in a one-line field on click, until the gestures
  arrive (#43). Depends on: canvas (anchor and layer contracts, API types), math.
- **test setup** (`src/test/`) — jsdom stubs for browser APIs Excalidraw
  touches on mount (canvas, fonts, matchMedia, ResizeObserver), and helpers for
  tests against the real Excalidraw. Not app code.

Planned (not built): saving to a file, the Sheet panel, an "add math" tool (for
now, duplicating an anchor makes a new math element with the same source).

## Domain

The core loop: define variables with units, see results inline, edit an input
and everything downstream recalculates. Engine: math.js, client-side.

- **Math element** — a block of math.js source, one statement per line
  (assignment is plain `=`), anchored at a scene position, plus one
  **result** per line: a value with unit (`20 V`), an error (message), or
  empty.
- **Anchor** — the Excalidraw rectangle that carries a math element's
  position, size, rotation and source. Excalidraw owns it (move, select, delete,
  undo); the app writes only `customData.source`, the only stored copy.
- **Line edit** — the one line shown as raw source: anchor id, line index and
  the typed text. UI state, never in the scene. The sheet runs from the typed
  text on every keystroke.
- **Line commit** — the moment an edit leaves a line whose text differs from the
  scene. It writes the element's whole source once, as one undo step, so a split
  or a join is one step too.
- **Viewport** — `scrollX`, `scrollY`, `zoom` from Excalidraw's app state.
- **Sheet** — all live math elements, in **reading order**: by the top of each
  anchor's visual bounds, then its left, then its id (ADR 0003). Derived from
  positions every time, never stored. The sheet, not the element, is the unit
  of evaluation: one scope, lines top to bottom.
- Invariants: one undo step per line commit and none for keystrokes; sheet undo
  never runs during a line edit, because the field is outside Excalidraw's
  container; results are never in a step. Selecting and deselecting are
  Excalidraw's own steps on the same stack (spec section 6). Scene coordinates
  are the only stored position, and the screen
  position is always derived as `(scene + scroll) * zoom`. Evaluation never
  throws, and a failed line does not stop the lines after it. A line sees only
  names assigned above it in reading order; a later assignment silently
  redefines a name for the lines below, and a failed one removes it (no stale
  values below an error). The same sheet (sources in reading
  order) gives the same results however often it is evaluated: every run
  starts from a fresh scope, and every known route for a line to change the
  engine is closed, including through parsed Nodes and the unit system
  results format in (see **math**).
- Known limit: a variable named like a math.js unit or built-in (`V`, `m`,
  `s`, `i`, ...) silently shadows the unit below its definition and falls
  back to the unit above it or after it fails (ADR 0003). The seed uses `U`
  for that reason; warnings are issue #7.

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
- **Source writes go through `writeAnchorSource`.** A plain spread isn't recorded
  by undo, and `EVENTUALLY` or the default capture drops later updates to that
  anchor off the stack. Excalidraw's own nudge and Link leave the anchor in that
  same state, so the write first records their change as its own step (spec
  section 14). That relies on how `updateScene` compares versions, which isn't
  public; `mathAnchor.excalidraw.test.tsx` holds the contract against the
  installed package.
- **`focusCanvas` queries `.excalidraw`,** the element that hears Excalidraw's
  keys. It lives in `src/canvas/`, and `SheetCanvas.test.tsx` pins it.
- **The line field is uncontrolled and remounts per line.** Setting its value
  from code clears the browser's text undo, which is what Ctrl+Z means while
  editing (spec section 6).
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
  overflows its border (spike limitation, until auto-size in #44). Rows and
  results have one fixed line height, which keeps each result beside its line.

## Decisions

[`docs/spec-v1.md`](docs/spec-v1.md) says what v1 will be. This file says what the
code is today, so each PR moves in the terms and rules it makes true. ADR items
marked with a milestone aren't built yet.

- [ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md) — wrap the npm
  Excalidraw component unforked; math is an overlay around it, and the app's
  chrome uses Excalidraw's public slots.
- [ADR 0002](docs/adr/0002-math-elements-anchor-to-excalidraw-rectangles.md) —
  math elements anchor to a marked Excalidraw rectangle; the overlay renders
  them; the source lives in the anchor.
- [ADR 0003](docs/adr/0003-sheet-evaluates-in-reading-order-in-one-scope.md) —
  the sheet evaluates in reading order (top, then left), in one fresh scope
  per run, re-run whole and synchronously on every change.
- [ADR 0004](docs/adr/0004-sheet-file-is-excalidraw-json-plus-a-block.md) —
  the sheet file is Excalidraw JSON plus one block, saved as `.excalimathpad`.
- [ADR 0005](docs/adr/0005-app-reads-line-forms-before-mathjs.md) — the app
  reads its line forms (comment, display unit, solve, range, table, plot)
  before math.js sees a line.
