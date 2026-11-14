Research for wayfinder ticket #117, 2026-11-14.

# Can a control in the Sheet panel act on the open line without the line edit leaving?

Installed version: `@excalidraw/excalidraw` **0.18.1** (its bundled `@radix-ui/react-tabs` **1.0.2**).
Excalidraw source references point at the installed development bundle,
`node_modules/@excalidraw/excalidraw/dist/dev/index.js`, by function name. "Observed" means seen in
the probe at the end. The probe drove the real app (`npm run dev` at `main` 4a25892) in the
session's headless Chromium with real mouse and key input. It injected plain DOM controls into the
Sheet panel's tab content, and in some runs it modelled a proposed change with a listener added from
the page. No app code was changed.

## Answer

**Yes, for buttons, with one change to `listenToCanvas`. Not for a `<select>` or a text input:
those take focus, and the blur leaves the line.**

Today, every press in the Sheet panel leaves the open line, including a button that prevents
`mousedown` and is out of the tab order (observed). The reason is not focus. The panel is drawn in
Excalidraw's sidebar, which is inside `root`, the box `listenToCanvas` listens on. Its capture
`pointerdown` hands every press to the gestures' `pointerDown`, and that handler calls
`leaveLine()` and `focusCanvas()` before the button sees its `mousedown`. Its `click` then fires
with the line already committed and the field gone (observed). The floating bars escape this only
because the overlay is `root`'s sibling, not its child (`canvasEvents.ts` says so in its header).

With presses from the panel kept out of the gestures (modelled by a `window` capture listener that
stops `pointerdown` from inside `.sheet-sidebar`), observed results:

| Control in the panel | Line after the press | Why |
| --- | --- | --- |
| Button, `mousedown` prevented, `tabIndex={-1}` (the format bar's rule) | **stays open, caret kept** | Click runs with the field present and focused |
| Plain button | leaves | The button takes focus; the field's blur leaves |
| `<select>` | leaves | Takes focus |
| `<select>` with `mousedown` prevented | stays open | But it can't open its list or take keys, so it is no use |
| `<input type="text">` | leaves | Must take focus to be typed into |
| The panel's background | leaves | The press moves focus to `body` |
| The panel's background, with `mousedown` prevented panel-wide | **stays open** | |
| A tab trigger (Variables, Problems, …), with `mousedown` prevented panel-wide on `document`, bubble phase | **stays open, tab switches** | See "Tabs" below |
| Wheel over the panel (no change needed) | **stays open**, the panel scrolls | No press, no focus move |

**Symbols works on that footing.** A no-focus panel button that runs
`document.execCommand('insertText', false, 'rho')` on the focused field inserted at the caret
(`b = a| + 3 m` → `b = arho| + 3 m`, caret after the insert). Ctrl+Z in the field then took it back
to `b = a + 3 m`, caret where it was (observed). The browser's text undo survives, as it does for an
accepted suggestion today (`LineField.acceptSuggestion` uses the same call).

**A format write works on that footing too**, by the path the format bar uses today. `onRewrite`
commits the line at once and mounts a new field (`LineEdit.revision`). As with the bar, that new field
starts with an empty text undo.

**A rule's condition can't be typed while the line stays open.** Any field the user types into takes
the keyboard, and the line field's blur leaves the line. That is the line commit, so nothing is
lost: the rule editor has to work on the **committed** line in the scene, not on the field.

## Findings in detail

### 1. Where a press in the panel goes today

- `SheetCanvas` passes `containerRef.current` as `root`. Excalidraw renders its sidebars inside its
  own `.excalidraw` container (the `Sidebar` is an `Island` in `LayerUI`), so the Sheet panel is a
  descendant of `root`.
- `listenToCanvas` (`src/canvas/canvasEvents.ts`) adds `pointerdown` on `root` in the **capture**
  phase. An ancestor's capture listener runs before any listener on the target, so no control in the
  panel can get in first, and preventing `mousedown` doesn't help: `pointerdown` comes first.
- `useSheetGestures`' `pointerDown` (`src/overlay/useSheetGestures.ts`) never looks at the target.
  With an edit open it calls `g().leaveLine()` and `g().focusCanvas()`. So a press on a panel
  control is, to the gestures, a press on the canvas.
- Observed: the no-focus button's `click` ran with no field in the DOM, and focus was on
  `div.excalidraw`, put there by `focusCanvas`.
- A Variables or Problems row is a press in the panel too. Today it leaves the line by the same
  route, then `App.jump` selects the element and calls `focusCanvas()`. Under the change below, a row
  still leaves the line: the row's button takes focus (or `jump`'s `focusCanvas` does), and the blur
  leaves.

### 2. The change that lets a panel button act on the line

