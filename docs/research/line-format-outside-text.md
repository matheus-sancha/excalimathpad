Research for wayfinder ticket #175, 2026-11-15.

# What would storing a line's format outside its text change in the file, undo, copy and paste, and the engine?

Our code is at commit `2ad3ef2` (the code of 0.2.1's branch); paths are from the repo root.
Installed `@excalidraw/excalidraw` is **0.18.1**. "Observed" means seen in the probe
([`line-format-outside-text/probe.mjs.txt`](line-format-outside-text/probe.mjs.txt)), run in
the session's headless Chromium on a bare page. "Read" means read in the named file, not run.
"Inferred" is my reasoning from what was read; nothing under it was built or run. Neither
direction was prototyped: that is the next ticket's work.

## Answer

**Fold changes one module and nothing stored. Store changes the stored form, and its real cost
is not the file but two things that stop being free: a format staying with its line, and a
rule's condition having somewhere to be typed.**

| | **Fold** (words stay in the line and the file) | **Store** (words saved beside the line) |
| --- | --- | --- |
| Sheet file, ADR 0004 | Unchanged, format 1 | A new `customData` key on the anchor, and the first migration (format 2) |
| A sheet saved by 0.2.x | Opens as it is | Upgraded on open; 0.2.x then refuses the newer file |
| Format stays with its line | Free: it is the line's text | Ours to keep, in the two moves that change the line count (Enter, Backspace at the start) |
| Undo | Unchanged | Unchanged, if source and formats go in one write |
| Copy and paste of an element, between sheets | Carries the format | Carries the format |
| Copy and paste of a line's text | Carries the format only if the copy includes the folded part | Never carries it |
| A rule's condition | Typed in the line, once unfolded | Needs a text field in the Format tab, or a typed `@word` that the app moves out of the line |
| Engine, ADR 0005 | Unchanged | Step 2 reads from a second string; small |
| Format tab and Rules list | Unchanged | Rewired to the stored form; the condition stops being read-only |
| Math guide | Unchanged | Its 26 `@` lines stay true only if a typed `@word` still works |
| Edit field | A second piece of edit state, a marker, and an unfold | Nothing: the line is shorter because the words aren't in it |
| Wrapping the field | Independent of both: a `<textarea>` in place of the `<input>` | Same |

On the map's true-position sheet the `check` line is 99 characters, of which 37 are the math and
61 the format clause (computed from the map's text). Either direction takes the open line from
99 characters to 37.

What I would carry to the prototype (inferred, a recommendation and not a finding): **Fold is the
cheaper and the reversible one**, since no file changes and 0.2.x keeps reading every sheet.
**Store is only clearly better if Matheus wants the line to never show a format at all**, and
then the question that decides its design is how a condition is typed, not where the string
lives. The two also combine: Store with "a typed `@word` is moved out of the line on commit"
looks, while typing, exactly like Fold.

## Today

- **One stored form.** A line's format is its text. The clause is read from the first `@`
  outside a string to the note (`splitClause`, `clauseStart` in `src/math/lineForm.ts`), before
  math.js sees the line ([ADR 0005](../adr/0005-app-reads-line-forms-before-mathjs.md), step 2).
  The text lives in the anchor's `customData.source`, the only stored copy
  ([ADR 0002](../adr/0002-math-elements-anchor-to-excalidraw-rectangles.md)). The spec states
  the consequence: "The clause is text in the line, so split, join, copy, paste, undo and save
  carry it, and nothing goes into `customData`" (`docs/spec-v1.md`, section 3, A comment line's
  format).
- **The words show only while a line is open.** A typeset row carries the format as classes
  (`is-bold`, `is-underline`, the band, the text colour; `src/overlay/MathElementView.tsx`).
  The raw text, clause included, shows only in the open line's field. So Matheus's "occupying a
  lot of space" is about the one open line (and the sample, which is its own ticket).
- **The field is a one-line `<input>`, uncontrolled** (`LineField`, same file). A hidden copy of
  its text shares its cell with `white-space: pre`, so the column, and the element, widen as you
  type (`.math-element__field-cell`, `src/overlay/MathOverlay.css`). It never wraps. The app
  never sets its value: a rewrite (a format press) mounts a new field (`LineEdit.revision`),
  which empties that line's own Ctrl+Z.
- **A line has no id.** A line is an index into `source.split('\n')` (`splitLines`,
  `src/math/evaluate.ts`). Only two moves change the number of lines: `split` (Enter) and `join`
  (Backspace at the start), both in `applyLineMove` (`src/overlay/lineEdit.ts`). Every other
  writer of source rewrites one line in place: the unit slot (`applyUnit`), the plot popover
  (`applyPlot`), a format press (`rewriteLine`), a commit (`moveEdit`, `commitLine`), all in
  `src/overlay/MathOverlay.tsx`. There is no reordering of lines and no multi-line paste: a
  newline pasted or inserted into the `<input>` becomes a space, and a newline in a value set
  from code is dropped (observed: `insertText` of `a = 1\nb = 2` gave `a = 1 b = 2`).
- **A rule's condition is typed in the line.** The Rules list shows it read-only, and a press on
  it puts the caret at its end in the field (`caretToRule`; `src/panel/RulesList.tsx`: "The
  condition is typed in the line itself, so nothing here takes the keyboard"). Every Format tab
  control keeps focus in the field by preventing the press's default
  (`src/panel/formatControls.tsx`, `src/canvas/panelPresses.ts`), because the field's blur is
  the line commit and ends the edit.
- **There is already a format stored beside its text: the title's.** `customData.titleFormat`
  is a string of words, never read from the title's text, set only from the Format tab and
  Ctrl+B, I, U, one undo step per press (`writeAnchorTitleFormat`,
  `src/canvas/mathAnchor.ts`; ADR 0002, amended 2026-11-13). It is a string because
  **`customData` can hold no nested object**: Excalidraw compares it one level deep when it
  records a step, and an object inside makes every later write gain an empty undo step
  (`CONTEXT.md`, the canvas notes; `src/canvas/mathAnchor.excalidraw.test.tsx`). Any stored
  line format has to obey the same rule.

## Fold

The file, the engine, undo, the Format tab's writers and the guide are untouched: everything
below is inside the overlay.

**What the field would need.** An `<input>` can't hide or shrink part of its value. Three ways
to fold, all inferred:

1. **Two pieces of edit state.** The open line's text is split with the function that already
   does it (`splitClause`): the field holds the math and the note, the clause is held in
   `LineEdit` beside it, and a small marker sits after the field (for example `@2` for two
   segments). The text that is evaluated and committed is the two joined again, clause before
   the note, which is what `writeClause` does today. Changes: `LineEdit` and `withTypedLine`
   (`src/overlay/lineEdit.ts`), `EditingRow` and `LineField`, and the caret arithmetic that
   assumes the field holds the whole line (`caretAfterFormat`, `caretToRule`, `planInsert`;
   about 40 uses of the field's value and selection across `src/overlay` and `src/panel`,
   counted by grep).
2. **A rich field** (a `contenteditable` with a non-editable chip, or an editor library). It
   could show the clause as a chip in place. It gives up what the `<input>` gives for nothing:
   `selectionStart`, `setSelectionRange`, `execCommand('insertText')` with the browser's own
   undo, which suggestions and symbol inserts rely on. An editor library would also add to a
   plugin the map is trying to make lighter. **Unverified:** I did not measure any library's
   size or try a `contenteditable`.
3. **Unfold in place.** Whatever folds, a press on the marker (or on a rule's condition in the
   Rules list) has to show the whole line again, because that is where a condition is typed.
   Unfolded is exactly today's field, so this state costs nothing new; folding is then "today,
   plus a collapsed default".

**What Fold decides, that today's text decides for free:**

- **Enter in the middle of a folded line.** Today the clause is at the end, so it goes to the
  second half with everything after the caret (`split` in `applyLineMove`). Folded, the app has
  to choose which half keeps it. Keeping today's behaviour (second half) will look odd when the
  caret was visibly at the end of the line: Enter there would move the format to a new blank
  line. Today the same Enter leaves the clause on the first line, because the caret is after it.
- **Backspace at the start.** Today `join` is `above + text`. If the line above has a clause,
  the joined text puts the lower line's math inside it and the line errors
  (`Unknown format …`); that happens today as well, but visibly. Folded, the join would happen
  across a hidden clause, so it needs a rule (for example: the lower line's math goes before
  the upper line's clause).
- **Copy of a line's text.** Select-all in a folded field copies the math without its format.
  Unfolded, it copies both, as today.
- **A typed `@`.** After `@` the suggestions offer the format words (`src/overlay/suggest.ts`).
  Typed into a folded field, a new word would sit before the hidden clause in the joined text,
  which reads correctly (the clause starts at the first `@`), and would fold away on the next
  open.
- **The field's own Ctrl+Z** starts fresh whenever the field is mounted again. Folding and
  unfolding by remounting would clear it each time, as a format press does today.

**Cost** (inferred): one module and its tests; no migration, no spec change outside section 4's
"While editing a line"; ADR 0002, 0004 and 0005 stand. **Risk:** the caret arithmetic, and the
three rules above, each of which is a place where the hidden text can surprise.

## Store

**Where it could live.** Three places, of which only the first survives:

1. **A second string on the anchor**, parallel to `source`: for example
   `customData.formats`, one entry per line, separated by `\n`, each entry the line's clause as
   it is written today (`@bold @text-red if v > 3 m/s`), empty for a line with none. A string,
   because of the no-nested-object rule above; a clause can't contain a newline, so `\n` is a
   safe separator. This is the title's precedent applied per line.
2. **A structured `source`** (an array of lines with ids). It would give lines an identity, but
   an array is a nested object, so it would have to be a JSON string inside `customData`, and
   every reader of `source` changes. Far more than the question needs.
3. **The file's `excalimathpad` block**, keyed by anchor and line. Ruled out: the block is not
   part of Excalidraw's scene, so undo wouldn't restore it, and a copied or duplicated element
   would arrive without it.

**The file and ADR 0004.** `customData` is saved and read back whole
([`excalidraw-undo-customdata.md`](excalidraw-undo-customdata.md): "Serialisation keeps
`customData` intact", observed there), so a new string key needs nothing from Excalidraw. What
it needs from us:

- **The first migration.** `FORMAT` is 1 and `MIGRATIONS` is empty (`src/file/sheetFormat.ts`).
  A step is "a pure function from format n to n + 1" that "gets the whole file, so a step can
  change elements as well as the block" (same file), so moving each line's clause out of
  `source` into the new key is exactly what the mechanism was built for. It runs on every open
  path, including the recovery copy (`readSheet` in `src/file/sheetSession.ts`).
- **A sheet saved by 0.2.x** opens upgraded, in memory; the file on disk changes at the next
  save (ADR 0004: "An older `format` is upgraded in memory on open").
- **A newer sheet in 0.2.x** is refused: "This sheet was saved by a newer Excalimathpad. Update
  the app." (`MESSAGES.newer`, `src/file/sheetSession.ts`; ADR 0004: "A newer `format` is
  refused, so an old app never overwrites a newer file"). That is the safe outcome and the
  reason to raise the format. **If the format were not raised**, 0.2.x would open the sheet,
  show every line unformatted, keep the unknown key on each write (its writers spread
  `...anchor.customData`, `src/canvas/mathAnchor.ts`), and move the formats onto the wrong
  lines at the first Enter or Backspace-join, silently (inferred from the code; not run).
  In a vault synced between devices with different plugin versions, the refusal is what the
  older device would show; how that looks inside Obsidian was **not checked**.

**The format staying with its line.** With no line id, the stored string is kept in step by
index. That is tractable only because the line count changes in exactly two places, both in one
pure function:

- `split`: the entry goes with one half (the same choice Fold has to make) and an empty entry
  is inserted for the other.
- `join`: two entries become one; a rule is needed when both lines had a format.
- An element removed takes its key with it; an emptied line keeps its entry unless cleared.

A reader has to tolerate a mismatch anyway (pad or cut to the line count), because a file can be
edited by hand or by another tool. **Risk:** any future feature that changes the line count
(reorder lines, a multi-line paste, "insert example") must also maintain the formats; today the
text does that by itself.

**Undo.** Unchanged if source and formats go in one `updateScene`: one write is one step
([`excalidraw-undo-customdata.md`](excalidraw-undo-customdata.md)), and the anchor's writers
already take a function over the whole `customData` (`writeAnchorData` under
`writeAnchorSource`, `src/canvas/mathAnchor.ts`); `writeAnchorTitle` already changes two keys in
one write. A format press from the tab would be one step, as now. Not run for a second key
changing together with `source`, though I see no reason it would differ from the title's two.

**Copy and paste.**

- **An element** (copy, paste, duplicate, between sheets): carries every `customData` key.
  Excalidraw's `restoreElement` keeps `customData` as given and its duplicate deep-copies the
  element (read in `node_modules/@excalidraw/excalidraw/dist/dev/chunk-4FTI6OG3.js`,
  `_deepCopyElement`, `duplicateElement`); the title, its format and the chosen width already
  travel this way. Not run for this note.
- **A line's text**, copied from the field and pasted into another line or another sheet: the
  format stays behind. Today it travels. This is the one behaviour Store removes outright, and
  the spec sentence quoted under Today would have to go.

**A rule's condition.** This is Store's hard part. The condition reads names and `result`, and
today it is typed in the line "so the edit never leaves it". With the clause out of the line
there are two ways to type one (inferred):

- **A text field in the Rules list.** It takes focus, and the line field's blur ends the edit,
  so either the edit has to survive focus moving into the panel (a change to the blur rule that
  `panelPresses.ts` exists to protect), or a condition is edited on a line that is no longer
  open (then the tab needs a target that isn't "the open line", which it doesn't have today:
  `FormatView` is built from what is open, `src/panel/formatTab.ts`). The field would also want
  the name suggestions the line field has, and its own undo story: a condition typed in the
  panel is a write to the anchor, one step per commit.
- **Typed in the line and moved out on commit.** `@text-red if v > 3 m/s` is typed as today;
  when the line is committed the clause moves to the stored string and the line keeps the math.
  To change a condition later it has to come back into the field, which is Fold's unfold under
  another name.

**Whether a typed `@word` still works** follows from that choice: with a panel field, `@` in a
line can become plain math.js text again (an error, as any stray `@` is) or stay accepted and be
moved out; with move-on-commit it stays the way in.

**The engine and ADR 0005.** Small. The engine reads a line's format in one place, `readLine`,
and carries `format`, `rules` and `formatError` on each line form into `runRules` and the
typeset (`src/math/evaluate.ts`). `evaluateSheet` would be handed the formats beside the source
and either pass each entry to `readLine` or join `code + clause + note` before reading, which
keeps `readLine` as it is. ADR 0005's step 2 would say where the clause comes from. Rules still
run after the line, in the same scope; nothing about `result` changes.

**The Format tab and the Rules list.** The writers (`writeFormat`, `writeRules`, `writeNewRule`,
`ruleText`, `writeCommentFormat` in `src/math/lineForm.ts`) compose a clause into a line; they
would compose it into the stored entry instead, which is less code, and `caretAfterFormat`
mostly disappears because a press no longer moves text in the field. A press would also stop
remounting the field, so the line's own Ctrl+Z would survive a format press, which it doesn't
today. The Rules list's condition changes as above. A comment line's format (`@bold @L # Pumps`,
in front of the `#`) would move too, or the two kinds of line would store their format
differently.

**The Math guide and the tests.** `docs/math-guide.md` has 26 lines that show a format as typed
text, and the acceptance sheet `docs/acceptance/pump-sizing.md` has one; 10 test files hold 195
lines with a format word (counted by grep). If a typed `@word` still works (move-on-commit), the
guide stays true as "what you type". If it doesn't, every one of those examples becomes a
description of panel presses, and a guide line can no longer be copied into a sheet with its
format.

**Cost** (inferred): the stored key and its reader and writers; the first migration with its
tests; the two line moves; the engine's entry point; the Format tab's writers; the condition's
editing, which is the largest single piece; spec sections 3, 4, 6 and 7; ADR 0002 (a new key),
0004 (format 2) and 0005 (step 2). **Risks:** formats and lines drifting apart; 0.2.x refusing
sheets after one save in 1.0.0; a condition's editing becoming worse than today's.

## Wrapping the field

Independent of Fold and Store, and it would shorten the open line on its own.

- An `<input>` is one row by definition. A `<textarea>` wraps: at 200 px wide the true-position
  `check` line's first 70 characters laid out on four rows (observed: `scrollHeight` 76 against
  19 for one row), it keeps `selectionStart` and `setSelectionRange`, and `insertText` and the
  browser's undo work in it (observed).
- What it would touch (read): the field and its hidden copy are fixed at `height: 24px` with
  `white-space: pre`, and the hidden copy is what widens the element as you type
  (`src/overlay/MathOverlay.css`). Wrapping needs a width to wrap at, so it changes the rule
  "the element grows as wide as the line"; an element with a chosen width
  (`customData.width`) already has one. A textarea doesn't size to its content, so its height
  has to be set from `scrollHeight` or from the hidden copy.
- ↑ and ↓ always leave the line today (`onKeyDown` in `LineField`). In a wrapped field they
  would have to move between rows first and leave only from the first or last row.
- Enter is already taken by the field (it splits the line), so a textarea would never hold a
  newline from typing; a pasted one would have to be turned into a space, which the `<input>`
  does by itself today (observed).
- Rows of different heights are already handled: a comment wraps, and hit-testing reads each
  row's `offsetTop` and `offsetHeight` (`src/overlay/lineHit.ts`).

## Not verified

- No prototype of either direction; every "would" above is inferred from the code.
- A second `customData` key written together with `source` in one step: expected to behave as
  the title and its format do, not run.
- Element copy, paste and duplicate keeping a new key: read in Excalidraw's bundle, not run.
- A `contenteditable` or an editor library as the field, and its size: not tried.
- Nothing was run inside Obsidian, on a phone, or with the on-screen keyboard.
