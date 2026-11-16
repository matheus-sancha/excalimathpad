# panel

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**panel** (`src/panel/`) — the Sheet panel's tabs (spec section 8), drawn
inside Excalidraw's sidebar, which `SheetCanvas` frames (`SheetPanelSlot`:
the badge's `errors`, the tabs' content, `onChange`). `sheetPanel.ts` (pure)
turns the evaluated sheet (`EvaluatedElement`s, which `MathOverlay` hands
out through `onEvaluated`) into Variables groups and Problems rows (every
error and warning), and `errorCount`, the Problems badge (errors only, M4d);
`SheetPanel.tsx` renders them, and a click asks App to jump. A row of a
line the app itself failed on (`ProblemRow.unexpected`, spec section 4,
Unexpected failures) shows the failure's raw text under its message, and
`FailureActions` after its button. **The Symbols
tab** (#146, `SymbolsTab.tsx`): a filter box (`filterSymbols`), then the
catalogue's groups, Greek in its three rows, each entry an `InsertButton`
showing its label, its hover `symbolHover`, a dot on a letter that is also
a constant. An `InsertButton` is a no-focus button that stays hoverable when
dimmed (`aria-disabled`, not `disabled`). The Constants tab's rows are
`InsertButton`s too, inserting the short name, else math.js's, as a `name`
insert ("Insert c"). Both take `InsertProps`: `canInsert` (a line or the
title open, or one math element selected; otherwise the buttons are dimmed
under "Open a line to insert") and `onInsert`, which App maps onto the line
relay's `insert`, with the selected element when nothing is open. **The Format tab**
(#144): `formatTab.ts` (pure) turns the evaluated sheet (`FormatElement`:
the panel's element and its `titleFormat`, which `EvaluatedElement` carries)
and what is open (`FormatTarget`, the overlay's `EditTarget`) into a
`FormatView`: none, a title, a math line (its plain format and the
"A rule sets …" notes), a comment line, or a blank one, each read from the
line's typed text with its stored format behind it (`FormatTarget.stored`,
M4e, #195; `typedRules` counts the rules still typed in the text, which come
first); with its caption
("Math line — Pipe flow, line 3", shown in capitals) and its link (Edit or
Add title ↑, First line ↓). `FormatTab.tsx` renders it: the sample in a
light box (the dark theme's filter on it), the link, Done, ↑ and ↓, then a
labelled row per property, every control a no-focus button; with nothing
open, the hint, and Edit while one math element is selected. Its presses are
`FormatActions`, which App maps onto the line relay; App holds what is open
(from `onEdit`) and the one selected math element (`mathSelection`). Its
rows are `formatControls.tsx` (`Row`, `Toggle`, `SizeRow`, `TextRow`,
`HighlightRow`, `PanelButton`; `locked` keeps a rule's last property).
**The Rules list** (#145, `RulesList.tsx`) sits under a math line's rows:
one row per rule (a chip in its format that opens its Text, Highlight and
Style rows, its condition, which puts the caret at its end, ↑ ↓ ✕ and its
live state), and + Add rule, whose new rule's controls open at once.
**The quick keys** (M4d, #147): `quickKeys.ts` is `QUICK_KEYS`, the pinned
row's keys in order, each a `SymbolInsert` (`(` with `alone`: it wraps a
selection, else types only itself); `QuickKeys.tsx` draws them as no-focus
`InsertButton`s.
`panelMemory.ts` is the `PanelMemory` port for the open/closed state
(`localStorage` on the web, given by `src/main.tsx`). `SettingsTab.tsx`
edits the unit system, Custom's kind → unit table, Digits and the Result
colour (`settings.resultColor`, one of the six text colours; App hands it to
`MathOverlay`, which sets `--math-result` on the overlay) through the
session's `setSettings` (saved with the sheet, dirty, not in undo); App
hands the session's settings to `MathOverlay`, which evaluates with them. App does the jump
(`jumpToAnchor` in `canvas/selection.ts`: scroll, select with `NEVER`) and
the flash (`MathOverlay`'s `flash`, a row class). Depends on: math, overlay
(KaTeX).
