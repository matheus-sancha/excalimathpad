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
  slot, seeds the untitled sheet (two anchors with their source: inputs above,
  `U = I * R` below, loaded clean, until Add math in #45) and wires the sheet
  file to the canvas and the line edit. Takes `files` and `recovery` so tests
  pass fakes. Depends on: shell, canvas, overlay, file.
- **shell** (`src/shell/`) — full-viewport layout with three slots: `canvas`,
  `overlay` (stacked exactly over the canvas, pointer-transparent by default)
  and `sidePanel` (docked right). Empty (falsy) slots render nothing. Neither
  slot sets a z-index (see Load-bearing). Interface: the `AppShell` props.
  Depends on: nothing.
- **canvas** (`src/canvas/`) — everything that knows Excalidraw. `SheetCanvas`
  is the official, unforked component; its `onReady` hands out a
  `SheetCanvasHandle`: Excalidraw's imperative API plus `forwardWheel` and
  `focusCanvas`. `mathAnchor.ts` defines a math element's anchor (a rectangle
  with `customData.kind === "math"` and `customData.source`, ADR 0002; a solid
  `#ffffff01` fill, so clicks inside it select and drag it) and
  `writeAnchorSource`, the only way source enters the scene. `selection.ts`
  holds `deselectAll`, the second Esc's write (`NEVER`, no undo step).
  `canvasEvents.ts` (`listenToCanvas`) hands the canvas's double-clicks, presses,
  clicks and keys to the gestures before Excalidraw hears them, and stops the
  ones they take. `sceneFile.ts` is
  the Excalidraw half of the sheet file: `serializeScene`, `loadScene` (no undo
  step, clears history) and `saveKey`, the key dirty is measured by.
  `SheetCanvas` also turns off Excalidraw's own open, save and export and draws
  the ☰ menu with the app's file items; its handle carries `root`, the box it
  shares with the overlay. `fileRoutes.ts` takes the file keys and scene-file
  drops from Excalidraw, and measures the space beside the ☰ button
  (`useBesideMenu`). `layers.ts` records where overlay
  content sits among Excalidraw's DOM layers, and the dark theme's filter.
  `anchorSize.ts` writes an anchor's size (`writeAnchorSizes`: `NEVER`, top-left
  kept, the rotated top-left for a rotated anchor) and snaps resize handles back
  (`snapBackResizes`, from `onPointerUp`'s `originalElements`), and says when
  a size write waits (`sizeWritesWait`). The only module that imports
  Excalidraw at runtime; tests may too, and other modules may import its
  types. This is ADR 0001's engineering rule as amended in ADR 0002. Depends
  on: `@excalidraw/excalidraw`.
- **math** (`src/math/`) — the engine. Interface: `evaluateSheet(blocks)`,
  with blocks `{ id, source }` already in reading order → one `SheetLine` per
  line, keyed by block id; never throws. A `SheetLine` is the line's
  `LineResult` (value | error | empty) and its `TypesetLine`, from the same
  parse: blank, comment, math (name, expression and note, as TeX) or unparsed
  (raw source). `lineForm.ts` (pure) reads a line's comment before math.js sees
  it (ADR 0005 step 1), so a note never reaches math.js. `typeset.ts` is the
  `toTex` handler of spec section 4, Typesetting names; a name counts as the
  sheet's from the line that assigns it down. `typesetResult` sets a result's
  `math.format` text as number and unit. A plain
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
- **overlay** (`src/overlay/`) — renders math elements over the canvas, each
  as a typeset grid (`MathElementView`, spec section 4): rows are CSS subgrids
  of one grid per element (gutter, name, `≔`, expression, result after a rule,
  note), each with its own box for the line hit. Cells hold KaTeX's HTML,
  loaded lazily by `katex.ts`; until it loads, a line shows as its source. Rows
  are named by their source (`aria-label`) and result cells carry their text
  (`data-text`). `useAnchorSizes` measures each body after every render and on
  a `ResizeObserver` (fonts), waits while `sizeWritesWait`, and writes the
  sizes through the session's `keepClean`. In Excalidraw's dark theme the
  overlay takes its canvas filter.
  `MathOverlay` subscribes to the scene (`onChange`, `onScrollChange`) and
  places each element from its anchor's scene position via `viewport.ts`
  (`sceneToStage`, pure). It reads source from the anchors and holds the sheet's
  one **line edit**; `lineEdit.ts` (pure) decides what each way of leaving a
  line writes. It owns the sheet's evaluation: it sorts anchors with
  `readingOrder.ts` (pure) and runs `evaluateSheet` on every keystroke,
  every source change and every change of order, then hands each
  `MathElementView` its lines. The overlay takes no pointer events except the open field:
  Excalidraw gets every click and drag. `useSheetGestures` opens, moves and
  leaves the line edit from the events `listenToCanvas` hands it. The open line
  is a field over the name, `≔` and expression cells, beside its live result as
  plain text; a hidden copy of its text widens the cell. `gestures.ts`
  (pure) decides when a double-click, a click, Enter or Esc is math's, and
  `lineHit.ts` (pure) finds the
  element and line under a point from geometry and the rows' `offsetTop` and
  `offsetHeight` (spec section 4, Gestures, section 14). Its `control` lets the
  sheet file commit the line (Ctrl+S keeps it open) or leave it (Open).
  Depends on: canvas (anchor, size, selection and layer contracts, API types),
  math, `katex` (lazily).
- **file** (`src/file/`) — the sheet file (ADR 0004, spec section 7).
  `sheetFormat.ts` (pure) reads and writes the `excalimathpad` block, settings
  and migrations. `sheetSession.ts` is the deep module: save, save as, open,
  startup with the recovery offer, the clean mark and the recovery copy, over
  ports (scene, file access, recovery store, dialogs, line), so it knows no
  Excalidraw, React or DOM. `fileAccess.ts` wraps the File System Access API,
  with a download and file-input fallback. `recovery.ts` keeps the one copy in
  IndexedDB. `FileChrome.tsx` shows the name and title, asks the two questions
  and asks before leaving while dirty; it answers the keys and drops that
  `canvas/fileRoutes.ts` takes. Opening picks the file before it asks about
  unsaved changes: Chromium allows one picker per gesture. Depends on: canvas
  (file routes, layers).
- **test setup** (`src/test/`) — jsdom stubs for browser APIs Excalidraw
  touches on mount (canvas, fonts, matchMedia, ResizeObserver, which tests can
  fire), helpers for tests against the real Excalidraw, body sizes for the
  size tests (`layout.ts`) and readers for the grid (`sheetView.ts`). KaTeX is
  loaded before the tests run. Not app code.

Planned (not built): the Sheet panel, an "add math" tool (for now, duplicating
an anchor makes a new math element with the same source).

## Domain

The core loop: define variables with units, see results inline, edit an input
and everything downstream recalculates. Engine: math.js, client-side.

- **Math element** — a block of math.js source, one statement per line
  (assignment is plain `=`), anchored at a scene position, plus one
  **result** per line: a value with unit (`20 V`), an error (message), or
  empty. It shows as a grid of **typeset rows**. A line starting with `#` is
  a **comment line**; the text after the first `#` on a line with code is its
  **note**; neither reaches math.js.
- **Content size** — the grid's laid-out size in scene units. The anchor's
  size is a copy of it, written with no undo step.
- **Anchor** — the Excalidraw rectangle that carries a math element's
  position, size, rotation and source. Excalidraw owns it (move, select, delete,
  undo); the app writes only `customData.source`, the only stored copy.
- **Line edit** — the one line shown as raw source: anchor id, line index and
  the typed text. UI state, never in the scene. The sheet runs from the typed
  text on every keystroke.
- **Gesture** — a double-click, Enter, Esc, or a press on the canvas that opens,
  moves or leaves the line edit. A double-click is math's when Excalidraw's own
  first click selected the anchor under the pointer (on its own or through its
  group), or the anchor is locked and nothing above it was selected (Excalidraw
  never selects a locked element); a drawing on top keeps its double-click. A
  **click** on the edited element is a press and its click with the anchor's `x`
  and `y` unchanged, on an anchor that still owns the point by the same rule;
  otherwise the press was a drag, or a drawing on top took it.
- **Line commit** — the moment an edit leaves a line whose text differs from the
  scene. It writes the element's whole source once, as one undo step, so a split
  or a join is one step too.
- **Viewport** — `scrollX`, `scrollY`, `zoom` from Excalidraw's app state.
- **Sheet** — all live math elements, in **reading order**: by the top of each
  anchor's visual bounds, then its left, then its id (ADR 0003). Derived from
  positions every time, never stored. The sheet, not the element, is the unit
  of evaluation: one scope, lines top to bottom.
- Invariants: after every evaluation and pointer release, an anchor's size
  equals its content size (within 0.5 px), and a size write adds no undo step
  and never makes a clean sheet dirty. A line commit's source change is one undo step, and keystrokes are
  none (a commit can also record a nudge or Link edit before it as its own step,
  spec section 6); sheet undo
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
- Known limit: a size write doesn't move a bound arrow's end (Excalidraw's
  binding update isn't public); it follows when the element next moves (#44).

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
- **Wheel over the line field is forwarded** to Excalidraw's canvas
  (`SheetCanvasHandle.forwardWheel`): Excalidraw listens for `wheel` on its
  own container, which the overlay is not inside. The field is the only part of
  the overlay that takes pointer events; without this, ctrl+wheel over it zooms
  the browser page.
- **Gestures run in the capture phase, before Excalidraw's React handlers**
  (`src/canvas/canvasEvents.ts`, per ADR 0001), and stop an event only when math
  acts on it. A press leaves the open line before Excalidraw sees it, so a drag
  starts on the committed scene and the line stays one undo step. Keys from
  outside the canvas, such as the app's own dialogs, are left alone: the second
  Esc once stole Esc from the open-file question. `canvasEvents.excalidraw.test.tsx`
  holds the phase contracts and `gestures.excalidraw.test.tsx` the gestures,
  against the installed package, each with the control of what Excalidraw does
  without the app; jsdom runs Excalidraw's hit-testing.
- **The line field ignores a press that continues a double-click begun
  elsewhere** (`mousedown` with `detail` 2 or more, before any press of its own),
  so double-clicking another line while editing opens it with the caret at the
  end, not a word selected.
- **Anchors need a fill.** Excalidraw tests the inside of a shape only when its
  background isn't transparent; `#ffffff01` looks transparent and takes clicks
  (`mathAnchor.excalidraw.test.tsx`, with a transparent control). An anchor
  given a transparent background can then be grabbed only by its border, until
  the style restore in #46.
- **Size writes go through `writeAnchorSizes`, wrapped in `keepClean`.** A
  `NEVER` write also updates Excalidraw's captured copy of the anchor, which is
  why a line commit after size writes is still one step
  (`anchorSize.excalidraw.test.tsx`, with a control). Without `keepClean`,
  every startup and Open would leave the sheet dirty. Writes wait while
  `sizeWritesWait` reads Excalidraw as mid-gesture or in one of its editors
  (drag, resize, rotation, new shape, text or line editor); its flags are
  contract-tested.
- **The body is measured, not the anchor.** `.math-element__body` is
  `max-content` and rotates about the anchor's centre; `offsetWidth` and
  `offsetHeight` ignore transforms, so they are scene units. A body measuring
  0 × 0 isn't laid out (jsdom) and is never written.
- **Source writes go through `writeAnchorSource`.** A plain spread isn't recorded
  by undo, and `EVENTUALLY` or the default capture drops later updates to that
  anchor off the stack. Excalidraw's own nudge and Link leave the anchor in that
  same state, so the write first records their change as its own step (spec
  section 14). That relies on how `updateScene` compares versions, which isn't
  public; `mathAnchor.excalidraw.test.tsx` holds the contract against the
  installed package. Upstream has dropped that comparison, so this has to change
  at the next Excalidraw upgrade.
- **`focusCanvas` queries `.excalidraw`,** the element that hears Excalidraw's
  keys. It lives in `src/canvas/`, and `SheetCanvas.test.tsx` pins it.
- **The line field is uncontrolled and remounts per line.** Setting its value
  from code clears the browser's text undo, which is what Ctrl+Z means while
  editing (spec section 6).
- **The app takes the file keys and drops before Excalidraw**
  (`src/canvas/fileRoutes.ts`): Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+Shift+E and
  dropped scene files, on the window in the capture phase. In Excalidraw 0.18,
  Ctrl+Shift+S and Ctrl+Shift+E ignore `canvasActions`, and a dropped scene
  replaces the sheet; each would drop the block (ADR 0004).
  `fileRoutes.excalidraw.test.tsx` holds the contract: the routes are open
  without the takeover and closed with it, and `.main-menu-trigger` and
  `.App-toolbar`, which place the file name, still render.
- **Excalidraw's `onChange` comes after React commits,** not inside
  `updateScene`. A file flow that has just written a line re-reads the save key
  itself; trusting the last `onChange` misses that line.
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
- In Excalidraw's phone layout (a narrow window), ☰ moves to the bottom bar and
  the file name, placed beside it, sits under that bar, so it doesn't show. v1
  targets desktop Chrome and Edge.
- After an Open, Excalidraw's Undo button can stay lit: `history.clear()`
  doesn't notify it. Pressing it undoes nothing and puts it right.
- KaTeX shares the lazy `katex-*.js` chunk with Mermaid (about 77 kB gzip) and
  brings its CSS and 59 font files, fetched only as a page uses them. The first
  frame of a sheet shows plain source; it typesets once the chunk loads.
- A box grows right and down, so a taller element can overlap the one below
  it. Reading order is by top, so it doesn't change.
- Resizing an anchor by a handle snaps back but still marks the sheet dirty:
  Excalidraw changes the scene while the handle moves (spec section 4).

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