- **`listenToCanvas` must not hand a press from the Sheet panel to `pointerDown`.** The narrowest
  form checks `event.target.closest('.' + SHEET_SIDEBAR_CLASS)` (`SheetCanvas.tsx` already exports
  the class) and skips the handler. The toolbar, the menus and the canvas keep today's behaviour: a
  press there still leaves the line. Excalidraw's own handlers still get the press (it is skipped,
  not stopped).
- Inside the panel, each control that acts on the open line follows the format bar's rule:
  `onMouseDown={(e) => e.preventDefault()}` and `tabIndex={-1}`. `ColourDots` is already exported
  from `MathElementView.tsx` and already follows it.
- **Two ways to cover the rest of the panel** (headings, gaps, tab triggers):
  - *Per control only.* A press on anything else in the panel blurs the field and leaves the line, as
    a press on the canvas does. This is simple and matches the rule as written.
  - *Panel-wide.* One `mousedown` listener prevents the default for every target in the panel that
    isn't a field (`input`, `select`, `textarea`), so a stray press keeps the line open. It must sit
    on `document` in the **bubble** phase. Radix's tab trigger switches tabs from its own
    `onMouseDown`, which `composeEventHandlers` skips when the event is already default-prevented. A
    capture listener, or a native listener on the sidebar itself (which runs before React's root
    listener), stopped the tabs from switching (observed). On `document`, bubble, the tab switched and
    the line stayed open (observed).
- Not verified here: a press on a classic scrollbar. The headless browser drew overlay scrollbars
  (width 0), so a scrollbar press couldn't be tried. Recent Chromium makes scrollers keyboard
  focusable, so a scrollbar press might move focus. The wheel was tried, and is fine.

### 3. `<select>` and text inputs in the panel

- A native `<select>` has to take focus to open its list and to take keys. If its `mousedown` is
  prevented, the line stays open (observed), but the list doesn't open (normal browser behaviour,
  not observable in the headless run). So **a format choice that acts on the open line must be
  buttons**, such as a dot row or a segmented row, not a `<select>`.
- A rule's condition is typed, so its field takes focus, and the blur leaves the line (observed).
  The rule editor then works on the committed line (section 5).
