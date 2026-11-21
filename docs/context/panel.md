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
`SheetPanel.tsx` renders them, and a click asks App to jump. **The words**
(0.6.0, #293): every word the tabs show is the text table's `panel` group
([text](text.md)), read with `useWords()` while each tab renders, and the
catalogues' own words are the tables' `constants`, `symbols` and `kinds`
groups, keyed by the catalogue; so a choice in ☰ → Language words an open tab
again at once. The pure modules (`sheetPanel.ts`, `formatTab.ts`,
`renameForm.ts`) take the table as a last argument, the one shown by
default: `elementLabel` (`panel.element`), a row's or a form's line
(`panel.line`), a function's or an error's value. **Longer text wraps**
(spec section 8, 0.6.0): no label is cut or ends in an ellipsis; a link's
arrow stays on its last word's line (`withArrow`, a no-break space), and a
condition quoted in a rule's note is one box (`KeepWhole`,
`.sheet-panel__whole`, an inline-block with its full stop) that moves to
the next line whole. **The rename
form** (spec section 4, Renaming a name: The form, on a Variables row; 0.5.0,
#261): every Variables row ends in a ✎ (`.sheet-panel__rename`, outside the
row's jump button), and `VariablesTab` holds which row's form is open, one at
a time (`renaming`: the row's key and its `RenameTarget`). `renameForm.ts`
(pure) is the form as a view of `planRename`: `renameFormView(sheet, target,
typed, settings)` gives the lines to write, each named by its element
(`elementLabel`) with its text cut into marked parts (and its stored clause
where the name stands in it), the reason under the field (the refusal, or
the shadow warning), the lines whose result would differ, `canRename`, and
the `plan` itself; null when the line no longer assigns the name.
The form's words are the table's `panel.rename` (its heading's words before
and after the name, which is code and never breaks); `RENAME_WORDS` keeps
only the toast's; the lines' marks are the engine's `markParts`. The sheet it
reads is a `RenameElement`: the panel's element with its `source` and
`formats`, which `EvaluatedElement` carries. `RenameForm.tsx` draws it: a
`type="text"` field that takes the keyboard as it mounts, the old name
selected (so an open line is left, section 8), Enter and Esc on the field,
and Rename and Cancel. The view is made from `useDeferredValue` of the
field's text, so a key is drawn before its check runs the engine twice
(spec section 14, 0.5.0); Rename plans again if the check shown is for an
older text. It writes nothing: `onRename` hands App a `RenameRequest` (the
target, the new name, the plan), `onCancel` says the form closed unwritten,
and `onGone` that its line stopped assigning the name. By touch
(`[data-math-touch]`) and in the bottom sheet the ✎ and the buttons are
40 px (`SheetPanel.css`); `scripts/panel-run.mjs` holds the form on the pump
sheet and at 280 px, `scripts/touch-run.mjs` by touch. A row of a
line the app itself failed on (`ProblemRow.unexpected`, spec section 4,
Unexpected failures) shows the failure's raw text under its message, and
`FailureActions` after its button. **The Symbols
tab** (#146, `SymbolsTab.tsx`): a filter box (`filterSymbols`), then the
catalogue's groups (named by the table's `symbols.groups`), Greek in its
three rows, each entry an `InsertButton` showing its label, its hover
`symbolHover` (the hint in the language shown), a dot on a letter that is
also a constant. An `InsertButton` is a no-focus button that stays hoverable when
dimmed (`aria-disabled`, not `disabled`). The Constants tab's rows are
`InsertButton`s too, inserting the short name, else math.js's, as a `name`
insert ("Insert c"); a row's description and group are the table's
`constants.description` and `constants.groups`, by math.js's name and the
group's `id`, and the filter matches the description in the language shown. Both take `InsertProps`: `canInsert` (a line or the
title open, or one math element selected; otherwise the buttons are dimmed
under `panel.openALine`) and `onInsert`, which App maps onto the line
relay's `insert`, with the selected element when nothing is open. **The Format tab**
(#144): `formatTab.ts` (pure) turns the evaluated sheet (`FormatElement`:
the panel's element and its `titleFormat`, which `EvaluatedElement` carries)
and what is open (`FormatTarget`, the overlay's `EditTarget`) into a
`FormatView`: none, a title, a math line (its plain format and the
"A rule sets …" notes), a comment line, or a blank one, each read from the
line's typed text with its stored format behind it (`FormatTarget.stored`,
M4e, #195: as a condition being typed has it; a rule typed in the text comes
before the stored ones); with its caption
("Math line — Pipe flow, line 3", shown in capitals) and its link, a key
of `panel.format.links` (`editTitle`, `addTitle`, `firstLine`); a note is a
`RuleNote`, its text and the condition it quotes. `FormatTab.tsx` renders it: the sample in a
light box (the dark theme's filter on it; see The sample, below), the link, Done, ↑ and ↓, then a
labelled row per property, every control a no-focus button but a rule's
condition; with nothing
open, the hint, and Edit while one math element is selected. Its presses are
`FormatActions`, which App maps onto the line relay; App holds what is open
(from `onEdit`) and the one selected math element (`mathSelection`). Its
rows are `formatControls.tsx` (`Row`, `Toggle`, `SizeRow`, `TextRow`,
`HighlightRow`, `PanelButton`; `locked` keeps a rule's last property).
**The Rules list** (#145, `RulesList.tsx`) sits under a math line's rows:
one row per rule (a chip in its format that opens its Text, Highlight and
Style rows, its condition, ↑ ↓ ✕ and its live state), and + Add rule, whose
new rule is the last row, its controls open. **A rule's condition is a text
field** (spec section 4, Rules list, M4e, #197; `ConditionField.tsx`), the
one control in the panel that takes the keyboard and keeps the line open: it
carries `LINE_FIELD` (`canvas/panelPresses.ts`), is `type="text"`, and shows
the line's own suggestions (`RulesActions.suggest`) in a list under it. The
list holds only the text as typed (`typing`: a rule's own condition is
trimmed) and the row + Add rule should give the keyboard to; the condition
itself lives in the overlay's line edit. Its presses are `RulesActions`:
`setRules(rows)` writes the rows (`RuleRow`s: a rule the list didn't change
keeps its `text`), `typeRules(rows)` hands over the rows at each keystroke
with nothing written, `saveRules()` writes them (Enter, or the keyboard gone
back to the line or to another condition), and `leave()` ends the edit when
the keyboard went anywhere else. A field is a new element each time it loses
the keyboard, which keeps what was typed in it out of the browser's text
undo (spec section 14). An empty condition's row reads
`panel.rules.noCondition`.
**The sample** (spec section 4, Format tab, M4e, #199): the tab draws the
overlay's `TitleSample` or `LineSample` in `.sheet-format__drawing`. A
title's is as before. A line's box is `is-line`: as tall as its line up to
150 px, then it scrolls inside, and sideways for math that can't break, so it
is the one part of the sample that takes pointer events; `has-table` raises
the height to 300 px, and `is-phone` (the `phone` prop, which App passes from
the vault's) lowers it to 72 px. The line's own layout, 13 px and wrapped, is
the overlay's ([overlay](overlay.md)). Under the box of a plot line (a line
with a `plot`), `panel.format.chartOnSheet`, left out on a phone. jsdom lays
nothing out: `scripts/panel-run.mjs` holds the sizes, the wrapping, the
sideways scroll and the scaled table at 320 px and 280 px, and
`scripts/touch-run.mjs` the bottom sheet's 72 px with no chart or table.
**The Português passes** (spec section 14, 0.6.0, #293): the panel run's
280 px loop runs a third time with Português in `data.json`, and the touch
run once more on the phone at 360 and 320 px (and in English at 320 px):
nothing cut, the bottom sheet's active name whole or not shown, Custom's
options whole, the link's arrow with its word and a rule's note on one line.
They press by class, role and place, never by English text.
`panelWords.test.ts` holds that every constant, symbol, kind and quick key
is worded in both tables, and `panelLanguage.excalidraw.test.tsx` draws
each tab and the rename form in Português against the real Excalidraw.
**The quick keys** (M4d, #147): `quickKeys.ts` is `QUICK_KEYS`, the pinned
row's keys in order, each named by its key in `panel.keys` and a `SymbolInsert` (`(` with `alone`: it wraps a
selection, else types only itself); `QuickKeys.tsx` draws them as no-focus
`InsertButton`s.
`ConstantsTab` lists `listConstants(settings)`: every built-in constant with
its value in the sheet's system; a value too long for its row at a narrow
panel goes under its symbol (`SheetPanel.css`, flex wrap). A rule's ↑ ↓ ✕ sit
under its condition for the same reason (M4e, #198: every tab is usable at
280 px, which `scripts/panel-run.mjs` holds in Chromium).
`panelMemory.ts` is the `PanelMemory` port for the open/closed state and,
from M4e (#198), the panel's width (`rememberedWidth`, `rememberWidth`; a
second key in `localStorage` on the web, given by `src/main.tsx`;
`sheetPanelWidth` in the plugin's `data.json`). The memory keeps what it is
told; `SheetCanvas` brings a remembered width into range. The frame the tabs
are drawn in, the icon tabs, each tab's heading and the drag handle are the
canvas's ([canvas](canvas.md)). `SettingsTab.tsx`
edits the unit system, Custom's kind → unit table (each kind named by the
table's `kinds.name`; its default option shows the system's unit or range
only, from 0.6.0, the system being named in Starts from), Digits, the Result
colour (`settings.resultColor`, one of the six text colours; App hands it to
`MathOverlay`, which sets `--math-result` on the overlay) and, from M5 (#80),
the Page row (`settings.page`, spec section 11: two selects, Paper size over
Orientation, in a group named Page, so both fit at 280 px; the panel run
measures them) through the
session's `setSettings` (saved with the sheet, dirty, not in undo); App
hands the session's settings to `MathOverlay`, which evaluates with them. App does the jump
(`jumpToAnchor` in `canvas/selection.ts`: scroll, select with `NEVER`) and
the flash (`MathOverlay`'s `flash`, a row class), and writes a rename
([app](app.md)). Depends on: math, overlay (KaTeX), print (`PageSetting`).
