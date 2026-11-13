# Context

Excalimathpad is a single-user, browser-only "calc sheet": the Excalidraw
whiteboard with a layer of live, unit-aware math on top (Mathcad-style). It is
a Vite + React + TypeScript app that builds to static files; there is no
server. v1 target: one sheet, for Matheus's own use.

## Entry points

- `index.html` → `src/main.tsx` — the only runtime entry; mounts `App`.
- `npm run dev | build | preview | test | lint | check` — see `package.json`.
- `.github/workflows/ci.yml` — runs `npm run check` on pushes to `main`
  and on pull requests. On a push to `main` its `deploy` job then publishes
  that run's `dist/` to Cloudflare Pages (spec section 12, Hosted build); it
  is skipped while the repository variable `CLOUDFLARE_PAGES_PROJECT` is unset.
- `buildStamp.ts` (repo root, pure) — the build stamp's text, short commit and
  date or `dev`. `vite.config.ts` runs it at build time from `GITHUB_SHA` and
  defines `__BUILD_STAMP__` (typed in `src/buildStamp.d.ts`).

## Modules

- **App** (`src/App.tsx`) — composition root. Decides what fills each shell
  slot and wires the sheet file to the canvas and the line edit, and the
  sheet's evaluation to the Sheet panel (opened at launch on a wide window). The untitled
  sheet starts empty, on the welcome screen. Takes `files`, `recovery` and
  `initialElements` so tests pass fakes and a sheet to work on. Depends on:
  shell, canvas, overlay, file.
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
  `writeAnchorSource`, the only way source enters the scene, and
  `writeAnchorTitle`, the same for the optional `customData.title`. `selection.ts`
  holds `deselectAll`, the second Esc's write (`NEVER`, no undo step).
  `anchorStyle.ts` keeps anchors in the fixed style (`ANCHOR_STYLE`, in
  `mathAnchor.ts`): `restoreAnchorStyles` writes it back with `NEVER`.
  `mathSelection.ts` marks the box Excalidraw fills with
  `data-math-selection` (`one`, `several`) while only math is selected;
  `SheetCanvas.css` uses the mark for the reduced panel and the hint.
  `SheetCanvas` starts new text in the Normal font (Nunito).
  `canvasEvents.ts` (`listenToCanvas`) hands the canvas's double-clicks, presses,
  clicks, pointer moves and keys to the gestures before Excalidraw hears them,
  and stops the ones they take. `sceneFile.ts` is
  the Excalidraw half of the sheet file: `serializeScene`, `loadScene` (no undo
  step, clears history) and `saveKey`, the key dirty is measured by.
  `SheetCanvas` also turns off Excalidraw's own open, save and export and draws
  the ☰ menu with the app's file items and, as its last line, the build stamp
  (`__BUILD_STAMP__`, plain text); its handle carries `root`, the box it
  shares with the overlay. `fileRoutes.ts` takes the file keys and scene-file
  drops from Excalidraw, and measures the space beside the ☰ button
  (`useBesideMenu`). `layers.ts` records where overlay
  content sits among Excalidraw's DOM layers, and the dark theme's filter.
  `addMath.ts` is Add math: a public custom tool (`startPlacing`,
  `cancelPlacing`, `isPlacing`) and `watchPlacing`, which turns the placing
  click into a new anchor, selected in the same write, and holds the crosshair.
  `mathAnchor.ts` also has `removeAnchor`, the one-step removal of an element
  left empty. `SheetCanvas` draws the welcome screen, and the app's two
  items in Excalidraw's More tools dropdown: Add math and Math Settings, which
  opens the Sheet panel. `moreTools.ts` finds the open dropdown
  (`useMoreToolsSlot`, a box of the app's own appended to it), closes it
  (`closeMoreTools`) and marks its button while it is closed (`markMoreTools`:
  `data-math-placing`, `data-math-problems` and `--math-problems`). Excalidraw
  has no slot for it, so `moreTools.excalidraw.test.tsx` pins the class names.
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
  (raw source). `lineForm.ts` (pure) reads a line's comment and its format clause
  (`@bold @text-red @yellow`, from the first `@` outside a string) before math.js
  sees it (ADR 0005), so a note or a format never reaches math.js. A word with
  `if <condition>` is a rule (`FormatRule`, kept as typed); `writeFormat`
  composes the plain words back for the bar in a fixed order and keeps every
  rule. A math line carries its `LineFormat` (bold, underline, highlight, text
  colour); an unknown clause word is the line's error, reported after the line
  ran. `typeset.ts` is the
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
  disabled in place on `math.typed`. The app units (`appUnits.ts`: `cP`,
  `gpm`, ...) are registered once at setup, before `createUnit` is disabled,
  and every unit system is then put back as it was, so they show only where
  written (spec section 14; a test compares with an engine without them).
  A result's `text` is its plain form at 4 significant digits
  (`numbers.ts`, pure: `math.format` with `formatOptions`, then `1.235·10⁴`,
  `∞`); `resultTex` typesets it (`1.235 \cdot 10^{4}`). Source numbers are
  never reformatted. `pump-sizing.test.ts` runs the acceptance sheet's lines,
  read from `docs/acceptance/pump-sizing.md`, against the reference at 4 s.f.
  (spec section 16). math.js's own unit system stays fixed at SI, so
  units read elsewhere never change a result (#25, ADR 0003). How a result
  shows is the app's formatter, `display.ts` (`createDisplay`, given the
  instance and the captured `parse`, spec section 5): a trailing `in <unit>`
  (`lineForm.ts` takes it off the text, the formatter checks it is a pure
  unit, read outside the sheet's scope) shows the value in that unit,
  balanced if the kind differs; else the kind's unit in the sheet's system
  (`unitSystems.ts`: SI with prefixes by default, SI base, USCS, Custom),
  else a named SI unit (`V`, `ohm`), else composed base units.
  `evaluateSheet(blocks, settings)` takes the system and Digits. An unknown
  display unit is the line's error after it ran. Each `SheetLine` also
  carries its `warnings` (`warnings.ts`, pure, read before the line runs).
  Each function the sheet defines is wrapped once its line has run
  (`functions.ts`, `createCalls`): the wrapper checks the argument count,
  stops recursion at a fixed depth, prefixes an error from its body with
  `in k(1 s): `, and carries `sheetFunction` (name, parameters); `messageOf`
  rewords math.js's errors (a value called, a function used as a number) in
  section 13's words. `table`, `plot` and `solve` can't be assigned.
  **Constants** (spec section 5, `constants.ts`, pure data): every math.js
  constant in groups, some with a short name (`c`, `k`, `R`, `h`), which
  `registerShortConstants` adds to the namespace once at setup. `h` is the
  Planck constant, so the hour is `hr`. A short name the sheet also assigns is
  the sheet's on every line: `SheetScope` (the run's scope) answers math.js
  "Undefined symbol" for it until its line has run, which `explain` words;
  the engine's own reads use `holds` and `peek`. `listConstants` gives the
  Constants tab its rows.
  A **solve line** (spec section 9) is read as text before math.js sees it
  (`solveLine.ts`, pure): a **solved value** is `<name> = solve <lhs> = <rhs>,
  for <unknown> = <from> .. <to>` and a **solve function** is
  `<name>(<params>) = solve …, guess <unknown> = <expr>`; either one with the
  other's clause, or none, is the line's error. Its sides and clause are
  parsed with the captured `parse` and compiled once (`solve.ts`,
  `createSolver`). Each run evaluates the guess or the range's ends in the
  scope at that point with the unknown hidden, then the residual `lhs - rhs`
  in a `LayeredScope` where the unknown wins, reduced to SI numbers, so a
  dimension mismatch is the app's message. `solver.ts` (pure numbers) has two
  searches. `solveNear` steps out from a guess for a sign change, skipping
  points with no value (NaN), then runs Brent to 1e-12 relative, 100
  iterations at most. `solveRange` samples 200 points of the range, runs Brent
  on each sign change, keeps a crossing only if its residual is at most 1e-6
  of its samples' (a pole or a jump isn't a root), and runs a dip pass (golden
  section) for double roots; more than 100 roots is an error. The solved value
  runs once at its line and holds its roots, ascending: one root is a single
  value, several a `SheetList`. It refuses a list in its equation or range
  (an index on one is fine). The solve function defines a wrapped function
  (`sheetFunction.solve`) that solves at each call over the scope as it is
  then. A failure throws a `SheetError`; a guess solve's no root and no
  convergence are marked `outsideDomain`, which the `in f(…):` wrapper keeps,
  so an outer solve counts a trial point where an inner one failed as having
  no value there; every other error fails the outer line at once. A solve's
  details ride on its line's `solveDetails` (and on a line that is just one
  call to a solve function): a guess solve's method, iterations, residual in
  SI and bracket; a range solve's range, points, each root with its residual
  and touching mark, and the crossings rejected.
  **Lists** (spec section 10, `lists.ts`): a `SheetList` holds point results
  (a value or an error) and the first list its line ran over, to name a failed
  point. A range line is read as text (`rangeLine.ts`, `[name =] a .. b [step
  s]`) and `createRanges` steps it in SI numbers, in the start's unit. A line
  whose names include a list runs once per point (`iterate` in `evaluate.ts`):
  each list name bound to its i-th value in a `LayeredScope`, lists paired,
  one compiled expression, no math.js matrices; a point that throws fails
  alone. An aggregate (`min`, `max`, `sum`, `mean`, `count`) over a list is
  worked out first and stands in the node as a bound name (`foldAggregates`).
  A function body that names an outside list fails at its definition. An
  **index** (`indexes.ts`, spec section 3) is the app's: after the parse
  (`parseSheet`), each `name[i]` becomes a call to `__index`, a raw-args
  function in the namespace that reads the name whole and takes its `i`-th
  point, counting from 1 (a single value is a list of one). A name inside an
  index never makes a line iterate (`withoutIndexes`), and `iterate` works out
  an index on a whole list first (`foldIndexes`), so `Q_s[2] + Q_s` reads the
  list. The typesetter shows it as `x_r[2]`, brackets at the baseline. A list
  result is `{ kind: 'list', text, failed }`: its summary, and the line's
  error when points failed. A **table line** (`tableLine.ts`, `table(arg, …)`,
  each argument with its own `in <unit>`) gives `SheetLine.table`: columns
  (header TeX, unit, a header unit slot) and every row's cells in the table
  number form (`tableColumn` in `numbers.ts`: zeros kept, whole columns whole).
  The overlay draws it as a second grid row inside the line's row; a header
  slot is `data-unit-slot="line:column"`, and choosing a unit writes it onto
  that argument (`writeArgumentUnit`). A **plot line** (`plotLine.ts`:
  `plot(x, y1, …)`, then clauses) gives `SheetLine.plot`, a `PlotView` of plain
  numbers in each axis's unit (null for a failed point), marks, failed points
  and settings. `PlotChart.tsx` draws it under the line with Observable Plot,
  loaded once behind `import()` (`plotDrawing.ts`), rebuilt only when the view
  changes; legend and title are HTML, typeset; each failed point's × carries
  its message as `data-tip`. Its ⚙ (`data-unit-slot="line:gear"`, the slot
  target's column `GEAR`) opens `PlotSettings.tsx` on the canvas's click, as a
  unit slot does; each change hands back the clause list, which the overlay
  writes with `writePlotClauses` as one line commit.
  App code must evaluate only
  through `evaluateSheet`: math.js functions that depend on the disabled
  names (`help`, `rationalize`, a `parser()`'s methods) no longer work. The
  only module that imports `mathjs`. Depends on: `mathjs`.
- **overlay** (`src/overlay/`) — renders math elements over the canvas, each
  as a typeset grid (`MathElementView`, spec section 4): rows are CSS subgrids
  of one grid per element (gutter, equation, result after a rule, note), each
  with its own box for the line hit. The equation is one cell holding the
  line's name, `≔` and expression inline, flush left, so `≔` doesn't line up
  between lines (#62). Cells hold KaTeX's HTML,
  loaded lazily by `katex.ts`; until it loads, a line shows as its source. Rows
  are named by their source (`aria-label`) and result cells carry their text
  (`data-text`). `useAnchorSizes` measures each body after every render and on
  a `ResizeObserver` (fonts), waits while `sizeWritesWait`, and writes the
  sizes through the session's `keepClean`. The same hook restores the fixed
  anchor style at every scene change that broke it, also through `keepClean`.
  Each row is drawn at its anchor's opacity (`--math-opacity`), the edited row
  at full. In Excalidraw's dark theme the
  overlay takes its canvas filter.
  The **unit slot** (spec section 5): a result's unit is drawn in its own
  `[data-unit-slot]` span, outlined on its hovered row (a chosen unit has no
  mark, from M4c) (an empty one for a plain input or a dimensionless value).
  The gestures find a slot from the slots' screen boxes (`slotAt`), open its
  field on the canvas's click when the element hasn't moved, and follow hover
  from `pointerMove`; `suggest.ts` (pure) is the suggestions while a line is
  typed (spec section 4): `wordAt`, `suggest` and `accept` over the sheet's
  names above the line (`sheetNames`), the constants, a fixed list of functions
  and the units; `MathOverlay` builds the sources for the open line and
  `LineField` draws the list and takes its keys (Tab, ↓ ↑, Enter, Esc);
  `UnitField` (the field and list, one of the overlay's
  controls that take pointer events) hands back a unit, and `MathOverlay`
  writes it with `writeDisplayUnit` as one line commit. The engine gives each
  line its `unitSlot` (kind, chosen unit, value in the system and in each
  unit of the kind).
  A **problem's message on hover** (spec section 4, Problems): the gutter mark
  and an error's result cell carry it as `data-tip`, never a `title` (the
  overlay takes no pointer events, so a title never shows). The gestures find
  the mark under the pointer from its screen box (`tipAt`, the error cell only
  while it is cut short) on each `pointerMove` over the canvas, and `HoverTip`
  shows it after a rest, short of the Sheet panel; a press, a drag, leaving the
  canvas or a scene or viewport change hides it. Screen only. A **solve's
  details** (spec section 4) use the same tip: a value with `solveDetails`
  sits in a `math-element__detailed` span, dotted underline, whose `data-tip`
  reads `Brent, 5 iterations`, the residual and the bracket; a range solve's
  reads `Scan + Brent, roots found in 1 .. 30 L / s`, the 200 points and each
  root with its residual. A solved value with several roots is a `roots`
  result: up to five written out (`RootsContent`, the unit once in the last
  root's slot), else a count summary (`13 roots, …`), with the details on
  hover. A solve line's range or guess and a range's step are their own TeX
  (`TypesetLine.aside`), set small and grey after the expression. A list's summary (`math-element__summary`)
  typesets its first and last values after the count, and its `data-tip` is
  the line's `listPreview`: three points from each end with their index.
  `MathOverlay` subscribes to the scene (`onChange`, `onScrollChange`) and
  places each element from its anchor's scene position via `viewport.ts`
  (`sceneToStage`, pure). It reads source from the anchors and holds the sheet's
  one **line edit**; `lineEdit.ts` (pure) decides what each way of leaving a
  line writes. It owns the sheet's evaluation: it sorts anchors with
  `readingOrder.ts` (pure) and runs `evaluateSheet` on every keystroke,
  every source change and every change of order, then hands each
  `MathElementView` its lines. The overlay takes no pointer events except the open field
  and its format bar: Excalidraw gets every click and drag. The bar
  (`FormatBar`, in `MathElementView`; its two rows of dots, text colours over
  highlights, are `ColourDots`) writes the clause into the open line's
  text; `MathOverlay` commits it at once and mounts a new field on the
  rewritten text (`LineEdit.revision`). `useSheetGestures` opens, moves and
  leaves the line edit from the events `listenToCanvas` hands it, starts and
  cancels placing (M, Esc) and opens the first line of a placed element.
  `PlacingGhost` draws the new element's box at the pointer while placing. A
  leave that finds the element with no text (`hasText`, in `lineEdit.ts`)
  removes it instead of writing the line. The open line
  is a field over the equation's cells, beside its live result as
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
  and migrations. The session's state carries the settings, and
  `setSettings` changes them. `sheetSession.ts` is the deep module: save, save as, open,
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

- **panel** (`src/panel/`) — the Sheet panel's tabs (spec section 8), drawn
  inside Excalidraw's sidebar, which `SheetCanvas` frames (`SheetPanelSlot`:
  the badge count, the tabs' content, `onChange`). `sheetPanel.ts` (pure)
  turns the evaluated sheet (`EvaluatedElement`s, which `MathOverlay` hands
  out through `onEvaluated`) into Variables groups and Problems rows;
  `SheetPanel.tsx` renders them, and a click asks App to jump.
  `panelMemory.ts` keeps open/closed in `localStorage`. `SettingsTab.tsx`
  edits the unit system, Custom's kind → unit table, Digits and the Result
  colour (`settings.resultColor`, one of the six text colours; App hands it to
  `MathOverlay`, which sets `--math-result` on the overlay) through the
  session's `setSettings` (saved with the sheet, dirty, not in undo); App
  hands the session's settings to `MathOverlay`, which evaluates with them. App does the jump
  (`jumpToAnchor` in `canvas/selection.ts`: scroll, select with `NEVER`) and
  the flash (`MathOverlay`'s `flash`, a row class). Depends on: math, overlay
  (KaTeX).

## Domain

The core loop: define variables with units, see results inline, edit an input
and everything downstream recalculates. Engine: math.js, client-side.
 `ConstantsTab` lists
  `listConstants(settings)`: every built-in constant with its value in the
  sheet's system.
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
- **Placing** — the UI mode between Add math (M or the More tools item) and the click
  that creates the anchor. It is Excalidraw's active tool, never in the scene,
  and no undo step. Esc cancels it.
- **Title** — a math element's optional name: plain text on one line, in
  `customData.title`, shown in a header above the lines. Never evaluated. An
  edit on it is the line edit at `TITLE_LINE` (-1): ↑ on the first line, the
  bar's Title button, or a double-click on the header (`onHeader`).
- **Empty element** — one whose source has no text and that has no title:
  every line is blank or spaces. A comment is text.
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
- **Anchor style** — fixed, except opacity: a thin, dashed grey border with
  sharp corners, and the `#ffffff01` fill. The element's math is drawn at the
  anchor's opacity.
- **Viewport** — `scrollX`, `scrollY`, `zoom` from Excalidraw's app state.
- **Sheet** — all live math elements, in **reading order**: by the top of each
  anchor's visual bounds, then its left, then its id (ADR 0003). Derived from
  positions every time, never stored. The sheet, not the element, is the unit
  of evaluation: one scope, lines top to bottom.
- Invariants: after every scene change, every anchor has the fixed style, and
  restoring it adds no undo step and never makes a clean sheet dirty. After
  every evaluation and pointer release, an anchor's size
  equals its content size (within 0.5 px), and a size write adds no undo step
  and never makes a clean sheet dirty. A line commit's source change is one undo step, and keystrokes are
  none (a commit can also record a nudge or Link edit before it as its own step,
  spec section 6); sheet undo
  never runs during a line edit, because the field is outside Excalidraw's
  container; results are never in a step. Selecting and deselecting are
  Excalidraw's own steps on the same stack (spec section 6). Add math is one
  step, the new element selected in the same write. No element is left empty
  when the edit leaves it: its removal is one step that doesn't write the line,
  so undo brings an emptied element back with its text. Scene coordinates
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
- A variable named like a math.js unit or built-in (`V`, `m`, `s`, `i`, ...)
  shadows the unit below its definition and falls back to the unit above it
  or after it fails (ADR 0003). Both are **warnings** (`warnings.ts`, spec
  section 5): an amber `⚠` in the gutter, its message on hover. So is a
  function body name not defined above. A warning never changes a result.
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
  (`mathAnchor.excalidraw.test.tsx`, with a transparent control). The style
  restore keeps it there, so an anchor can always be grabbed from inside.
- **The style restore runs from `onChange`, with `NEVER`.** It lands before
  Excalidraw records the change that broke the style, so paste styles on math
  adds no undo step (`anchorStyle.excalidraw.test.tsx`, with the control).
  Moved later, it would leave an entry that undoes nothing visible.
- **The reduced panel and the hint are CSS on Excalidraw's DOM**
  (`SheetCanvas.css`): the panel's children that have Opacity
  (`label.control-label`) after them are hidden, and `.HintViewer`'s span is
  replaced through `::after`. Neither is public API;
  `mathSelection.excalidraw.test.tsx` pins the order, the class and the span,
  with a desktop-sized container, since jsdom's 0-wide one gets the phone
  layout.
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
- **The Add math item hands the keyboard to `.excalidraw`.** A clicked button
  keeps focus, and keys aimed at a button are left alone, so Esc wouldn't cancel
  placing and M would do nothing (`App.test.tsx`).
- **Add math selects the new element in its own write.** Starting the tool
  clears the selection, which Excalidraw records; a separate select makes undo
  take two steps when something was selected (`addMath.excalidraw.test.tsx`).
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
- **The header is in the body, above the grid.** So the measured size
  includes it, and each row's `offsetTop` already counts it: the line hit
  needs no offset. The gestures read its box from `[data-title]`.
- **The format bar never takes focus.** Its buttons prevent `mousedown` and
  are out of the tab order: a blur leaves the line. It is absolutely placed,
  so the measured body, and so the anchor, never includes it.
- **A field inside Excalidraw's container is `type="text"`.** Excalidraw
  runs its letter shortcuts on a key from any input that isn't text, number
  or password, so a `type="search"` filter in the Sheet panel lost the
  keyboard to its colour picker on `s` (#99, `App.test.tsx`).
- **A comment's cell is `width: 320px; max-width: max-content; min-width:
  100%`** (`MathOverlay.css`). The percentage fills the row and counts as
  nothing when the grid sizes its columns, so a comment wraps at the width the
  math sets and asks for at most 320 px itself (#98). jsdom lays nothing out:
  check a change here in Chromium.
- **Underline is drawn, not `text-decoration`.** KaTeX's boxes are
  inline-blocks, which a decoration doesn't reach; bold is set on `.katex`
  itself, because KaTeX sets its own font there.
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
- A placed element makes the sheet dirty, and it stays dirty after an empty one
  is removed: the save key counts deleted elements, and undo can bring it back.
- The welcome screen doesn't come back once an element has been placed, even
  if it is then removed: Excalidraw shows it only for a scene that never held
  an element.
- A box grows right and down, so a taller element can overlap the one below
  it. Reading order is by top, so it doesn't change.
- Opacity set on a math element becomes Excalidraw's default for the next
  shape drawn, as for any element. A new math element starts at 100.
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
  before math.js sees a line, and the index right after the parse.