- **Keys on a focused `<select>` reach Excalidraw's shortcuts.** Excalidraw's `onKeyDown` returns
  early only for `isWritableElement`: a textarea, or an input of type `text`, `number` or
  `password`. A `<select>` is only `isInputLike`, which spares the arrow keys alone. Observed, with a
  math element selected and a `<select>` in the panel focused:
  - **R** switched the tool to Rectangle (and the select's type-ahead changed its value too);
  - **Delete** deleted the selected math element. The same happened with the **existing** Settings
    tab's unit-system `<select>`, so this is a bug in today's app, not only a risk for new tabs.

  A `<input type="text">` focused the same way kept both keys (observed), as #99 found. The
  `type="text"` rule in `CONTEXT.md` covers inputs only. A `<select>` inside Excalidraw's container
  needs its own guard, for example stopping the keys it doesn't use before they bubble to
  `.excalidraw`, or a button row in its place.

### 4. How a panel control reaches the open line

Today, `MathOverlay` owns the line edit (`edit`, `editRef`, `changeEdit`). The bar talks to it
through `MathElementView` props (`onRewrite`), and App reaches it only through the `control` ref
(`LineEditControl`: `commitLine`, `leaveLine`), which the sheet file uses. A panel control lives in
App's tree (`sheetPanel` slot of `SheetCanvas`), so it needs both directions.

- **Out, to the panel (what the line is).** A callback alongside `onEvaluated`, such as
  `onEdit(target)`, where `target` is null or `{ anchorId, lineIndex, text }`. The panel then reads the
  line's form with `readLine` (`lineForm.ts`), as `EditingRow` does, to show its format pressed. It
  would fire on every keystroke, like `onEvaluated` (which already re-renders the panel per
  keystroke).
- **In, from the panel (what to do).** `LineEditControl` gains two methods:
  - `setFormat(format)`: the bar's write, moved to `MathOverlay`. It writes `writeFormat(text,
    format)` and calls the `onRewrite` path, which writes the line with `writeAnchorSource` (one undo
    step), bumps `revision` and remounts the field. The caret is `min(selectionStart,
    codeLength(text))`, read from the live field, which is still focused.
  - `insert(text)`: the caret exists only in the DOM, so the call has to reach the field.
    `MathOverlay` keeps a ref to the open `LineField` (an imperative handle next to `fieldRef`), and
    the field runs `focus()`, then `execCommand('insertText', …)`, with the `setRangeText` fallback
    `acceptSuggestion` already has, which loses the text undo. The `input` event it fires goes
    through `onType`, so the sheet re-evaluates as for a typed key. The insert is not a commit, just
    as typing isn't.
- `execCommand` is deprecated but still has no replacement that keeps the undo stack. It is the only
  way to keep the field's undo, and the app already depends on it.

### 5. With no line open and a math element selected

- A press in the panel with no edit open changes nothing today: `pointerDown` returns early, and
  Excalidraw's canvas handler never sees a press outside the canvas, so **the selection is kept**
  (observed: `data-math-selection` still set).
- The panel has no view of the selection yet. `MathOverlay`'s scene store ignores
  `selectedElementIds` on purpose (selection changes fire `onChange` constantly).
  `mathSelection.ts` already watches it for the reduced properties panel, so App could get "the
  selected math elements" from the same place.
- What a control can act on, by kind:
  - **Format of a line**: no caret and no line, so either disabled with a hint ("Open a line to
    format it"), or applied to every code line of the selected element. The latter is one
    `writeAnchorSource` per element, so one undo step per element. Several selected elements would
    be several steps unless they go in one `updateScene`, which `writeAnchorSource` doesn't do today.
  - **Title format**: `writeAnchorTitleFormat` already acts on an element, not on an edit, so a
    selected element's title can be formatted with no line open (one step per press).
  - **Symbols**: no caret. Either disabled, or the press first opens the element's last line (the
    gestures' `open-last` action, `openLine`) and inserts at its end.
  - **Rules**: since typing a condition leaves the line anyway (section 3), the rule editor works
    the same with or without an open line. It edits a **panel target**, `{ anchorId, lineIndex }`,
    remembered after the edit leaves. Each change rewrites that line's `@` clause in the scene with
    `writeAnchorSource` (one step each). `lineForm.ts` has `writeFormat`, which keeps rules as typed,
    but no writer for rules yet.

### 6. The floating panel on a narrow window

- At or below `SIDEBAR_DOCKS_ABOVE` (1229 px), the panel floats. Excalidraw's `Sidebar` closes a
  floating sidebar on any `pointerdown` outside it (`useOutsideClick` on `document`).
  - Observed at 1000 px: the double-click that opens a line closed the panel.
  - With the panel open and the line opened by Enter (no press), a press inside the line field also
    closed it.
- `useOutsideClick` skips targets inside `[data-prevent-outside-click]`. With that attribute on the
  line field, a press in the field left the panel open (observed). The attribute is not documented
  API, so it would need a contract test like the others. Presses on the canvas still close it, which
  matters for "Open automatically while editing a math block" on a narrow window.

### 7. Rules and contract tests this touches

- **`CONTEXT.md`, Load-bearing.**
  - "Gestures run in the capture phase, before Excalidraw's React handlers": gains the exception
    that a press from the Sheet panel isn't a canvas press.
  - "The format bar never takes focus": becomes the rule for every panel control that acts on the
    open line (and goes away for the bars if they are removed, per #93/#95 reopened).
  - "A field inside Excalidraw's container is `type="text"`": still holds for the rule's condition
    field, and gains a `<select>` clause (section 3).
  - "The line field is uncontrolled and remounts per line": unchanged; the insert keeps it.
- **`src/canvas/canvasEvents.excalidraw.test.tsx`**: "hears each press before Excalidraw, and its
  click after" stays, plus a new contract that a press inside the Sheet panel's sidebar isn't handed
  to `pointerDown`, with the control: a press on the canvas still is.
- **`src/overlay/gestures.excalidraw.test.tsx`**: a press on a panel control while editing keeps the
  line open; a press on the canvas still leaves it.
- **`src/overlay/MathOverlay.test.tsx`**: "blur writes the typed line and ends the edit" stays (it is
  how a typed panel field commits). The format-bar tests ("shows the bar only beside the open line…",
  "leaves every rule as typed when the bar writes", the title's bar M4c #111) move to the panel's
  Format tab if the bars go.
- **`src/App.test.tsx`**: the #99 test ("the %s filter keeps its keys from Excalidraw's shortcuts")
  is the pattern for the rule's condition field, and for a new test that a focused Settings
  `<select>` doesn't delete the selection on Delete.
- **New contract tests** for two Excalidraw internals: the Radix tab trigger acting on its own
  `mousedown` (if the panel-wide prevention is chosen), and `data-prevent-outside-click` (if the
  field takes it).

## Options left for the Format tab and Symbols tickets

1. **How the panel stops a press from leaving the line** (both tickets need one of these):
   - **A. Skip panel presses in `listenToCanvas`, and keep the per-control no-focus rule.** Smallest
     change. A press on a heading or a gap in the panel still leaves the line.
   - **B. A, plus a panel-wide `mousedown` prevention on `document`, bubble phase.** No stray press
     leaves the line, and tabs still switch, but it relies on Radix's handler order (one more
     contract test).
2. **Which controls act on the open line:** buttons only, such as dot rows, toggles and segmented
   rows. A `<select>` or a typed field leaves the line, so it can only act on a committed line.
3. **How rules are edited** (the conditional-formatting ticket):
   - **A. On a panel target**, `{ anchorId, lineIndex }`, written to the scene, with the line closed.
   - **B. Rules shown read-only while a line is open,** and edited only when no line is.
4. **What the panel does with no line open and a math element selected,** per control: disabled
   with a hint; act on the element (every code line, or the title, both one step per element); or,
   for Symbols, open the last line and insert at its end.
5. **The narrow window**, as part of "open automatically while editing": mark the field
   `data-prevent-outside-click` so a press in it keeps the floating panel, or accept that the
   floating panel closes on any canvas press, which today includes the double-click that opens a
   line.
6. **How Symbols spaces an insert:** the probe's `a|` + `rho` gave `arho`. Whether a button adds a
   space, or a call such as `sqrt()` places the caret between its brackets, is the Symbols ticket's
   choice. `execCommand('insertText')` can insert any text, and the field's
   `setSelectionRange` can place the caret after it.

**Also found:** a focused `<select>` in today's Settings tab passes Delete and letter keys to
Excalidraw, so Delete removes the selected element (section 3). This is a bug in the current app,
independent of M4d.

## Probe

`panel-probe.cjs` ran with Playwright against `npm run dev` at 1400 × 900. It placed an element,
typed `a = 2 m` and `b = a + 3 m`, reopened line 1 with the caret at 5, and pressed each injected
control, first as the code stands, then with each modelled change. Abridged results:

```
today: press #p-btn (no-focus button)       {"open":false,"active":"DIV.excalidraw"} click: fieldAtEvent false
today: press #p-plain / #p-select / #p-text  {"open":false}
today: wheel over the panel                   {"scrolled":400,"open":true,"focused":true,"caret":5}
fix: press #p-btn                             {"open":true,"focused":true,"caret":5} click: fieldAtEvent true
fix: press #p-plain                           {"open":false,"active":"BUTTON"}
fix: press #p-select                          {"open":false,"active":"SELECT"}
fix: press #p-select-nf (mousedown prevented) {"open":true,"focused":true}
fix: press #p-text                            {"open":false,"active":"INPUT"}
fix: press #p-bg                              {"open":false,"active":"DIV"}
fix + panel mousedown prevented: #p-plain     {"open":true,"focused":true}
fix + panel mousedown prevented: #p-bg        {"open":true,"focused":true}
fix: insert "rho" at caret 5 from the panel   {"insertText":true,"value":"b = arho + 3 m","caret":8}
fix: Ctrl+Z in the field after the insert     {"value":"b = a + 3 m","caret":5}
focused <select>, key r                       {"tool":"toolbar-rectangle"}
focused <select>, key Delete, math selected   {"anchors":0}
focused text input, keys r + Delete           {"anchors":1,"tool":"toolbar-selection"}
no line open, press panel button              {"selected":true}
```

The "fix" runs added, from the page:

```js
// Model of A: presses from the panel never reach listenToCanvas's capture listener on root.
window.addEventListener('pointerdown', (e) => {
  if (e.target instanceof Element && e.target.closest('.sheet-sidebar')) e.stopPropagation()
}, true)
// Model of B: no press in the panel moves focus, unless it lands on a field.
document.addEventListener('mousedown', (e) => {
  const t = e.target
  if (t instanceof Element && t.closest('.sheet-sidebar') && !t.closest('input, select, textarea')) e.preventDefault()
}, false)
```

The real change would skip the handler inside `listenToCanvas`, not stop the event: stopping it on
`window` also hides the press from Excalidraw and from the panel's own React handlers, which works
for the probe but is wider than needed.

A second probe (`panel-probe-3.cjs`) found:

- Tabs, with model B on `document` in the bubble phase: Problems, then Variables, each switched with
  the line still open and focused.
- Tabs, with the same prevention in the capture phase or on the sidebar itself: the tab stayed on
  Variables.
- At 1000 × 800, the panel floating: Enter opened the line with the panel open. A press in the field
  closed the panel. With `data-prevent-outside-click` on the field, the same press kept it open.

`panel-probe-5.cjs`: Settings tab's first `<select>` focused, one math element selected, Delete →
anchors 1 → 0.

Not covered: Firefox and Safari, touch and pen input (relevant to the Obsidian phone and tablet
tickets), and a classic, non-overlay scrollbar.
