# Spec history

What [`docs/spec-v1.md`](spec-v1.md) no longer needs to say for a build session: the issue orders of the
milestones already built, the results of its Verify first items, and the index of the tickets it came from.
Moved here by M4e (#192), unchanged apart from links. The spec keeps its sections 16, 17 and 18, with
the milestones still being built, the finish line and the items still open. This file is read only on
demand. It records what happened, so it isn't edited to match later behaviour: the spec is.

## 16. Milestones and finish line

The milestone table, the orders of M4e and M5, the road to 1.0.0 and the finish line are in
[section 16](spec-v1.md#16-milestones-and-finish-line) of the spec.

**M1's issue order:**

1. Source in `customData` + undo steps + bare line field and its keys
2. Save, open, recovery copy, ☰ items
3. Gestures and Esc's second press
4. KaTeX grid with the edit field's final layout, auto-size, comments
5. Add math (M), empty removal
6. Reduced panel + hint, Normal font

**M2's issue order** (M1's six are built, #41 to #46):

1. App units and number format, with the pump sheet's CI test (#55)
2. Display unit (`in <unit>`) and unit systems (#56)
3. Warnings: a name that shadows a unit, a fallback to the unit, a body name not defined above (#7)
4. Function and reserved-name messages (#57)
5. Sheet button and panel, with Variables and Problems (#58)
6. Settings tab: unit system, Custom, Digits (#59)
7. Unit slot (#60)

The first four change only what the sheet computes and shows, so the panel and the slot are built on values
that are already right. The slot is last: its list needs the unit systems, and its Sheet units entry the
Settings tab.

**M3's issue order** (M2's seven are built, #55 to #60 and #7):

1. Solver and the value form (#70)
2. Solve functions and nested solves, with the pump sheet's lines 14-28 in CI (#71)
3. Solve typeset and hover details (#72)

The engine comes first, so the nested solve, the open risk below, surfaces in the first two issues; the
typeset form and the hover are built on values that are already right.

**M4's issue order** (M3's three are built, #70 to #72):

1. Ranges and lists, with the pump sheet's `Hs(Q_s)`, `Hp(Q_s)` and 5" column in CI (#74)
2. Range typeset and list hover (#75)
3. Tables (#76)
4. Plots (#77)
5. Plot settings popover (#78)

Lists come first, since tables and plots only show them. The table comes before the plot: it is the simpler
display of the same lists, and it settles the column units the plot axes reuse. The popover is last: it only
writes clauses the plot already reads.

**M4b's issue order** (added on 2026-11-12, built before M5):

1. Deploy on merge to Cloudflare Pages (#83)
2. Build stamp in the ☰ menu (#84)
3. Work-laptop check (#85): closed on 2026-11-14 as superseded. The hosted app doesn't open on the
   work laptop (#115), and M4d's BRAT beta there is the check.

The deploy comes first, since the other two need an address. The check is Matheus's, by hand, and comes
last so the stamp can tell him which build each machine runs. It is done before M5 so a blocked laptop is
known before more is built on it.

**M4c's issue order** (added on 2026-11-13 from Matheus's [improvements batch](https://github.com/matheus-sancha/excalimathpad/issues/88), built before M5):

1. A value out of a list: the index `x_r[1]` (#104)
2. Range solve: the roots found in a range, with the pump sheet's line 26 rewritten in CI (#105)
3. Roots shown, the range typeset, and a range solve's details on hover (#106)
4. Text colours on a line, and the bar's second row (#107)
5. Result colour in Settings; a chosen unit loses its tint (#108)
6. Rules: conditional formats (#109)
7. Chosen width (#110)
8. Title format (#111)

The solve comes first: it carries the milestone's one open risk (its cost is projected, not measured),
and it is the only part that changes what a saved sheet computes. The index comes before it, because a
solve's roots are read with it. The colours follow, since rules and the title's bar reuse the six names;
rules come after both colour issues, since they apply the same words. The width comes before the title,
whose alignment needs a width to align in.

The batch's other items held no decision and went straight to the Engineer, outside this milestone: #98
and #99, both built, and #102.

**M4d's issue order** (added on 2026-11-14 from Matheus's second batch, on the map
[Spec for the second improvements batch and the Obsidian plugin, before M5](https://github.com/matheus-sancha/excalimathpad/issues/114); M4c's eight are built, #104 to #111; built before M5):

1. The plugin bundle: one source, two builds, audited (#135)
2. A sheet in a vault: autosave, New sheet, outside changes (#136)
3. Inside an Obsidian tab: chrome, keys, theme, confinement (#137)
4. Releases: one version, the Release button, the stamp (#138)
5. Warnings show only while editing (#139)
6. `if()` and text: the engine, with the pump sheet's check line in CI (#140)
7. Conditionals typeset as one brace; text and `true` / `false` upright (#141)
8. Comment-line formats (#142)
9. Panel footing: presses keep the line, six icon tabs, open then restore (#143)
10. The Format tab replaces the bars (#144)
11. The Rules list, and joined words (#145)
12. The Symbols tab (#146)
13. Touch: phone and tablet (#147)
14. The Math guide (#148)
15. The community listing (#149)
16. Clean the history, then submit, by hand (#150)

The plugin comes first ("Plugin first"): it carries the milestone's open risks (the bundle, the app
inside an Obsidian view, the review), and once it lands its audits, the network-blocked run and the
zero-warning lint guard every later pull request. The first issue therefore also renames UI text
to sentence case, which the lint needs, so later panel text is born in it. The fourth gives Matheus
a beta on the work laptop, the reason the plugin exists, before the panel work starts; the
work-laptop check of M4b ([#85](https://github.com/matheus-sancha/excalimathpad/issues/85),
closed) is that beta. The first release, `0.1.0`, therefore has no Format tab, so the listing's
screenshot is taken for the version submitted.

The engine follows: the warning rule is the smallest change, then `if()` and text, then their
typesetting, and comment-line formats, all usable typed before any panel exists. The panel footing
comes before every tab that acts on the open line, and the Format tab before the Rules list that sits
in it and the Symbols tab that shares its footing. Touch comes after both the plugin and the panel,
since its controls live in the Format tab and its bottom sheet in the plugin. The Math guide describes
the finished app, so it is the last build issue, and the listing points to it. The history is rewritten
last, once everything is merged, then the plugin is submitted.

**Along the way:**

- **M1's line 2:** `mu = 1.002 cP` shows an unknown-unit error until M2 registers the app units. Results keep
  today's formatting until M2. M1's check doesn't judge values, so neither blocks it.
- **Line 6's warning** is checked at M2, when the shadow warning lands.
- **Settings:** the Settings tab arrives in M2, its Page row in M5. The Print… menu item arrives in M5.
- **Line 26** keeps its guess in the [pump sheet](acceptance/pump-sizing.md) until M4c's second issue,
  which rewrites it as `Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s in L/s` in the same PR as
  the code: CI reads the sheet's lines from that file. Line 14, the Colebrook function, doesn't change,
  and neither does any expected value.
- **The seed:** until Add math (the fifth issue), the untitled sheet started with two seeded elements,
  loaded clean, because an empty sheet had no other way to get a math element. Add math removed them (#45):
  the untitled sheet starts empty, on the welcome screen.

## 17. Verify first

The items with a recorded result. Those still open are in
[section 17](spec-v1.md#17-verify-first) of the spec.

**M1**

- A duplicated or copied anchor keeps its source. **Passed (#41):** Ctrl+D, Alt+drag, copy and
  paste, cut and paste, and a paste after a page reload each give a new id with the same
  `customData`, in Chromium. Ctrl+D used real keys; the others used dispatched events. Alt+drag
  leaves the copy in place, and the dragged anchor keeps its id. Ctrl+D and copy and paste are
  contract tests in `src/canvas/mathAnchor.excalidraw.test.tsx`.
- The unit slot and ⚙ open on `click` while a drag can still start on them (only the stopping form was probed;
  needed from M2). **Passed for the rule (#43):** with the overlay pointer-transparent, a press anywhere on an
  element, its result column included, reaches Excalidraw, which selects and drags as usual, and a `click`
  then reaches the canvas root. A click is that `click` with the anchor's `x` and `y` unchanged; after a drag
  they have changed. In Chromium with real input, a click on the result column of another line moved the edit
  there, and a drag from the same place moved the element and opened nothing. M2 builds the slot on this rule;
  the slot itself is untried. **Passed for the slot (#60):** in Chromium with real mouse input, a click on a
  result's unit opened its field and list, and choosing `bar` wrote `in bar` before the note as one undo step; a
  drag started on the same slot moved the element and opened nothing; Ctrl+Z took back the drag, then the unit.
  `unitSlot.excalidraw.test.tsx` holds both against the installed package, with the slots' boxes stubbed.
- The reduced panel's CSS on `.panelColumn` children, and the hint's replacement through `.HintViewer`.
  **Passed (#46):** in Chromium, the panel's children are Stroke, Background, Fill, Stroke width, Stroke style,
  Sloppiness, Edges, Opacity, Layers, (Align), Actions, and Opacity is the only one with a class of its own
  (`label.control-label`). One rule hides the children that have Opacity after them: one math element showed
  Opacity, Layers, Actions; two showed Align too; a drawing, and math with a drawing, showed the full panel.
  `.HintViewer` holds one `<span>`; hiding it and showing the app's text in `::after` put the hint in
  Excalidraw's own place. With several elements selected Excalidraw shows no hint, so nothing is replaced.
  On touch a second rule, under the canvas's `data-math-touch`, shows the touch wording in the same place;
  the touch run reads the computed `::after` at a phone and a tablet, as Android and as iOS.
- Restoring style with `NEVER` from `onChange`: paste styles on math alone may leave an empty undo entry.
  **Passed (#46), in jsdom on the real Excalidraw:** it leaves none. Without the restore, paste styles changed
  the anchor and added one undo step; with it, the anchor kept its style and the paste added no step, and undo
  and redo moved only through the selection steps. On math with a drawing, the paste reached only the drawing,
  and one undo took it back. Not tried in Chromium: paste styles couldn't be triggered headless, by shortcut
  or context menu.
- Restoring `x` and `y` on snap-back, resizing several selected elements or a group, and a handle on a rotated
  element. **Passed (#44):** in Chromium with real input, the top-right handle moved `y` from 200 to 159 while
  dragged, and letting go restored `x`, `y`, `width` and `height`; a corner handle on an anchor rotated about 81°,
  and the corner handle of a group of two anchors (one rotated), each snapped back the same way, angle kept. The
  first Ctrl+Z after a snapped-back resize only re-selects: the resize step is empty. Contract tests cover a corner,
  the top-right handle and an anchor resized with a drawing (the drawing keeps its resize). Found: the resize still
  marks the sheet dirty, because Excalidraw changes the scene while the handle moves; the content doesn't change.
- Measuring real KaTeX rows: `offsetWidth` and `offsetHeight`, again when a `ResizeObserver` fires as fonts load.
  **Passed (#44):** in Chromium, after `document.fonts.ready` every anchor equals its body (the seed's
  158 × 72 and 188 × 48); rows read 24 px at `offsetTop` 12 and 36, and a fraction row 43 px. The first frame
  shows plain source until KaTeX's chunk loads, then the grid re-renders and the box re-fits. The observer watches
  each body's border box; with Excalidraw's text editor open, a body made wider waited and was written when the
  editor closed.
- Line hit-testing on rows of different heights. **Passed (#44):** with rows of 24, 24, 43 and 24 px, a double-click
  2 px inside the top of row 1, the bottom of row 2, the top of the fraction row and 14 px above its bottom each
  opened that line, in Chromium with real input.
- Rotated elements keeping their rotated top-left, and the half-pixel threshold. **Passed (#44):** typing on an
  anchor rotated about 81° widened it from 188 to 291 px, and its rotated top-left stayed at (703.60, 127.46) to
  0.001 px, in Chromium. Body sizes are whole pixels, so a fit doesn't jitter; the 0.5 px threshold is a unit test.
- A size write not marking the sheet dirty. **Passed (#44):** the seed's anchors shrank to their content on
  startup and the sheet stayed "Untitled", in Chromium. Size writes go through the session's clean mark
  (`keepClean`); App tests cover startup, a re-measure and Open, each failing without it.
- A size write during Excalidraw's own text edit, or while drawing a new shape. **Passed (#44):** writes wait while
  Excalidraw is busy (a drag, a resize or rotation, a new shape, its text or line editor) and go in at its next
  idle change; in Chromium a measure during a text edit waited until Esc. With the wait turned off for the probe,
  a write during a text edit kept the editor, its focus and its text, and a rectangle drawn while writes ran came
  out whole; a write landing mid-draw wasn't confirmed. The wait stays, and contract tests pin its flags: set
  while a rectangle is drawn, an element dragged, a resize handle held or the text editor open, clear after.
- Starting a drag while a line is being edited. **Passed (#43):** the press leaves the line before Excalidraw
  sees it, so the line is one step and the move is Excalidraw's own; Ctrl+Z takes the move, then the line. In
  Chromium with real input and as a contract test.
- Grouped and locked anchors. **Changed (#43):** a click on a grouped anchor selects the group, and
  Excalidraw's double-click enters the group; a locked anchor can't be selected, and Excalidraw's double-click
  adds a text element on it, or labels what lies under it. Now a double-click edits either straight away (see
  Changes), a locked one over a filled drawing or over another math element too. Contract tests; not tried by
  hand.
- Arrows binding to a math element from inside. **Passed (#43):** an arrow drawn from inside binds to the anchor
  (`startBinding`, gap 14) and follows it when it moves, in Chromium and as a test. Kept (see Changes). #44's
  size writes (`NEVER`) won't move a bound end; noted on #44.
- A drawing on top of an anchor: as written, the listeners win, so a double-click there edits math. **Changed
  (#43):** Excalidraw's click selects the drawing on top, so the drawing keeps its double-click (its label), in
  Chromium and as a contract test.
- `#ffffff01` in dark mode and over a drawing. **Passed (#43):** in Chromium, the canvas pixels inside an anchor
  equal the background's (`255,255,255` over white, `255,201,201` over a pink rectangle) in light and dark mode
  (dark is a CSS filter over the same pixels). Found on the way: the math text keeps light-theme colours and is
  hard to read in dark mode (#50).
- Whether Excalidraw's hit-testing runs in jsdom, for the first contract test. **Passed (#43):** a press inside an
  unselected `#ffffff01` anchor selects it, inside a transparent one doesn't, and its stroke does. A drag runs
  when each `pointermove` targets the canvas (Excalidraw drops moves whose target isn't an element), with a
  short wait between moves. The section 14 contract tests run in CI.
- Found in #43: double-clicking another line while editing. The first click moves the edit there, and the second
  lands in the field, where the browser would select the word under the pointer. The field ignores that press, so
  the line opens with the caret at the end, as section 4 says (Matheus, in chat on 2026-11-07: "Caret at end").

**M3, M4**

- The nested solve on the pump sheet (`f_d`, `Q_op`, and the table). **Passed for `f_d` and `Q_op` (#71):** lines
  1-28 match the reference at 4 s.f. in both the 4" and the 5" columns (`Q_op` 18.81 and 25.21 L/s), and 30 calls
  `Hs(1 L/s)` … `Hs(30 L/s)` match the range table's 4" rows. `Q_op` converged in 5 Brent iterations (10 residual
  evaluations, each one Colebrook solve), `f_d` in 6. The table itself waits for M4.
- Run time: the sheet runs 30 Colebrook solves for the table on every keystroke, plus `Q_op`'s nested solves. A
  91-row sweep took 30 ms in the research, so it's probably fine, but measure it. **Measured (#71), in Node under
  Vitest:** lines 1-28 run in about 8 ms (median of 20), 9 ms at 5"; with the 30 `Hs` calls added, about 11 ms
  (38 ms at worst). The pump sheet's CI test pins the whole run under 200 ms. M4 measures the table in the browser.
  **Measured in Chromium (#74):** lines 1-29 plus `H_s = Hs(Q_s)` and `H_p = Hp(Q_s)`, so 30 Colebrook solves per
  run besides `Q_op`'s, take about 6 ms (median of 30 runs, dev build), 11 ms at worst. Re-running the whole sheet
  on every keystroke holds.
- The mark label's position, log scale and `points`, tried only as prototype switches. **Passed (#77), in Chromium:**
  the label sits at the top of its guide, above the frame, with a dot where the guide meets each curve; `x log` and
  `y log` draw log axes fitted to the data (not rounded out to whole decades); `points` puts a dot at every point,
  and `labels direct` names each series at its line end.
- The clause parser and lazy loading of Observable Plot, not built in the prototype. **Passed (#77):** the clauses
  are read in `src/math/plotLine.ts`, with tests for each; Observable Plot 0.6.17 is its own chunk (297 kB, 103 kB
  gzip) requested once the first plot shows, and the entry grew by 9 kB, the app's own plot code. A placeholder of
  the chart's size holds the box until it arrives.

**M4b**

- The deploy command, `wrangler pages deploy dist`, against Cloudflare's current documentation. **Passed
  (#83):** Wrangler 4's own `pages deploy --help` lists the directory, `--project-name`, `--branch` and
  `--commit-hash`, and the wrangler-action's README shows the same command. Cloudflare's documentation site
  couldn't be reached from the build session, so the first deploy settled the rest, on 2026-11-12: a token
  with the one permission Account, Cloudflare Pages, Edit uploaded the build, and with `--branch=main` it was
  served at `excalimathpad.pages.dev`, the production address, where Matheus read the stamp
  `c42e72e · 2026-11-12`. The project was made with `wrangler pages project create excalimathpad
  --production-branch=main`.
- A token that can only edit Pages fails `wrangler whoami`, which reads account details. **Found (#83):**
  `wrangler pages project list`, with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set, is the check
  that matches the deploy.

**M4c**

- The range solve's run time on the pump sheet: `Q_op` over `1 L/s .. 30 L/s`, calling Colebrook with a
  guess at each of the 200 points. Projected at about 10 ms; the whole run must stay under the CI test's
  200 ms and feel instant on every keystroke. **Measured (#105), in Node under Vitest:** the whole pump sheet,
  lines 1 to 31 with its table and plot, averaged 33 ms a run over 10 runs, with line 26 rewritten as a range
  solve. `Q_op` is 18.81 L/s, one root, and the CI test's lines 1 to 28 stay under its 200 ms.
- A range search over a residual with inner failures (the pump sheet's `Hs(Q)` near Q = 0): skipped
  points, not an error. **Passed (#105):** a range from -5 L/s, where the inner Colebrook solve fails below
  zero, finds the root; with no root, the message carries the last inner error
  (`evaluate.test.ts`, nested solves).
- Re-wrapping live while a resize handle is dragged: Excalidraw's frame and the overlay's layout in step
  mid-drag, with the frame held at the floor. If they can't be, re-wrap on release, where the snap-back
  runs today. **Re-wraps on release (#110):** size writes wait while Excalidraw resizes
  (`sizeWritesWait`), so the overlay keeps the stored width until the handle is let go, then lays out at
  the new one. Checked in Chromium with real mouse input: an element with `x = 2` and a long comment,
  dragged to 762 px, ran the comment on two rows with the math at the left; dragged to 256 px, between
  the floor and 320 px, the comment wrapped to it; dragged below the floor, it went back to automatic.
- Excalidraw's resize and the stored `customData.width` landing in one undo step, and Ctrl+Z restoring
  the width before it, or automatic. **Passed (#110):** a `NEVER` write in `onPointerUp` lands in the
  resize's own step; one Ctrl+Z restored the width before it, and automatic for a first width
  (`anchorSize.excalidraw.test.tsx`, and in Chromium).
- A left handle, a rotated element and a group, each setting the width and discarding the height.
  **Passed for a left handle and a group (#110),** in `anchorSize.excalidraw.test.tsx` against the
  installed package: a left handle moves the left edge with the right edge in place, and a group resize
  sets the anchor's width and keeps the drawing's resize. A rotated element keeps Excalidraw's own
  geometry along its axis, and the height is then refit to the content; not checked by hand.
- A title at XL: the header's height, the floor it sets, and the anchor following both. **Passed (#111),**
  in Chromium with real keys and mouse: "Pump @ 50 Hz #2" at XL, centred, red on yellow, gave a 42 px
  header; the anchor grew to fit, and the title kept its characters. Every press on the title's bar
  left the title field focused.

**M4c, also checked in Chromium (#107, #109, #111)**

- A text colour reaching KaTeX's glyphs in the equation and the result, as bold had to (#63): the next item.
- A text colour reaches KaTeX's glyphs: a line with `@text-red` computed `rgb(224, 49, 49)` on the
  equation's glyphs and on its result; its note stayed grey. A rule's colour (`@text-red if v > 3 m/s`)
  showed the same, and a table's rows over a rule's limit took its band. Not checked: the six colours
  under the dark theme's filter.

**M4d**

- The app inside a real Obsidian `TextFileView`, with every listener and portal bound to the view: Excalidraw's
  own keys, its dialogs and its sidebar in a pop-out window. **Not run in Obsidian (#135):** the build session
  wasn't allowed to download and run Obsidian, so the real view is Matheus's hand check (the issue's copy into a
  test vault). Against the fake `obsidian` in jsdom, the view opens the pump sheet with the reference values,
  shows no file chrome, never writes the file, and adds no listener to the global `window` or `document`
  beyond what the unforked Excalidraw adds by itself, measured against Excalidraw alone as the control
  (`plugin/test/SheetView.test.ts`; the same measure finds the web app's own `keydown`, `drop` and
  `beforeunload`). **Found:** Excalidraw 0.18.1 listens on the global `document` for copy, cut, paste, `keyup`,
  `pointermove`, `pointerup`, `scroll`, `touchmove`, `fullscreenchange` and Safari's gesture events, and on
  `window` for resize, blur, focus, message and unload, whatever `handleKeyboardGlobally` is (React adds
  `selectionchange`). In a pop-out window those are the main window's, so a drag or a paste there is the risk
  #137 has to check by hand.
- Two sheet tabs side by side and a pop-out window, each keeping its own keys, panel and dialogs (#137).
  **Side by side, passed against the fake `obsidian` in jsdom** (`plugin/test/tab.test.ts`): M places math
  only in the focused tab, Add math and Toggle Math settings act on the active tab only, Dark mode in one tab
  leaves the other's mode, and Ctrl+P that Obsidian's keymap takes never reaches an open line.
  **Pop-out: failed, then passed with the bridge**, in headless Chromium against the built plugin, with the
  view's DOM in a second, same-origin window as Obsidian makes a pop-out (`scripts/popout-run.mjs`). Before
  the bridge the main window's tab (the control) dragged, placed math, opened Help and pasted; the pop-out's
  tab typeset, but a drag moved nothing, M and a click placed nothing, `?` opened Help in the main window and
  a paste did nothing. **Found on the way:** Excalidraw's drag handler reads on only when the event's target
  is an `HTMLElement` of the code's own window, its copy, cut and paste read the global
  `document.activeElement`, its paste tests `document.elementFromPoint` with `instanceof HTMLCanvasElement`,
  and its copy writes with the global `navigator.clipboard.writeText`. With the bridge
  ([section 14](spec-v1.md#14-engineering-constraints)) every check passes in the pop-out, and in a tab opened in the
  main window and then moved there; the run is in CI (`npm run test:popout`). **Not run in Obsidian:** the
  real Electron pop-out (focus between windows, a dialog opened from ☰ there, the eye dropper) and Obsidian's
  keymap phase (whether it marks a key it took `defaultPrevented`, which the pass-through relies on) are
  Matheus's hand check in a test vault: Ctrl+P from a focused line opens Obsidian's palette, and M adds math
  only in the focused sheet tab, side by side and in a pop-out.
- The bundle under 5,000,000 bytes after the trims, and the network-blocked run making no request with a plot,
  an image and CJK text. **Passed (#135):** `main.js` is 3,434,970 bytes and `styles.css` 642,640 bytes, with 21
  of Excalidraw's fonts inlined and Xiaolai's 209 paths `local:`. In headless Chromium with every non-local
  request blocked, the pump sheet (`plugin/test/pump-sizing.excalimathpad`: the pump lines with their table
  and plot, an image and CJK text) typeset with the reference values, drew the plot and the image, loaded
  Excalifont, Nunito, Assistant and KaTeX's faces from `data:` URLs, and attempted no request. **Found on
  the way**, each now handled by the build or the audit:
  - Excalidraw's own bundle names `localStorage` (its `EditorLocalStorage`, used only by the Publish library
    and Mermaid dialogs): the build rewrites it to no storage.
  - Its build environment holds excalidraw.com's service URLs (`json.excalidraw.com` and others) as well as
    the Firebase key: the build blanks every `VITE_APP_*` value.
  - A file holding an embed would load its iframe (YouTube, Vimeo, Twitter's widget script): the plugin passes
    Excalidraw `validateEmbeddable={false}`, so no embed loads; the web keeps Excalidraw's default.
  - React DOM's resource hoisting and `react-style-singleton` (Radix's scroll lock) contain
    `createElement("style")` and `createElement("link")`, so no bundle with React can pass a plain text check.
    The audit lets through only those library sites, each known by a word near it
    (`scripts/plugin-allowlist.json`), and the blocked run fails on any `<style>` or `<link>` added at run time.
  - Besides XML namespaces and licence comments, the bundle names Excalidraw's Help links and its embed
    patterns. Each host is in the allowlist with why it can't load: a link opens the browser only when
    clicked, and the patterns never match with embeds off.
- `eslint-plugin-obsidianmd` at zero warnings over `src/`, and what the sentence-case rename touches. **Passed
  (#135), after fixes:** the recommended config's first run over `src/` gave 113 problems (77 errors, 36
  warnings). Left out as the community scanner leaves them out (tests and Node build scripts), it gave 63 in
  `src/` and none in `plugin/`, the manifest, `package.json` or `LICENSE`. All are fixed: window timers,
  `ownerDocument` for `document`, a node-name test for `instanceof HTMLCanvasElement`, function properties for
  callbacks passed unbound, a class in place of inline styles while measuring the floor, and typed shapes for
  three Excalidraw members its published typings give as `any` (`setCursor`, `history`, an element's
  `angle`). The config's exceptions are named in `eslint.config.mjs`: the web-only modules (`src/main.tsx`,
  recovery, file access, `FileChrome`, which never reach the plugin, as the audit shows), the deprecated
  `execCommand('insertText')` that keeps the line field's own Ctrl+Z, and the leave prompt's `returnValue`.
  **Found:** `ui/sentence-case` reads Obsidian's API calls and DOM properties, not JSX text, so it can't see the
  app's labels. The rename was by hand: only "Math Settings" (the More tools item's label and tooltip) broke
  sentence case.
- `requestSave` after a line commit and at once on close; a theme change or scroll never writing. **Not run in
  Obsidian (#136):** as for #135, the build session couldn't download and run Obsidian, so the real view is
  Matheus's hand check (the issue's test-vault steps: type a line, wait, close Obsidian, reopen; open and scroll
  a sheet and see its modified time unchanged). Against the fake `obsidian` in jsdom, with the real Excalidraw
  (`plugin/test/vault.test.ts`): a line commit requests a save and the fake's 2 s debounce writes it; closing
  the tab, Obsidian's quit and Save current file write at once, an open line committed first (Save current file
  keeps it open); opening, a wheel scroll, a ctrl+wheel zoom, Excalidraw's own Dark mode key (Alt+Shift+D), a
  line opened and left unchanged, and closing request no save and write nothing. Each of three of these was
  shown to fail with the rule broken (a `save` that always writes, a reload that scrolls, no drop guard).
  **Found:** Obsidian documents neither how a `TextFileView` reacts to its file changing on disk nor whether
  its `modify` event can come before `vault.modify` resolves, so the view hears `vault.on('modify')` itself,
  also takes `setViewData(data, false)` as an outside change, and records the text it writes before the write.
  Both routes, and a real sync, are for the hand check. **Hand check (Matheus, 2026-11-14):** type, close
  and reopen; the unchanged modified time; the idle reload and the conflict copy across a split pane; and
  the round trip with the web app all passed. **Found:** in Obsidian's dark theme the Sheet panel's rows
  took Obsidian's global button style (dark, 30 px, centred), since its `button:not(.clickable-icon)`
  outweighs the app's one-class rules. Fixed by the view's CSS guard ([12a](spec-v1.md#one-source-two-builds)) and
  held by the network-blocked run. A white box near Obsidian's left sidebar after Split right, never
  reproduced outside Obsidian, was gone in Matheus's retest with the guard; the rows matched the web.
- The `equal` / `unequal` text signatures inside the hardened math.js instance, and `if()` with `rawArgs` under
  the custom `toTex`. **Passed (#140), in the app's engine with `import` disabled after them:** the
  signatures merge into math.js's own (`math.import` merges typed functions of one name), and
  `"Approved" == "Approved"` is true, `"Approved" == "approved"` false, `"10" == 10` the app's error;
  `2 == 2`, `1 m == 100 cm`, `true == true` and `[1, 2] == [1, 3]` (`[true, false]`) are unchanged
  (`evaluate.test.ts`, "leaves every other comparison as math.js's own"). `if()` with `rawArgs` runs only the
  branch taken, also per point on a list line and inside a function body, and typesets with the custom
  `toTex` as `\mathrm{if}(…)`, with no error, until #141 draws the brace. **Found:** `? :` keeps math.js's
  truthiness (`0`, `""` and `1 m` as conditions) unless its node changes; the engine replaces
  `ConditionalNode`'s `_compile` on its own instance, which math.js's custom-node guide documents, and a test
  of `0 ? 2 : 3` pins it.
- The brace in KaTeX at the sheet's size, and a three-branch nest flattening to three rows. **Passed (#141):**
  `band = if(sigma < 100 MPa, "low", sigma < 140 MPa ? "mid" : "high")` is one `cases` of three rows, which
  KaTeX renders at `strict: 'error'` (`typeset.test.ts`). In headless Chromium, the built plugin drew it as one
  brace of stacked glyphs (`⎧⎨⎩`) beside the line's name, the result cell reading `mid`, at the sheet's size;
  the quotes are KaTeX_Main's, upright. In the dark theme the brace, the quotes and `true` took the text colour
  as the rest of the math did, and with print media emulated the element drew as in the light theme.
  **Found:** math.js's own `? :` TeX nests a brace in the last branch, and sets a text as `\mathtt{"…"}` and
  `true` as four italic letters; the handler replaces all three.
- With presses from `.sheet-sidebar` skipped in `listenToCanvas` and the panel-wide prevention on `document` in
  bubble: every Format, Rules, Symbols and Constants press keeps the line open with its caret, and Radix's tabs
  still switch. Firefox and Safari, a classic scrollbar press and pen input were not probed (#117).
  **Passed (#143), in Chromium with real mouse and keys** (the dev server at 1400 × 900): with a line open at
  caret 5, a press on each of Problems, Variables, Symbols and Format switched the tab, and the line stayed
  open, focused, caret 5; a press on the panel's background kept it too, and the next key typed at the caret.
  A press in the Variables filter took focus and left the line, as section 8 says. In jsdom the contract tests
  (`src/canvas/panelPresses.excalidraw.test.tsx`) hold Radix's side against Excalidraw 0.18.1: the tab switches
  with the prevention heard above React's root, and doesn't (the control) with it in capture on the document
  or on the sidebar itself. **Found:** the plugin adds no listener to the global `document` (section 12a,
  `plugin/test/SheetView.test.ts` failed on it), so in a vault the prevention sits on the view's container,
  which holds React's root, and is heard after React there too. Firefox, Safari, a classic scrollbar and pen
  input were still not probed.
- `data-prevent-outside-click` keeping the floating panel open, since it is undocumented. **Passed (#143):** at
  1000 × 800, with the panel floating on Format and a line open, a press in the field kept the panel and the
  line; a press on a tab switched it with the line open; a press on the canvas left the line and closed the
  panel. A new element placed at x 760 opened its line on Format and was scrolled to 160–465 px, clear of the
  panel's left edge at 624. The contract test holds the mark, with an unmarked press as the control. Delete
  and R on a focused Settings `<select>`, one math element selected, left the element and the tool.
- Two taps becoming a `dblclick` on iOS and Android, Excalidraw's phone toolbar reaching Add math, and the
  bottom sheet staying above the on-screen keyboard (`visualViewport`). **Found (#147), in Chromium with
  touch, on the built plugin, as Android and as iOS (`navigator.platform`, which Excalidraw reads):** two
  taps don't become a `dblclick` first. Excalidraw's own double tap runs from a native `touchstart` on its
  canvas, so before the fix a double tap on a selected math line opened Excalidraw's text editor on the
  anchor: as iOS it added a label; as Android the browser's `dblclick` came after, the gesture found
  Excalidraw busy, and nothing opened. As iOS a tap sent no `click` at all, so a tap on another line
  didn't move the edit. With the `touchstart` taken first and a touch's click read from its release, the
  touch run passes on both (section 14). Excalidraw's phone toolbar (390 × 844) shows More tools with
  **Add math** and **Math settings**. **Still on a device:** iOS bringing up the keyboard for a line opened
  from a `touchstart`, and `visualViewport` with a real keyboard. The touch run checks the sheet and the
  suggestions against a view that shrinks, as a keyboard that resizes the page does, not against
  `visualViewport` itself.
- Whether Obsidian's review passes without a committed `main.js`, by the preview scan. **Not run from the
  build session (#149):** the preview scan runs on community.obsidian.md, behind Matheus's Obsidian account
  with GitHub connected, so it is his step, on #149's branch before submission ([Listing](spec-v1.md#listing)), and
  its result goes here. Nothing changes on a guess: `main.js` stays uncommitted, and the Release workflow
  commits it only if the scan fails for want of it alone. What the scan meets: `build` is the first of the
  scripts it looks for, and builds both homes (`tsc -b`, then `build:web` and `build:plugin`); Obsidian's
  lint passes at zero warnings over `plugin/` and `src/`, with one named exception that the scan may still
  flag, the deliberate lookbehind in `hasLookbehind` (#147); the README is users first, with Privacy and
  Support; the issue forms and `SECURITY.md` are in place. **Found:** GitHub's private vulnerability
  reporting, which `SECURITY.md` points to, was off, and the build session couldn't turn it on (the
  setting is the repository owner's): Matheus turns it on under Settings → Advanced Security before
  submitting.
- The beta through BRAT (#138, replacing M4b's #85). **`0.1.0` failed on 2026-11-14:** in Matheus's vault,
  every save while a line was open made a conflict copy, and editing the copy made a copy of it. The
  tab's own write was coming back as an outside change: the view compared the text Obsidian handed it,
  which can predate the last write or catch it half-done, and two saves could overlap. Fixed for `0.1.1`:
  saves run one at a time, and any word of a change makes the view read the file afresh once its own
  write has finished (`plugin/test/vault.test.ts`, "the tab's own writes coming back"). Not reproduced
  in real Obsidian from the build session; the `0.1.1` beta is the check. **`0.1.1` passed on 2026-11-14,**
  installed through BRAT on the work laptop and on Matheus's personal machine, each in his own vault,
  in Obsidian 1.15.0 (installer 1.12.7): a sheet opened, lines typed with autosave pauses kept their
  results, and after closing and reopening Obsidian the lines were kept, with no conflict copy. The
  plugin is the route to the work laptop that the hosted app couldn't be (#115).
- The Release workflow's permission to push the version commit and tag to `main` (#138). **Checked from the
  repository's settings as far as the build session could, on 2026-11-14:** `main` has no branch protection
  (GitHub's branch list reports it unprotected), and the workflow asks for `contents: write`, which a
  workflow in its own repository may take whatever the default token setting is. Rulesets couldn't be read
  from the build session, so the first press of the button is the full check. It fails safe: the commit and
  tag go up in one atomic push after `npm run check`, and the draft is made only once the push has landed.
  **Passed (2026-11-14):** the runs for `0.1.0` and `0.1.1` each pushed their "Release x.y.z" commit and
  tag to `main` and drafted the release with its three files. **Found:** a release made by hand with
  "Draft a new release" on the same tag carries no files, and BRAT then refuses it ("A manifest.json
  file does not exist in the latest release"); the workflow's own draft is the one to publish.
  **Found:** a push made with the workflow's own token starts no other workflow, so CI and the hosted
  deploy don't run for the release commit; the next push to `main` deploys as usual. The commit changes
  only version numbers, which the web app doesn't show.
- (M4e) The sweep test's bounds for slow scalar calls. **Found (2026-11-16, #194):** before the limit, 42 of
  the 247 functions a line can call failed the sweep on some argument list: froze, died or took over 1 s.
  The builders and the functions whose result grows are checked on the size they would build; the rest
  have the bounds listed in [spec section 14](spec-v1.md#14-engineering-constraints), each set where the
  call measured about 100 ms or less. With them the sweep's 6,669 calls take about 25 s.
- (M4e) The panel at 280 px: 28 px tabs, the Format tab's colour rows wrapping, a rule's condition
  field, and the Settings tab. **Passed, with two changes (2026-11-16, #198, in Chromium, the built
  plugin at 1280 px with the panel at 280 px and at 320 px; `scripts/panel-run.mjs` holds it in CI):** in
  every tab no control is cut by the panel's edge and nothing scrolls sideways but a text field's own
  text. The six tabs are 28.2 px at 280 px and 32 px from 320 px to 480 px, their 18 px icons whole, with
  "Keep sidebar open" and Close inside the panel. The Format tab's Text and Highlight rows wrap to two
  lines of swatches, and a rule's own rows too. The Settings tab fits, Custom's kind → unit table
  included; a unit's name longer than its `<select>` ends in the browser's ellipsis. **Changed:** a rule's
  condition field was 79 px wide at 280 px (119 px at 320 px) beside ↑ ↓ ✕, so those sit under it now,
  beside the rule’s state, and the field is 181 px at 280 px (221 px at 320 px); a long condition still scrolls inside
  it. **Changed:** a long constant's value (`3.99·10⁻¹⁰ (kg m²)/(s mol)`) scrolled inside its cell, at
  320 px too; it goes under its symbol now. Not run in Obsidian or on a device (the beta `0.3.0`).
- (M4e) A table of more than three columns in the sample, scaled with no floor. **Passed (2026-11-16,
  #199, in Chromium, the built plugin at 1280 px; `scripts/panel-run.mjs` holds it in CI):** a table of
  8 columns and 9 rows, 631 px wide at the sample's size, is drawn whole at 44% in a 320 px panel
  (279 × 82 px) and at 38% at 280 px (239 × 70 px), inside the box, with nothing cut. Its numbers are
  then about 5 px tall: the table shows which rows a rule coloured, and isn't read there. Its line,
  `table(…)` with eight arguments, is a call that can't break, so at 280 px the line scrolls sideways
  above the table. The table of 3 columns and 9 rows needs no scaling at either width (114 px). **Also
  measured:** the true-position sheet's `check` line is two rows at both widths, its result on the
  second; at 280 px its equation is 3.4 px narrower than the box's room, which is why the sample's side
  padding is 5 px and a problem's mark takes its column only when there is one. Not run in Obsidian or
  on a device (the beta `0.3.0`).
- (M4e) The savings of the plugin cuts (87 KB, about 148 KB and 109 KB), probed as separate bundles or
  read from the source. **Measured together (2026-11-16, #200 and #201, the built plugin):** `main.js`
  went from 3,594,195 to 3,380,158 bytes and `styles.css` from 663,706 to 554,953, so the plugin is
  322,790 bytes (7.6%) smaller, 4,258,307 to 3,935,517 with the manifest. Each cut, in its turn:
  Observable Plot by name 126,343 bytes of `main.js` (#200; the probe's 147,625 less what the point
  and the circle brought back), math.js's help texts 87,694 (#201, with `help` disabled; probed
  87,188) and the four KaTeX font families 108,753 of `styles.css` (#201; read as 108,753). The web
  app's entry chunk went from 2,295,927 to 2,211,210 bytes with the help texts (84,717 less); its
  Plot chunk from 297 to 170 KB (#200). `npm run check`, its five Playwright runs included, passes
  on the built plugin; the network-blocked run now also fails on a KaTeX class drawn in a family
  with no font. Not run in Obsidian or on a device (the beta `0.3.0`).
- (M4e) The typing test's time in CI with the new guide examples (59 s when measured). **Measured
  (2026-11-16, #202, with M4e's guide and both acceptance sheets):** 4,920 states, the guide's 13
  sections with examples, the pump sheet's 43 lines and the true-position sheet's 9; 70 s alone on
  one core of the build machine (4 cores), and 74 s inside `npm test` (the whole run 124 s), well
  under its 900 s limit. It stays in `npm run check`. Not timed on GitHub's runner itself.

**M5**

- Staggered side-by-side elements and the no-clean-gap fallback. **Passed (2026-11-16, #80), on boxes
  measured in Chromium** (the panel run, the built plugin, rows read from the overlay by `printRows`):
  two elements of 60 lines side by side, the second 12 units lower, rows 24.2 units tall, have no
  clean gap, and A4 portrait cuts them at the page's bottom (40 to 1,018.9). **Found:** each element's
  first row starts below its box's top, so the first build took the empty strip above the rows as a
  clean gap and broke after 12 units; a gap above the page's first box no longer counts
  ([section 11](spec-v1.md#11-print), As built). Also there: the pump sheet with its heading and
  30-row table in one element 2,262 units tall, at 0.7 scale on A4 portrait, breaks once (2 pages), in a gap
  inside the table, through no row, and the next page repeats the header; A4 landscape and Letter
  give 4, 2 and 4 pages, every break in a gap. A rectangle taller than a page is cut, and a heading
  beside the lines moves the break up to the gap between rows above it. Not run on paper: the print
  view is #81.
- The web's items, each in a real Chromium PDF. **Run (2026-11-16, #81, the print run: the built web app
  in headless Chromium 1243, Print… with the dialog stood in for by `page.pdf` at the page's own `@page`
  size, read back from the PDF):**
  - Excalidraw text in Nunito on the pump sheet's heading. **Passed:** the heading, Excalidraw text exported
    by `exportToSvg`, is in the PDF as text in Nunito (embedded as `NunitoExtraLight-Medium`, its variable
    font), not as a picture.
  - A drawing taller than a page, dark mode, and images in drawings. **Passed:** a rectangle 2,600 units
    tall beside 70 lines prints across 3 pages, the lines whole; a PNG in the drawing is the PDF's one
    image; with Excalidraw in dark mode no page or copy takes a filter and the drawings export light, so
    the pages are white with light-theme colours.
  - Taking over Ctrl+P with real keys. **Found:** Excalidraw 0.18.1 takes Ctrl+P itself inside its
    container (it stops the browser's print and shows a toast naming its command palette), so before #81
    Ctrl+P on the canvas printed nothing. The app's listener on the window, in the capture phase, runs
    first: Ctrl+P from Playwright's keyboard (Chromium's input events, not the browser's own menu) opens
    Print…, with a line open too, and Excalidraw shows no toast (`fileRoutes.excalidraw.test.tsx` holds
    both). Whether the browser's own shortcut handling sees a prevented Ctrl+P is the hand check of step 4.
  - KaTeX 0.16.47, which the repo resolves, against the 0.19.1 the PDF probe used. **Passed:** the pump
    sheet's PDF holds KaTeX's Main, Math and Size fonts, and every letter each page paints, KaTeX's
    included, is in its PDF text exactly as often: no math missing, nothing twice.
  - A hand-set Scale. **Found, with Chromium's own scale (`page.pdf`'s `scale`, the setting the dialog
    sets):** at 50 % each app page is still one sheet of paper with everything on it, the content half
    size at the top left and the footer still at the paper's foot, since a page is `100vh` tall. The
    app's breaks assume 100 %, the dialog's default. The real dialog's Scale, other systems and real
    printers stay in section 17.
  - Also found: a point's label with its halo came up twice in the PDF's text (spec, Changes since
    agreed, 2026-11-16), and the system font's figures in a chart can be private-use glyphs in the PDF's
    text, so a chart's tick numbers may not be searchable in the PDF (seen with Inter on Linux).
- In Obsidian on a computer, with a throwaway two-page frame: the system dialog honours `@page`; Obsidian's
  print styles don't reach the frame; the saved PDF's name. **Run (2026-11-16, by Matheus):** a two-page
  frame (A4 portrait, `@page { size: A4; margin: 0 }`, built in an off-screen iframe appended to the main
  document, styles through `adoptedStyleSheets`, printed with `frame.contentWindow.print()`) in Obsidian
  1.15.1 on a Windows laptop of his own (not the work laptop), through the system dialog to "Microsoft Print
  to PDF"; the PDF read back.
  - **Passed:** the dialog opened and only the frame's document was printed: nothing of Obsidian's is on the
    paper.
  - **Passed:** exactly 2 pages; one app page is one sheet of paper, and no margin was added (the pages
    reach the paper's edges on the long side).
  - **Found:** the paper is the dialog's, not `@page size`. Letter, landscape had been chosen in the dialog
    by hand, and the PDF is 792 × 612 pt: Chromium turned each A4 portrait page sideways and shrank it to
    about 94% to fit, leaving a white band on the other two sides. So the app's pages are the paper's pages
    when the paper and orientation chosen in the dialog match the sheet's Page setting; when they don't, each
    page is still whole on one sheet, rotated or scaled. Whether the dialog's untouched default follows
    `@page size` was not seen.
  - **Found:** the PDF's title, which Save As offers as the name, was the main window's title
    ("Pump-Sizing - Obsidian-Vault - Obsidian 1.15.1"), not the frame document's title (`print-probe`). So
    the name comes from the window's `document.title` while the dialog is open.
  - **Decided (Matheus, the same day):** the route stays the hidden frame and the system dialog, and before
    the dialog opens the plugin shows a notice naming the paper to choose, from the sheet's Page setting
    ([section 11](spec-v1.md#11-print), Changed on 2026-11-16). An area export as an image is a separate
    issue after 1.0.0 (#221).
  - Not checked by that probe, so still in section 17: KaTeX's fonts inside the frame, printing from a
    pop-out window, the work laptop.

**0.5.0**

- A rename's one write over several anchors when one of them has a nudge or a Link edit pending: whether
  that change is recorded first as its own step and the rename stays one step. **Passed (#261):** against
  Excalidraw 0.18.1 in `mathAnchor.excalidraw.test.tsx`, a write of two of three anchors (`writeAnchorSources`)
  after one of them was nudged took two Ctrl+Z: the first put both anchors' lines back and left the nudge, the
  second took the nudge back, and redo mirrored both. The same with an uncaptured Link on one of them.
  - With both written anchors nudged together, each nudge is its own step before the rename's: three Ctrl+Z,
    the lines first, then one anchor back, then the other.
  - An anchor nudged with them that the rename doesn't write stays moved and no undo reaches it, as for a line
    commit ([section 6](spec-v1.md#6-undo), A nudge of several elements can split).
  - In Chromium with real keys (the panel run, the built plugin): the pump sheet's first element selected with
    a click, moved 1 px with →, then `rho` renamed to `rho_w` from its row. One Ctrl+Z put the eight lines
    back in their five elements with the element still 1 px right; the next moved it back.
- The cost of "changes a result" on the pump sheet: the engine run twice at each key in the form's field.
  **Measured (#261)** in headless Chromium on the pump sheet in six elements (the panel run, the built plugin,
  keys 120 ms apart): one check, `planRename` with its two engine runs, was one task of 64 to 105 ms over two
  runs. That is
  felt if it stands between a key and its letter, so the check waits: the form's check is a deferred render
  ([section 14](spec-v1.md#14-engineering-constraints), 0.5.0), and each key reached its paint in 32 ms or
  less, with the check in a task of its own after it. No timer was needed: a run of keys faster than the check
  is checked once, for the text as it stands. The run reports both numbers each time and fails on neither,
  since a shared CI machine's times aren't the user's. The first run's results weren't passed in to halve it,
  as [#279](https://github.com/matheus-sancha/excalimathpad/pull/279) suggested: it isn't needed while the key
  doesn't wait for the check.
- The offer's card on a narrow editor and beside an element at the window's right edge. **Passed (#262)**
  in headless Chromium (the panel run, the built plugin, the pump sheet in six elements, `rho` changed to
  `rho_w` in its line):
  - At 1280 px with the panel docked, the view puts the first element's right side under the panel, so the
    card has no room to its right: it is drawn under its line, inside the visible area and short of the panel.
    Left with ↓, it first covered the next line, the one being typed; so a card that would cover the open line
    goes under it ([section 4](spec-v1.md#renaming-a-name), As built), and the run checks it is clear of it.
  - On a 640 px editor (the panel closed) the card is under its line, its buttons whole, inside the editor.
  - On a 2560 px window there is room: the card is beside the line, 8 px right of its element, at its row.
  - The element on the pump sheet is about 610 px wide (its comment line), so on 1920 px there is no room either.
- Under Português: every place a test or a run finds Excalidraw's DOM by its English text; whether Excalidraw
  redraws in the new language at once with a line open, or only after the menu closes; the plugin's `main.js`
  with `pt-BR` in it, against its budget. **Measured (#263)** on Excalidraw 0.18.1:
  - The app's own code and CSS find Excalidraw's DOM only by class, order and `data-testid`: nothing by its
    English text. The tests that do (`findByTitle('More tools')`, a `Close` button, the labels of the plugin's
    hidden items) run in English and check Excalidraw, not the app. Under Português the network-blocked run
    (the built plugin) still finds More tools' Math heading and two items, the image tool (the vault's picker,
    no system chooser), Web Embed, the Generate heading and Copy to clipboard as SVG hidden, the reduced
    properties panel (only Opacidade, Camadas and Ações) and the app's canvas hint, in English.
  - A line can't be open while a language is chosen: ☰ is a press, which leaves the line first. Excalidraw
    redraws at once, with ☰ still open (the panel run on the web, and in jsdom). A `langCode` change doesn't
    remount the editor: Excalidraw shows its loading screen only on its first mount, so the scene, the
    selection and the panel stay as they are.
  - Excalidraw keeps one language for every editor in the window and switches it only once the texts have
    loaded. A second sheet tab given the new `langCode` in the same render kept its toolbar in the old language,
    since Excalidraw draws its UI again only on a change of its own props or state. So each canvas follows the
    language Excalidraw shows (`useI18n`), and every open tab changes with a choice (`plugin/test/tab.test.ts`,
    with the control).
  - The plugin's `main.js` with `pt-BR` kept: 3,447,773 bytes, 23,822 more than without it, under its budget
    of 3,574,000, so the budget isn't raised. On the web `pt-BR` is its own 22 kB chunk, fetched from the app's
    address when first chosen.
  - Excalidraw also writes the language into the window's `<html lang>` (and `dir`), as it already wrote `en`
    at every mount; in Obsidian that is Obsidian's own page.

**0.6.0**

- The time the Português passes of the panel and touch runs add to `npm run check`. **Measured (#293)** in
  headless Chromium on the built plugin, each pass timed by its run: the panel run's 280 px panel in Português
  took 6.9 s, and the touch run's three phone passes (Português at 360 and 320 px, English at 320 px) 6.1 to
  6.3 s each, about 19 s. Together about 26 s added to a check of about 25 minutes. Each run prints its passes'
  times at its end.

## 18. Decision index

| Ticket | Fed sections |
|---|---|
| [What is the pipe-flow acceptance sheet, line by line?](https://github.com/matheus-sancha/excalimathpad/issues/9) | 15, acceptance file |
| [Does Excalidraw's undo history record customData edits made through updateScene?](https://github.com/matheus-sancha/excalimathpad/issues/10) | 6, 7, 14, 17 |
| [What is one undo step for a math edit?](https://github.com/matheus-sancha/excalimathpad/issues/11) | 2, 6, 14 |
| [What is the v1 sheet file, and when does it save?](https://github.com/matheus-sancha/excalimathpad/issues/12) | 2, 7, 12, 13, 14 |
| [Can math.js and KaTeX typeset sheet lines with units and engineering names?](https://github.com/matheus-sancha/excalimathpad/issues/13) | 4, 14 |
| [How does a math element look typeset, and how does it switch to editing?](https://github.com/matheus-sancha/excalimathpad/issues/14) | 2, 4 |
| [How do Mathcad's unit placeholder and unit systems work, and what can math.js reproduce?](https://github.com/matheus-sancha/excalimathpad/issues/15) | 3, 5, 14 |
| [How do you set a result's display unit and the sheet's default?](https://github.com/matheus-sancha/excalimathpad/issues/16) | 2, 3, 5, 7 |
| [What is the v1 app chrome: Add math, top bar and side panel?](https://github.com/matheus-sancha/excalimathpad/issues/17) | 2, 4, 6, 8, 14 |
| [Which client-side libraries can solve an equation and plot with math.js units?](https://github.com/matheus-sancha/excalimathpad/issues/18) | 9, 10, 12, 14 |
| [How is a solve block written and shown on the sheet?](https://github.com/matheus-sancha/excalimathpad/issues/19) | 2, 3, 4, 9, 13 |
| [How are ranges written, and how do their tables show?](https://github.com/matheus-sancha/excalimathpad/issues/20) | 2, 3, 8, 10, 13, 14 |
| [How does print / PDF turn the canvas into pages?](https://github.com/matheus-sancha/excalimathpad/issues/21) | 2, 7, 11 |
| [What does it take to ship the build as an offline PWA?](https://github.com/matheus-sancha/excalimathpad/issues/22) | 12, 14, 17 |
| [Can a sheet define its own units, such as cP?](https://github.com/matheus-sancha/excalimathpad/issues/24) | 5, 14 |
| [How does a user function show on the sheet and in the variables list?](https://github.com/matheus-sancha/excalimathpad/issues/27) | 2, 3, 4, 5, 8, 13, 14 |
| [Can a math element take double-click and Enter while Excalidraw keeps click and drag?](https://github.com/matheus-sancha/excalimathpad/issues/28) | 4, 6, 8, 14, 17 |
| [Does a math element's anchor size itself to its content?](https://github.com/matheus-sancha/excalimathpad/issues/29) | 2, 4, 6, 14, 17 |
| [How does a result's number read: digits, scientific notation, separators?](https://github.com/matheus-sancha/excalimathpad/issues/30) | 2, 4, 5, 7, 14 |
| [How is a plot written and shown on the sheet?](https://github.com/matheus-sancha/excalimathpad/issues/31) | 2, 3, 10, 13, 17 |
| [What should a selected math element show: Excalidraw's properties panel and hint?](https://github.com/matheus-sancha/excalimathpad/issues/32) | 2, 4, 11, 14, 17 |
| [Does the print view come out right as a real Chromium PDF?](https://github.com/matheus-sancha/excalimathpad/issues/34) | 8, 11, 14, 17 |
| [Can a sheet have prose or comments next to math in v1?](https://github.com/matheus-sancha/excalimathpad/issues/36) | 2, 3, 4, 11, 14, acceptance file |
| [What are v1's build milestones, and what does the finish line become?](https://github.com/matheus-sancha/excalimathpad/issues/37) | 16 |
| [What does docs/spec-v1.md contain, and how does it relate to CONTEXT.md and the ADRs?](https://github.com/matheus-sancha/excalimathpad/issues/38) | 1, 3, 11, 13, this structure, ADR amendments, acceptance file |
| [Warn when a variable name shadows a unit](https://github.com/matheus-sancha/excalimathpad/issues/7) (open, joins M2) | 5, 13 |
| [Spec for Excalimathpad v1](https://github.com/matheus-sancha/excalimathpad/pull/39) (the review, this PR) | 1, 3, 4, 7, 8, 11, 13, acceptance file |
| [How can every root of one equation in one unknown be found without a guess?](https://github.com/matheus-sancha/excalimathpad/issues/91) | 9, 14 |
| [How is an all-roots solve written, shown and indexed?](https://github.com/matheus-sancha/excalimathpad/issues/92) | 1, 2, 3, 4, 9, 10, 13, acceptance file |
| [What are the text colours: the sheet's result colour and a line's own?](https://github.com/matheus-sancha/excalimathpad/issues/93) | 2, 3, 4, 5, 7, 8, 11 |
| [How is a conditional format written on a line, with several rules?](https://github.com/matheus-sancha/excalimathpad/issues/94) | 2, 3, 4, 10, 13, 14 |
| [How is a title's format stored and set?](https://github.com/matheus-sancha/excalimathpad/issues/95) | 2, 4, 6, 7 |
| [Can the user set a math element's width, with comments wrapping to it?](https://github.com/matheus-sancha/excalimathpad/issues/100) | 2, 4, 6, 7, 14, 17 |
| [What does milestone M4c hold in the spec, and in what issue order?](https://github.com/matheus-sancha/excalimathpad/issues/97) | 16, 17, ADR amendments |
| [What does the work laptop block, and can it run an Obsidian community plugin?](https://github.com/matheus-sancha/excalimathpad/issues/115) | 1, 12, 12a |
| [What does an Obsidian community plugin need to open .excalimathpad files in its own view?](https://github.com/matheus-sancha/excalimathpad/issues/116) | 7, 12a, 14, 17 |
| [Can a control in the Sheet panel act on the open line without the line edit leaving?](https://github.com/matheus-sancha/excalimathpad/issues/117) | 8, 14, 17 |
| [When does a warning's ⚠ show, and what counts as editing a math element?](https://github.com/matheus-sancha/excalimathpad/issues/118) | 2, 4, 8 |
| [How does a comment line carry bold, underline, size and colour?](https://github.com/matheus-sancha/excalimathpad/issues/119) | 2, 3, 4, ADR 0005 |
| [What does the cheat sheet cover, and where does Help open it?](https://github.com/matheus-sancha/excalimathpad/issues/120) | 1, 2, 8 |
| [How does the Format tab replace the line's and the title's floating bars?](https://github.com/matheus-sancha/excalimathpad/issues/121) | 2, 4, 6, 8, 14 |
| [What does the Symbols tab hold, and what does each symbol insert?](https://github.com/matheus-sancha/excalimathpad/issues/122) | 1, 2, 4, 6, 8 |
| [How does the Format tab list and edit a line's conditional rules?](https://github.com/matheus-sancha/excalimathpad/issues/123) | 1, 2, 3, 4, 14, ADR 0005 |
| [How do save, open, the clean mark and recovery work for a sheet in a vault?](https://github.com/matheus-sancha/excalimathpad/issues/124) | 1, 2, 7, 13, ADR 0004 |
| [What must the plugin do so that all of a user's data stays protected?](https://github.com/matheus-sancha/excalimathpad/issues/126) | 1, 2, 12a |
| [How does a sheet work on a phone and a tablet in Obsidian?](https://github.com/matheus-sancha/excalimathpad/issues/127) | 1, 4, 8, 12a, 13, 17 |
| [How does one source build the web app and the plugin, and how is a version released?](https://github.com/matheus-sancha/excalimathpad/issues/128) | 12, 12a, 14, ADR 0006 |
| [Which of the app's chrome and keys remain inside an Obsidian tab?](https://github.com/matheus-sancha/excalimathpad/issues/129) | 2, 8, 11, 14 |
| [What does the community plugin listing need: id, name, description and review?](https://github.com/matheus-sancha/excalimathpad/issues/130) | 1, 8, 12a |
| [How do Mathcad and its peers write programs in a sheet, and which of it can math.js already run?](https://github.com/matheus-sancha/excalimathpad/issues/131) | 14, 17 |
| [What programming forms does a sheet gain, and how does a text result such as "Approved" show?](https://github.com/matheus-sancha/excalimathpad/issues/132) | 1, 2, 3, 4, 5, 10, 13, 14, acceptance file |
| [What does milestone M4d hold in the spec, and in what issue order?](https://github.com/matheus-sancha/excalimathpad/issues/125) | 16, 17, 18, ADR amendments |
