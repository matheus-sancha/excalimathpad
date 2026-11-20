Research for wayfinder ticket #255, 2026-11-20.

# Does the app start on a pinned Excalidraw canary, and how do the five new items behave with math elements?

[Which of the nine Excalidraw items go in 0.5.0, which wait, and which are refused?](https://github.com/matheus-sancha/excalimathpad/issues/234)
put five canary-only items in 0.5.0: sticky notes, draw to shape, bucket fill, lasso selection and
the Preferences menu. [The research before it](https://github.com/matheus-sancha/excalimathpad/blob/69ea8af2b0237200f02bb9936e55a6cf4425b92c/docs/research/excalidraw-nine-items.md)
could not run them. This
note is the run. It recommends nothing: the rules are the next ticket's.

## How each fact is marked

- **[O]** observed in headless Chromium, with real keys and mouse, on the plugin built from the
  throwaway copy and started against the repository's fake `obsidian`, as the repository's own
  runs start it. The sheet is the pump sheet in one math element, with a three-line element above
  it (`a = 2 m`, `b = a * 3`, `c = b / 4 s`). The scripts are in
  [`excalidraw-canary/`](excalidraw-canary/), named by their number.
- **[T]** from the repository's own tests and Playwright runs, run on the throwaway copy.
- **[C]** read from the canary package, `@excalidraw/excalidraw@0.18.0-9fbeaed`.
- **[I]** inferred from the facts beside it. Nothing marked [I] was run.
- **Not run** is said in words, and collected at the end.

The base is `main` at `dccc624`: the code of 0.4.1, on Excalidraw 0.18.1.

## Answer

**Yes: with 24 lines added and 27 removed in six source files, and the one line of the pin, the
web app and the plugin both build and start on the canary, the pump sheet typesets all 43 lines, and no page error or network request
was seen in any probe [O].** That is "starts", not "works": 35 of 2,196 unit tests and three of
the six Playwright runs fail, and the plugin fails its bundle audit [T].

**All five items run. Each one meets a math element in a way the upgrade has to decide on:**

| Item | What was seen with a math element | What it leaves to decide |
|---|---|---|
| **Sticky notes** | A note is drawn under the math, never over it, and its text collides with the math's. 0.4.1 opens the file, shows the note's text with no note, says nothing, and its next save writes the file without the note | The file: a note is lost silently by an older build |
| **Draw to shape** | A stroke into a math element becomes an arrow bound to its anchor. The arrow doesn't follow when the element grows | Nothing new: it is the known limit of a bound arrow (#44) |
| **Bucket fill** | A click anywhere inside a math element colours the whole element, the pump sheet's too. The fill keeps its size when the element grows or shrinks | Whether a fill inside a math element is allowed, and what happens to it on a size write |
| **Lasso selection** | Selects math elements, skips a locked one. While the lasso is the active tool, Enter and a double-click open no line | Whether the app's gestures act under the lasso tool |
| **Preferences** | Twelve entries, each its own component, so the app chooses which show. None is remembered after a reload in either home, except the grid, which is in the sheet file. View mode stops line edits, but **M and a click still place a math element** | Which entries show; where each is remembered; view mode |

**Three findings nobody asked about, each larger than the five items:**

1. **Tab pressed twice on a selected math element turns its anchor into a diamond, and its math
   is no longer drawn** [O]. The source stays in the file and Ctrl+Z brings it back, but the
   element looks deleted and its names leave the Variables tab.
2. **A selected math element shows Excalidraw's whole properties panel** (stroke, background,
   fill, stroke width, stroke style, sloppiness, edges, opacity, layers, actions), not the reduced
   one [O]. The CSS that hides those sections no longer matches.
3. **The plugin's bundle audit fails on six counts** [T]: both size budgets, three uses of
   `localStorage` by Excalidraw itself, a `<style>` element made at run time by a new dependency,
   and two new hosts.

## The pin

- **The version: `0.18.0-9fbeaed`** [O], npm's `next` tag, published 2026-11-17. It is the newest
  canary, and the one the earlier research read. Nothing newer existed on 2026-11-20. A canary is
  a build of whatever was merged that day, so "the newest" is the only reason for this one.
- **In `package.json` it is an exact version,** `"0.18.0-9fbeaed"`, in place of `^0.18.1` [O]. A
  caret range would not do: a prerelease tag isn't ordered against the next canary's.
- **The lockfile** changes by 1,445 lines added and 1,186 removed: 52 packages added, 105
  removed, 25 changed, 662 in all against 715 [O]. The canary brings three packages of its own
  at the same version (`@excalidraw/common`, `element`, `math`) and
  `@excalidraw/mermaid-to-excalidraw` 3.6.0 in place of 2.2.2 [O].
- **`npm audit`** reports 14 advisories (1 high) on the canary, against 22 (9 high) on 0.18.1
  [O]. Fewer, not none.
- **The plugin's trims and rewrites still run** [T]: the build prints "21 fonts inlined and 209
  paths local:", as on 0.18.1, and the network-blocked run passes, with every font from a
  `data:` URL and no request. Web Embed and Mermaid to Excalidraw are still hidden in the plugin's
  More tools [O]. Whether each trim still removes what it is meant to was read only through
  those two results.
- **The canary's Portuguese** is one file of 31 kB, against about 22 kB on 0.18.1 [C].

## The code that had to change

The whole of it is [`excalidraw-canary/canary.patch.txt`](excalidraw-canary/canary.patch.txt).
With only the package swapped, `tsc -b` gives 50 errors, the same as the earlier research found
[O]. After these, none outside two test files:

| Change in the canary | Where | Size |
|---|---|---|
| `excalidrawAPI` prop is `onExcalidrawAPI` | `src/canvas/SheetCanvas.tsx` | 1 line |
| `ToggleTheme` needs `allowSystemTheme` | `src/canvas/SheetCanvas.tsx` | 1 line |
| `scrollToContent` is `setViewport({ target, fit, animation })` | `src/canvas/selection.ts`, `src/canvas/sceneFile.ts` | 2 lines each |
| `restore` is gone; `restoreElements` and `restoreAppState` stay | `src/canvas/sceneFile.ts` | 7 lines |
| `exportToSvg` is `exportScene({ type: 'svg', data, config })` | `src/canvas/printScene.ts` | 12 lines |
| `appState.editingLinearElement` is `selectedLinearElement?.isEditing` | `src/canvas/anchorSize.ts`, `src/overlay/useSheetGestures.ts` | 1 line each |

These were written to start the app, not to be right. The print run passes on them, so the
drawings on a printed page come through `exportScene` [T]; the others were not checked beyond
the runs below.

## Each of the five

### Sticky notes

- **The tool** is in the toolbar, with the key `N`. It took the image tool's place there: the
  image tool is now "Insert image" in More tools, with the key 9 [O].
- **A click places a note 250 × 250, centred on the click,** with its text editor open. In the
  scene it is two elements: a `stickynote` and the `text` bound to it [O].
- **Over a math element, the note is under the math.** Clicked onto the three-line element, the
  note was added above both anchors in the scene's order, and the math is still drawn over it:
  the overlay paints above Excalidraw's canvas. The note hides the anchor's dashed border, and its
  text and the math's are drawn through each other
  ([picture](excalidraw-canary/sticky-note-over-math.png)) [O].
- **A double-click on a math line under the note opens the note's text,** not the line [O]. That
  is the app's rule today: a drawing on top keeps its double-click.
- **In the file** a note is `"type": "stickynote"` with the usual fields and one new one,
  `baseHeight`; its text is a `text` element with `containerId` and two new fields,
  `baseFontSize` and `labelPosition`. The block still says `"format": 2` [O].
- **0.4.1 opening that file:** it opens with no message. The note is gone and its text is shown
  loose, where it was ([picture](excalidraw-canary/sticky-note-opened-by-0.4.1.png)). After one
  edit of a math line, the file in the vault holds `rectangle`, `rectangle`, `text`: the note is
  no longer in it [O]. So a sheet with a sticky note, opened and edited once on a device still on
  0.4.1 (or on 0.5.0, if the upgrade ships after it), loses the note for every device.

### Draw to shape

- **The tool** is in More tools, with the key Shift+X. It stays active after a stroke [O].
- **A rough rectangle beside a math element became a `rectangle`,** a plain drawing with no
  `customData`, so not a math element [O].
- **A stroke from that rectangle into the math element became an `arrow` bound at both ends,**
  its end to the anchor (`endBinding` on the arrow, the arrow in the anchor's `boundElements`)
  [O].
- **The arrow doesn't follow a size write.** A line edited so the element grew from 203 to
  537 px wide left the arrow where it was, now ending inside the element
  ([picture](excalidraw-canary/arrow-after-growth.png)) [O]. This is the limit `CONTEXT.md`
  already names for any bound arrow (#44); draw to shape makes such arrows easier to draw.

### Bucket fill

- **The tool** is in More tools, with the key `B`. It stays active after a click [O].
- **A fill is a `line` element** with `polygon: true`, no stroke and a background colour, the
  size of the region, placed just under the element that bounds it in the scene's order [O].
- **Inside a drawn rectangle** it fills the rectangle. **On open canvas** it does nothing, with
  no message [O].
- **Inside a math element it colours the whole element.** A click in the three-line element
  added a fill of exactly the anchor's 203 × 97; a click on a line of the pump sheet added one
  of 1,029 × 2,262. The anchor's own style is untouched (`#ffffff01`, the grey dashed border)
  [O]. So the anchor's border bounds a region, as the earlier research inferred.
- **The math still works over a fill:** a click selects the anchor, a double-click opens the
  line [O].
- **The fill keeps its size.** After the element grew to 537 px wide the fill was still 203 px,
  so it covered the left part only ([picture](excalidraw-canary/bucket-fill-after-growth.png));
  after it shrank back, the same [O]. A fill is its own element: it moves only if it is selected
  with the anchor.
- **A second bucket click on a fill recolours that fill** and adds nothing [O].
- **0.4.1 keeps a fill:** the file with one, opened and edited in 0.4.1, still holds the `line`
  with `polygon` and its colour [O]. A fill is not a new element type.

### Lasso selection

- **The tool** is in More tools, with no key [O].
- **A loop around a math element, a drawn box and a locked math element selected the first two**
  and skipped the locked one, as the marquee does [O].
- **The tool stays the lasso after a selection.** Esc clears the selection and goes back to the
  selection tool [O].
- **With one math element lassoed and the lasso still active, Enter opens no line and a
  double-click on a line opens none** [O]. Both work again after Esc and a click. The app's
  gestures act only under the selection tool.
- **A lasso drag that starts inside a math element draws the lasso;** it doesn't move the
  element [O].

### The Preferences menu

`MainMenu.DefaultItems.Preferences` isn't in the app's menu until the app adds it: the probe
added it under Dark mode ([`probe-hook.patch.txt`](excalidraw-canary/probe-hook.patch.txt)).

- **It is a submenu of twelve entries** ([picture](excalidraw-canary/preferences-and-minimap.png))
  [O]: Select on (Wrap or Overlap), Input (Trackpad or Mouse), Tool lock (Q), Snap to objects
  (Alt+S), Toggle grid (Ctrl+'), Zen mode (Alt+Z), View mode (Alt+R), Minimap, Canvas & Shape
  properties (Alt+/), Arrow binding, Snap to midpoints, Toolbar hints.
- **Each entry is its own component** (`Preferences.ToggleZenMode`, `Preferences.ToggleMinimap`
  and ten more), and `Preferences` takes children, so the app can show any subset [C].
- **Every entry pressed with a line open:** opening ☰ leaves the line, and what was typed is
  committed (`b = a * 3 + 7 m` was written each time). No entry lost text [O].
- **Zen mode:** a line still opens by double-click and takes typing, and M still places. ☰, More
  tools and the Sheet panel were all still there [O]. What zen mode hides was not measured.
- **View mode:** Excalidraw's toolbar and More tools go, and ☰ loses Reset the canvas and Canvas
  background. A click selects no math element, and a double-click and Enter open no line [O].
  **But M and then a click placed a new math element, with its first line open** (two elements
  became three) [O]: the app's own tool writes the scene in view mode. The Sheet panel stays, with
  all six tabs. Whether its Settings still change the sheet there was tried and not established.
- **Minimap:** a 200 × 140 map at the bottom left, over the sheet, with its own button beside
  the zoom. A math element shows in it as a grey box with no math
  ([same picture](excalidraw-canary/preferences-and-minimap.png)). Lines open and M works with
  it on [O].
- **What is still set after a reload:**
  - **The plugin:** nothing. Five entries were left changed (snap to objects, snap to midpoints,
    arrow binding, toolbar hints, the minimap); after a restart with the same `data.json` and the
    same browser storage, every one was back at its default. `data.json` held
    only `{"sheetPanel": true}`, and `localStorage` was empty [O].
  - **The web app:** nothing. Five entries and Dark mode were changed; after a reload all were
    back, Dark mode too. `localStorage` held only the app's own `excalimathpad.sheetPanel` [O].
  - **The grid is the exception:** `gridModeEnabled` is one of the keys Excalidraw's scene JSON
    saves, so it is in the sheet file and comes back with the sheet [O]. It is the file's, not
    the device's.
  - So where a preference is remembered is all the app's to build: Excalidraw persists none of
    them for a host app.
- **Excalidraw's own `localStorage` code is in the bundle** [T]: a "compact or full" setting for
  its properties panel, and a feature-flags key (`excalidraw-feature-flags`). Neither was written
  in these runs, but Obsidian has a `localStorage`, and the plugin's rule is that nothing is
  stored outside the vault.

## Tab on a selected anchor

- **One Tab** on a selected math element opens Excalidraw's shape switch
  (`ConvertElementTypePopup`); the element is unchanged [O].
- **A second Tab converts the anchor to a `diamond`.** The element keeps `customData.kind` and
  its source, and its fill and dashed border, but the app reads an anchor only while it is a
  rectangle: the math is no longer drawn, a dashed diamond is left, and its names are gone from
  the Variables tab ([picture](excalidraw-canary/tab-twice-diamond.png)) [O].
- **The file** then holds `"type": "diamond"` with the source in `customData` [O]. What 0.4.1 or
  a later build does with such a file was not run.
- **Ctrl+Z** brings the rectangle and the math back [O].
- While a line is open the field has Tab (the suggestions). This is Tab on a selected element
  with no line open.

## What breaks

On the throwaway copy with only the patch above, so the Preferences menu isn't in it.

**Unit tests: 35 of 2,196 fail, in 12 of 86 files** [T] (351 in 26 with only the package swapped).

| Contract | Failing | What the failures say |
|---|---|---|
| **Undo steps** of a source write, a format, a title, a split, a join, a width, a size write followed by a commit | 18, in `mathAnchor`, `MathOverlay` and `anchorSize` tests | A step is there where none is expected, or an undo takes back the wrong amount. This is the version comparison `CONTEXT.md` says "has to change at the next Excalidraw upgrade" |
| **The toolbar:** the image tool as a radio in a label | 7, in `imageTool`, `vault` and `App` tests | No radio: tools are `<button>`s, and the image tool moved into More tools. The vault's image picker hangs on it |
| **More tools' items and the plugin's hidden items** | 2 | The lists differ: Excalidraw's own items are more, and in another order. Web Embed and Mermaid to Excalidraw are still hidden on screen [O] |
| **The reduced panel and the hint** | 3, in `mathSelection` tests | The panel's children aren't where the CSS expects. On screen: the whole panel shows for a math element [O]; the app's hint still shows for one [O] |
| **Gestures** on a locked math element over a drawing, and Esc's control | 3 | A selection the test expects isn't made |
| **Copy and paste** of an anchor | 2 | The pasted element doesn't arrive in jsdom. With real keys in Chromium, Ctrl+C, Ctrl+V and Ctrl+D each add the element, as on 0.4.1 [O] |
| **The saved app state** | 1 | One new key is saved: `lockedMultiSelections` |
| **No global listener** | 1 | The view adds `document keydown capture` beyond what Excalidraw alone adds |

`layers.test.ts` passes: Excalidraw's z-indexes are where the overlay needs them [T].

**The six Playwright runs** [T]:

| Run | Result |
|---|---|
| Network-blocked | Passes: math, a table, a plot, an image, CJK text, the Math guide, no request, no `<style>` at run time |
| Follow | Passes, all 117 checks |
| Print | Passes, all 61 checks |
| Pop-out | Fails 4 of 40: a copy writes nothing in the main window, the pop-out and a moved tab, and a paste adds nothing in the main window. The other bridge checks pass |
| Panel | Fails 4 of 236, all in docking: at the docking width the panel doesn't float, the drag doesn't go on across it, a press outside doesn't close it, and an edit opens it |
| Touch | The two tablets finish, 28 checks each. The two phones stop at a control the run can't find, after 9 checks that pass |

**The bundle audit fails on six counts** [T]:

| Count | Detail |
|---|---|
| `main.js` over its budget | 4,206,778 bytes against 3,574,000: 632,778 over, and 793,222 under the 5,000,000 cap |
| `styles.css` over its budget | 605,569 bytes against 584,000 |
| `localStorage`, 4 places | Three are Excalidraw's own reads and writes (above); one is a message text |
| A `<style>` made at run time | CodeMirror's style module, a new dependency. The network-blocked run saw none added, so it is made only when that editor mounts |
| `https://drive.google.com` | A new embed pattern, not in the allowlist |
| `https://www.instagram.com` | The same |

**The web app** builds: its entry chunk is 2,708,185 bytes (836 kB gzip) against about 2.23 MB
(689 kB), with a new 296 kB chunk for CodeMirror [O]. It still asks `esm.sh` for canvas fonts,
as today [O].

## Portuguese

Of the five items' labels in the canary's `pt-BR` [C]:

| Label | In Portuguese |
|---|---|
| Lasso selection | "Seleção de laço" |
| Preferences | "Preferências" |
| Sticky note | No entry: shown in English |
| Draw to shape | An empty entry: shown in English |
| Bucket fill | An empty entry: shown in English |

Of the twelve Preferences entries, nine are translated ("Modo Zen", "Modo de visualização",
"Alternar grade", "Encaixar em objetos" and others); Minimap, Toolbar hints and Select on are
not. That an empty entry falls back to English is how Excalidraw's i18n reads it; it was not
seen on screen.

## Not run

- **Inside Obsidian or on a device:** everything here ran in headless Chromium against the fake
  `obsidian`. The keys `N`, `B`, Shift+X, Alt+Z, Alt+R and Ctrl+' against Obsidian's own; a real
  pop-out window's copy and paste; the five items by touch.
- **The web app with a sheet:** only its start, its menu and the reload were run there. The five
  items were run in the plugin's build, which is the same app.
- **Whether a Settings change writes in view mode;** what zen mode hides; the unit slot and the
  plot's settings in view mode.
- **The grid with math:** it draws under the math; whether lines sit on it is the open grid
  issue's.
- **A sticky note on a printed page,** and a fill on one: the print run has neither.
- **What a later build does with a diamond that holds a source.**
- **Why each of the 35 tests fails,** beyond its message: the table groups them by what they
  assert. The undo failures were not traced to the version comparison; they match what
  `CONTEXT.md` and section 14 predict.
- **How much work the upgrade is.** The patch is the least that starts the app. The counts above
  are what is red after it, not an estimate.

## Assets

In [`excalidraw-canary/`](excalidraw-canary/):

- [`canary.patch.txt`](excalidraw-canary/canary.patch.txt): the throwaway change, against `main`
  at `dccc624`. `npm i --save-exact @excalidraw/excalidraw@0.18.0-9fbeaed`, then `git apply`.
- [`probe-hook.patch.txt`](excalidraw-canary/probe-hook.patch.txt): the Preferences submenu and
  `window.__api`, for the probes only.
- `harness.mjs.txt` and `01` to `12`: the probes. Each runs as
  `ROOT=<checkout> OUT=<folder> node <probe>.mjs` after `npm run build:plugin` there; `03`, `09`,
  `11` and `12` read only the DOM, so they also run on `main`, which is how 0.4.1 was compared.
- Six pictures, linked above.

No branch was pushed: this session may push only to its own branch, so the change is kept as the
patch, as the rename prototype was.
