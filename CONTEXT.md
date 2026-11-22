# Context

Excalimathpad is a single-user, browser-only "calc sheet": the Excalidraw
whiteboard with a layer of live, unit-aware math on top (Mathcad-style). It is
a Vite + React + TypeScript app that builds to static files; there is no
server. v1 target: for anyone, built around Matheus's own engineering work;
free and best effort. M4d adds an Obsidian community plugin built from this
source (`docs/spec-v1.md` section 12a, ADR 0006): **one source, two builds**.
M1 to M5 are built and out, with beta 0.5.0; two betas precede 1.0.0 (spec section 16).

This file holds the model, the terms, the load-bearing rules and where things
are. It is read by every build session, so it has a budget
(`scripts/docs.test.mjs`). Behaviour belongs in the spec, and a module's
description in `docs/context/<module>.md`; [`CLAUDE.md`](CLAUDE.md) says
what to read for an issue and where to write.

## Entry points

- `index.html` → `src/main.tsx` — the web app's entry; mounts `App` with the
  browser's ports: the file pickers, the IndexedDB recovery copy and the
  per-browser memory (`localStorage`: the panel open or closed, its width,
  from 0.5.0 the language, and the Math assistant's setup, 0.7.0).
- `plugin/main.ts` — the plugin's entry (section 12a), built by
  `esbuild.plugin.mjs` into `dist-plugin/` (`main.js`, `styles.css`, a copy of
  the root `manifest.json`). `tsconfig.plugin.json` type-checks `plugin/`.
- `npm run dev | build | build:web | build:plugin | preview | test | lint |
  audit:plugin | test:blocked | test:print | check` — see `package.json`. `build` runs
  `tsc -b` and both builds; `lint` is oxlint, then Obsidian's ESLint rules
  (`eslint.config.mjs`) at `--max-warnings 0`; `check` is lint, the tests, the
  build, the **bundle audit** (`scripts/audit-plugin.mjs`) and the
  **network-blocked run** (`scripts/blocked-run.mjs`) and the **pop-out run**
  (`scripts/popout-run.mjs`: the built plugin with sheet tabs in a second,
  same-origin window, as an Obsidian pop-out), and the **touch run**
  (`scripts/touch-run.mjs`, M4d, #147: the built plugin by touch, Playwright's
  `hasTouch`, at a phone and a tablet viewport, each as Android and as iOS;
  the phone with `Platform.isPhone`), and the **follow run** (`scripts/follow-run.mjs`,
  0.2.1, #191: the built plugin with real keys, the math on its box and the
  caret in view as a line is typed; its header lists the checks), and the
  **panel run** (`scripts/panel-run.mjs`,
  M4e, #198: the Sheet panel's widths, docking, drag handle and 280 px, in
  the built plugin and web app; the sample, #199; the charts, #200; the Page
  row and the page breaks, M5, #80; a rename, #261, and its offer, #262), and the **print run** (`scripts/print-run.mjs`, M5, #81:
  the built web app's and plugin's Print… in Chromium PDFs, read by `scripts/pdf-read.mjs`). `npm test` holds the **typing test**
  (`src/typing.test.tsx`, M4e, #193: the guide's examples and the acceptance
  sheets, a character at a time); `npm run test:probe` is the **odd-values
  probe** (`src/oddValues.probe.tsx`), by hand before a release. `npm test`
  also holds the **sweep test** (`src/math/sweep.test.ts`, M4e, #194: every
  math.js function a line can call, at huge arguments, each inside 1 s, in a
  child process that Node runs from the TypeScript as it is) and the **font
  test** (`src/overlay/katexFonts.test.tsx`, #201: no KaTeX class the guide
  or a sheet draws is in a family the plugin drops). CI installs Playwright's Chromium (the
  version `package.json` pins) for the last six. The network-blocked run and the pop-out
  run also open ☰ → Math guide in the built plugin (M4d, #148).
- `docs/math-guide.md` — the **Math guide** (spec section 8, M4d, #148): every
  form, key and setting, for users, in 17 sections. Both builds turn it into
  elements when the app imports `docs/math-guide.md?guide` (`vite.config.ts`
  and `esbuild.plugin.mjs`, through `src/guide/markdown.ts`), and
  `src/math/math-guide.test.ts` runs its examples in CI.
- `.github/workflows/release.yml` — the **Release button** (section 12a,
  Releases): run by hand on `main` with patch, minor or major. It runs
  `npm version`, `npm run check`, then one atomic push of the commit and tag
  to `main`, then drafts a GitHub release with `dist-plugin/`'s three files,
  `.github/release-checklist.md` (the pre-publish checklist, also in
  `CONTRIBUTING.md`; `scripts/release.test.mjs` keeps them equal) and
  generated notes. Its push starts no other workflow.
- `scripts/version.mjs` — npm's `version` lifecycle script: **one version**
  from `package.json`, copied into `manifest.json`, with a line added to
  `versions.json` when `minAppVersion` (1.7.2) changes, staged so
  `npm version` moves them in one commit. `.npmrc` makes tags `x.y.z` with no
  `v` and the commit "Release x.y.z". The plugin's ☰ stamp is that version
  (`esbuild.plugin.mjs` defines `__BUILD_STAMP__`), and the network-blocked
  run reads it from the built plugin.
- `.github/workflows/ci.yml` — runs `npm run check` on pushes to `main`
  and on pull requests. On a push to `main` its `deploy` job then publishes
  that run's `dist/` to Cloudflare Pages (spec section 12, Hosted build); it
  is skipped while the repository variable `CLOUDFLARE_PAGES_PROJECT` is unset.
- `CLAUDE.md` — the **reading route** and the **writing rule** for a build
  session (spec section 14, M4e, Documents, #192). `scripts/docs.test.mjs`,
  part of `npm test`, holds the documents to it: this file's budget
  (`CONTEXT_BUDGET`), a file under `docs/context/` for each module linked
  below, the spec's section numbers, and every link between these documents
  landing on a file and a heading.
- `docs/spec-history.md` — the built milestones' issue orders, the results
  of Verify first and the decision index, moved out of spec sections 16 to
  18, which keep their numbers. Read on demand only.
- `buildStamp.ts` (repo root, pure) — the build stamp's text, short commit and
  date or `dev`. `vite.config.ts` runs it at build time from `GITHUB_SHA` and
  defines `__BUILD_STAMP__` (typed in `src/buildStamp.d.ts`).

## Modules

One line each: what the module is and what it depends on. Each module's description, its
files, interfaces and how they work together, is in `docs/context/<module>.md`: read it when
an issue touches that module ([`CLAUDE.md`](CLAUDE.md) has the reading route).

- **App** (`src/App.tsx`) — the composition root: fills the shell's slots, wires the sheet
  file to the canvas, the line edit and the Sheet panel, and runs in one of two **homes**,
  the web or a vault. Depends on: shell, canvas, overlay, file.
  [`docs/context/app.md`](docs/context/app.md)
- **canvas** (`src/canvas/`) — everything that knows Excalidraw: the unforked component and
  its handle, the anchor and the only writes into the scene, gestures, sizes, layers, the
  keys of a vault tab and the pop-out bridge.
  [`docs/context/canvas.md`](docs/context/canvas.md)
- **math** (`src/math/`) — the engine: `evaluateSheet(blocks)` gives each line its result
  and its typeset form, and never throws; `limits.ts` refuses a call that would build more
  than 10,000 values or freeze, before math.js runs it. Reads the app's line forms before math.js
  (ADR 0005). `planRename` (`rename.ts`, 0.5.0) plans a rename from that same reading.
  Depends on: `mathjs`. [`docs/context/math.md`](docs/context/math.md)
- **overlay** (`src/overlay/`) — draws math elements over the canvas as typeset grids, and
  holds the line edit, a rename's offer, the unit slot, tables and plots. Depends on: canvas, math, print, text, `katex`
  (lazily). [`docs/context/overlay.md`](docs/context/overlay.md)
- **file** (`src/file/`) — the sheet file (ADR 0004): format 2 and its migration from 1, the
  session (save, open, the clean mark, the recovery copy) over ports, and the vault's
  sheet. Depends on: canvas (file routes, layers), text.
  [`docs/context/file.md`](docs/context/file.md)
- **plugin** (`plugin/`) — the Obsidian plugin (ADR 0006), the only code that imports
  `obsidian`: the `Plugin`, the `TextFileView`, and their tests against a fake `obsidian`.
  Depends on: App, file, panel memory. [`docs/context/plugin.md`](docs/context/plugin.md)
- **guide** (`src/guide/`) — the Math guide in the app: `docs/math-guide.md` turned into
  elements at build time, and its dialog. Depends on: nothing.
  [`docs/context/guide.md`](docs/context/guide.md)
- **panel** (`src/panel/`) — the Sheet panel's tabs, drawn inside Excalidraw's sidebar:
  Variables with its rename form, Problems, Format with its Rules list, Symbols, Constants and Settings.
  Depends on: math, overlay (KaTeX), print. [`docs/context/panel.md`](docs/context/panel.md)
- **print** (`src/print/`) — the print pages (spec section 11): `printPages`, one pure function
  from the scene's boxes, the overlay's measured rows (`printRows`) and the Page to the pages and
  their breaks; the print view, drawn in any document; and Print… (`printSheet`). Depends on: text. [`docs/context/print.md`](docs/context/print.md)
- **text** (`src/text/`) — the app's own words: two text tables of one shape (`en.ts`,
  `ptBR.ts`) and the reader (`words.ts`), which answers the language Excalidraw shows, for
  React and for code outside it (0.6.0). Depends on: math's message types. [`docs/context/text.md`](docs/context/text.md)
- **assistant** (`src/assistant/`) — the Math assistant (0.7.0, ADR 0008), reached only through
  the two ports a home hands App. Off in every build until its switch is turned on; so far the
  ports, the provider constants, the setup (one record per device) and its card. Depends on: text.
  [`docs/context/assistant.md`](docs/context/assistant.md)
- **failure** (`src/failure/`) — unexpected failures (spec section 4): the boundary, the
  failure screen, Copy details and Report this error. `App` wraps the sheet in the view's
  boundary. Depends on: text. [`docs/context/failure.md`](docs/context/failure.md)
- **shell** (`src/shell/`) — full-viewport layout with three slots: `canvas`,
  `overlay` (stacked exactly over the canvas, pointer-transparent by default)
  and `sidePanel` (docked right). Empty (falsy) slots render nothing. The
  overlay slot is `overflow: clip` and is never scrolled (0.2.1, #191: the
  browser scrolls a `hidden` box to show a focused field, which drew the math
  away from its box); only the canvas's pan and zoom move its content. Neither
  slot sets a z-index (see Load-bearing). Interface: the `AppShell` props.
  Depends on: nothing.
- **test setup** (`src/test/`) — jsdom stubs for browser APIs Excalidraw
  touches on mount (canvas, fonts, matchMedia, ResizeObserver, which tests can
  fire), helpers for tests against the real Excalidraw, body sizes for the
  size tests (`layout.ts`) and readers for the grid (`sheetView.ts`). KaTeX is
  loaded before the tests run. Not app code.

## Domain

The core loop: define variables with units, see results inline, edit an input
and everything downstream recalculates. Engine: math.js, client-side.
- **Math element** — a block of math.js source, one statement per line
  (assignment is plain `=`), anchored at a scene position, plus one
  **result** per line: a value with unit (`20 V`), an error (message), or
  empty. It shows as a grid of **typeset rows**. A line starting with `#` is
  a **comment line**, and so is one whose code is only a format clause, the
  comment's format (`@bold @L # Pumps`, M4d); the text after the first `#` on
  a line with code is its **note**; neither reaches math.js.
- **Stored format** (M4e, #195) — a line's format clause, its words and
  rules, kept beside the line and not in its text: `customData.formats`, one
  clause per line of `source`. A clause typed in a line is read in front of
  it, and moves into it at the line commit (spec sections 3 and 7).
- **Content size** — the grid's laid-out size in scene units. The anchor's
  size is a copy of it, written with no undo step.
- **Anchor** — the Excalidraw rectangle that carries a math element's
  position, size, rotation and source. Excalidraw owns it (move, select, delete,
  undo); the app writes only `customData.source` and `formats`, the only stored copy.
- **Placing** — the UI mode between Add math (M or the More tools item) and the click
  that creates the anchor. It is Excalidraw's active tool, never in the scene,
  and no undo step. Esc cancels it.
- **Title** — a math element's optional name: plain text on one line, in
  `customData.title`, shown in a header above the lines. Never evaluated. Its
  **title format** (bold, italic, underline, alignment, size, text colour,
  highlight; `MathAnchor.titleFormat`) is kept beside it in
  `customData.titleFormat` as a string of the words that differ from no format
  (`"centre L text-red"`), never read from the text, and set only from the
  Format tab (M4d, #144) and the title field's Ctrl+B, Ctrl+I and Ctrl+U, one
  undo step per press (`writeAnchorTitleFormat`). Emptying the title removes it. An
  edit on it is the line edit at `TITLE_LINE` (-1): ↑ on the first line, the
  Format tab's Edit title ↑ (or ↑ there), or a double-click on the header (`onHeader`).
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
  scene. It writes the element's whole source and its stored formats once, in
  one write, as one undo step, so a split or a join is one step too.
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
  throws, and a failed line does not stop the lines after it; a throw of the
  app's own on a line, its parse included, is that line's error (spec section
  4, Unexpected failures). A line sees only
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
  section 5): an amber `⚠` in the gutter, its message on hover, shown only
  while its element is being edited or the line flashes (M4d). So is a
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
  without the app; jsdom runs Excalidraw's hit-testing. **Two taps reach the
  app first** (M4d, #147): Excalidraw 0.18.1's double tap is a native
  `touchstart` listener on its interactive canvas that calls its double-click
  handler itself (on iOS it also cancels every touch, so no `click` follows a
  tap). A `dblclick` listener never sees it, so the app's capture
  `touchstart` on `root` keeps Excalidraw's count (300 ms, one finger) and
  runs first; the contract is in `canvasEvents.excalidraw.test.tsx`, with
  Excalidraw's own double tap as the control, and end to end in the touch
  run. **The Sheet panel is
  the exception** (M4d, #143): it is drawn inside `root`, but a press, click,
  double-click or key there isn't the canvas's (`isInSheetPanel`,
  `panelPresses.ts`), so a press in the panel never leaves the open line. The
  Math guide's dialog (M4d, #148) is drawn there too, and is the same
  (`isInMathGuide`): M typed in it places nothing, and a pointer move over it
  shows no hover from the math beneath. Excalidraw's own `onKeyDown` is a
  React prop on its container, and the dialog's React parent is
  `SheetCanvas`, not Excalidraw, so Excalidraw never hears its keys either.
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
  replaced through `::after`, by a second rule under `data-math-touch` on
  touch. Neither is public API;
  `mathSelection.excalidraw.test.tsx` pins the order, the class and the span,
  with a desktop-sized container, since jsdom's 0-wide one gets the phone
  layout. jsdom applies no stylesheet, so the touch run reads the hint's
  computed `::after` after a tap and after a click, on all four devices.
- **Size writes go through `writeAnchorSizes`, wrapped in `keepClean`.** A
  `NEVER` write also updates Excalidraw's captured copy of the anchor, which is
  why a line commit after size writes is still one step
  (`anchorSize.excalidraw.test.tsx`, with a control). Without `keepClean`,
  every startup and Open would leave the sheet dirty. Writes wait while
  `sizeWritesWait` reads Excalidraw as mid-gesture or in one of its editors
  (drag, resize, rotation, new shape, text or line editor); its flags are
  contract-tested.
- **The body is measured, not the anchor.** `.math-element__body` is
  `max-content` (with a chosen width, that width and `min-width: max-content`,
  its comments asking for nothing, so the laid-out width is never below the
  floor; `floorOf` in `useAnchorSizes.ts` measures the floor by laying the body
  out at no width for a moment) and rotates about the anchor's centre; `offsetWidth` and
  `offsetHeight` ignore transforms, so they are scene units. A body measuring
  0 × 0 isn't laid out (jsdom) and is never written.
- **The Add math item hands the keyboard to `.excalidraw`.** A clicked button
  keeps focus, and keys aimed at a button are left alone, so Esc wouldn't cancel
  placing and M would do nothing (`App.test.tsx`).
- **Add math selects the new element in its own write.** Starting the tool
  clears the selection, which Excalidraw records; a separate select makes undo
  take two steps when something was selected (`addMath.excalidraw.test.tsx`).
- **Source writes go through `writeAnchorSource`,** which takes the lines'
  `formats` in the same write: whatever changes the number of lines must keep
  the two in step (ADR 0002). A rename's several anchors go in one
  `writeAnchorSources`, one undo step (0.5.0). A plain spread isn't recorded
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
- **A control that acts on the open line never takes focus** (spec section
  14, M4d): every Sheet panel control, the Format tab's, the quick keys,
  the bottom sheet's and a rename offer's card included, prevents
  `mousedown` and are out of the tab order (`tabIndex={-1}`), since a blur
  leaves the line. For the panel, `keepPanelPresses` (`panelPresses.ts`)
  prevents every press that isn't on a field, in the bubble phase above
  React's root (the page's document; the view's container in a vault, which
  adds no global listener): Radix's tab trigger switches on its own
  `mousedown` and skips a prevented one, so in capture, or on the sidebar, the
  tabs stopped switching (`panelPresses.excalidraw.test.tsx`, with the
  control). A field in the panel (a filter) takes focus, and so leaves the
  line; a rule's condition field doesn't (M4e, #197): it shares `LINE_FIELD`
  with the line's field, and a blur from one to the other keeps the line. The
  panel's drag handle (M4e, #198) is the one control in the tab order.
- **The Sheet panel's docking width is one value** (spec section 14, M4e,
  #198): `docksAbove(width)` (`src/canvas/panelWidth.ts`), 640 px plus the
  panel's width. `SheetCanvas` passes it to Excalidraw
  (`UIOptions.dockedSidebarBreakpoint`) and answers `panelDocks()` from it;
  App asks only that. A second copy docks the panel where the app thinks it
  floats; the panel run holds it.
- **A field inside Excalidraw's container is `type="text"`.** Excalidraw
  runs its letter shortcuts on a key from any input that isn't text, number
  or password, so a `type="search"` filter in the Sheet panel lost the
  keyboard to its colour picker on `s` (#99, `App.test.tsx`). **A `<select>`
  or a button isn't a field to it either:** Delete on a focused Settings
  `<select>` deleted the selected element. So no key from the Sheet panel
  reaches Excalidraw: `.sheet-sidebar__keys`, a `display: contents` box around
  its tabs, stops each key's React propagation (#143,
  `panelPresses.excalidraw.test.tsx` and `App.test.tsx`).
- **A comment's cell is `width: var(--math-comment-request, 320px);
  max-width: max-content; min-width: 100%`** (`MathOverlay.css`). The
  percentage fills the row and counts as nothing when the grid sizes its
  columns, so a comment wraps at the width the math sets and asks for at most
  320 px itself (#98), scaled by its size (277, 427 or 555 px at S, L or XL,
  M4d). The size sets the request through the variable, not `width`, so the
  chosen width's `width: 0` and the floor's measuring still win over it. jsdom
  lays nothing out: check a change here in Chromium.
- **`customData` holds no nested objects.** Excalidraw compares it one level
  deep when it records a step, so an object inside it differs from the
  snapshot's clone and every later write of the anchor gains an empty undo
  step. The title's format and the lines' `formats` are strings for that
  reason (`mathAnchor.excalidraw.test.tsx`).
- **Underline is drawn, not `text-decoration`.** KaTeX's boxes are
  inline-blocks, which a decoration doesn't reach; bold is set on `.katex`
  itself, because KaTeX sets its own font there.
- **The line field is uncontrolled and remounts per line.** Setting its value
  from code clears the browser's text undo, which is what Ctrl+Z means while
  editing (spec section 6). It is a textarea over a hidden copy of its text
  (M4e, #196): the copy gives the cell its size and the field lies over it, so
  the two must break at the same places (spec section 14); check it in Chromium.
- **The app takes the file keys and drops before Excalidraw**
  (`src/canvas/fileRoutes.ts`): Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+Shift+E, Ctrl+P and
  dropped scene files, on the window in the capture phase. In Excalidraw 0.18,
  Ctrl+Shift+S and Ctrl+Shift+E ignore `canvasActions`, and a dropped scene
  replaces the sheet; each would drop the block (ADR 0004).
  `fileRoutes.excalidraw.test.tsx` holds the contract: the routes are open
  without the takeover and closed with it, and `.main-menu-trigger` and
  `.App-toolbar`, which place the file name, still render.
- **The view's boundary tells the sheet file of a failure during the render**
  (`Boundary`'s `onFail`, spec section 14, M4e), before React unmounts anything:
  Excalidraw empties its scene as it unmounts, so a copy taken in an effect's cleanup would
  be an empty sheet. `fail` returns the kept sheet and ends that sheet file's writes for
  good, so the unmount's own cleanups (the recovery copy's flush, the vault's last save)
  write nothing. React can render one failure twice before it commits: the boundary calls
  `onFail` once. `src/failure/injected.excalidraw.test.tsx` and
  `plugin/test/failure.test.ts` hold it.
- **Excalidraw's `onChange` comes after React commits,** not inside
  `updateScene`. A file flow that has just written a line re-reads the save key
  itself; trusting the last `onChange` misses that line.
- **Static-only build** with relative `base` (`vite.config.ts`). Adding a
  server dependency breaks the deploy model.
- **`src/` never imports `obsidian` or `plugin/`** (section 12a): oxlint's
  `no-restricted-imports` under `src/**` and `plugin/test/boundary.test.ts`,
  which reads every file in `src/`. `plugin/` imports `src/`, never the reverse.
- **The plugin's bundle names no browser storage and reaches no host.** App
  takes the web's ports as props, so `recovery.ts`, `fileAccess.ts` and
  `localStorage` stay out of `main.js`; importing one into App at run time
  fails the audit. `esbuild.plugin.mjs`'s trims and rewrites
  ([`docs/context/plugin.md`](docs/context/plugin.md)) each depend on the
  text of Excalidraw 0.18.1, math.js or KaTeX; the build or the audit fails an
  upgrade that moves one. The audit's allowlist (`scripts/plugin-allowlist.json`)
  says why each host and each library `<style>`/`<link>` site is harmless; its
  `reached` list (0.7.0, #307) is the four built-in providers' hosts, which
  `main.js` names once each and nothing reaches until the assistant is on (#312).
- **Excalidraw's typings give some of its API as `any`** (its `.d.ts` imports
  types the package doesn't ship; `setCursor` indexes a private member).
  `setCanvasCursor` (`addMath.ts`), `clearHistory` (`sceneFile.ts`) and
  `toMathAnchor`'s `angle` state their shapes, so the type-aware lint passes.
- **Obsidian's lint runs over shipping code only**, as the community scanner
  does: tests and Node scripts are left out. Its exceptions are named in
  `eslint.config.mjs`: the web-only modules, `execCommand('insertText')` (the
  line field's own undo), the leave prompt's `returnValue` and, once
  `isDesktopOnly` is false (#147), the lookbehind test in `SheetView.ts`. Its sentence-case
  rule doesn't read JSX text, so UI labels are kept in sentence case by hand.
- **Obsidian's keys pass by Obsidian's own mark** (`vaultKeys.ts`). Its keymap
  hears a key before the view, and a core key it acted on comes marked
  `defaultPrevented`: only then does the view stop it, so the sheet doesn't
  act on it too. Stopping it unmarked would break Obsidian's keys if its
  keymap listened later. The unit field and the plot settings stop every key
  but those. Whether Obsidian marks them is a hand check (spec section 17).
- **The pop-out bridge** (`popoutBridge.ts`, spec section 14). In an Obsidian
  pop-out window the code runs in the main window, so Excalidraw's own
  `window` and `document` listeners and its dialogs (`document.body`) are the
  main window's. The bridge copies a sheet's pointer, touch, `keyup` and
  clipboard events from the pop-out onto the main document (never `keydown`):
  a move and a release from the main body, since Excalidraw's drag reads on
  only for an `HTMLElement` of the code's window; a press keeps its target.
  For a clipboard event it lends the main document the pop-out's
  `activeElement`, `elementFromPoint` and `navigator.clipboard`. It moves a
  dialog box from the main body into the pop-out whose sheet had the last
  press or key (each view notes that on its own container), and gives the main
  body a `removeChild` that finds a moved box. Every one of these is
  Excalidraw 0.18.1's text; the pop-out run fails an upgrade that moves it.
- **Excalidraw keeps one language per window** (0.5.0): `langCode` loads its
  texts for every editor there, and a tab given the new prop before they load
  keeps its toolbar in the old one. So each canvas also follows `useI18n`'s
  `langCode` (`LanguageShown`, `SheetCanvas.tsx`; `plugin/test/tab.test.ts`), and tells
  the reader (`src/text/words.ts`, 0.6.0), the one answer the app's own words read.
- **Callbacks handed around unbound are function properties**, not methods
  (`SheetSession`, `DialogHost`, the scene store): the type-aware lint's
  `unbound-method` holds them to it.

## Incidental

- Excalidraw loads its canvas fonts (Excalifont etc.) from the esm.sh CDN by
  default; UI fonts are bundled. Fine online; self-host them if offline use
  matters (`window.EXCALIDRAW_ASSET_PATH`).
- The production bundle is large. The entry chunk (`index-*.js`) is about
  2.23 MB (689 kB gzip): math.js `create(all)` is about 170 kB gzip of that
  (accepted for v1; trimming to fewer factories is a later follow-up) and
  nearly all the rest is Excalidraw. A separate ~1.8 MB chunk is loaded only
  by Excalidraw's font-subset worker. Vite's chunk-size warning is expected.
- `npm audit` reports advisories in Excalidraw's transitive deps (mermaid,
  katex, nanoid, lodash-es); the only "fix" downgrades Excalidraw to 0.17.
- `test.server.deps.inline` for Excalidraw in `vite.config.ts` exists because
  its ESM build imports JSON without import attributes, which Node rejects.
- In Excalidraw's phone layout (a narrow window), ☰ moves to the bottom bar and
  the file name, placed beside it, sits under that bar, so it doesn't show. The
  web app targets desktop Chrome and Edge; in the plugin Obsidian's tab title
  names the file.
- Where the Sheet panel floats (an editor at or below its docking width), it
  covers Excalidraw's More tools; its ✕ closes it.
- The plugin's `main.js` is about 3.40 MB and `styles.css` 0.56 MB; the audit
  fails either over its budget (`BUDGET`, about 5% above, #203) or above
  5,000,000 bytes, Obsidian Sync Standard's cap.
- Excalidraw 0.18.1 listens on the global `document` (copy, cut, paste, `keyup`,
  pointer moves and ups, scroll and others) and `window` (resize, blur, focus,
  message, unload) by itself. The plugin's own code adds none
  (`plugin/test/SheetView.test.ts`, against Excalidraw alone). In a pop-out
  window the bridge carries them across (#137).
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
- A height-only drag of a handle snaps back but still marks the sheet dirty:
  Excalidraw changes the scene while the handle moves (spec section 4). A
  width change marks it dirty because it changes the sheet.
- A chosen width re-wraps comments on release, not while the handle moves:
  the overlay lays the body out from the stored width (spec section 17).

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
- [ADR 0006](docs/adr/0006-plugin-bundles-the-app-from-one-source.md) — the
  Obsidian plugin bundles the whole app from the same source: `plugin/` is the
  only code that imports `obsidian`, built by esbuild into one `main.js`, with
  no network and nothing stored outside the vault (M4d; the bundle and the
  view are built, #135, and the tab's chrome, #137).
- [ADR 0007](docs/adr/0007-engine-returns-message-codes.md) — the engine
  returns message codes (0.6.0).
- [ADR 0008](docs/adr/0008-math-assistant-calls-the-users-provider-directly.md) — the
  Math assistant calls the user's provider directly, with the user's key, only on a press
  (0.7.0, not built yet).
