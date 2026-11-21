# overlay

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**overlay** (`src/overlay/`) — renders math elements over the canvas, each
as a typeset grid (`MathElementView`, spec section 4): rows are CSS subgrids
of one grid per element (gutter, equation, result after a rule, note), each
with its own box for the line hit. The equation is one cell holding the
line's name, `≔` and expression inline, flush left, so `≔` doesn't line up
between lines (#62). Cells hold KaTeX's HTML,
loaded lazily by `katex.ts`; until it loads, a line shows as its source.
`texToHtml` is the one place the app's KaTeX is drawn; the plugin has no font
for four of its families, and `katexFonts.test.tsx` holds the grid, the
legends and the panel's rows out of them (section 14, Lighter plugin). Rows
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
names above the line (`sheetNames`), the constants, the functions and line
forms (`FUNCTION_SUGGESTIONS`, built from the Symbols catalogue's entries
spelled as names, Greek left out) and the units; `MathOverlay` builds the sources for the open line and
`LineField` draws the list and takes its keys (Tab, ↓ ↑, Enter, Esc), and
opens it above the field (`listGoesAbove`, M4d) when below it the on-screen
keyboard (`visualViewport`) or a phone's bottom sheet would cover it; after
`@` it holds the format words, and on a clause at the start of a line, a
comment's, the comment words and never `if` (M4d);
`UnitField` (the field and list, one of the overlay's
controls that take pointer events) hands back a unit, and `MathOverlay`
writes it with `writeDisplayUnit` as one line commit. The engine gives each
line its `unitSlot` (kind, chosen unit, value in the system and in each
unit of the kind).
A **comment line's row** (spec section 4, Typeset grid, M4d) carries its
format as classes, a math line's (`is-bold`, `is-underline`, the band, the
text colour) and `is-upright` and `is-size-S|L|XL`; `MathOverlay.css` sets
the size, a line height 1.6 times it, and the width the comment asks for,
scaled by its size (`--math-comment-request`). Its gutter shows only for its
clause's error, so a comment row is laid out as before.
A **warning at rest** (spec section 4, Problems, M4d): an element's `⚠`
marks show only while one of its lines or its title is open (`edit` in
that element; being selected is not), or on its line while a jump flashes
it (`flash`, a `FlashLines`: the lines to flash at once and the key that
restarts them, one line for a jump and every changed line after a rename,
spec section 4, 0.5.0). Otherwise `TypesetRow` hands the gutter no warnings: the cell
keeps its fixed 10 px column, empty and with no `data-tip`, so rows don't
shift when an edit opens. An error's `●` always shows.
A **problem's message on hover** (spec section 4, Problems): the gutter mark
and an error's result cell carry it as `data-tip`, never a `title` (the
overlay takes no pointer events, so a title never shows). The gestures find
the mark under the pointer from its screen box (`tipAt`, the error cell only
while it is cut short) on each `pointerMove` over the canvas, and `HoverTip`
shows it after a rest, short of the Sheet panel; a press, a drag, leaving the
canvas or a scene or viewport change hides it. **On touch** (M4d, #147) a
tap shows the same tip at once (`showNow`), until the next press anywhere
(`anyPress`), above a phone's bottom sheet; with `touch` set, every selected
math element (the scene snapshot's `selected`) shows its rows as hovered
(`UnitSlots.revealed`): slots outlined, each plot's ⚙. On touch a slot opens
its field only on a tap on an element selected before the press. Screen only. A **solve's
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
`MathElementView` its lines. The overlay takes no pointer events except the open field:
Excalidraw gets every click and drag. There is no bar beside the open line
or title (M4d, #144): the Format tab formats them, and the field's Ctrl+B,
Ctrl+U and Ctrl+I (italic on a comment line and the title; nothing on a math
line) are a Format tab press. **A line's format is stored beside it** (spec
section 3, M4e, #195): `MathOverlay` hands the engine each anchor's
`formats` with its source, and a press (`pressLine`) writes the open line's
typed text and its stored clause in one `writeAnchorSource`, leaving the
field alone; only when the press changed the line's text (a clause typed in
it moved out) does it mount a new field on the rewritten text
(`LineEdit.revision`). `lineEdit.ts` carries the formats through every
move: `commitTypedLine` moves a typed clause out at the commit, a split
keeps the format on the first half, a join keeps the upper line's or else
the lower's. `commitLine` (a save with the line open) writes the typed text
as it is, clause and all; the clause moves out when the edit leaves the
line. `EditTarget.stored` is the open line's stored clause, for the panel.
`MathElementView` exports `LineSample` and `TitleSample`, one row or a
header, for the tab's sample. **A line's sample is smaller and wraps** (spec
section 4, Format tab, M4e, #199): `LineSample` draws the sheet's own row
(`TypesetRow` with `sample` set: `'panel'` or `'phone'`), so its format
classes, its result, its note and its ⚠ are the sheet's, and
`.math-element__body.is-line-sample` (`MathOverlay.css`) lays it out anew at
13 px with 20 px rows: the row a wrapping flex line of equation, result and
note, so the result drops to a row of its own with its rule; the equation
inline content, where KaTeX's top-level `.base` boxes break, the name and its
`≔` held together in `.math-element__lhs`, a box only the sample has; text
(a note, a comment, source, an error's message) wrapping; a mark's column
only on a row that `has-mark`. What can't break sticks out of the row, and
the panel's box scrolls. With `sample` set a row never draws `PlotCell`, and
a table is drawn in `ScaledTable` (`'panel'` only): laid out at its own
width, then a `transform: scale` to its box's `clientWidth` with the box's
height set to match, measured again on a `ResizeObserver` of both; no floor.
The sheet's rows are untouched by any of it. `useSheetGestures` opens, moves and
leaves the line edit from the events `listenToCanvas` hands it, starts and
cancels placing (M, Esc) and opens the first line of a placed element.
`PlacingGhost` draws the new element's box at the pointer while placing. A
leave that finds the element with no text (`hasText`, in `lineEdit.ts`)
removes it instead of writing the line. The open line
is a field over the equation's cells, beside its live result as
plain text; a hidden copy of its text widens the cell. **The field wraps**
(spec section 4, While editing a line, M4e, #196): `LineField` is a
`<textarea>` laid over that copy, which gives the cell its width and, past
the cell's `max-width`, its rows. `MathOverlay` measures that room as the
line opens (`measureWrap`, a layout effect on the open anchor and line, so
the line is drawn once without it and again before the paint) and keeps it
until the line closes: `wrapRoom.ts` gives the wrap width
(`wrapWidthTo`: the element's left edge to `visibleArea`'s right less
`FOLLOW_MARGIN`, in scene units, at least 240; or the chosen width) and the
field's share of it (`fieldRoom`: the body laid out for a moment as
`is-measuring-wrap`, the cell asking for nothing). `control.rewrap()`
measures again, which App calls when the panel the edit opened is drawn.
`caretPlace` (`caretRow.ts`) says which row of the field the caret is on,
from a second copy split at the caret (`offsetTop`, so any zoom and
rotation; null in jsdom, where a field is one row): ↑ and ↓ are left to the
browser between rows, reporting `onCaretRow` so App follows the caret, and
move the edit only from the first or last row; the suggestion list hangs
under that row (`--math-suggest-below`, `--math-suggest-above`). A pasted
newline is typed in as a space (`insertText`, keeping the field's Ctrl+Z), a
line break with no key (`beforeinput`) splits the line, and a newline that
got in by a drop is the one case the field's value is set from code. The
title's field is the same element and never wraps. `gestures.ts`
(pure) decides when a double-click, a click, Enter or Esc is math's, and
`lineHit.ts` (pure) finds the
element and line under a point from geometry and the rows' `offsetTop` and
`offsetHeight` (spec section 4, Gestures, section 14). Its `control` lets the
sheet file commit the line (Ctrl+S keeps it open) or leave it (Open). From M4d (#143) the Sheet
panel acts on it too: `setFormat`, `setCommentFormat` (#144),
`setTitleFormat`, `moveTo('title' | 'first')`, `move('up' | 'down')` and
`openLast(anchorId)` (#144), `setRules(rows)`, `typeRules(rows)`,
`saveRules()` and `suggest(text, caret)` (the Rules list, #145 and, M4e,
#197: `setRules` is a press, `pressRules` through `pressLine`, so every row
goes to the stored clause and a rule typed in the line moves out of its
text; `typeRules` keeps the rows as `LineEdit.stored`, the open line's
stored format while a condition is being typed, which the sheet is evaluated
from (`withTypedFormat`), `EditTarget.stored` reports, and every write of
the line takes: `saveRules`, the next press, `commitLine` and each move of
the edit; `suggest` is the open line's own list, for the condition's field)
and `insert(symbol, anchorId)` (#146: a Symbols
or Constants button; `symbolInsert.ts`'s pure `planInsert` gives the range,
the text and the caret by the insert's mode, typed by
`execCommand('insertText')`, which keeps the field's Ctrl+Z, then
`setSelectionRange`; a title, a comment line or a note (`isPlainAt`) takes
it as plain text; with nothing open, `anchorId` opens that element's last
line, and a layout effect types the insert once its field has mounted),
through the line relay (`createLineRelay<LineEditControl>`). `onEdit` reports what is
open (`EditTarget`: anchor, line or `'title'`, text) on each change, and
null when the edit ends. The line and title fields carry
`data-prevent-outside-click`, so a press in them keeps a floating panel, and
turn off spelling, capitals and corrections. They also carry `LINE_FIELD`
(`data-line-field`, M4e, #197), as a rule's condition field in the panel
does: a blur whose `relatedTarget` carries it doesn't leave the line, and a
line's field mounted while such a field has the keyboard doesn't take it.
**Unexpected failures** (spec section 4, #193): `MathOverlay` wraps each
`MathElementView` in a `Boundary` (reset by its source, its lines, the open
line's index and its title), whose fallback is `FailedElement.tsx`: the
notice with Copy details and Report this error (they take pointer events),
the title and the lines as plain text, each row with its `data-line` box so
the gestures still open it, and the open line as `PlainField`, a bare input
with the line's moves. It imports nothing from `MathElementView`. `PlotChart`
is a `Boundary` around the chart, whose fallback keeps the chart's box. A
line's unexpected error shows its raw text under its message in the gutter's
and the result cell's `data-tip`, on every hover. `onTyped` hands App the
open text as it is set, before the render that draws it.
`printRows.ts` reads a laid-out body's rows for the print pages (spec section
11, M5, #80; [print](print.md)): the title, a failed element's notice, each
line and comment, a plot line whole, a table line as its line, header row and
rows, from the body's top in scene units, the canvas's zoom taken out.
`printRowNodes(body)` gives the same rows' nodes in the same order, which the
print view reads in its copies; `printViews(stage)` gives each drawn element's
view, laid-out size and rows, by anchor id, and the overlay's `--math-*` colours
(#81).
**A rename's offer** (spec section 4, The offer, on a committed line, 0.5.0,
#262): `MathOverlay` holds `offers` (`RenameOffer`: anchor, line, `from`,
`to`, `key`), UI state. `changeEdit` notes the name a line assigns as its edit
opens (`opened`, from the scene, `assignedName`); `moveEdit` compares it with
the name written, for the moves `makesOffer` allows (↑ / ↓, leave, and a split
only at the end of the line), and `noteCommit` (`renameOffer.ts`, pure) makes,
re-asks or drops an offer. On every render `followOffers` runs the offers on
the scene's own sources in reading order (`planOffer` without its check):
one whose element is gone, whose line no longer assigns `to` or that has no
line left to change is dropped, and one whose line moved with a split or join
follows it when its element assigns `to` on one line; an effect prunes the
state to match. `OfferCard.tsx` draws one: the question with the count as a
button that opens the list (`offerLines`, as the form lists them, the element
named as `elementLabel` names it), the amber "This changes" from
`planOffer`'s check in a deferred render of the scene's blocks, and Rename and
Keep, all `tabIndex={-1}`, and the card prevents `mousedown`, so an open line
keeps its field, text and caret. The cards are the overlay's fourth part that
takes pointer events; a press on one never reaches the canvas, its sibling.
`placeCards`, a layout effect after each render, puts each card to the right
of its element's body at its row where `visibleArea` has room, else under the
row, then under the open field if it would cover it, then under an earlier
card. `answerOffer` (also on the control, for a phone's row) drops the offer;
for Rename it leaves the open line (`moveEdit` leave, its own step), plans
again on the scene and hands `onRenameOffer` the plan. With `phone` no card is
drawn and `onOffers` reports `OffersShown`. `OFFER_WORDS` is section 13's
wording.
`caretRow.ts` gives the follow rule its row (0.2.1, #191): the open
field's box and, in a wrapped field, the row the caret is on; narrowed to
the caret, measured on the field's hidden copy, when the row is wider than
the room. Depends on: canvas (anchor, size, selection and layer contracts, API types),
math, print (`PrintRow`), `katex` (lazily).
