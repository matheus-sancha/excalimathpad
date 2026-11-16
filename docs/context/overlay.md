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
it (`flash`). Otherwise `TypesetRow` hands the gutter no warnings: the cell
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
line) write the clause into the open line's text; `MathOverlay` commits it
at once and mounts a new field on the rewritten text (`LineEdit.revision`).
`MathElementView` exports `LineSample` and `TitleSample`, one row or a
header drawn as the sheet draws it, for the tab's sample. `useSheetGestures` opens, moves and
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
sheet file commit the line (Ctrl+S keeps it open) or leave it (Open). From M4d (#143) the Sheet
panel acts on it too: `setFormat`, `setCommentFormat` (#144),
`setTitleFormat`, `moveTo('title' | 'first')`, `move('up' | 'down')` and
`openLast(anchorId)` (#144), `setRules(rows)`, `caretToRule(index)` and
`addRule(name)` (#145: a caret inside a rule follows it to its condition's
end, by each row's `from`) and `insert(symbol, anchorId)` (#146: a Symbols
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
turn off spelling, capitals and corrections.
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
`caretRow.ts` gives the follow rule its row (0.2.1, #191): the open
field's box, narrowed to the caret, measured on the field's hidden copy,
when the field is wider than the room. Depends on: canvas (anchor, size, selection and layer contracts, API types),
math, `katex` (lazily).
