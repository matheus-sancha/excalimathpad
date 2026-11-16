# Excalimathpad v1 spec

**Status:** agreed 2026-11-03 · living. From 1.0.0, "v1" in this file's name is a name, not a
status: this stays the living spec, at this path and with these section numbers

## 1. What v1 is, and what it isn't

Excalimathpad v1 is a calc sheet for anyone, built around Matheus's own engineering
work, with no server; it is free and best effort. It is the Excalidraw whiteboard
with live, unit-aware math on it. You type math where you want it on the canvas,
see it typeset with results and units, edit an input and everything below
recalculates, save the sheet to a file, and print it to PDF. It runs on Chrome and
Edge on desktop. Installing it as an offline app is M6, built after 1.0.0
([section 16](#16-milestones-and-finish-line)).

From M4d it has a second home: an **Obsidian community plugin** that opens
`.excalimathpad` files from a vault in its own tab, on desktop, phone and tablet,
built from the same source ([section 12a](#12a-obsidian-plugin)). The web app stays.
Both homes read and write the same file.

**How to read this spec:**

- This spec says what v1 **will be**, and it wins over the tickets it came from.
  Each section ends with those tickets, for the reasoning.
- [`CONTEXT.md`](../CONTEXT.md) says what the code **is today**. Each Engineer PR
  moves into it the terms and rules it makes true, using this spec's names, and into
  [`docs/context/`](context/) what it changes in a module.
- [`docs/spec-history.md`](spec-history.md) holds what sections 16 to 18 no longer need to
  say: the built milestones' issue orders, the results of Verify first, the decision index.
- [`docs/adr/`](adr/) says **why**, for choices that are hard to reverse. An ADR
  item marked with a milestone isn't built yet.
- A change Matheus agrees is edited in here, with a line under
  [Changes since agreed](#changes-since-agreed), in the PR that needs it. Behaviour
  doesn't change without this file changing. When the finish line is met, 1.0.0 is
  released and this file goes on as the spec of the app, edited in place (M4e).

**Not in v1:**

| Area | Left out |
|---|---|
| Solve | Systems of equations; a search with no range written (every root of a polynomial); a solve function over a range; complex roots; a setting for the tolerance or the search points |
| Units | Units defined by a sheet; scaled display units (`1000 Pa`) |
| Numbers | Digits per result; thousands separators |
| Lists | Two lists forming a grid (cartesian product); lists of lists |
| Formats | Sheet-wide rules (an "applies to"); text size, italic or alignment on a math line; alignment on a comment line; a colour picker or hex colours; rules on a title or a comment line; formatting a selected element, or several lines at once, from the Format tab |
| Programs | Mathcad's program block across lines (local names, `for`, `while`, `return`, the vertical bar); Calcpad-style `#if` / `#else` / `#end` lines; `ifs()` and `error()`; `<` and `>` on text; several statements on one line |
| Plots | A second y axis; zoom, pan or hover values on curves; renamed axis titles; chosen colours |
| Print | Printing a selection, frame or viewport; a scale setting; page guides on the canvas; Print on a phone or tablet; a preview inside Obsidian |
| Editing | Cancelling a line edit; placing the caret at the clicked character; Greek or operator characters in the source (`ρ`, `≤`) and new operators (integral, derivative): the Symbols tab types the text the engine already reads |
| Help | A Help tab in the panel, an example sheet, or a PDF guide: the Math guide is one Markdown file shown in a dialog |
| Files | Excalidraw's image export; a supported round trip through plain Excalidraw; several sheets in one window; embedding a sheet in an Obsidian note (`![[…]]`, as a picture or a live sheet); resolving links between sheets, or to notes, from inside a sheet |
| Platforms | The installed offline app (M6, after 1.0.0); touch and mobile layouts in the web app; browsers other than Chrome and Edge on desktop (a save and open fallback exists, untested); the plugin on iOS below 16.4; Excalidraw's embeds and library browsing in the plugin; the Sheet panel as a view in Obsidian's sidebar; a plugin settings tab |

The web app makes no promises on a touch device. The plugin does, from M4d: a phone
and a tablet edit everything desktop does ([section 4](#touch), [section 8](#on-a-phone)),
once the device checklist of [section 12a](#releases) has passed. Until then a
release ships desktop-only.

Decided in: [map](https://github.com/matheus-sancha/excalimathpad/issues/8),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38),
[the community listing](https://github.com/matheus-sancha/excalimathpad/issues/130),
[phone and tablet](https://github.com/matheus-sancha/excalimathpad/issues/127).

## 2. Terms and invariants

One name per concept, used the same in conversation, code, tests, docs and the UI.

### Terms

| Term | Means |
|---|---|
| **Sheet** | All live math elements in reading order, plus drawings and settings. The unit of evaluation |
| **Reading order** | By the top of each anchor's visual bounds, then its left, then its id. Derived, never stored |
| **Math element** | A block of source lines anchored at a scene position, shown as a typeset grid |
| **Anchor** | The marked Excalidraw rectangle that carries a math element. Its `customData` holds `kind`, `source` and, each optional, `title`, `titleFormat`, `width` and, from M4e, `formats` |
| **Line** | One string of an element's source: one statement. See [section 3](#3-sheet-lines-every-form) for its forms |
| **Typeset row** | One line on screen: *gutter · equation (name · `≔` · expression, plus guess, search range or step) · result · note* |
| **Line edit** | The one line shown as raw source, held as *anchor id + line index*. UI state |
| **Line commit** | The moment an edit leaves a line whose text differs from the scene. Writes the source once and, from M4e, the line's stored format with it |
| **Result** | What a line computes: a value with unit, a list, an error, or empty |
| **Shown result** | A result as displayed: in its display unit, else in the unit system, with Digits applied |
| **Plain input** | A line whose right side is a literal (`D = 102.3 mm`). Its result cell stays empty |
| **Problem** | An error or warning on a line, with its element and line. Derived |
| **Unit slot** | The clickable unit in a result cell or table header. The UI for a display unit |
| **Display unit** | Optional, per line, stored as a trailing `in <unit>`. Display-only |
| **Unit system** | One per sheet: SI with prefixes, SI base, USCS, plus optional per-kind overrides (Custom) |
| **Kind** | A dimension from a fixed list, such as pressure or volume flow |
| **App units** | The fixed list of extra units every sheet has, such as `cP` |
| **Digits** | Significant digits for every number shown. One per sheet |
| **Function definition** | A line that defines one name with parameters |
| **Solve line** | A line with `= solve`. Defines a **solved value**, searched over a range, or, with parameters, a **solve function**, started from a guess |
| **Equation, residual** | `lhs = rhs` on a solve line. The solver sees `lhs - rhs` |
| **Unknown** | A name bound only inside its own solve line's equation |
| **Guess** | A solve function's `guess <unknown> = <expr>`, evaluated each time the solve runs. It gives the search's start and the unknown's dimension |
| **Search range** | A solved value's `for <unknown> = <from> .. <to>`, evaluated each time the solve runs. It gives the span searched and the unknown's dimension |
| **Roots** | What a solved value holds: the roots found in its search range, ascending. One root is a single value; several are a list |
| **Solve details** | For a guess: method, iterations, final residual and bracket. For a range: method, range, points, the residual at each root and the crossings rejected. Shown on hover, never saved |
| **Range** | `a .. b step s`. Evaluates to a list |
| **List** | An ordered sequence of point results (value or error), all of one kind. It comes from a range, an iterating line or a solved value with several roots |
| **Iterating line** | A line that mentions a list outside an aggregate or an index. Runs once per point |
| **Index** | `x_r[2]`: one value taken out of a list, counting from 1 |
| **Aggregate** | `min`, `max`, `sum`, `mean`, `count`. Takes a list, gives one value |
| **Table line, plot line** | `table(…)` and `plot(…)`. Display only; each defines no name and draws under itself |
| **Clause** | A comma-separated setting after a plot line or solve line, such as `mark Q_op`, `guess f = 0.02` or `for Q = 1 L/s .. 30 L/s` |
| **Series, mark** | One list drawn on a plot; a value of the x kind drawn as a guide, dot and label |
| **Comment line, note** | A line starting with `#`; the text after `#` on a line with code |
| **Formatted comment line** | A line whose code is only a format clause, followed by comment text: `@bold @L # Pumps` (M4d) |
| **Format** | A line's `@` words, after its code and before its note: bold, underline, one text colour, one highlight. A comment line's also take italic off and a size (M4d). From M4e it is stored beside the line, not in its text ([section 3](#3-sheet-lines-every-form)) |
| **Plain format, rule** | A format word with no `if`, which always applies; `@word if <condition>`, which applies while its condition is true |
| **Joined word** | Several format words joined by `+` with no spaces, read as one word: `@text-red+red+bold` (M4d). One rule with one condition |
| **Conditional** | `cond ? a : b` or `if(cond, a, b)`: a value chosen by a condition, only the branch taken run (M4d) |
| **Text value** | A result that is text, such as `"Approved"`. Shown plain, without quotes (M4d) |
| **Text colour, highlight** | One of six colours for a line's or title's text; one of five soft bands behind a row or a header |
| **Result colour** | One per sheet: the text colour of every result's number and unit. Blue by default |
| **Sheet file** | Excalidraw scene JSON + the `excalimathpad` block. The sheet's only durable form |
| **Dirty** | The scene or settings changed since the last save or open |
| **Recovery copy** | The whole sheet file, its name and its file handle in IndexedDB. Exists only while dirty |
| **Sheet panel** | Excalidraw's sidebar, labelled **Math settings**, with the tabs Variables, Problems, Settings and Constants. From M4d: Format, Symbols, Variables, Problems, Constants, Settings |
| **Format tab** | The Sheet panel's tab that formats the open line or title (M4d). The only place to format; it replaced the format bar and the title's bar |
| **Symbols tab** | The Sheet panel's tab of buttons that type, at the caret, text the engine reads (M4d) |
| **Sample** | The top of the Format tab: the open line or title drawn as the sheet draws it (M4d) |
| **No-focus control** | A panel button that prevents `mousedown` and has `tabIndex={-1}`, so a press acts on the open line without leaving it (M4d) |
| **Math guide** | `docs/math-guide.md`, every form, key and setting with examples, shown in a dialog from ☰ (M4d) |
| **Plugin, vault sheet** | The Obsidian community plugin (`plugin/`); a `.excalimathpad` file opened from a vault in its view (M4d) |
| **Conflict copy** | `<name> (conflict YYYY-MM-DD HHmm).excalimathpad`, written beside a vault sheet when an outside change meets unwritten work (M4d) |
| **Quick keys** | The pinned row of no-focus keys above the panel's tab icons, on touch, while a line or title is open (M4d) |
| **Title** | A math element's optional name: plain text on one line, shown in a header above its lines. Never evaluated |
| **Title format** | How a title looks: bold, italic, underline, alignment, size, text colour and highlight. Stored beside the title, never in its text |
| **Chosen width** | A math element's optional width, set with the resize handles. Without one the element is **automatic** |
| **Floor** | The width an element's math lines and title need. Comments don't count toward it |
| **Laid-out width** | The larger of the chosen width and the floor |
| **Placing** | The UI mode between Add math and the click that creates the anchor |
| **Print pages** | The sheet laid out for its Page setting. Computed at print time, never stored |
| **Unbreakable box** | A math line, table row, plot, or drawing that fits a page. A break doesn't pass through one |
| **Pump sheet** | The [acceptance sheet](acceptance/pump-sizing.md) |

**Retired names:** *placeholder* (unit slot or display unit), *sheet default*
(unit system), *solve block* (solve line), *side panel* (Sheet panel), *pipe-flow
acceptance sheet* (pump sheet). From M4d: *format bar* and *title's bar* (Format tab),
*cheat sheet* (Math guide), *Math Settings* (Math settings, in sentence case).

### Invariants

**Sheet and evaluation**

- Scene coordinates are the only stored position. The screen position is derived.
- Evaluation never throws, and a failed line doesn't stop the lines after it.
- A line sees only names assigned above it in reading order. A later assignment
  silently redefines a name below it. A failed assignment removes the name.
- A result's value is a pure function of the sources in reading order: every run
  starts from a fresh scope, and no line can change the engine. A shown result also
  depends on the unit system and Digits.
- Results are never saved and never part of an undo step.

**Math element**

- At most one line across the sheet is in source form. Every other line is typeset.
- A result cell is always on its line's row.
- After every evaluation and every pointer release, an anchor's width equals its
  laid-out width and its height equals its content's. A size write never adds an undo
  step and never changes a value. Only a handle sets a chosen width, and that is a step.
- A laid-out width is never below the floor, so math never wraps and is never cut.
- Everything visible in an upright element is inside its anchor, so it can be
  clicked and dragged.
- After every scene change, an anchor has the fixed style. Only `opacity` varies. A
  restored style adds no undo step.
- An element's math, on screen and in print, has its anchor's opacity.
- Hover content is never printed or saved.
- Comments and notes never change a result. They live only in the line's source,
  and a note is always the last part of a line.
- A format never changes a result. A rule's condition reads the scope and never
  changes it, and a rule that can't be decided is skipped with a warning.
- A warning's `⚠` shows only while a line or the title of its element is open, or on
  its line while a jump flashes it (M4d). An error's `●` always shows.
- A line is one statement: a `;` at its top level is its error (M4d).
- Only the branch a conditional takes is run. Text compared with a number or a unit
  is an error, never a conversion (M4d).
- A title's text is exactly what was typed. Its format is never read from it.

**Units and numbers**

- A display unit, Digits and the unit system never change a value, only how it
  shows. Lines below use the full value.
- A result with no display unit always follows the unit system. A chosen unit has
  no mark: it is read from the line's source (`in <unit>`) and from its open slot.
- Every plain number has no more significant digits than Digits, and no digit that
  rounding invented.
- The source a user typed is never rewritten, except for what a slot or popover
  writes when asked.

**Solve**

- The residual's dimension is checked at the guess, or at the low end of the search
  range. A mismatch is an error at any trial point.
- A root lies inside a bracket of width no more than the fixed tolerance, or is a
  touching point the search found. Anything else is an error, never a value.
- A solved value holds the roots found in its range. Nothing shown calls them all
  the roots.
- The same sheet gives the same solve, with the same roots in the same order.
- A solved value runs once per run, at its line. A solve function runs at every
  call, and its definition can fail only for syntax.
- A range search never runs inside another, and never once per point: a solve
  function takes a guess, and a range solve can't use a list.

**Functions and lists**

- A definition never has a value or a display unit. Whether a function's result can
  be computed is decided at each call, and any error lands on the calling line.
- A warning never changes a result.
- A range's list has the length its range gives. A failed point never removes or
  shifts other points: index *i* is always the *i*-th value of the range. A solved
  value's list has one point per root found, so its length can change with the inputs.
- Iteration happens at the line, never inside a function body.
- A plot shows one kind on y and one on x. Clauses never change a value.

**Undo and files**

- A line commit's source change is exactly one undo step, and keystrokes are none. A commit
  can also record a nudge or Link edit before it as a step of its own ([section 6](#6-undo)).
- A press in the Format tab, a format key, an insert from the Symbols tab and a change
  of chosen width are each exactly one undo step (M4d; before it, a press on the
  title's bar).
- Sheet undo never runs while a line is being edited.
- A source write is never `EVENTUALLY` or the default capture.
- Settings changes never enter Excalidraw's undo history.
- In the web app, a file is written only by Save or Save as. In a vault (M4d), a
  sheet's file is written only by the view that loaded it, and only when its
  `saveKey` changes or its tab closes; viewing never writes. The one automatic write
  besides it is a conflict copy, which goes in the sheet's folder, never overwrites
  and is always announced.
- The app never writes a file whose `format` is newer than its own, and never opens
  one.
- Excalidraw's own file and export actions are never reachable. In the plugin, nor
  are Web Embed, Mermaid to Excalidraw, Browse libraries, Copy to clipboard as SVG
  and Excalidraw's command palette (M4d).
- The Sheet panel shows only what the last evaluation produced.
- The same scene, results and Page give the same print pages. Printing never changes
  the scene.

**Plugin** (M4d)

- The plugin makes no network request, ever. A link on an element still opens the
  browser, as the user's own action.
- It stores nothing outside the vault: sheets in their files, its own memory in
  `data.json`. No IndexedDB, no `localStorage`.
- It reads only the sheet open in its view and one image the user picks. It never
  lists, renames or deletes another note.
- `src/` never imports `obsidian` or `plugin/`. The same `.excalimathpad` file opens
  unchanged in both homes.

Decided in: the Model part of each ticket in [section 18](#18-decision-index).

## 3. Sheet lines: every form

Built in M1 to M4d, as tagged below. Assignment is plain `=`; `:=` isn't accepted.
Typeset, an assignment shows `≔`. One line is one statement: from M4d a `;` at a line's
top level is its error, and the message says to split the line there. A `;` inside
brackets (a matrix row, `[1, 2; 3, 4]`) is unaffected.

| Form | Example | Built in | Result cell |
|---|---|---|---|
| Blank | an empty line, or a bare `#` | M1 | Empty; a spacer row |
| Comment line | `# Water at 20 C` | M1 | None; one text cell spans the row |
| Formatted comment line | `@bold @L @text-blue # Pumps and pipes` | M4d | None; one text cell spans the row, in its format |
| Assignment | `v_d = v(Q_d)` | M0, M1 | Value |
| Plain input | `D = 102.3 mm` | M0, M1 | Empty, unless it has a display unit |
| Bare expression | `2 * pi` | M0, M1 | Value; name and `≔` cells empty |
| Conditional | `check = if(sigma <= sigma_allow, "Approved", "Rejected")` | `? :` M0; `if()` and text M4d | The branch taken: a value, or a text |
| Function definition | `Hp(Q) = H_0 - (H_0 - H_r) (Q/Q_r)^2` | M0, M1 | Empty; problems only |
| Solve line, value | `Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s` | M3; the range in M4c | The roots found: a value, or several |
| Solve line, function | `f(Re, r) = solve …, guess f = 0.02` | M3 | Empty; problems only |
| Range | `Q_s = 1 L/s .. 30 L/s step 1 L/s` | M4 | List summary |
| Table line | `table(Q_s, Hs(Q_s), Hp(Q_s))` | M4 | Empty; rows draw under the line |
| Plot line | `plot(Q_s, Hs(Q_s), Hp(Q_s)), mark Q_op` | M4 | Empty; the chart draws under the line |

Any form with code can end with a `# note`. Any line with a value can end with
`in <unit>`, on the left of the note:

```
dP_pipe = f_d * (L_p/D) rho v_d^2 / 2 in kPa # friction only
```

Any line with code can also carry a **format**: a clause of `@` words after everything
else and before the note, in any order.

| Word | Sets |
|---|---|
| `@bold`, `@underline` | The whole row |
| `@yellow`, `@green`, `@blue`, `@red`, `@gray` | A highlight: a band behind the whole row |
| `@text-black`, `@text-blue`, `@text-red`, `@text-green`, `@text-orange`, `@text-gray` | A text colour, from M4c: the equation and the result, not the note |

```
U = I_load * R in V @bold @text-red @yellow # check
```

- **A bare colour is always a highlight** (`@red`), and a text colour always starts with
  `text-`. A line can carry one of each.
- A highlight named twice keeps the last, and so does a text colour. A word that isn't a
  format (`@blod`, `@text-purple`) is an error on the line, and the line's value still
  reaches the lines below.
- The clause starts at the first `@` outside a string and runs to the note. An `@` in a
  string or in a note is left alone.
- **Joined words** (M4d): several words joined by `+` with no spaces are one word,
  `@bold+underline` meaning `@bold @underline`. A property named twice in one joined word
  keeps the last. A part that isn't a format (`@text-red+blod`) is the line's error.
- Blank lines take no format.

**A comment line's format** (M4d) is a clause written in front of its `#`:
`@bold @L @text-red # Pumps and pipes`. The comment split stays the first step of reading,
so nothing after a `#` is read: `# call me @home` stays plain text, and every comment
saved before M4d reads as before. Until M4e the clause is text in the line; from M4e it is
stored beside the line like any other format, below.

**Where a line's format lives** (M4e). A line's format, its words and its rules, is not part
of the line's text. It is saved beside the line ([section 7](#the-file)) and shown and changed
in the [Format tab](#format-tab). The open line's field shows the math and the note only. This
holds for a math line and a comment line alike.

- **Typing it still works.** `@bold`, `@text-green` and a rule such as
  `@text-red if v > 3 m/s` may be typed at the end of a line (in front of the `#` on a comment
  line), with the same words, the same suggestions after `@` and the same errors. While the
  line is open a typed clause shows live. When the line is committed, everything from the
  first `@` outside a string up to the note moves out of the text into the line's format, in
  front of what is already stored; a typed word that clashes with a stored one (a second
  colour) replaces it. The next time the line opens, the field shows the math alone.
- **Enter** in a line: the first half keeps the format; the new line starts with none.
- **Backspace** at the start of a line: the joined line keeps the upper line's format; if the
  upper line had none, it keeps the lower line's.
- **Copying a line's text** copies the math, not the format. Copying, pasting or duplicating
  the math element carries every line's format. Text pasted with an `@…` in it is read as
  typed.
- **The engine** reads the format from where it is stored. A clause found in a line's text (a
  typed one not yet committed, or a hand-edited file) is read as before and joined in front
  of the stored one. Rules run after the line, in the same scope, as before.
- The open line shows no marker for a stored format: the Format tab and the typeset row show
  it.
- **What counts as committed.** The clause moves out when the edit leaves the line: ↑ / ↓,
  Enter, Backspace at the start, a click elsewhere, Esc, Done. A save while the line is still
  open (Ctrl+S, a vault's autosave) writes the text as typed, the clause still in it, so
  typing isn't cut short; the clause moves out when the edit then leaves the line. A line
  that holds a clause in its text (a hand-edited file) is put right the same way, the first
  time an edit leaves it, typed or not.
- **Enter with a clause typed in the line:** a clause before the caret goes to the first
  half's format. Text after the caret is the new line's own, read as typed, so
  `a = 1│ @L # Results` leaves `a = 1` and a new comment line `# Results` in the L size.
- **Backspace with a clause typed in the lower line:** it is read on the joined line, and
  moves out in front of the format the joined line keeps.
- A format is kept for whatever its line holds: on a line emptied to a blank it formats
  nothing, and shows again once the line has code or comment text.
- A line that doesn't parse shows as its text, which doesn't hold the stored clause.

| Word, on a comment line | Sets | Without it |
|---|---|---|
| `@bold`, `@underline` | Bold; underline | Off |
| `@upright` | Not italic | Italic |
| `@S`, `@L`, `@XL` | Size: 13, 20 or 26 px | M, 15 px |
| `@text-black` … `@text-gray` | The six text colours | Grey (`--math-quiet`) |
| `@yellow` … `@gray` | The five highlights, a band behind the row | None |

- There is no alignment: a comment runs from the row's left edge. A comment line takes no
  rules: a word followed by `if` is the line's error ("rules need a math line").
- A clause with no comment text after it (`@bold`, or `@bold #`) formats nothing: the line
  stays a blank line, and the Format tab offers no format on it.
- `@S`, `@L`, `@XL` and `@upright` are comment words. On a math line each is the line's
  error ("@L is for comment lines"), and the line's value still reaches the lines below.
- A note (the `#` text after code) is unchanged: it follows its line's bold, underline
  and highlight, and stays grey, italic and 15 px whatever the line's text colour.

**A rule** (M4c) is a format word followed by `if` and a condition. The word applies while
the condition is true. A word with no `if` is a **plain format** and always applies.

```
v = Q / A @bold @text-red if v > 3 m/s @text-orange if v > 2 m/s # check
```

- **Each word takes its own `if`.** A condition runs from `if` to the next `@`, or to the
  end of the code. From M4d, two formats under one condition are one joined word with one
  `if`: `@text-red+red if v > 3 m/s`. Written twice, `@text-red if v > 3 m/s @red if v > 3 m/s`,
  they stay valid: two rules.
- A line can hold any number of rules, in any order with its plain formats.
- **The first true rule wins, left to right,** like `if / else if`, so the strictest limit
  is written first. Text colour, highlight, bold and underline are each decided on their
  own. When no rule for one of them is true, the line's plain format applies, wherever it
  is written; with none, the defaults.

  ```
  @text-blue @text-red if v > 3 m/s @text-orange if v > 2 m/s
  v = 3.4 m/s → red      v = 2.5 m/s → orange      v = 1.0 m/s → blue
  ```

- **A condition** is an ordinary expression with units that gives true or false:
  comparisons, `and`, `or`, `not`. It reads every name defined above the line and the name
  the line defines, so a limit can be another variable:
  `sigma = F / A @text-red if sigma > sigma_adm`.
- **`result`** stands for the line's own value, so a line with no name can be tested
  (`Q / A @text-red if result > 3 m/s`) and a rule survives a rename. Inside a condition
  `result` is always the line's value, even on a sheet that defines a variable `result`.
- **A condition that can't be decided is a warning,** and the rule is skipped: an
  undefined name, units of different kinds (`v > 3 kg`), something that isn't true or
  false (`@text-red if v`), or an assignment. The line keeps its value and its other
  formats. This differs on purpose from a misspelt word, which is the line's error.
- A line whose own result is an error runs no rules and adds no warning. A plain input
  has a value, so its rules run. A line with no single value (a function definition, a
  plot) can't use `result`: that is a warning.
- On a list or a table a rule is tested per point ([section 10](#ranges-and-lists)).
- Rules are typed, in the line. From M4d the Format tab's **Rules list**
  ([section 4](#rules-list)) adds, removes, reorders and formats them, writing the same
  clause; until M4e the condition is always typed in the line. From M4e the clause it writes
  is the line's stored format and a rule's condition is edited in the list; a rule typed in the
  line moves there when the line is committed, or when the list next writes.

**Conditionals and text** (M4d)

- **Two forms choose a value:** `cond ? a : b`, as before, and `if(cond, a, b)`, an app
  function. Both run only the branch taken. Several branches are written by nesting:
  `if(sigma < 100 MPa, "low", sigma < 140 MPa ? "mid" : "high")`. There is no `ifs()`
  and no `error()`. `if` becomes a reserved name; it never clashes with a rule's `if`,
  because the clause starts at the first `@` outside a string.
- **Branches of different kinds are allowed,** with no check: `if(ok, sigma, "too high")`.
  A mistake surfaces where the value is used.
- **Text** is written in double quotes. `==` and `!=` compare two texts exactly, case
  included: `"Approved" == "approved"` is false. Comparing text with a number or a unit is
  the line's error ("can't compare text with a number"); `"10" == 10` is that error, not
  true. `<` and `>` on text are not supported.
- **`true` and `false`** are values like any other. Arithmetic on them is math.js's
  (`ok + 0` is 1).
- A text typed as is (`status = "OK"`) is a plain input: its result cell stays empty, as
  `D = 102.3 mm`'s does, and the Variables tab shows it.
- So a check reads, and colours, as text:

  ```
  check = if(sigma <= sigma_allow, "Approved", "Rejected") @text-green if result == "Approved" @text-red if result != "Approved"
  ```

  How a text result, a conditional and `true` / `false` show is in
  [section 4](#conditionals-and-text-typeset) and [section 5](#shown-result).

A solve line follows the same order: `in <unit>` comes after the range or the guess, and the
format after that. `in <unit>` sets the result's display unit and doesn't convert the range
or the guess. A clause added later goes before it.

```
Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s in L/s
```

**An index** (M4c) takes one value out of a list, counting from 1: `x_2 = x_r[2]`,
`Q_s[5]`.

- It goes on a name. The index is any expression giving a whole number with no unit, 1 or
  more: `x_r[count(x_r)]` is the last. Anything else, or an index past the end, is an error
  on that line.
- A name inside an index doesn't make the line an iterating line: `x_r[2] + 1` is one
  value.
- On a single value, `x[1]` is the value itself, so a line written with `[1]` works
  whether a solve found one root or several.
- An index on a failed point is that point's error.

**How a line is read, in this order:**

1. **Comment:** split at the first `#` outside a string. Nothing after it is read.
   From M4d, a line whose code is only a format clause, with comment text after the `#`,
   is a formatted comment line, and its clause is read as the comment's format.
2. **Format:** take off everything from the first `@` outside a string: the format
   words (from M4d, `+`-joined words too) and, from M4c, each word's `if <condition>`.
   math.js rejects `@`, so a clause can never be read as code. A condition goes to
   math.js on its own, after the line has run. From M4e the line's stored clause is read
   with it, after any clause found in the text: a plain word in the text replaces what the
   stored clause says of the same property, and the text's rules come before the stored
   ones.
3. **Display unit:** take off a trailing top-level `in` or `to` whose target is a
   pure unit. The target is read outside the sheet's scope, so a variable named `K`
   doesn't change what `in K` means. A conversion inside the expression
   (`(a in bar) + …`) stays math.js's own.
4. **Form:** recognise solve (`= solve`), range (`..`), `table(` and `plot(`, and
   take off their clauses. A solve line's `for … = a .. b` is its clause, not a range line.
5. **Index:** from M4c, read each `name[…]` as the app's own index. math.js never sees
   it, because lists are the app's and not math.js matrices.
6. **One statement:** from M4d, a `;` at the top level of what is left is the line's
   error. math.js would otherwise run both statements.
7. **The rest goes to math.js.**

**Rules for what the app writes:** the unit slot, the plot popover and the Format tab
(before M4d, the format bar) write before the `#`, so a line reads
`D = 102.3 mm in cm @bold # 4" Sch 40`. The slot and the popover don't put the line in
source. Each write is one line commit. From M4e the Format tab writes the same words, in the
same order, into the line's stored clause, not its text: the line reads `D = 102.3 mm in cm
# 4" Sch 40`, and `@bold` is stored beside it.

- The Format tab writes a math line's plain words in a fixed order,
  `@bold @underline @text-<name> @<highlight>`, and then every rule.
- It writes a comment line's words in the order
  `@bold @upright @underline @<size> @text-<name> @<highlight>`, before the `#`.
- A rule the Rules list adds or changes is written as one joined word and one
  condition: `@text-red+red+bold if v > 3 m/s`. A rule it didn't change is kept exactly
  as typed, joined or not, and is never rewritten.

**Parsing notes that catch people:**

- A name directly before `(` is a function call. `f_d (L_p/D)` errors if `f_d` is a
  number; write `f_d * (L_p/D)`. See [section 13](#13-messages) for the message.
  `(…)(…)` and `2 (…)` multiply as usual.
- `min` is a math.js function, so litres per minute is `L/minute`.
- `table`, `plot` and `solve` are reserved, and from M4d `if`. Assigning to one is an
  error on the line.
  `result` isn't reserved: it has its special meaning only inside a rule's condition.

**Function definitions:**

- A definition's body isn't evaluated at the line, except for checking names. Functions
  bind late: `f(x) = k * x` uses `k`'s value at the call.
- It fails only for a syntax error, a trailing `in <unit>`, or a list from outside the
  body. As for any line, a failed definition removes the name.
- `in <unit>` belongs on the calling line, which is an ordinary result:
  `dP = p(100 kPa) in bar`. A conversion inside the body stays math.js's own.
- Recursion with an end works (`fact(5)` is 120).
- **Functions as values:** `r = q` works as an alias, and `r(3)` calls it. Any line whose
  value is a function leaves its result cell empty.
- A function named like a unit or built-in wins, with the warning: after `g(x) = x^2`,
  `5 g` is an error, not grams. A parameter named like a unit wins inside the body: after
  `u(s) = s + 5 s`, the `5 s` is 5 times the parameter.

Decided in: [solve](https://github.com/matheus-sancha/excalimathpad/issues/19),
[ranges](https://github.com/matheus-sancha/excalimathpad/issues/20),
[plots](https://github.com/matheus-sancha/excalimathpad/issues/31),
[functions](https://github.com/matheus-sancha/excalimathpad/issues/27),
[comments](https://github.com/matheus-sancha/excalimathpad/issues/36),
[unit slot](https://github.com/matheus-sancha/excalimathpad/issues/16),
[Mathcad research](https://github.com/matheus-sancha/excalimathpad/issues/15),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38),
[all-roots solve](https://github.com/matheus-sancha/excalimathpad/issues/92),
[text colours](https://github.com/matheus-sancha/excalimathpad/issues/93),
[conditional formats](https://github.com/matheus-sancha/excalimathpad/issues/94),
[comment-line formats](https://github.com/matheus-sancha/excalimathpad/issues/119),
[the Rules list](https://github.com/matheus-sancha/excalimathpad/issues/123),
[programming forms](https://github.com/matheus-sancha/excalimathpad/issues/132).

## 4. Math element: look and editing

Built in M1. Hover details arrive with M3; the unit slot with M2. Text colours, rules, the
title's format and the chosen width arrive with M4c. With M4d the Format tab replaces the
format bar and the title's bar; comment lines take a format; conditionals draw a brace;
the Symbols tab inserts at the caret; and the sheet works by touch.

### Typeset grid

- A math element is a **worksheet block**. Each line is its own display, **flush left**:
  name, `≔` and expression together, from the element's left edge. `≔` doesn't line up
  between lines, and a bare expression starts at the left edge like the rest. There is no
  alignment setting.
- A row is as tall as its tallest cell.
- **Result column:** one per element, right of its longest line, after a thin
  column rule. A value shows typeset, without a leading `=`. Columns aren't lined up
  across elements.
- **Note column:** one per element, right of the result column, in the same text
  style as a comment line. A plain input's empty result cell keeps its note in line
  with the others.
- **Comment line:** plain literal text from the row's left edge, ignoring the
  columns. A comment longer than the element is wide wraps onto more rows, so it never
  sticks out past the results and notes. No typeset math or `##` headings. From M4d a
  comment line takes its [format](#3-sheet-lines-every-form): bold, italic off, underline,
  size S/L/XL (13, 20, 26 px; M stays 15 px), a text colour and a highlight that fills its
  row. Its line height keeps the ratio 1.6 to its size. Underline may be a plain text
  decoration, since a comment has no KaTeX.
- **Title:** optional. An element with a title shows it in a **header** at the top of its
  box, above the lines: plain text on one line, with a thin rule under it. It is
  never evaluated and takes no typeset math. With no format of its own it is bold, black,
  16 px and at the left; its [format](#title-format) changes that. An element with no title
  has no header and looks as it always did. The header follows the element's opacity.
- **Empty cells:** a plain input and a function definition leave the result cell
  empty. A bare expression has no name or `≔`.
- **Solve line:** `Q_op ≔ solve H_p(Q) = H_s(Q)`, with the search range
  (`Q = 1 L/s … 30 L/s`) or the guess (`f = 0.02`) small and grey after the equation,
  inside the expression cell.
- **Range line:** `Q_s ≔ 1 L/s … 30 L/s`, with the step small and grey after it.
- `in <unit>`, plot clauses and the format clause don't show when typeset. They show
  in source.
- **Format:** a line's bold, underline and highlight apply to its whole row: equation,
  result and note. The highlight is a soft band behind the row, in one of five colours
  that keep the text readable, in the dark theme too. On a table or plot line it covers
  the line's own row, not what draws under it. A line that doesn't parse shows no format.
  Text colours and rules are under [Colours and rules](#colours-and-rules).
- **Dark theme:** in Excalidraw's dark theme the math takes the canvas's own filter, so it
  darkens exactly as drawings do. Print stays light.

### Colours and rules

Built in M4c. There are six **text colours**, one list for a line, a title and the sheet's
results. There is no picker and no hex value. The five highlights are a separate list and
don't change.

| Name | Value | |
|---|---|---|
| `black` | `#1e1e1e` | An equation's colour by default |
| `blue` | `#1971c2` | A result's colour by default |
| `red` | `#e03131` | |
| `green` | `#2f9e44` | |
| `orange` | `#e8590c` | Stands in for yellow, which doesn't read as text |
| `gray` | `#868e96` | |

- **The sheet's result colour** colours every result's number and unit: one row in the
  Settings tab, **Result colour**, from the six, blue by default. Equations stay black; there
  is no sheet-wide equation colour. It is a setting: a change marks the sheet dirty and isn't
  in undo.
- **A line's text colour** (`@text-red`) colours its equation and its result: the name, `≔`,
  the expression, the result's number and unit. On its line it wins over the result colour.
  **The note stays grey.**
- **It also colours** a list's summary, written-out roots and a table's cells on that line.
- **Never recoloured:** an error's message (red), the gutter's marks, a note, a solve's
  range or guess and a range's step (grey), and plot series. A comment line is grey unless
  its own format names a text colour (M4d); the result colour never reaches it.
- A line being edited shows its source uncoloured. Its live result takes its colour.
- The Variables, Problems and Constants tabs keep their own colours.
- In the dark theme the six darken with everything else, under the canvas's filter. In print
  they show as on a light screen.

**A rule on the sheet** (its grammar is in [section 3](#3-sheet-lines-every-form)):

- A rule's format shows exactly as the same plain format would: a text colour on the equation
  and the result, a highlight behind the row, bold and underline on the whole row.
- **A rule that can't be decided** puts an amber `⚠` in the gutter, with the reason on hover
  and in the Problems tab. The result still shows, with the line's other formats.
- A warning from a condition is reported once per rule, not once per point of a list.
- A rule's `⚠` shows by the rule of [Problems](#problems): only while its element is being
  edited.

### Typesetting names

Lines typeset through math.js `toTex` with one custom handler, then KaTeX.

- Text after the first `_` is the subscript: upright if multi-letter, italic if one
  letter or digits (`L_pipe`, `H_0`, `Q_s`).
- A Greek word becomes its letter when it is the whole base or is followed by a
  capital (`rho_w` → ρ_w, `DeltaP` → ΔP). A Greek word that is the whole subscript
  becomes its letter too (`T_alpha` → T_α).
- Other multi-letter names are one italic word (`Re`, not R·e).
- Parameters follow the same rule as names in the body.
- Definitions use `≔`.
- Results typeset from the text `math.format` shows: number and unit split, unit
  typeset.
- Micro shows as `µm`, not math.js's `um`. `ohm` shows as Ω (`kohm` as kΩ), `deg` as °.
- An index (M4c) shows in square brackets after the whole name, at the baseline: `x_r[2]`.

### Conditionals and text, typeset

From M4d.

- **`? :` and `if()` draw the same brace, flattened.** Each row reads the value, then "if"
  and its condition; the last row reads the value, then "otherwise". A conditional nested
  in the last branch adds a row, never a brace inside a brace.

  ```
  band = if(sigma < 100 MPa, "low", sigma < 140 MPa ? "mid" : "high")

            ⎧ “low”,   if σ < 100 MPa
   band ≔   ⎨ “mid”,   if σ < 140 MPa        mid
            ⎩ “high”,  otherwise
  ```

  A conditional in an earlier branch keeps its own brace, inside its row. A brace that is an
  operator's operand, `if(ok, 1, 2) + 3`, sits in brackets, so the operator doesn't run into its
  last row; a fraction's bar and a root's sign set it apart already, so there it has none.
- **A text literal in an equation** is upright, in quotes: `“Approved”`, not math.js's
  monospace.
- **`true` and `false`** are upright words, in an equation and in a result.
- **A text result** shows plain, without quotes, upright, in the result colour (or the
  line's text colour), in the result cell and in table cells. The Variables tab shows it
  the same way.

### Problems

| Problem | Gutter | Elsewhere |
|---|---|---|
| Error | Red `●` | Its message takes the result cell, in red |
| Line that doesn't parse | Red `●` | Raw source in red with a wavy underline, over the line's equation space (where the field opens); any `#` part stays in it, so no note cell. Its message takes the result cell, as for any error |
| Warning | Amber `⚠` | Message on hover over the mark; the line's value still shows. From M4d the mark shows only while its element is being edited (below) |

**An error is capped** at about 320 px of the result column and ends in an ellipsis.
The full text is on hover and in the Problems tab.

**A warning at rest** (M4d). An element's `⚠` marks show while any of its lines or its
title is open, and are hidden otherwise. Being selected is not being edited. While an
edit is open, other elements keep theirs hidden, even when the edit causes a warning
there.

- The gutter keeps its fixed column, so rows don't shift when an edit opens. A hidden
  mark has no hover.
- A jump from a `⚠` row in the Problems tab shows that line's `⚠` for as long as the
  line is flashed or outlined, then hides it again. Nothing opens.
- The Problems tab still lists every warning. Its badge counts errors only
  ([section 8](#sheet-panel)).
- It is fixed behaviour, with no setting. Print already leaves `⚠` off.

### Unexpected failures

From M4e (the line's guard is in 0.2.1). An unexpected failure is the app's own fault, not
the sheet's. It stays as small as the thing that failed, says whose fault it is, never writes
the file, and offers details to report that hold no sheet content.

- **A line.** An unexpected throw while one line is read, its parse included, is that line's
  error: `this line hit an unexpected error in Excalimathpad`, in the result cell. The raw
  text of the failure is on hover and in the Problems tab, under those words. The line shows
  as its plain source. The lines below still run; a name the line defines reads
  `x has an error above` below it.
- **A math element** has its own boundary. A failed element shows its lines as plain text
  under a red `●` and `this element hit an unexpected error in Excalimathpad`. It can still
  be opened and edited. The other elements, the drawings, the canvas and the panel keep
  working.
- **A chart** that fails to draw shows `this chart hit an unexpected error in Excalimathpad`
  in its box, which keeps the chart's size; its line stays. The raw text of the failure is on
  hover.
- **A panel tab** has its own boundary: `this tab hit an unexpected error in Excalimathpad`,
  with the raw text of the failure on hover. The other tabs keep working.
- A boundary tries again when its element's lines or results change: an element's also when
  a line or the title opens in it, a chart's when its plot changes, and a tab's when the
  sheet, what is open, the selection or the settings change.
- **A failed element being edited** shows the open line, or the title, as a plain field in
  place of the line's own: it takes typing, Enter, ↑, ↓, Backspace at its start and Esc, with
  no suggestions and no format keys. Each change tries the element's own view again.
- **The whole view.** A failure outside every boundary replaces the view with a failure
  screen:

  ```text
  This sheet hit an unexpected error in Excalimathpad.

  Your sheet is kept up to the last finished line. You were typing:

    zone_x = r_t cos(theta) i     [ Copy ]

  [ Reload the sheet ]   [ Copy details ]   Report this error
  ```

  - **The failed view never writes the file.** In a vault, what the tab holds is the sheet as
    of the last line commit or scene change; on the web, the recovery copy. A broken scene
    can't overwrite a good one.
  - **Reload the sheet** mounts the sheet again from that kept copy, as an open does: no undo
    step, history cleared. On the web nothing is asked, and the sheet keeps its name and is
    unsaved if it was. In a vault, a kept copy the file doesn't hold is written by autosave
    from then on, as any change is. If the view failed before its sheet had loaded, there is
    no kept copy: the web starts as it does on a launch, and a vault's tab opens its file as
    last written.
  - The line being typed is shown as text to copy, and isn't put back by itself, since it may
    be the cause. With no line open, that part of the screen is left out.
  - If the reloaded sheet fails too, the screen shows again, and the kept copy stands.
  - **What counts:** a failure while the view is drawn or laid out. A failure in the app's
    answer to a key or a press, with nothing being drawn, leaves the view as it was.
- **Copy details** puts a short text on the clipboard: the version and build stamp, web or
  Obsidian plugin (and desktop, phone or tablet), what failed (a line, an element, a chart, a
  tab, the view), and the error with its stack. It ends `(no sheet content is included)`. It
  holds no line text, name or value: every line and title of the sheet, each word and number
  in them, each name a line defines and each result as shown is cut from the error's text and
  replaced by `…`, where it stands as a whole word. A one-letter name and any other text
  under three characters stay, since cutting each `a` or `2` would leave no error to read. A
  word of the sheet that is also a word of the error is cut too; the stack's frames, which
  are places in the app's code, are whole. The button reads `Copied` once the text is on the
  clipboard; where the clipboard refuses, the text shows in a box to copy by hand.
- **Report this error** is a plain link to the repository's new-issue page, with nothing
  filled in. The app sends nothing by itself.
- Copy details and Report this error appear on the failure screen, on a failed element, and
  on the failed line's row in the Problems tab.
- **In print** a line's unexpected error and the notice in place of a failed element or chart
  print as they show, as errors do.

A line that would freeze the sheet or run it out of memory can't be caught this way; it is
stopped before it runs ([section 10](#ranges-and-lists)).

### Solve details

Hovering the result of a solve line (`Q_op`), or of a line that is just one call to a
solve function (`f_d = f(Re_d, eps/D)`), shows its details. A dotted underline marks a
result that has details. A line where the solve runs deeper (`H_d = Hs(Q_d)`) and a solve
function's definition show none. Hover is screen-only.

- **A call to a solve function** (a guess): the method, iterations, residual with its unit,
  and the bracket.
- **A solved value** (a range, from M4c): the method (scan + Brent), the range searched, the
  200 points, each root with its residual, a root that only touches zero marked "touching",
  and how many crossings were rejected as poles or jumps. It never says the roots are all of
  them: it says "roots found in 1 .. 30 L/s".

### Gestures

- **Single click** selects the anchor. **Dragging from anywhere** on it moves it.
  There is no grip. Both are Excalidraw's own behaviour.
- **Double-click on the header** edits the title, by the same rule as a line.
- **Double-click on a line** edits that line, with the caret at the end. A chart or
  table counts as part of its line's row. Excalidraw's own first click decides whose
  double-click it is: math's when it selected the element, on its own or through its
  group, so a **grouped** element edits straight away. A **drawing on top** of the
  element took that click, so it keeps Excalidraw's double-click (its label). A
  **locked** element still edits: the lock holds its position only.
- **Arrows bind** to a math element, even when drawn from inside it, and follow it
  when it moves. **Known limit:** a size write doesn't move a bound end, so an end
  bound to the right or bottom edge stays where it was until the element next moves.
- **Enter** on one selected math element edits its **last line**, with the caret at
  the end.
- The rotate handle works. Until M4c, **resize handles snap back** to the fit, in place.
  **Known limit:** the resize still marks the sheet dirty, though nothing changes: Excalidraw
  changes the scene while the handle moves.
- **From M4c the resize handles set the element's width** ([Size](#size)). A change of
  height by a handle is still discarded.
- **By touch** (M4d), see [Touch](#touch).

### While editing a line

- The line becomes a source field over the line's equation space, starting
  where the typeset line did, so the text doesn't move. Until M4e the field is one row; from
  M4e it wraps, below. Its result cell shows the live result as plain text, and its note cell is
  empty because the note is in the field.
- The sheet re-runs on every keystroke. Every other line stays typeset and updates
  live.
- **The math is always drawn on its box** (0.2.1, [#191](https://github.com/matheus-sancha/excalimathpad/issues/191)): nothing but the canvas's own
  pan and zoom moves it. The overlay can't be scrolled by the browser.
- **The view follows the caret** (0.2.1). When a line or the title opens, on Enter, on ↑ and
  ↓, and while typing, if the caret's row isn't wholly inside the visible area less a 48 px
  margin, the canvas scrolls the least distance that puts it there: up, down or sideways.
  Otherwise nothing moves. There is no zoom change, no undo step, no animation, and no scroll
  back when the edit ends. A pan by hand during an edit is left alone until the caret next
  moves. The caret's row is the open field and, once the field has wrapped (M4e), the one of
  its rows the caret is on, so the view follows the field down as it grows. A row wider than
  the visible area less both margins can't fit (a very long title, or a line whose element
  starts left of the visible area), so there the view follows the caret itself. Where the visible area is
  too small for the row and both margins, the margin gives way and the row is centred. The
  suggestion list keeps its own rule and doesn't move the view.
- **The visible area** is the canvas less the Sheet panel where it covers the canvas (a
  floating panel, and a docked one, which Excalidraw draws over the canvas's right) and, on a
  phone, the bottom sheet and the keyboard. When it changes during an edit (the panel the edit
  opens is drawn, the keyboard comes up) the caret is followed again.
- **Enter** splits the line at the caret and continues on the new line below. At the
  end of a line, that opens an empty line.
- **↑ / ↓** move the edit to the line above or below.
- **↑ on the first line** goes to the title, and so does the Format tab's **Edit title ↑**
  link (before M4d, the bar's **Title** button), from any line. If the element has no
  title, this opens an empty one. In the title, **↓** or **Enter** go to the first line,
  and Esc or a click outside leave. The title keeps what was typed, trimmed; an empty one
  removes the header.
- **Backspace** at the start joins the line to the one above.
- **The field wraps** (M4e). A line longer than the wrap width continues on the next row of
  the field, and the element grows taller, not wider. The wrap width is the element's
  [chosen width](#chosen-width) when it has one. With none, it is the space from the element's
  left edge to the visible area's right edge less the 48 px margin, measured when the line
  opens and kept until it closes (a pan or a resize during the edit doesn't re-wrap), and at
  least 240 px. If the element's left edge is out of view, or 240 px doesn't fit, the canvas
  scrolls sideways by the follow rule (0.2.1,
  [#191](https://github.com/matheus-sancha/excalimathpad/issues/191)). ↑ and ↓ move between
  the field's rows and leave the line only from its first or last row. Enter still splits the
  line; a pasted newline becomes a space. Typing in a Format tab field doesn't move the view.
  - **The field shares the wrap width with the rest of its row:** the gutter, the padding and
    the result and note columns, as wide as they are when the line opens. So the element, not
    the field alone, ends at the wrap width. A result that grows wider while the line is typed,
    an error's message most of all, can widen the element until the line closes; the field's
    own rows don't move for it.
  - **Where the other lines already need more than the wrap width,** the field wraps at the
    width their equations take, and the element is no wider than it was. The field is never
    narrower than about 20 characters, the room a short or empty line's field has always had.
  - **The wrap width is in the sheet's own px,** as every size of the element is: at 200 %
    zoom the same window holds half as many characters a row, and the least is 240 px at 100 %.
  - **The panel an edit opens** covers part of the visible area once it is drawn: the wrap
    width is measured again then, once. After that it is kept as stated.
  - **At the end of a row** the caret counts as at the start of the next one, which is the same
    place in the text: there **↑** on the first row goes to the start of the line first, and
    **↓** on the last row but one leaves the line.
  - **The suggestion list** opens under the caret's row, or above that row, not under the
    whole field.
  - **The title's field never wraps** ([Title format](#title-format)). A newline dropped into
    the field, like a pasted one, becomes a space.
- A **single click on another line** of the element moves the edit there.
- **Formatting** is done in the [Format tab](#format-tab), which opens when an edit starts
  (M4d). Until M4d a floating **format bar** beside the open line did it; the bar and the
  title's bar are removed. **Ctrl+B** and **Ctrl+U** toggle bold and underline from the
  field, on a math line, a comment line and the title. **Ctrl+I** toggles italic on a
  comment line (writing or removing `@upright`) and on the title, and does nothing on a
  math line. A clause typed by hand shows live, like any other typing, and from M4e moves to the
  line's stored format when the line is committed ([section 3](#3-sheet-lines-every-form)).
- The line and title fields set `autocapitalize="off"`, `autocorrect="off"` and
  `spellcheck={false}`, and carry `data-prevent-outside-click`, so a press in the field
  never closes a floating panel (M4d).

**Suggestions:** while a name is typed, a list under the field offers the names that start
with it, from the first letter, at most eight.

- **From four places:** the sheet's names defined above the line, the nearest first, each
  with its value (`speed` · `3 m/s`) or signature (`H_s(Q)`); the functions and line forms
  (`sqrt`, `solve`, `plot`); the [constants](#constants), by short and long name, with what
  they are and their value; and the units, with their kind.
- **Order:** names with the same capitals as typed come first; then the sheet's names; then
  the rest, shorter names first.
- **Keys:** **Tab** takes the highlighted name, or the first if none is. **↓** moves the
  highlight into the list and **↑** back out of it. **Enter** takes a highlighted name;
  with nothing highlighted it splits the line as always, so typing and Enter work as
  without a list. **Esc** closes the list and keeps the line open; a second Esc leaves. A
  click on a name takes it. **↑** with nothing highlighted moves to the line above.
- **Taking a name** replaces the typed word. A function adds its bracket (`sqrt(`), and
  `solve`, `guess`, `for` and `step` a space. It is typing: the field's own Ctrl+Z takes it back.
- **After `@`** (M4c) the list holds the format words, and `if` after a word. On a
  comment line's clause (M4d) it holds the comment words.
- **`if`** (M4d) is among the functions, with its hint `if(cond, a, b)`.
- **Above the field** (M4d) when below it would be covered by the on-screen keyboard or a
  bottom sheet. A tap on a name takes it, as a click does.
- **No list** where there is nothing to complete: inside a word, after a number (`10k`),
  in a comment, in a quoted plot title, on the element's title, after a name typed in full,
  or after a unit typed in full (`3 m/s`), where one more letter brings it back.
- **After `in` or `to`** the list holds units only.
- The list is screen only: it never changes the element's size, the scene or print.

**Leaving:**

- **Esc** goes back to typeset with the element still selected. A second **Esc**
  deselects everything whenever the selection includes a math element, mixed
  selections too. Excalidraw doesn't do this itself, so the app does. A selection of
  drawings only keeps Excalidraw's Esc.
- A **click outside**, or starting a drag on the element, also leaves.
- Leaving always keeps what was typed. There is no cancel.
- An element left with no text is removed when the edit leaves it, whether new or
  emptied. An element holding only comments, or only a title, isn't empty; one holding
  only spaces and blank lines, with no title, is. The edit leaves the element on Esc, a click outside, a drag, or a
  line opened in another element; moving between its own lines never removes it.
- The removal is the only undo step, and it doesn't write the line. So Ctrl+Z brings
  an emptied element back with the text the sheet last held, and a new one back as an
  empty box.

### Size

A math element's box always fits its content. The app measures the content and writes
the size to the anchor, live, while typing too. Until M4c the width is always automatic;
from M4c it can be the user's ([Chosen width](#chosen-width)).

- **Counts toward width:** the equation (name, `≔` and expression), a solve's range or guess,
  a range's step, result values, list summaries, tables, charts, notes, comments, the gutter
  and the title, at its size. The header adds to the height, and a larger title makes it taller.
- **Doesn't:** error text past its cap, and a comment past 320 px: the math lines and their
  notes set the width a comment wraps at, and a comment asks for at most 320 px itself, so
  prose alone or beside short math isn't broken into a thin column. From M4d the request
  scales with the comment's size: about 277 px at S, 320 at M, 427 at L and 555 at XL, so
  a heading wraps at about as many characters as an ordinary comment.
- **A very long line widens the element.** One source line of math stays one row; a comment
  line wraps. You can
  split it yourself with Enter. From M4e the line's open field wraps instead
  ([While editing a line](#while-editing-a-line)): while it is open the element is as tall as
  the field's rows make it, live, and no wider than the wrap width or what its other lines
  need. When the edit leaves the line it is typeset on one row again, and widens the element.
- **The top-left corner stays put,** and the box grows right and down. An upright
  element's size change can't change reading order or re-run the sheet. A rotated
  element keeps its rotated top-left corner in place, which can change its visual top
  and so reading order.
- **Empty content:** the field of an element with no source, new or emptied, has a
  minimum width of about 240 px. An empty line elsewhere keeps its one-row height.
- A size write doesn't mark the sheet dirty. Opening a sheet measures again.

### Chosen width

Built in M4c. A math element has an optional **chosen width**. Without one it is
**automatic**, exactly as under [Size](#size).

- **Laid-out width** is the larger of the chosen width and the **floor**.
- **The floor is what the math lines need:** the widest math line with its result and note,
  tables and charts, the gutter, the padding, and the title at its size. Comments don't count
  toward it. Math never wraps; comment lines always do. An element holding only comments has a
  floor of about 120 px.
- **A comment's own request of up to 320 px** (scaled by its size from M4d) **applies to automatic elements only.** A chosen
  width replaces it, so a chosen width between the floor and 320 px is kept, and comments wrap
  to it.
- **Content that grows past the chosen width widens the element,** as today. The chosen width
  stays stored and applies again once the content is narrower.
- **Height is always automatic.** It follows the wrapped content, the open field's rows
  included (M4e): the chosen width is the width a line's field wraps at
  ([While editing a line](#while-editing-a-line)).

**Setting it:**

- **Excalidraw's own resize handles** set it. On release, the dragged width becomes the chosen
  width, as one undo step, and the sheet is dirty.
- **Dragged narrower than the floor, the element goes back to automatic** and the chosen
  width is forgotten. This is the only way back: there is no button or menu item.
- **While dragging, the text re-wraps live,** and the frame doesn't follow below the floor.
  If Excalidraw's frame and the overlay can't be kept in step mid-drag
  ([section 17](#17-verify-first)), the text re-wraps on release instead.
- **A handle changes the width only.** Any change of height is discarded. A handle on the left
  moves the left edge, as Excalidraw does for any shape, and the top stays put. A left handle
  can therefore change reading order, as a move can; a right handle can't.
- A rotated element resizes like an upright one, along its own axis.

**What uses the extra width:**

- Comment lines re-wrap to the full width, and the header's rule and highlight run the full
  width. A title aligns within it.
- Equations, results and notes stay at the left, as in an automatic element. The space to
  their right is empty. No column stretches, and notes don't wrap.

It is saved with the element and copied with it. Print uses the laid-out width.

### Title format

Built in M4c. The title's text stays exactly what was typed, so `@` and `#` in a title are
ordinary characters ("Pump @ 50 Hz", "Case #2"). Its format is kept beside it and is set only
from the Format tab (before M4d, the title's bar). Nothing is typed to format a title, and a
title takes no rules.

| Option | Choices | Without a format |
|---|---|---|
| Bold | on, off | on |
| Italic | on, off | off |
| Underline | on, off | off |
| Alignment | left, centre, right | left |
| Text size | S 13 px, M 16 px, L 20 px, XL 26 px | M |
| Text colour | The six [text colours](#colours-and-rules) | black |
| Highlight | The five highlights, or none | none |

- **The highlight fills the whole header band,** from the element's left edge to its right,
  above the rule, as a line's highlight fills its row. It doesn't reach into the box's padding.
- **Alignment is within the element's laid-out width,** which is the chosen width when the
  user set one.
- **The title stays one line and never wraps.** Its width at its size counts toward the floor,
  so an XL title can widen the element. The header's height follows the size.
- The rule under the header stays. Underline is drawn on the text, not on the band.
- Wherever the title names the element (the Variables and Problems tabs), it is the plain text.
- Emptying the title removes the header and its format with it. The format is copied with the
  element, prints as shown, and takes the dark theme's filter like the rest.

**Setting it** (M4d): the [Format tab](#format-tab)'s Style, Size, Align, Text and Highlight
rows, while the title is open. Until M4d the title's bar, beside the title, did it.

- The current format shows pressed. Bold is on without a format, so B shows pressed on a new
  title, and pressing it stores "not bold".
- **Each press is one undo step** and keeps the title open. **Ctrl+B**, **Ctrl+I** and
  **Ctrl+U** do the same from the field.

### Format tab

From M4d, the only place to format a line or a title. It is the Sheet panel's first tab
([section 8](#sheet-panel)), and acts only on the open line or title, never on a selection.

**The sample.** At the top, in a light box: a caption naming what is open and where, in the
Variables tab's naming ("MATH LINE — PIPE FLOW, LINE 3", "COMMENT LINE — …",
"TITLE — PIPE FLOW"), then the open thing drawn as the sheet draws it: a math line typeset
with its result and note, rules applied, live as it is typed; a comment line or a title in
its format.

**From M4e the sample is smaller than the sheet and wraps:**

- It draws the open line with its format and rules applied, at **13 px with 20 px rows** (the
  sheet's are 16 and 24), in a box as wide as the panel.
- A line wider than the box **wraps**. Typeset math breaks only where KaTeX allows: after an
  operator or a relation at the top level, and between the name with its `≔` and the
  expression. The **result** moves to a row of its own, keeping its rule on the left, when it
  doesn't fit beside the expression. A note, a comment, a line shown as source and an error's
  message wrap as text.
  A note and a comment are 12 px (the sheet's are 15), and a sized comment keeps its
  proportion: 10.5, 16 and 21 px at S, L and XL. A problem's mark keeps its place at the row's
  left, and takes its column only when there is one.
- A part that can't break (a long square root, a fraction, a call's arguments) **scrolls
  sideways** inside the box. Nothing is scaled down to fit.
- The box is as tall as its line, up to about **150 px (six rows)**; past that it scrolls
  inside. A table line may take up to about 300 px.
- **A plot line shows its line only,** with the note "Its chart is drawn on the sheet." under
  the box. A format doesn't change the chart.
- **A table line shows its line and the whole table, scaled down to the box's width,** because
  a rule colours its rows. The scale has no floor.
- **On a phone** the bottom sheet shows the same sample, **72 px (about three rows) at most**,
  scrolling inside, and never a chart or a table: a plot or a table line shows its line only,
  without the note.
- The title's sample is unchanged: one row, at the title's own size.

- When a true rule overrides a property the buttons set, a line under the sample says so:
  "A rule sets the text colour while v > 3 m/s." The buttons still show and set the plain
  format under it.
- Beside the sample, a link moves the edit: "Edit title ↑" (or "Add title ↑") under an open
  line, "First line ↓" on the open title. ↑ on the first line and a double-click on the
  header stay.
- The sample row also holds **Done** (leaves the line, as Esc), **↑** and **↓** (move the
  edit, as the arrow keys, from the first line to the title and back), on every device.

**The rows.** One labelled row per property, of large [no-focus](#2-terms-and-invariants)
buttons. A row that doesn't apply is left out, not greyed:

| Open | Style | Size | Align | Text | Highlight |
|---|---|---|---|---|---|
| Math line | B, U | – | – | six text colours + none | five highlights + none |
| Comment line | B, I (pressed by default; off writes `@upright`), U | S M L XL | – | six + none | five + none |
| Title | B (pressed by default), I, U | S M L XL | ⇤ ↔ ⇥ | six + none | five + none |

- On a math line the [Rules list](#rules-list) sits below the rows.
- A blank line, or a clause with no comment text, shows the sample and "This line takes no
  format."
- With nothing open: "Open a line or a title to format it: double-click it, or select its
  element and press Enter." With one math element selected, an **Edit** button beside the
  hint opens its last line, as Enter does; on touch the hint reads "Double-tap a line, or
  tap Edit".
- Tooltips name the keys: "Bold (Ctrl+B)". There are no keys for size, alignment or
  colours.

**Writes.** Each press is one undo step, written at once, as the bar's were: a line press is a
line commit that keeps the line open with its caret in the code
(`min(selectionStart, codeLength)`) and remounts the field, whose text undo then starts empty;
on a comment line, which has no code, the caret keeps its place in the comment text, moving
with the `#` (#144). A title press is one step. Pressing a pressed button takes that format off.

**From M4e a line press writes the line's stored format** ([section 3](#3-sheet-lines-every-form)),
with the line's typed text, in one write: one undo step. It doesn't touch the open field: its
text, its caret and its own Ctrl+Z stay as they were. Ctrl+B, Ctrl+U and Ctrl+I in the field are
the same press. One case rewrites the field: plain words typed in the line (`@red`, not yet
committed, or in a hand-edited file) move out with the press, so the buttons and the line agree;
the field is then mounted again with the caret in the code, as in M4d. A rule being typed in the
line stays there.

### Rules list

From M4d, on a math line only, under the Format tab's rows. Its header says "first true wins,
top to bottom". Until M4e no field in the panel takes the keyboard, so the line never leaves
while rules are edited: **the condition is typed in the line itself**, with its suggestions
and units.

**From M4e a rule's condition is edited in the Rules list,** in a text field on its row, since
the line's text no longer holds the format ([section 3](#3-sheet-lines-every-form)):

- While that field has the keyboard **the open line stays open**, with its field and whatever
  is half-typed in it. It is the one typed field in the panel that doesn't leave the line. A
  press back in the line continues the edit.
- The condition is saved on Enter or when its field loses the keyboard, as one undo step. An
  empty condition removes nothing: the row shows `⚠` and "a rule needs a condition".
- The field offers the name and unit suggestions the line's field has.
- **+ Add rule** adds a row with the format `text-red` and the condition `<name> ` already in
  its field, the caret after it; nothing is written into the line.
- Add, remove, reorder and each format change write the line's stored format, one undo step
  each, and never touch the line's text or its caret.
- At the panel's least width a long condition's field scrolls sideways; the colour rows wrap.

As built (#197):

- **Typing a condition writes nothing,** and the sheet runs from it as it does from the line's
  typed text: the rule's live state, the sample and the sheet follow each keystroke. A save
  writes the condition with the line's typed text in one write, as a press does
  ([Format tab](#format-tab), Writes).
- **Enter keeps the keyboard in the field.** The line stays open when the keyboard goes back to
  it or on to another rule's condition, and when the window loses focus. When it goes anywhere
  else (a filter, Excalidraw's toolbar), the edit leaves the line, as it does from the line's
  own field.
- **A condition not yet saved goes with the line** when the edit leaves it or moves (Done, ↑ ↓,
  a press on the canvas, a save of the file), in the line's one write; and with the next press
  in the list, in that press's write.
- **The new rule is last,** lowest in priority, and written at once: one undo step for the
  rule, and one more when its condition is saved. Its row opens its format controls. On a table
  line its condition starts empty.
- **The field's keys** are the line's: with the list open, ↓ ↑ highlight, Tab takes the first
  or the highlighted suggestion, Enter the highlighted one, Esc closes the list. Otherwise
  Enter saves, and Esc does nothing. Ctrl+Z is the field's own text undo, and never takes
  back the line's typing; once the field has lost the keyboard, what was typed in it is no
  longer in any text undo, so Ctrl+Z back in the line is the line's own.
- **A condition holds no `@` and no `#` outside a text:** the field doesn't take them, since
  an `@` starts the clause's next word and a `#` ends it. A text left open (`result == "Pa`)
  is read, and saved, with its quote closed, so the rules after it stay rules.
- **A rule typed in the line** (`@text-red if v > 3 m/s`, not yet committed, or in a
  hand-edited file) shows in the list, before the stored ones. It is the one case where the
  list rewrites the field: the list's next write, the first key in a condition included, moves
  every typed rule out of the line into the stored format, in the list's order, and the field
  is mounted again with the caret in the code, as plain words move out with a Format tab press.
  The keyboard stays where it was. Plain words typed in the line stay there.

What follows describes M4d, and still holds where M4e doesn't replace it.

Each row is one rule, in the line's order, and holds no-focus controls:

- a **format chip**, drawn in the rule's format, which opens the Text, Highlight and Style
  rows for that rule under it. A rule's last property can't be taken off: its "none" is
  disabled, and ✕ removes the rule;
- its **condition**: until M4e read-only, as typed, and a click puts the caret at the end of
  that condition in the line; from M4e its text field;
- **↑ ↓** to reorder, and **✕** to remove;
- its **live state**, beside the condition: "true" or "false"; on a list "12 of 30 points",
  on a table "4 of 10 rows"; "true, overridden" when every property it sets is won by a
  rule above; or `⚠` and the reason, in amber ("units of different kinds", "not true or
  false", an undefined name), the same warning the line carries.

**+ Add rule,** until M4e, writes ` @text-red if <name> ` at the end of the clause, before any
note, and puts the caret after it, so the user types `> 3 m/s`. `<name>` is the name the line
defines, or `result` on a line with none; on a table line it writes ` @text-red if ` alone. The
new rule is last, so lowest in priority, and its row opens its format controls at once.

- A row the list writes is one joined word and one condition
  ([section 3](#3-sheet-lines-every-form)). A rule typed the old way is its own row and is
  never rewritten unless changed.
- Add, remove, reorder and each format change is one press: one line commit, the line kept
  open. Until M4e a press made with the caret inside the clause puts it back at the same
  rule's condition, and typing a condition is ordinary typing in the line, under the field's
  own Ctrl+Z.

### Symbols tab

From M4d, the panel's second tab. Every button types, at the caret, text the engine already
reads. It adds no grammar.

**Groups, top to bottom:**

1. **Greek:** the 24 lowercase letters except omicron; the variants `varepsilon`, `vartheta`,
   `varpi`, `varrho`, `varsigma`, `varphi` on a second row; the 11 capitals unlike Latin
   (Γ Δ Θ Λ Ξ Π Σ Υ Φ Ψ Ω). A button shows ρ and inserts `rho`. The letters that are also
   constants (π, σ, τ, φ, α) carry a small dot: "also the constant …; a sheet may take the name".
2. **Operators:** `+` `−` (`-`) `·` (`*`) `÷` (`/`) `x²` (`^2`) `xⁿ` (`^`) `√` (`sqrt`)
   `∛` (`cbrt`) `ⁿ√` (`nthRoot`) `|x|` (`abs`) `n!` `( )` `[ ]` `<` `>` `≤` (`<=`) `≥` (`>=`).
3. **Functions:** today's function suggestions, in that order.
4. **Logic:** `if()`, `? :`, `==`, `!=`, `and`, `or`, `not`, `true`, `false`, a pair of quotes.
5. **Sheet forms:** `solve`, `for`, `..`, `step`, `table()`, `plot()`, `in`, an index `[ ]`. A
   button inserts its keyword only; its hover shows the whole form as a runnable example
   (`x = solve x^2 = 2, for x = 0 .. 10`).

A filter box at the top matches the spelling, the letter's name and the hint (`rho`, `root`,
`less`). It takes focus, so typing in it leaves an open line; the buttons below are no-focus.

**What a click inserts:**

- **Greek joins a name only right after `_`:** `T_` + α gives `T_alpha`. Right after another
  name character a space comes first (`a` + ρ gives `a rho`). The caret ends after the
  spelling. The hover reads "rho — type _ for a subscript: rho_w".
- **Calls** (`sqrt`, `abs`, `if`, `table` …) put the caret between the brackets, or wrap a
  selection: select `a + b`, click √, get `sqrt(a + b)|`. The quote pair and `( )` wrap too.
- **Binary operators and comparisons** go in with one space each side, never doubling one.
  **`^`, `^2` and `[ ]`** go in tight. Any other symbol replaces a selection.
- **Each insert is one Ctrl+Z step** in the field (`execCommand('insertText')`, then the
  caret by `setSelectionRange`).
- **With no line open:** one math element selected, a click opens its last line and inserts
  at its end; nothing or several selected, the buttons are dimmed under "Open a line to
  insert", and their hovers still show each spelling. An open title or comment line takes
  the insert as plain text.

The Constants tab's rows insert their short name (`c`, `N_A`), else the math.js name
(`gravity`), by the same rules, with the hover "Insert c". One catalogue module holds every
Symbols entry, and the typing suggestions' functions are built from it.

### Touch

From M4d, in the plugin on a phone and a tablet ([section 12a](#12a-obsidian-plugin)). One
behaviour on every device; touch is told by `pointerType === 'touch'`, so a mouse or a pen
that hovers keeps hover.

- **A double tap on a line** opens it, by the double-click rule of [Gestures](#gestures):
  math's only when the first tap selected the element; a drawing on top keeps Excalidraw's
  double tap; a locked element still edits. A double tap is Excalidraw's own: a second
  one-finger touch within 300 ms of the first, wherever it lands. The app takes that second
  touch before Excalidraw does ([section 14](#14-engineering-constraints)), so Excalidraw adds no
  label to the anchor.
- **The keys' places** are taken by the Format tab's **Done**, **↑ ↓** and **Edit**. A tap on
  another line of the element moves the edit; a tap outside or a drag leaves; Enter on the
  on-screen keyboard splits the line; a tap on empty canvas deselects. Hiding the
  keyboard doesn't leave the line; a tap in the field brings it back.
- **Add math** is ∑ Add math under More tools, then a tap to place.
- **A tap shows a tip** where hover would: a gutter `●` or `⚠` (when shown), a table's red
  —, a solve's result, a list's summary. The next tap anywhere closes it.
- **A math element selected by touch** shows its result unit slots outlined (a tap opens
  the unit choice) and each plot's ⚙. A slot shows only while its element is selected, so a
  tap on an unselected element's slot selects the element, as any tap does.
- **Quick keys:** while a line or the title is open, a pinned row above the panel's tab icons:
  `_` `^` `=` `(` `)` `*` `/` `,` `..` and a pair of quotes, no-focus, inserting by the
  Symbols tab's rules, one Ctrl+Z step each: `_ ^ ) ,` tight, `= * / ..` spaced, the quotes a
  pair with the caret between. `(` wraps a selection and otherwise types only itself, since
  `)` is its own key.
- **The canvas hint** for one selected math element reads "Double-tap a line, or tap Edit in
  Math settings" after a touch press, and the desktop wording again after a mouse or pen press
  ([Selected math element](#selected-math-element)).

### Selected math element

| Selection | Panel | Hint |
|---|---|---|
| One math element | Opacity, Layers, Actions | "Double-click a line or press Enter to edit"; after a touch press, "Double-tap a line, or tap Edit in Math settings" |
| Several math elements | Opacity, Layers, Align, Actions | Excalidraw's own |
| Math and drawings | Excalidraw's full panel; opacity reaches the math, other styles only the drawings | Excalidraw's own |

Actions stays whole, including Link. The panel can still cover math at the left of the
view; that's accepted.

**Anchor style is fixed, except opacity:** stroke `#868e96`, dashed, thin; background
`#ffffff01`, solid; roughness 0; sharp corners. If paste styles, a mixed selection or a
hand-edited file changes these, the app writes them back with no undo step, and a
clean sheet stays clean. Paste styles on math alone adds no undo step at all.

**Opacity** is saved in the file, and the overlay and print follow it. The line being
edited shows at full opacity. Opacity 0 is allowed: the element is invisible, still
evaluates, and still appears in Variables and Problems.

### Text on the sheet

Excalidraw text carries headings and free prose. New text defaults to the Normal font
(Nunito), set through Excalidraw's public initial app state, and can still switch to
hand-drawn. New shapes keep Excalidraw's defaults. Excalidraw text isn't in reading
order and is never evaluated. It doesn't follow the math when lines are added; group
it or use a `#` line.

Decided in: [look](https://github.com/matheus-sancha/excalimathpad/issues/14),
[typesetting](https://github.com/matheus-sancha/excalimathpad/issues/13),
[gestures](https://github.com/matheus-sancha/excalimathpad/issues/28),
[auto-size](https://github.com/matheus-sancha/excalimathpad/issues/29),
[panel](https://github.com/matheus-sancha/excalimathpad/issues/32),
[comments](https://github.com/matheus-sancha/excalimathpad/issues/36),
[functions](https://github.com/matheus-sancha/excalimathpad/issues/27),
[chrome](https://github.com/matheus-sancha/excalimathpad/issues/17),
[chosen width](https://github.com/matheus-sancha/excalimathpad/issues/100),
[text colours](https://github.com/matheus-sancha/excalimathpad/issues/93),
[conditional formats](https://github.com/matheus-sancha/excalimathpad/issues/94),
[title format](https://github.com/matheus-sancha/excalimathpad/issues/95),
[all-roots solve](https://github.com/matheus-sancha/excalimathpad/issues/92),
[warnings at rest](https://github.com/matheus-sancha/excalimathpad/issues/118),
[comment-line formats](https://github.com/matheus-sancha/excalimathpad/issues/119),
[Format tab](https://github.com/matheus-sancha/excalimathpad/issues/121),
[Symbols tab](https://github.com/matheus-sancha/excalimathpad/issues/122),
[Rules list](https://github.com/matheus-sancha/excalimathpad/issues/123),
[phone and tablet](https://github.com/matheus-sancha/excalimathpad/issues/127),
[programming forms](https://github.com/matheus-sancha/excalimathpad/issues/132).

## 5. Results: units and numbers

Built in M2. A result's colour is the sheet's [result colour](#colours-and-rules), from M4c.

### Shown result

A shown result is the line's value in its display unit, balanced if the kinds differ;
else in the unit system for its kind; else in composed base units of the system.

From M4d a **text value** shows plain, without quotes (`Approved`), and `true` / `false`
as upright words, never ✓ / ✗, Yes / No or 1 / 0. A text has no unit slot, and `in <unit>`
on a text is the line's error.

### Unit slot

- Every result's unit is a slot. Hovering a row outlines it, and a dimensionless
  result shows an empty one. A plain input shows an empty slot on hover. With a unit
  chosen, its cell shows the input converted (`D ≔ 102.3 mm` │ `4.028 in`). A function
  definition has no slot.
- Clicking turns the slot into a text field with a list under it:
  - **Sheet units** on top, with the value in the system. Choosing it clears the
    chosen unit.
  - Then the **units of the same kind**, each with the result's value in that unit.
- **Typing filters.** ↑ / ↓ move the highlight. **Enter** applies the highlighted unit,
  or what was typed if nothing matches. **Esc** cancels. An empty field + Enter goes
  back to sheet units.
- **A chosen unit has no mark,** from M4c: it looks like any other result. Whether a result
  has one is read from its line (`in m/min`) and from the open slot, whose list has Sheet
  units on top. Until M4c a chosen unit is tinted, and the tint doesn't print.
- **Stored** at the end of the line's source as `in <unit>`. Choosing from the slot is
  one line commit and doesn't put the line in source.
- **Accepts** a unit expression with no number: `bar`, `kN/m^2`, `L/minute`. An unknown
  unit turns the field red and isn't applied.
- In source, an unknown `in xyz` puts a red error in the result cell, and the line's
  value still reaches the lines below.
- **A dimensionless result** shows a plain number, and its slot offers `%`.

**A unit of the wrong kind is balanced, as in Mathcad,** with no error or warning. The
value is divided by the chosen unit, and the leftover dimension shows in base units of
the system: Δp in `m` shows `4.543·10⁴ m·kg/(m²·s²)`. The same applies when a result's
kind changes after a unit was chosen. The list only offers the right kind, so a
mismatch only comes from typing.

### Unit systems

Set in the Settings tab. Switching re-shows every result without a chosen unit.

| System | Shows |
|---|---|
| **SI with prefixes** (default) | A prefix keeps the number between 1 and 1000 where the kind has prefixed units: `45.43 kPa`, `5.412 kW`, `1.002 mPa·s` |
| **SI base units** | No prefixes: `4.543·10⁴ Pa`, `5412 W` |
| **USCS** | ft, ft², ft³/s, ft/s, psi, hp, lb/ft³ and so on |
| **Custom** | Starts from one of the three and changes the unit for chosen kinds. Others follow the system it started from |

**Kinds:** length, area, volume, volume flow, mass flow, velocity, acceleration, force,
pressure, energy, power, density, dynamic viscosity, kinematic viscosity, frequency,
mass, time, temperature. Each system names one unit per kind. A kind not on the list
shows in composed base units (`kg/(m·s)`).

**The slot's list per kind** is a fixed list in app code. For a pressure: Pa, kPa, MPa,
mbar, bar, psi, atm.

**Torque is listed with energy.** The two have the same dimension, so a result can't tell
the app which it is: a torque shows in `J` until a unit is chosen. The energy list, named
"Energy, torque" in the Settings tab, ends with N·m, kN·m, lbf·ft and lbf·in, and Custom can
set one of them for every such result on the sheet.

### App units

A fixed list, registered once at engine setup, so every sheet has the same ones. The
file stores nothing about them.

| Group | Name | Definition |
|---|---|---|
| Viscosity | `cP` | `0.001 Pa s` |
| | `poise` | `0.1 Pa s` |
| | `cSt` | `1e-6 m^2/s` |
| | `St` | `1e-4 m^2/s` |
| Rotation and flow | `rpm` | `1 / minute` |
| | `gpm` | `1 gal / minute` |
| | `cfm` | `1 ft^3 / minute` |
| Energy and force | `kcal` | `4184 J` (thermochemical) |
| | `tonf` | `2000 lbf` |
| | `tf` | `1000 kgf` |

- Each name is registered as written, with no prefixes. There is no bare `P`, so `P`
  stays free for power or pressure.
- They join the slot's list for their kind and can be chosen in Custom. Dynamic
  viscosity gains `cP`, `poise`; kinematic viscosity lists m²/s, `cSt`, `St`; frequency
  lists Hz, `rpm`; volume flow gains `gpm`, `cfm`; energy gains `kcal`; force gains
  `tonf`, `tf`.
- An app unit shows only where it is written or chosen. A derived viscosity shows
  through the system (`1.002 mPa·s`) unless a Custom system names it.
- A unit not on the list can be a plain variable (`bbl2 = 159 L`), but a variable can't
  be a display unit.
- `mH2O`, `inH2O` and `inHg` weren't chosen. `cmH2O`, `mmH2O` and `mmHg` are already in
  math.js.

### Numbers

**Digits** are significant digits, an integer from 2 to 15, default 4, per sheet only.

| Rule | |
|---|---|
| Scientific notation | At 10^Digits and above, and below 0.001, so no digit is invented |
| Typeset form | `1.235 \cdot 10^{4}` in KaTeX. Plain-text places (a line being edited, hover, messages) use `1.235·10⁴`. `1.86e5` never shows |
| Trailing zeros | Dropped in a result cell (`25 m`, `5.4`). Kept in a table column (`20.00`, `24.80`) |
| Whole-number table column | Stays whole (`1`, `19`, `30`). Numbers line up on the decimal point. Scientific values keep their zeros (`1.860·10⁵`). Zero stays `0` |
| Separators | A decimal point, no thousands separator |
| Counts | No special treatment: `n = 123456` shows `1.235·10⁵` |
| Other values | `∞`, `-∞`, `NaN`; `-0` shows `0`; a complex result formats each part (`2 + 3i`) |
| Source | Never reformatted: `D = 102.30 mm` stays as typed |

| Value, Digits 4 | Shows |
|---|---|
| 1234 | `1234` |
| 12345 | `1.235·10⁴` |
| 185997 | `1.86·10⁵` |
| 0.01864 | `0.01864` |
| 0.0004399 | `4.399·10⁻⁴` |

These rules apply everywhere a number shows: result cells, Variables, list summaries,
the slot's list, solve details and print. The exceptions: a solve detail's residual and
bracket can read as they fall, and plot axis ticks use the chart's own round values.

### Constants

Every constant math.js has is built in, under math.js's name: `pi`, `e`, `gravity`,
`speedOfLight`, `gasConstant`, about sixty in all. The common ones can also be written by
a short name, as in Mathcad:

| Short | Constant | Short | Constant |
|---|---|---|---|
| `c` | Speed of light | `sigma` | Stefan–Boltzmann constant |
| `G` | Gravitational constant | `e_c` | Elementary charge |
| `h` | Planck constant | `epsilon_0`, `mu_0`, `Z_0` | Vacuum permittivity, permeability, impedance |
| `hbar` | Reduced Planck constant | `m_e`, `m_p`, `m_n`, `m_u` | Electron, proton, neutron and atomic mass |
| `R` | Molar gas constant | `a_0` | Bohr radius |
| `k` | Boltzmann constant | `alpha` | Fine-structure constant |
| `N_A` | Avogadro constant | `R_inf` | Rydberg constant |

- **`g` is the gram.** Standard gravity has no short name: it is `gravity`.
- **`h` is the Planck constant, so the hour is `hr`.** `2 hr`, `m^3/hr`, `km/hr`. In a display
  unit, which is read as units only, `in km/h` still means per hour.
- **A sheet may take a short name** (`R = 10 kohm`, `k = 3`), with no warning. From then on
  the name is the sheet's on every line: used above its line it is `R is defined below`,
  and after a failed definition `R has an error above`, never the constant.
- A constant shows as any result does, in the sheet's unit system and Digits.
- The list is in the Sheet panel's [Constants tab](#sheet-panel).

### Warnings

**A name that shadows a unit or built-in** gets an amber `⚠`, in the gutter and the
Problems tab. The name wins, and the warning doesn't change a result.

- Covers variables, function names, function parameters and a solve's unknown, against
  math.js's units and built-ins and the app units.
- A use that falls back to the unit, because the name is defined below it or its
  definition failed, is flagged too.
- A parameter that hides a **sheet function** doesn't warn (`f(Re, r)` hides `Re(Q)` on
  purpose).
- Names that aren't units or built-ins don't change.
- A constant's short name is free to take: `R`, `k` and `c` don't warn. `h` and `hbar` do,
  being units as well.

**A function body name not defined above** gets an amber `⚠` on the definition.

- It checks every name in the body and in a solve function's guess, except the
  function's own name, its parameters, a solve's unknown, units, and math.js's functions
  and constants.
- Only a name missing at that point warns. A name defined above and redefined later
  stays silent.
- The function still works if the name exists by the time it's called, because functions
  bind late.

Decided in: [unit slot](https://github.com/matheus-sancha/excalimathpad/issues/16),
[Mathcad research](https://github.com/matheus-sancha/excalimathpad/issues/15),
[app units](https://github.com/matheus-sancha/excalimathpad/issues/24),
[numbers](https://github.com/matheus-sancha/excalimathpad/issues/30),
[shadow warning](https://github.com/matheus-sancha/excalimathpad/issues/7),
[functions](https://github.com/matheus-sancha/excalimathpad/issues/27).

## 6. Undo

Built in M1. There is one undo stack, Excalidraw's. It covers moves and line edits,
Excalidraw's own selection steps, and a nudge or Link edit that a line commit follows.

- **One step is one line's edit.** The line goes into the scene when the edit leaves it:
  ↑ / ↓, Enter (split), Backspace at the start (join), a click on another line, Esc, a
  click outside, or starting a drag. Typing a 10-line block takes 10 undos to remove.
- **Ctrl+Z while editing is text undo,** the field's own, inside that line. It never
  reaches the sheet's undo. It starts fresh on each line.
- **A line left unchanged writes nothing.**
- **A split** writes both halves as one step, and **a join** is one step. The line edited
  next is its own step.
- **Starting a drag while editing** writes the line (one step); the move is Excalidraw's
  own step.
- **Add math** is one step, the first line another. So after Add math, typing a line and
  leaving with Esc, the first Ctrl+Z empties the element and the second removes it. An element
  removed for being empty is one step, so Ctrl+Z after an empty Add math brings back the
  empty box.
- **A unit slot or plot popover change** is one line commit.
- **A title change** is one step, written when the edit leaves the title: adding one,
  changing it, or removing it. A title left unchanged writes nothing.
- **A press in the Format tab on the title, or a title format key** (M4c on the title's
  bar; M4d in the Format tab) is one step, written at once.
- **A change of chosen width** (M4c) is one step: Ctrl+Z restores the previous width, or
  automatic. Excalidraw's resize and the stored width land in the same step.
- **A format from the Format tab, its Rules list or a format key** (before M4d, the bar) is
  one line commit too, written at once with the line's typed text, so each press is one
  step. The line stays open. Until M4e the field's text undo starts fresh after it, because
  the app rewrote the field; from M4e the press writes the stored format and leaves the
  field alone, so its text undo is kept, except where the press moved a typed clause out of
  the line ([section 4](#format-tab)).
- **A line's text and its stored format are one write** (M4e): a commit that moves a typed
  clause out, an Enter and a join are each one step, and undo puts both back.
- **A rule's condition** (M4e) is one step when it is saved, on Enter or when its field loses
  the keyboard ([Rules list](#rules-list)): written with the line's typed text, as a press is,
  and the line stays open. Typing in the field is no step, and Ctrl+Z there is that field's own
  text undo. A condition not yet saved when the edit leaves the line is part of the line's step.
- **An insert from the Symbols tab, the Constants tab or a quick key** (M4d) is typing:
  one step of the field's own Ctrl+Z, and part of the line's one commit.
- **Redo** (Ctrl+Y, Ctrl+Shift+Z) is Excalidraw's own and mirrors undo.
- **Undoing a line shows nothing extra:** no selection, scroll or highlight. An undo off
  screen shows only as changed results.
- **Selecting and deselecting are Excalidraw's own steps,** on the same stack; #41 found no
  public API that keeps them off it. An undo that lands on one changes only the selection. When
  the element is selected, leaving a line with a click outside also deselects it, so the first
  Ctrl+Z after that only re-selects the element, and the second takes back the line. Leaving
  with Esc adds no such step.
- **A nudge or Link edit becomes its own step only if a line commit follows.** Excalidraw doesn't
  record either by itself: Ctrl+Z doesn't reach it until Excalidraw's next step, such as a click
  that deselects, sweeps it in. A line commit on that anchor records it first, so the commit adds two entries: the nudge or Link edit, then
  the line. The line is still exactly one step, and undo takes it first.
- **A nudge of several elements can split,** because only the anchor being written is recorded.
  The line stays one step and loses nothing. With two anchors nudged and a line edited in one:
  - Ctrl+Z straight away takes back the line, then the written anchor's nudge. The other anchor
    stays moved and no undo reaches it, so the two end up out of line.
  - After a click that deselects, the first Ctrl+Z moves the other anchor back and re-selects, the
    second takes back the line, and the third moves the written anchor back.
- **Not undo steps:** keystrokes, size writes, style restores, settings changes (the result
  colour among them) and results.

Decided in: [undo steps](https://github.com/matheus-sancha/excalimathpad/issues/11),
[undo research](https://github.com/matheus-sancha/excalimathpad/issues/10),
[auto-size](https://github.com/matheus-sancha/excalimathpad/issues/29),
[chrome](https://github.com/matheus-sancha/excalimathpad/issues/17),
[chosen width](https://github.com/matheus-sancha/excalimathpad/issues/100),
[title format](https://github.com/matheus-sancha/excalimathpad/issues/95),
[Format tab](https://github.com/matheus-sancha/excalimathpad/issues/121),
[Symbols tab](https://github.com/matheus-sancha/excalimathpad/issues/122).

## 7. File and save

Built in M1. Settings fill in as M2, M4c and M5 add them. In a vault (M4d) the same file is
saved the Obsidian way: see [A sheet in a vault](#a-sheet-in-a-vault).

### The file

A sheet is Excalidraw's own JSON with one extra top-level block, saved as
`.excalimathpad`. Each anchor's source is in its `customData`, with its title when it has
one (`"title": "Pipe flow"`). An element without a title stores no `title` key, so the
format version doesn't change.

From M4c an anchor's `customData` can also hold:

- `titleFormat`: only what differs from a title with no format, as a string of words, such as
  `"centre L text-red"` (`regular`, `italic`, `underline`; `centre`, `right`; `S`, `L`, `XL`;
  `text-<colour>`; a highlight's name). A title with no `titleFormat` looks as it did before M4c.
  It is a string and not an object because Excalidraw compares `customData` one level deep when it
  records a step: a nested object adds an empty undo step to every later write of the anchor
  (#111, `mathAnchor.excalidraw.test.tsx`).
- `width`: the chosen width, in scene units. An element without one is automatic.

Files saved before M4c have neither key and open as they looked, so the format number stays 1.
M4d adds nothing to the file: a comment line's format, joined words and conditionals are
text in the source, so the format number still stays 1, and a sheet moves between the web
app and a vault unchanged.

**From M4e the file is format 2,** the first migration (ADR 0004):

- An anchor's `customData` gains `formats`: a string with one entry per line of `source`,
  separated by `\n`, each entry the line's clause as it was written in the line (`@bold`,
  `@text-green if result == "Pass" @text-red if result == "Fail"`), empty for a line with
  none. It is a string for the reason `titleFormat` is. An anchor whose lines have no format
  stores no `formats` key. A reader pads or cuts the entries to the number of lines. An entry
  that doesn't start with `@` is read as none, and a `#` ends an entry: neither can come from
  the app, only from a hand-edited file.
- `source` and `formats` change in one write, so a commit, an Enter, a join or a press in the
  Format tab is one undo step.
- **On open, a format 1 sheet is migrated in memory:** each line's clause moves from its text
  into `formats`. The file changes at the next save, and opening alone doesn't make the sheet
  dirty. The migration runs on every open path: Open…, a dropped file, a vault file, an
  outside change read back, and the recovery copy. The math and the note stay as typed; one
  space stands between them where the clause was. An element whose lines hold no clause is
  left exactly as it was. A drawing with no block opens as format 1, so it is migrated too.
- **A format 2 file can still hold a clause in a line's text:** a hand-edited file, or a
  save made while that line was open. It is read in front of the stored clause
  ([section 3](#3-sheet-lines-every-form)) and moves out when an edit next leaves the line.
- **A format 2 sheet is refused by 0.2.x** with "This sheet was saved by a newer
  Excalimathpad. Update the app.", so an older app never overwrites it. In a vault synced
  between devices, every device needs 1.0.0 before one of them saves.
- The example below shows format 2. In format 1 the block says `"format": 1`, there is no
  `formats` key, and the first line's text is `D = 102.3 mm @bold`.

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [ { "customData": { "kind": "math", "source": "D = 102.3 mm\n…", "formats": "@bold\n…" } } ],
  "appState": { },
  "files": { },
  "excalimathpad": {
    "format": 2,
    "settings": {
      "units": { "system": "si-prefixed", "custom": { "pressure": "bar" } },
      "digits": 4,
      "resultColor": "blue",
      "page": { "size": "A4", "orientation": "portrait" }
    }
  }
}
```

- `system` is `si-prefixed`, `si-base` or `uscs`. A non-empty `custom` makes it Custom.
  `size` is `A4` or `Letter`, and `orientation` is `portrait` or `landscape`.
  `resultColor` (M4c) is one of the six text colour names.
- A setting missing from a file takes its default.
- `appState` keeps what Excalidraw's own save keeps (background, grid and the like).
- Embedded images are saved in `files`, as Excalidraw does.
- **Never saved:** results, undo history, selection, hover, the line being edited, whether
  the panel is open.
- Renamed to `.excalidraw`, a file opens in plain Excalidraw or Obsidian Excalidraw as a
  drawing with empty dashed rectangles. That's a fallback: a sheet saved back from those
  tools may lose the block.

### Saving

- **Ctrl+S** writes back to the sheet's file. On an untitled sheet it works as Save as.
- **Ctrl+Shift+S** picks a new file, which becomes the sheet's file.
- **A plain drawing** opened as a sheet (a `.excalidraw`) isn't written back: its first Ctrl+S works
  as Save as and suggests `<name>.excalimathpad`, so the drawing file keeps its own format.
- The file on disk changes only when you save, as in Mathcad.
- **Saving during a line edit** commits the line first, as a line commit, and the line stays open.
  From M4e a clause typed in that line is saved in its text, and moves to the line's stored
  format when the edit leaves the line ([section 3](#3-sheet-lines-every-form)).
- **A failed save** (permission refused, a disk error) shows a message and leaves the sheet dirty.
- **Unsaved changes** show as `●` before the file name. Closing the tab or window with
  unsaved changes asks to confirm.
- **Recovery copy:** after every line commit and every scene change, the app writes the
  whole sheet, its file name and its file handle to IndexedDB, about half a second after the last
  change and at once when the page goes away. It holds every line up to the last commit. It is
  cleared on a successful save, when you discard it, and when another file is opened. There is one
  at a time. Because it keeps the handle, Ctrl+S after Restore writes back to the same file, once
  the browser grants permission again.

### Opening

- **The app starts on a new untitled sheet,** with no seeded demo. It's titled "Untitled".
- **If a recovery copy exists, it is offered first:** "Restore unsaved changes to
  pump-sizing.excalimathpad?" (or "to an untitled sheet"), with Restore and Discard. This
  also comes before a file opened by double-click, and before opening another file.
- **Opening:** Ctrl+O, the ☰ menu's Open…, a double-click in Windows, or dropping the file on
  the canvas. A dropped `.excalimathpad`, `.excalidraw` or `.json` goes through Open, so it gets the
  unsaved-changes question and the refusals below. Dropped images and libraries stay Excalidraw's.
- **With unsaved changes** in the current sheet, opening asks: Save, Don't save or Cancel. It
  asks after the file is picked and read, so a refused file never asks, and the Save picker gets
  the click on Save (Chromium allows one picker per gesture). After a Save, the picked file is read
  again, so reopening the sheet's own file shows what was just saved.

| The file | What happens |
|---|---|
| Older `format` | Upgraded in memory, one step at a time, by a pure function per step. The next save writes the current format |
| Newer `format` | Refused with a message, so an old app never overwrites a newer file |
| No `excalimathpad` block (a plain drawing) | Opens as format 1 with default settings. Rectangles without `customData.kind === "math"` stay plain rectangles |
| Doesn't parse | Refused with a message. The current sheet is left as it was |

**Browsers:** Chrome and Edge on desktop, through the File System Access API. Elsewhere,
Save falls back to a download and Open to a file picker, with no write-back. Not tested
in v1.

### A sheet in a vault

From M4d, in the plugin ([section 12a](#12a-obsidian-plugin)). The web app's Saving and
Opening above are unchanged. In a vault the file is the sheet, and it autosaves as
Obsidian's views do.

- **Autosave.** The view is a `TextFileView`. After a line commit or a scene change it asks
  Obsidian to save (`requestSave`, 2 s), and it writes at once when its tab closes or
  Obsidian quits, committing an open line first. Only a change of `saveKey` writes, so
  opening, selecting, scrolling, zooming or a theme change never touches the file.
  Obsidian's "Save current file" (Ctrl+S) writes at once.
- **Dropped in a vault:** Save, Save as, Open (Ctrl+O and ☰ Open…), a sheet file dropped on
  the canvas (ignored; dropped images stay Excalidraw's), the `●` mark, the leave question,
  the recovery copy with Restore and Discard, and the untitled sheet. Obsidian's own copy,
  rename, move, file explorer, quick switcher and links take their places. Undoing a bad edit
  is Ctrl+Z, Obsidian's File recovery or sync history.
- **Opening** is `setViewData`: today's open, with no undo step and the history cleared.
  The refusals of [Opening](#opening) hold: a newer `format` or a file that doesn't parse
  shows its message, and the view never writes it. Only `.excalimathpad` is registered;
  `.excalidraw` stays the Excalidraw plugin's.
- **New sheet:** the command "New sheet", a ribbon icon, and "New sheet" in a folder's
  menu in the file explorer (in that folder). The command and the ribbon follow Obsidian's
  *Default location for new notes*. It is named `Untitled.excalimathpad`, then `Untitled 1`,
  `Untitled 2`…, holds an empty sheet (format 1, default settings) and opens in a new tab on
  the welcome screen.
- **An outside change** (sync, git, another app, a second tab on the same file):
  - an idle tab (nothing unwritten, no line open) reloads in place, keeping scroll and zoom,
    with no undo step and the history cleared;
  - a busy tab keeps the outside version in the file, writes its own beside it as
    `<name> (conflict YYYY-MM-DD HHmm).excalimathpad` (never overwriting a file, in the same
    folder), shows a notice naming the copy, then reloads.
- **Each tab** has its own view, scene, undo history and file adapter. A rename or move keeps
  the tab open, and Obsidian updates links. A wikilink to the sheet opens it; an embed shows
  Obsidian's default.
- **A failed write** shows Obsidian's notice with the message and leaves the work in the
  tab, so the next change or close writes again.
- Obsidian Sync carries `.excalimathpad` files only with "Sync all other types" on; the
  README says so.

Decided in: [file](https://github.com/matheus-sancha/excalimathpad/issues/12),
[undo research](https://github.com/matheus-sancha/excalimathpad/issues/10),
[unit slot](https://github.com/matheus-sancha/excalimathpad/issues/16),
[numbers](https://github.com/matheus-sancha/excalimathpad/issues/30),
[print](https://github.com/matheus-sancha/excalimathpad/issues/21),
[chosen width](https://github.com/matheus-sancha/excalimathpad/issues/100),
[text colours](https://github.com/matheus-sancha/excalimathpad/issues/93),
[title format](https://github.com/matheus-sancha/excalimathpad/issues/95),
[a sheet in a vault](https://github.com/matheus-sancha/excalimathpad/issues/124).

## 8. App chrome

Built in M1 (☰ file items, file name, Add math) and M2 (Math settings and the Sheet panel). From
M4d the label is **Math settings**, in sentence case in both homes (until M4d "Math
Settings"), and so is every UI text, for Obsidian's lint. Print…
and the Page row arrive in M5; until then Ctrl+P is the browser's own and prints the
screen. There is no app bar: the chrome lives inside Excalidraw's own UI slots.

```
☰  ● pump-sizing.excalimathpad      [ Excalidraw's toolbar … More tools ② ]      Library
                                                    Math
                                                    ∑ Add math        M
                                                    Math settings ②
```

- **☰ menu:** Open… (Ctrl+O), Save (Ctrl+S), Save as… (Ctrl+Shift+S) and Print… (Ctrl+P)
  at the top. Excalidraw's own Open, Save to… and Export image… are removed. Its other
  items stay: Find on canvas, Help, Reset the canvas, dark mode, canvas background. From M4b the
  menu's last line is the [build stamp](#hosted-build), which is text, not an item. From M4d
  **Math guide** sits just above Excalidraw's Help ([Math guide](#math-guide)).
- **File name** beside the ☰ button, with `●` while dirty.
- **Window title:** the name without its extension, with `●` while dirty: `● pump-sizing`.
  An unsaved sheet reads `● Untitled`. While printing, the title drops the mark, so the PDF is
  named `pump-sizing.pdf`, because Save as PDF names the file from the title.
- **More tools**, Excalidraw's own dropdown at the end of its toolbar, holds the app's two
  items under a **Math** heading, below Excalidraw's. The app has no buttons of its own on
  the canvas. Choosing an item closes the dropdown.
- **∑ Add math** is the first, labelled with its shortcut **M**. It reads as pressed while
  placing, and so does the More tools button, as it does for Excalidraw's Frame tool.
- **Math settings** opens and closes the Sheet panel, and reads as pressed while it is open.
  It carries a red badge counting errors while the sheet has any (until M4d, errors and
  warnings); the More tools button carries the same badge, so the count shows with the
  dropdown closed. A sheet with warnings alone shows no badge.
- An empty untitled sheet shows Excalidraw's welcome screen: the app's name, the hint
  "Press M, or choose Add math under More tools, then click the sheet to place math", and Open… (Ctrl+O).
  Excalidraw's own logo and collaboration items are left out.

### Add math

Choosing Add math or pressing **M** turns the cursor into a crosshair with a ghost box. The next
click on the canvas places the element there, selected, with its first line open for
typing. It can be placed on top of an existing element. **Esc** before clicking cancels.
Placing isn't in the scene and isn't an undo step until the click.

- The ghost box is the new element's box, with its top-left at the pointer, where the
  click puts it.
- **M works from any tool,** like Excalidraw's own letter shortcuts, unless Excalidraw is
  busy (its text or line editor, a shape being drawn, a menu or dialog open) or a field
  has the keyboard, where "m" is typed.
- **M or the button pressed again while placing keeps placing.** Only Esc cancels.
- **Each Add math places one element.** The tool then returns to selection.

### Sheet panel

Excalidraw's docked sidebar, opened by Math settings. Its tabs, the dock button and
the close button all fit its width (until M4e the panel is 384 px wide, since Excalidraw's own 302 px is too narrow for four tabs; from M4e see below), so the close button is never cut by the window. Open at
launch on a wide window, on Variables, or on Problems
if the opened sheet has any errors (from M4d; before, any problem). Open or closed is
remembered per browser, not in the file. On a small window (1229 px or less) it floats over
the canvas, and closes after a jump or a click on the canvas.

**From M4d the panel has six tabs,** in the order **Format, Symbols, Variables, Problems,
Constants, Settings**. Each is an icon with a tooltip; the active tab also shows its name.
The Problems badge sits on its icon. Format is the [Format tab](#format-tab) and Symbols the
[Symbols tab](#symbols-tab).

**From M4e the panel is narrower, resizable, and docks by its own width:**

- **320 px wide by default** (`--right-sidebar-width`; the panel itself is 8 px narrower).
- **The six tabs are icons only.** The active tab's name is a heading at the top of its
  content, and stays each tab's tooltip and accessible name. "Keep sidebar open" and Close
  stay in the header. Tabs are 32 px at 320 px and wider, and shrink to about 28 px at the
  least width.
- **Its left edge is a drag handle:** 280 px least, 480 px most; a double-click puts it back
  to 320 px. With the handle focused, ← and → move it 16 px and Home puts it back. The handle
  is the app's own control; Excalidraw isn't forked.
- **The width is remembered per device and never in the file,** beside the open state
  (browser storage on the web, the plugin's `data.json` in a vault). Resizing never makes the
  sheet dirty, is no undo step, and never ends an open line's edit.
- **It docks when the editor is wider than 640 px plus the panel's width** (960 px at the
  default; 920 to 1120 px across the drag range), not 1229 px. The 640 px is the room
  Excalidraw's toolbar needs. That one value is passed to Excalidraw as
  `UIOptions.dockedSidebarBreakpoint` and used for the app's own decisions, and follows the
  width as it is dragged. At or below it the panel floats over the sheet and closes on a
  press outside. Opening at launch follows the same width. The remembered open state still
  counts only a docked panel's choice.
- **An edit opens the panel on Format only when the panel docks,** or is already open. On an
  editor too narrow to dock, an edit opens nothing: the user opens the panel from Math
  settings to format.

As built (#198):

- **The handle** is the panel's left 8 px (16 px after a touch press), named "Resize the
  panel". A drag is remembered once, at its release; each key and the double-click at once.
  ← widens the panel, since it moves the handle left. A remembered width outside 280 to
  480 px is brought inside it.
- **"Docks" is by width alone,** for the launch, an edit and a jump: an editor wider than the
  docking width, whatever "Keep sidebar open" is set to, as it was at 1229 px.
- **With the panel open on an editor too narrow to dock,** an edit switches it to Format and
  its end puts its tab back, by the rule below. That is how a line is formatted there: select
  the element, open Math settings, and press the Format tab's Edit. On a tablet held upright
  the [quick keys](#touch) show with the panel, so only once it is open.
- **The bottom sheet on a phone is unchanged:** its active tab still shows its name, and it
  has no heading and no handle. An edit opens it as before.
- **Room at 280 px:** a rule's ↑ ↓ ✕ sit under its condition, beside its state, so the
  condition's field has the row; a constant's value too long for its row goes under its
  symbol. Checked in Chromium at 280 px, tab by tab
  ([spec history](spec-history.md#17-verify-first)).

- **An edit opens the panel on Format.** When a line or the title opens and none was open,
  the panel opens on Format, or switches to it. Moving within the edit keeps whichever tab
  shows, so a tab picked during the edit stays. When the edit ends, the panel returns to how
  it was: closed if it was, else its tab. Closed during an edit, it stays closed until the
  next. The automatic open and restore are never remembered as the user's choice.
- **On a small window** the same rule holds. The fields carry `data-prevent-outside-click`,
  so a press in them keeps the floating panel; a press on the canvas still closes it, and
  the next edit reopens it. If the open line would sit under the panel, the view scrolls it
  clear by the [follow rule](#while-editing-a-line) (0.2.1): the least distance, with no
  centring. A jump from the panel still centres its element.
- **A press in the panel never leaves the line.** Its controls that act on the open line
  are no-focus buttons. A typed field in it (a filter) takes focus, and so leaves an open
  line. From M4e a rule's condition field ([Rules list](#rules-list)) is the one typed field
  that doesn't: the line stays open while it has the keyboard. A focused control in the panel never passes a key to Excalidraw: Delete on a focused
  `<select>` doesn't delete the selected element (a defect until M4d).

| Tab | Holds |
|---|---|
| **Variables** | A filter box, then every name in reading order, grouped by element, labelled by the element's position. Row: typeset name, value, unit, in the unit system and Digits. A name defined twice appears twice. A line with an error shows "error". A text shows plain, as in its result cell (M4d). A list shows its summary (`30 values, 1 … 30 L/s`). A function shows its signature, `H_s(Q)`, with `function` or `solve function` as the value and a blank unit. Comments and notes don't appear |
| **Problems** | Errors `●` and warnings `⚠` in one list in reading order, each with its message and "element, line n · name". Comments and notes don't appear |
| **Settings** | Unit system, and for Custom its kind → unit table. Digits, 2 to 15. Result colour, one of six (M4c). Page: A4 or Letter, portrait or landscape |
| **Constants** | A filter box, then every [built-in constant](#constants) in its group. Row: its symbol typeset and its value in the unit system and Digits, then what it is and the names a line reads it by (`c or speedOfLight`). The filter matches names and descriptions. Nothing here is the sheet's, so a row doesn't jump. From M4d a click inserts its name at the caret ([Symbols tab](#symbols-tab)) |

- **An element with a title is named by it** in Variables and Problems ("Pipe flow, line 3"),
  in place of its position. Built with the panel (#58).
- **Clicking a variable or problem jumps to it:** the view scrolls the element into the
  middle, selects it and flashes the line for about 1.5 s. With reduced motion it's a static
  outline that clears on the next click.
- **Settings aren't part of undo.** Changing one re-shows every result, refits boxes and
  marks the sheet dirty. Ctrl+Z doesn't reach it.

### Math guide

From M4d. **☰ → Math guide** opens `docs/math-guide.md`, turned into HTML at build time, in an
in-app dialog that scrolls and starts at its contents list. (The build turns it into a tree of
elements that the dialog draws, so nothing sets `innerHTML`, as Obsidian's review asks.) It has no shortcut (`?` stays
Excalidraw's Help). It is the same on the web, offline and in a vault, and makes no request.

- It is written for a newcomer engineer, about 400 to 600 lines, in 17 sections in learning
  order: a first sheet; lines and names; units; numbers and constants; functions; checks
  and conditions; solve; ranges and lists; tables; plots; comments and notes; formatting;
  the Symbols tab; the Sheet panel; files and recovery; keys and gestures (saying that
  Excalidraw's Help lists the drawing keys); common messages.
- Each form is a row of **Write | Shows | Note**; a multi-line example is a code block with
  each line's result after `→`. No screenshots.
- It links only to its own sections, and to no file or site.
- A CI test (`src/math/math-guide.test.ts`) evaluates each section's Write cells in order as
  one sheet and checks each against its Shows cell, at the default Digits. Rows that aren't
  math carry a marker the test skips: a Write cell in italics.
- The dialog closes on Esc, ✕ or a click outside, and is as wide as the view allows up to
  about 760 px.

### Inside an Obsidian tab

From M4d, in the plugin. The web app's chrome above is unchanged.

- **☰ menu:** Math guide, Find on canvas (Ctrl+F), Help (`?`), Reset the canvas, a separator,
  Dark mode (Alt+Shift+D), Canvas background, then the version stamp (`0.1.0`) as text. The
  file items are gone ([A sheet in a vault](#a-sheet-in-a-vault)).
- **No file name** beside ☰ and no `document.title`: Obsidian's tab header names the sheet.
- **The welcome screen** keeps the name and the hint, without Open…. On touch the hint reads
  "Tap More tools, then Add math, then tap the sheet".
- **Theme:** Excalimathpad's own light or dark mode, whatever Obsidian's. Dark mode in ☰
  (Alt+Shift+D) switches it, and the choice is remembered in the plugin's `data.json`: every
  sheet tab opened after it opens in that mode, after a restart too. Light until one is chosen.
  Canvas background is saved in the file, as on the web.
- **Keys** act only while the tab has focus. Obsidian's core keys always pass through, even
  from the canvas or a line: Ctrl/Cmd+P, O, N, W, `,`, Shift+F, S (Obsidian's save), and
  Ctrl+Tab / Ctrl+Shift+Tab. A core key Obsidian acted on stops at the view, so the sheet
  doesn't act on it too (Excalidraw would answer Ctrl+P with a toast); one Obsidian left alone
  goes on to the sheet. Ctrl+Shift+E stays swallowed. Everything else the sheet uses
  stays the sheet's: M, Enter, Esc, ↑ ↓, Tab in suggestions, Ctrl+B/U/I, Ctrl+Z/Y,
  Excalidraw's letters, Ctrl+C/V/D/A/F, `?` and Alt+Shift+D.
- **The Sheet panel** is Excalidraw's sidebar inside the tab, docking when the **tab** is
  wider than 1229 px (from M4e, 640 px plus the panel's width: [Sheet panel](#sheet-panel))
  and floating when narrower, so a split pane floats it. Each tab has its
  own panel. Its open or closed memory is kept in the plugin's `data.json`.
- **Hidden in the plugin:** Web Embed and Mermaid to Excalidraw in More tools, with the
  Generate heading over them, and Excalidraw's AI items; Browse libraries (the library keeps
  the session's items); Copy to clipboard as SVG (Copy as PNG stays); Excalidraw's command
  palette, whose keys (Ctrl+/, Ctrl+Shift+P) are swallowed.
- **Obsidian's entries:** the commands **New sheet** (always), **Add math**, **Toggle Math
  settings** and **Open Math guide** (only while a sheet tab is active), with no default
  hotkeys; the ribbon icon (New sheet); no settings tab. Add math and Toggle Math settings do
  what their More tools items do, in the active tab, and Open Math guide what ☰ → Math guide does.
- **Side by side and in a pop-out window** each sheet tab keeps its own keys, panel and
  dialogs. In a pop-out (desktop) the tab works as in the main window: drag, place, draw,
  Help and the other dialogs, copy and paste. Excalidraw listens on the main window there, so
  the **pop-out bridge** carries the pop-out's events and dialogs across
  ([section 14](#14-engineering-constraints)).
- Excalidraw's Help and `?` stay. Its outbound links open the browser only when clicked.
- Reset the canvas keeps Excalidraw's confirm, is one undo step and autosaves.

### On a phone

From M4d, in the plugin on a phone (`Platform.isPhone`). A tablet follows the docking rule
above, by the editor's width (1229 px until M4e).

- **The Sheet panel is a bottom sheet** across the view instead of the right sidebar. While a
  line is open it sits just above the on-screen keyboard and is short: the quick keys, the
  tab icons and a few rows of the tab, which scroll inside it. With no line open it is
  taller, about half the view. Its ✕ closes it, as Math settings does. The tab contents are
  the same components.
- The open-then-restore rule holds, and the view scrolls the open line into the space left
  above the sheet and the keyboard by the [follow rule](#while-editing-a-line) (0.2.1): the
  least distance, with no centring.
- Buttons for a finger are at least 40 px. The quick keys sit in the order
  `_ ^ = ( ) * / , ..` then the quotes.

Decided in: [chrome](https://github.com/matheus-sancha/excalimathpad/issues/17),
[gestures](https://github.com/matheus-sancha/excalimathpad/issues/28),
[functions](https://github.com/matheus-sancha/excalimathpad/issues/27),
[numbers](https://github.com/matheus-sancha/excalimathpad/issues/30),
[ranges](https://github.com/matheus-sancha/excalimathpad/issues/20),
[Chromium PDF](https://github.com/matheus-sancha/excalimathpad/issues/34),
[warnings at rest](https://github.com/matheus-sancha/excalimathpad/issues/118),
[Math guide](https://github.com/matheus-sancha/excalimathpad/issues/120),
[Format tab](https://github.com/matheus-sancha/excalimathpad/issues/121),
[Obsidian tab](https://github.com/matheus-sancha/excalimathpad/issues/129),
[phone and tablet](https://github.com/matheus-sancha/excalimathpad/issues/127),
[listing](https://github.com/matheus-sancha/excalimathpad/issues/130).

## 9. Solve

Built in M3, with a guess on every solve. From M4c a solved value searches a range and can
hold several roots; a solve function keeps its guess. A solve is one line. v1 solves one
equation in one unknown, with our own solver in `src/math/`.

```
x_r  = solve x^3 - 6x^2 + 11x = 6, for x = 0 .. 10                      1, 2, 3
x_2  = x_r[2]                                                            2
Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s in L/s               18.81 L/s
f(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02
f_d = f(Re_d, eps/D)
```

**The two forms:**

| | Solved value | Solve function |
|---|---|---|
| Written | `<name> = solve <lhs> = <rhs>, for <unknown> = <from> .. <to>` | `<name>(<params>) = solve <lhs> = <rhs>, guess <unknown> = <expr>` |
| Gives | Every root found in the range | One root, near the guess |
| Runs | Once per run, at its line | At every call |

- A solve line defines exactly one name. A solve can't appear mid-expression
  (`2 * solve …`): solve into a name, then use the name.
- **A solved value with `guess` is an error** that says what to write, and so is one with
  neither clause. Sheets saved before M4c show it on each such line: nothing is converted for
  them. **A solve function with `for` is an error** that asks for `guess`.
- **Why a function keeps the guess:** it is called many times, and a range search costs 25 to
  40 times a guess solve. A search inside a search would take about 0.3 s.
- **Unknown: local to the line.** Inside the equation it wins over every other meaning: a
  variable above, a unit, or the function being defined (in Colebrook, `f` inside is the
  unknown, not a recursive call). It isn't defined below the line. If it's a unit name, the
  shadow warning still shows.
- **Tolerance:** fixed. Brent stops when the bracket is within about 1e-12 relative of the
  root, with a cap of 100 iterations, which is an error. There is no setting, so nothing is
  saved.

### Search range

- **The word is `for`.** Both ends are required, of the same kind, with `from` below `to`.
  There is no step.
- The ends are expressions evaluated each time the solve runs, in the scope at that point.
  They can't use the unknown. **The unknown takes its dimension from them,** as it takes it
  from a guess.
- **The search:** the residual is sampled at 200 evenly spaced points of the range, and Brent
  runs on every sign change between two neighbouring points that have a value. A point where
  the equation has no value is skipped.
- **A pole or a jump isn't a root.** A crossing is kept only if the residual at the converged
  point is at most 1e-6 of the larger residual at its two sample points.
- **A double root is found** by a second pass over places where the residual dips toward zero
  without changing sign. If it crosses there, the two roots are found; if it only touches
  zero (within 1e-9 of the neighbouring samples' size), it counts as one root, marked
  "touching" in the details.
- **These numbers are fixed:** 200 points, the tolerance, the 1e-6 check and the 1e-9
  threshold. No settings.
- **What it doesn't promise:** it finds the roots it can see at that spacing. It can miss two
  roots closer than the spacing, the roots of a fast-oscillating equation, and every root
  outside the range. So the app says "roots found in a .. b" and never "all roots". Complex
  roots aren't found.

### Roots

- Roots come out in **ascending order**.
- **Exactly one root is a single value,** as a guess solve's result was. Lines below show
  plain values.
- **Several roots are a list,** like any other ([section 10](#ranges-and-lists)): a line that
  uses the name without an index runs once per root, and aggregates, tables, plots and the
  Variables tab treat it as a list.
- **`x_r[2]` takes one root** ([section 3](#3-sheet-lines-every-form)). `x_r[1]` works for one
  root or several.
- **Accepted cost:** if inputs change and a second root appears, the lines below become lists.
- **Shown:** up to five roots are written out in one row, ascending, with the unit once:
  `0.07996, 0.1491, 0.2369 L/mol`. Six or more show a summary with the count:
  `13 roots, 0.5236 … 38.22`. Details are on hover. Nothing extra prints.
- **More than 100 roots is an error** that asks for a narrower range.
- **A range solve can't use a list:** if its equation or its range mentions one, that is an
  error which points to a solve function with a guess. There are no lists of lists.

### Guess

- **Required on a solve function.** It can be any expression, evaluated each time the solve
  runs, in the scope at that point: names above, plus the parameters. It can't use the
  unknown. The unknown takes its **dimension** from the guess's unit.
- The search steps out from the guess to a sign change, then Brent. It returns one root.
- **Result:** the value only, on the calling line, in its display unit or the unit system.

### Failure

An error on the line that ran it, with the cause named. A failed solve never shows a
best-effort value.

- **Solved value:** the error is the solve line's result. **No root in the range is an
  error.** A failed line removes its name, so lines below say `has an error above`. There is
  no warning for a root near the edge of the range.
- **Solve function:** the solve runs only when called, so the error lands on the **calling**
  line and names the function and its arguments.
- **A range end or a guess that fails to evaluate** is the line's error.

**Nested solves:** an inner failure counts as "outside the domain". When the outer search
tries a point where an inner solve fails (Colebrook at Q ≤ 0), it treats that like a point
with no value: a range search skips it, and a guess search looks on the other side. Only if
the outer solve ends without a root does its line error, and the message carries the last
inner cause. **Units errors are never swallowed:** they fail the line at once, because no
trial point can fix them.

Decided in: [solve](https://github.com/matheus-sancha/excalimathpad/issues/19),
[libraries](https://github.com/matheus-sancha/excalimathpad/issues/18),
[all-roots research](https://github.com/matheus-sancha/excalimathpad/issues/91)
([`all-roots-solve.md`](research/all-roots-solve.md)),
[all-roots solve](https://github.com/matheus-sancha/excalimathpad/issues/92).

## 10. Ranges, tables, plots

Built in M4. The index and per-point rules arrive with M4c.

### Ranges and lists

```
Q_s = 1 L/s .. 30 L/s step 1 L/s
x = 0 .. 1 step 0.1
n = 1 .. 10
```

- **The step is required when the ends have units.** Without units it defaults to 1.
- **Start, end and step are the same kind.** The end is included when the steps land on it;
  otherwise the range stops at the last point before it.
- A negative step counts down. A zero step, or one pointing away from the end, is an error.
  More than 10,000 points is an error.

**math.js's own range and builders take the same limit** (M4e). Matrices stay an undocumented
passthrough of math.js: small ones (`inv`, `det`, `cross`, `sum(1:100)`) work as they did.

- `a:b`, `a:step:b` and every math.js function that takes a size or a count (`zeros`, `ones`,
  `identity`, `range`, `nthRoots`, …) are checked on their arguments before math.js runs.
  Anything that would build more than 10,000 values (rows × columns for a matrix) is a line
  error: `identity(100)` is allowed, `identity(101)` refused. The 10,000 is one number in the
  code, shared with the sheet's own range.
- A function whose result can pass the limit from legal arguments (`kron`, `concat`, `resize`,
  `diag` of a list, `setCartesian`, `setPowerset`, a column times a row, a list times a matrix)
  is checked on the size its result would have. A list times a matrix would hold a matrix at
  every point: its points fail when points × the matrix's values pass the limit.
- An end of `a:b` that isn't a finite number is its own error. So is its step, in the same
  words, and a `0/0`: `0/0 is not a number`.
- **The message names the call as typed** (`zeros(n) has more than 10,000 values`), inside a
  longer line too. Where the line can't run the call again by itself (inside a function's
  body, at one point of a list), it is written from its values instead: `zeros(1e8)`, a
  matrix too large to write as `…`, and a range's end as `the end is ∞`.
- A call that is slow without building anything large (`combinations(1e9, 5e8)`) is refused
  by a bound on its argument, set at what keeps the call inside the sweep's time limit
  ([section 14](#14-engineering-constraints)); the bounds are listed there as they are found.
  `1e8!`, `9^9^9` and `gamma(1e7)` answer `∞` at once and are untouched.
- **A large matrix is summarised where it is shown.** A matrix or math.js range of up to 20
  values is shown whole. Past that, the result cell and the Variables tab show a one-row
  summary, and the hover shows the first and last few rows with their index, as a list's
  does. Nothing is refused for being too big to show. A row of values reads exactly as a
  list does, in its unit and the line's display unit (`30 values, 2 … 60 mm`); a matrix reads
  by its size (`3 × 7 matrix`, `10 × 10 × 10 matrix`), and each row of its hover shows three
  values from each end. A summarised result has no unit slot, as a list has none.

  ```text
  1:5               [1, 2, 3, 4, 5]
  inv(a)            [[-2, 1], [1.5, -0.5]]
  1:2000            2000 values, 1 … 2000
  identity(100)     100 × 100 matrix
  ```
- **A legal line that is slow is accepted.** It is the user's own request and recovers when
  the line is fixed. The measured case: `Q_s = 1 L/s .. 30 L/s% step 1 L/s`, a typo, is 3,000
  values and about 600 ms per key against 41 ms. Evaluation stays synchronous, with no worker
  and no wait for a pause in typing.

**A line that mentions a list runs once per point,** and its result is a list of the same
length: `H_s = Hs(Q_s)` is 30 values, from 30 Colebrook solves.

- **Several lists in one line pair up point by point** (`dH = H_p - H_s`). Different lengths
  are an error on the line.
- **Aggregates take the whole list:** `H_max = max(H_s)`.
- Every function works point by point with no special syntax, user and solve functions
  included. `Q_s^2` means each point squared.
- **A function body can't reach a list from outside.** `g(x) = x + Q_s` is an error at the
  definition. Only the line that calls with a list iterates.
- **An index takes one value out,** counting from 1 (M4c): `Q_s[5]`, `H_s[1]`. It works on
  any list: a range, a per-point result, a solve's roots. Its rules are in
  [section 3](#3-sheet-lines-every-form).
- **A solved value with several roots is a list too** ([section 9](#roots)). Its length is
  the number of roots found, so two such lists on one line pair up only if they are the same
  length, like any others.

**A list result shows one row high,** as a summary: `30 values, 12.04 … 33.18 m` (count,
first … last, unit). Hovering it shows the first and last few values with their index.
From M4d a list of texts (a verdict per point) counts each distinct text instead, most
frequent first, ties in the order first seen: `3 OK, 1 NOT OK`. Failed points come last,
`2 OK, 1 NOT OK, 1 failed`. The hover and `table()` still show each point.

**A failed point fails only itself:**

- The line gets a red `●` with "1 of 30 points failed" and the first point's message.
- The summary reads `29 of 30 values`.
- A table cell shows a red — with its message on hover.
- An aggregate over a list with a failed point is an error.

**A rule on a list is tested per point** (M4c), with `result` and the list names at that
point's value, as the line already runs once per point.

- **A list's one-row summary takes the format only if every point is true.** Its hover says
  how many are (`12 of 30 points`). Roots written out in one row follow the same rule.
- **A table row whose point is true takes the format:** `table(Q_s, v) @red if v > 3 m/s`
  highlights the rows over the limit. On a table line `result` is a warning; its conditions
  read the list names.
- A failed point counts as not true.

### Tables

`table(Q_s, H_s, Hp(Q_s))` draws a typeset table **under the line, inside the math element**,
with one column per argument, headed by its expression and unit.

- **Every row shows,** on screen and in print. A table is as tall as its rows. Long lists are
  for plots.
- **Units:** each column shows in its argument's display unit, else in the unit system. An
  argument can carry its own: `table(Q_s in L/s, H_s in m)`. The unit in a column header is a
  unit slot; picking a unit there writes `in <unit>` onto that argument.
- **Numbers** keep trailing zeros ([section 5](#numbers)).
- **The line has no result value.** Its errors go in its result cell: an argument that isn't a
  list, or lists of different lengths. A scalar argument fills its whole column.
- It defines no name.

### Plots

```
plot(Q_s, Hs(Q_s), Hp(Q_s)), mark Q_op
```

A plot is a line, `plot(x, y1, y2, …)`, drawn **under the line** with Observable Plot, loaded
lazily. Its settings are clauses after it. Hovering the chart shows a ⚙, which opens a popover
that writes those clauses into the source, one line commit per change. Esc or a click outside
closes the popover. Typing the clauses works too.

| Clause | Means | Without it |
|---|---|---|
| `mark Q_op` | A dashed vertical guide at that x, a dot where it meets the curve, its value at the top of the guide (`Q_op = 18.81 L/s`). Can repeat. Any expression giving one value of x's kind | No marks |
| `labels direct` | Series names at the line ends | A legend above the chart, typeset |
| `points` | A dot at every point, as well as the line | Line only |
| `x log`, `y log` | Log axis. Zero or a negative value in range is an error on the line | Linear |
| `x a .. b`, `y a .. b` | Axis range, same kind as the axis (`y 0 m .. 40 m`) | Fits the data |
| `size S`, `size L` | 360 × 220 or 640 × 360, in scene units | M, 480 × 280 |
| `title "…"` | A title above the chart | None |

An unknown clause is an error on the line. The popover holds Mark, Series names, Points, x axis,
y axis, Size and Title.

**From M4e a plot can draw a point and a circle, with equal scales.** `plot(x, y1, …)` and every
clause above work as before. The true-position chart is one line, with no helper line:

```
plot(dx, dy), circle T_p / 2, title "True position"
```

| Clause or form | Means |
|---|---|
| `plot(x, y)` with two single values | One dot at (x, y), with its coordinates beside it. This replaces `x must be a list` for this case only; one single value against a list is still that error. The axis titles are the two arguments as written, with their units: `dx [mm]`, `dy [mm]` |
| `point (x, y)` | The same labelled dot, on any plot, drawn over the curves. Can repeat. `mark` stays as it is, with its line |
| `circle r`, `circle (x0, y0) r` | A circle of radius `r` in the axes' units, centred on the origin or on (x0, y0). An outline, not filled, drawn as one shape from no list. `r` is any expression giving one positive value of the axes' kind. Can repeat. A circle gives the chart equal scales, with no way to turn that off |
| `equal` | Both axes take one scale, so a unit of x is as long as a unit of y. Needs x and y of the same kind |

- **A point's label** is plain text: `(0.08, −0.05) mm`, each number to the sheet's Digits, the
  unit once when both share it and after each number when they differ. It sits right of its
  dot, or left of it when the right has no room, with a halo in the chart's background colour
  so a line under it doesn't cut through the text. It stays inside the chart.
- **Equal scales:** the ranges are worked out from what is drawn (curves, points, circles),
  padded, then the shorter axis is widened around its middle. With a typed `x a .. b` or
  `y a .. b`, the typed range is kept and only the other axis is widened; with both typed it
  is an error.
- **The look of a chart with equal scales** (from `equal` or a circle): a frame, a line through
  0 on each axis, and no grid. Other charts keep their grid.
- **Its size is square:** `size S`, M and `size L` give 220, 280 and 360 px a side.
- **The legend:** a point's row shows a dot and the point as written (`dy against dx` for
  `plot(dx, dy)`, `(dx, dy)` for a `point` clause); a circle's row shows a line and
  `circle T_p / 2`. Colours follow the fixed order: curves first, then points, then circles.
  No pass or fail colour.
- **Nothing drawn runs past the chart,** on any plot. The app sets all four margins, sized for
  the tick numbers, the titles and a mark's label (before M4e they could run up to about
  40 px past it).
- **The popover** gains Point, Circle and Equal scales.
- A chart is still a fixed block that sets the element's least width and ignores a chosen
  width.

- **Arguments follow `table()`:** x must be a list; lists of different lengths are an error; a
  single-value y draws a horizontal line; at least one y is required.
- **One kind per plot.** Mixed kinds on y are an error on the line. Same kind in different units
  isn't: series that disagree take the first series' unit.
- **Axes:** titles are automatic: x from its argument and unit (`Q_s [L/s]`), y from the series
  and shared unit (`H_s, H_p [m]`). Each axis uses its arguments' display units, else the unit
  system. An argument can carry its own: `plot(Q_s in L/s, Hs(Q_s) in m)`. Ticks use the chart's
  own round values; a mark's value uses Digits.
- **Colours:** a fixed order.
- **Reading order:** the line evaluates where it is, so a mark must be defined above it.
- **It defines no name.** Its result cell is empty, and its errors go there.
- **Failed points:** the line has a gap there and a red × sits on the x axis, with its message on
  hover. The line gets a red `●` and "1 of 30 points failed" with the first message. If every
  point of a series fails, it's an error on the line.
- **Static apart from the settings.** No zoom, pan or hover values on the curves.
- **Pointer:** dragging from a chart moves the element. A double-click on it opens the plot line.
  The ⚙ works like the unit slot, on `click`.
- Until Observable Plot loads, a placeholder of the chart's size keeps the box from jumping.

Decided in: [ranges](https://github.com/matheus-sancha/excalimathpad/issues/20),
[plots](https://github.com/matheus-sancha/excalimathpad/issues/31),
[libraries](https://github.com/matheus-sancha/excalimathpad/issues/18),
[all-roots solve](https://github.com/matheus-sancha/excalimathpad/issues/92),
[conditional formats](https://github.com/matheus-sancha/excalimathpad/issues/94).

## 11. Print

Built in M5. Print fits the sheet to the page width and flows down onto as many pages as it needs.

- **What prints:** the whole sheet. The content's bounds (every drawing and math element) map to
  the printable width. Pan and zoom don't affect it.
- **Scale:** shrink only, capped at 100% (1 scene unit = 1 CSS pixel), from the left margin. There
  is no floor, so a very wide sheet just gets small.
- **Page:** A4 or Letter, portrait or landscape, in Settings; default A4 portrait. The app needs it
  to compute breaks, so paper size is changed there, not in the browser's dialog.
- **Furniture:** margins of 15 mm. A small grey footer on each page has the file name, the print
  date (`YYYY-MM-DD`) and `2 of 3`. An unsaved sheet reads "Untitled". No URL prints.

**Page breaks:**

- Never cut: a math line, comment row, table row or whole plot.
- A drawing that fits on one page stays whole. A taller one doesn't hold back the break. Excalidraw
  text counts as a drawing.
- A break is one horizontal line across the full width. It moves up to the nearest clean gap, so
  side-by-side content moves together.
- **Fallback:** with no clean gap (staggered side-by-side elements taller than a page), cut at the
  page bottom.
- A table split across pages repeats its header row.

**What's on paper:**

| Prints | Doesn't print |
|---|---|
| Drawings, typeset grid, notes, results as they show on screen, column rule, tables, plots with legend, marks, gaps and × | All app and Excalidraw chrome, the panel, selection, the line editor, anchor borders, the ⚙ and popover, hover details, the dotted underline |
| Errors: red `●` and message. A plot's gutter `●` | Warnings: the `⚠`, because its message lives on hover |

An element's math prints at its anchor's opacity. Colours are always a white page in light colours,
whatever the dark mode or canvas background. Text colours, highlights, formats set by a rule and a
title's format print as they show on a light screen, and an element prints at its laid-out width.

**Print flow:**

- **Print… (Ctrl+P, taken over from the browser)** goes straight to the browser's dialog, which is
  the preview and the route to Save as PDF. An open line edit ends first. Printing doesn't change
  the sheet or mark it dirty. Problems don't block it, since they print.
- **The browser's own Print command** builds the pages in `beforeprint` from cached parts: the
  drawing's SVG, cached and refreshed on idle after a scene change, plus clones of the overlay's
  math and plots, with KaTeX fonts loaded ahead of printing. If the cache is empty, it prints one
  line: "Use Print… from the app's menu".
- **Both routes** set the window title to the plain name while printing
  ([section 8](#8-app-chrome)), and restore it afterwards.
- **No page guides.** To change a bad break, close the dialog, move something and print again.
- **In a vault** (the plugin, from M4d), Ctrl+P is Obsidian's command palette, so Print… is a
  command, "Print…", with no default key, and a ☰ item as on the web. The footer's file name is
  the vault file's name.

**Changed on 2026-11-15, before M5 was built** ([print after M4d and M4e](https://github.com/matheus-sancha/excalimathpad/issues/186)). The page
rules above stand. Where these differ from the Print flow above, these win:

- **Where Print exists.** The web app, and the plugin on a computer. On a phone or tablet the
  plugin has no "Print…" command and no ☰ item, and the Math guide says so.
- **Print… in the plugin.** The pages are built in a hidden frame inside the view's own
  window, and that frame is printed, so only the pages reach the paper and nothing of
  Obsidian's does. It opens the operating system's print dialog. It uses no Node or Electron
  API, writes nothing to the vault and makes no request, so
  [data protection](#data-protection) is unchanged. "Print…" is a command and the first ☰
  item. While the dialog is open the plugin may set the window's title to the plain name, and
  restores it after.
- **No preview in Obsidian.** "The browser's dialog, which is the preview and the route to
  Save as PDF" is true on the web only. In Obsidian the route to a PDF is the system's own PDF
  printer ("Microsoft Print to PDF" on Windows). "No page guides" stands in both homes: to
  change a bad break, look at the PDF, move something and print again.
- **The browser's own Print, on the web,** always prints the one line "Use Print… from the
  app's menu". The cache of the drawing, the pages built in `beforeprint` and the fonts loaded
  ahead of printing are not built. Obsidian has no such command.
- **If building the pages fails,** no dialog opens, a notice says so
  (`The pages couldn't be built, so nothing was printed.`), and the sheet is untouched.
- **What's on paper** gains: a point with its label, a circle and their legend rows; a square
  chart, one unbreakable box like any plot; a line's unexpected error and the notice in place
  of a failed element or chart, as they show; a large matrix as its one-row summary. A line's
  stored format needs no print rule: the print view is built from the overlay's views.
- **The web app may use the same frame** as the plugin if it passes the Chromium PDF test, so
  there is one print path; otherwise it keeps [section 14](#14-engineering-constraints)'s
  recipe as written.
- **The Page row** fits the Settings tab at the panel's least width, 280 px.

Decided in: [print](https://github.com/matheus-sancha/excalimathpad/issues/21),
[Chromium PDF](https://github.com/matheus-sancha/excalimathpad/issues/34),
[comments](https://github.com/matheus-sancha/excalimathpad/issues/36),
[panel](https://github.com/matheus-sancha/excalimathpad/issues/32),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38),
[text colours](https://github.com/matheus-sancha/excalimathpad/issues/93).

## 12. Offline PWA

Built in M6, after 1.0.0 (changed on 2026-11-15). The app installs and works fully offline, and a `.excalimathpad` file opens from Windows.

- **Service worker and manifest:** vite-plugin-pwa, with vite-plugin-static-copy for the fonts.
- **Fonts:** Excalidraw's fonts are self-hosted from our own origin, including Normal (Nunito).
- **Precache:** the app, its fonts, the font-subset worker and WASM chunk, and the lazy chunks for
  KaTeX and Observable Plot. The 13 MB Xiaolai CJK font stays out and is cached on first use.
- **Updates:** prompt, not automatic. A new deploy asks, and accepting reloads onto the new bundle,
  so an open sheet is never reloaded unasked.
- **Opening files:** manifest `file_handlers` for `.excalimathpad` plus `launchQueue` (Chrome and Edge
  102+ on desktop, installed app only). The first launch asks to confirm. The app writes files itself,
  as in [section 7](#7-file-and-save).
- **Icons:** 192 px and 512 px PNGs, which the repo doesn't have yet.
- **Hosting:** the [hosted build](#hosted-build), which M4b sets up. Fallback: install from
  `npm run preview` on localhost.
- The build stays static files with a relative `base`.

### Hosted build

Built in M4b, before M5. The app is served at a public HTTPS address, so Matheus can open it on a second
machine, the work laptop first.

- **Host:** Cloudflare Pages, public, with no login gate. The app holds no data and sheet files stay on
  each machine's disk, so a public address is acceptable.
- **Deploy:** a push to `main` that passes `npm run check` publishes its `dist/` from CI. Nothing else
  deploys: a pull request publishes nothing. From M4d the web app and the plugin share one version
  number, released by hand ([section 12a](#releases)); the hosted app still deploys on every `main`
  push, and the README links it as a way to try the app before installing the plugin.
- **Build stamp:** the ☰ menu's last line shows the build's short commit and date, such as
  `389dd51 · 2026-11-12`, so two machines can be compared. A local build shows `dev`. The plugin's
  stamp shows only its version (`0.1.0`).
- **Until M6** there is no service worker: the app needs the network at each launch, a reload takes the
  newest build, and Excalidraw's fonts aren't yet served from our own origin.
- **Between machines** a sheet moves as its `.excalimathpad` file. The recovery copy belongs to one
  browser and doesn't travel.
- **The work laptop can't use it** (found on 2026-11-14, #115): the hosted app doesn't open there,
  while Obsidian there takes community plugins and runs the Excalidraw plugin. Which part is blocked
  wasn't recorded. The fallbacks once planned (a custom domain, fonts pulled forward, a zip of
  `dist/`) are dropped: the [plugin](#12a-obsidian-plugin) is the route to that machine.

Decided in: [PWA](https://github.com/matheus-sancha/excalimathpad/issues/22),
[file](https://github.com/matheus-sancha/excalimathpad/issues/12),
[libraries](https://github.com/matheus-sancha/excalimathpad/issues/18),
[work laptop](https://github.com/matheus-sancha/excalimathpad/issues/115).

## 12a. Obsidian plugin

Built in M4d. A community plugin, id `excalimathpad`, that opens `.excalimathpad` files from a
vault in its own tab, on desktop, phone and tablet. It bundles the whole app, built from the same
source as the web app, which stays. How a sheet saves there is in
[section 7](#a-sheet-in-a-vault), its chrome and keys in [section 8](#inside-an-obsidian-tab),
touch in [section 4](#touch). Research: [`docs/research/obsidian-plugin.md`](research/obsidian-plugin.md).

### One source, two builds

- **`plugin/`**, at the top level, is the only code that imports `obsidian`: `plugin/main.ts`
  (the `Plugin`: `registerView`, `registerExtensions(["excalimathpad"])`, the commands, the
  ribbon, the folder menu) and its siblings (the `TextFileView` mounting `<App>` on `contentEl`,
  the vault file adapter that replaces `sheetSession`, the key scope, the theme). It imports
  `src/`; `src/` never imports `obsidian` or `plugin/`, enforced by an oxlint rule and a test.
  `src/main.tsx` stays the web entry. `tsconfig.plugin.json`; one `package.json`.
  `manifest.json` sits at the repository root.
- **The plugin build** is `esbuild.plugin.mjs`: one CommonJS `main.js` with no splitting (the
  KaTeX and Plot `import()`s fold in), minified, `obsidian` external, fonts as `data:` URLs, a
  post-build rewrite of Excalidraw's run-time `./fonts/…` strings to `data:` URLs, no worker,
  and one `styles.css` keeping KaTeX's woff2 only. Licence notices stay at the end of `main.js`
  (`legalComments: 'eof'`). No `<style>` or `<link>` is created at run time.
- **Trims, plugin only:** Mermaid to Excalidraw, the non-English locales and font subsetting are
  stubbed; Xiaolai's paths become `local:`, so CJK text uses system fonts. Measured: 3.46 MB.
  The web build is untrimmed.
- **Scripts:** `build:web` (`vite build` → `dist/`), `build:plugin` (→ `dist-plugin/`: `main.js`,
  `styles.css`, a copy of `manifest.json`), and `build` runs `tsc -b` and both, so
  `npm run check` proves both homes on every pull request. `main.js` is not committed (see
  [Listing](#listing) for the one exception).
- **The view is confined to itself.** Every key and pointer listener and every dialog or portal
  (the Math guide, plot settings, notices) is bound to the view's own container and window
  (`registerDomEvent`, `activeDocument`, `element.doc`), so pop-out windows work. Nothing listens
  on the global `window` or `document`; Excalidraw keeps `handleKeyboardGlobally: false`.
  `html` and `body` CSS is scoped to the view. The other way, Obsidian's and a theme's global CSS
  stay out: the app's and Excalidraw's CSS sit in one cascade layer (`excalimathpad`), and one
  guard rule sends every property of every element inside the view back to that layer
  (`all: revert-layer`, weighted as an id), so the sheet and its panel look as on the web.
- **A device without regex lookbehind** (iOS below 16.4) is detected at view open
  (`new RegExp('(?<=a)b')` in a try): the view shows "Excalimathpad needs iOS 16.4 or later" and
  neither opens nor writes the sheet.
- **Tests:** Vitest aliases `obsidian` to a hand-written fake in `plugin/test/` (Plugin,
  TextFileView, Vault, Scope, Platform). The view's load and save, rename, outside change,
  conflict copy, key pass-through, commands, theme and "no global listener" are tested in jsdom.

### Data protection

"ALL my data is protected" is Matheus's identity in public, and every user's vault.

- **No network, ever.** Excalidraw's embeds, Browse libraries, the `esm.sh` fallback and
  excalidraw.com's Firebase config (the `AIza…` key) are removed or stripped; Xiaolai is `local:`;
  there is no telemetry and no account. A link on an element opens the browser when clicked.
- **Storage only in the vault:** sheets in their files; the plugin's memory (the panel's open or
  closed state, and light or dark) in `data.json` through `loadData`/`saveData`. No IndexedDB, `localStorage` or
  `App#saveLocalStorage`.
- **Reach:** it reads only the sheet open in the view and one image the user picks from a vault
  image picker (image files listed by name; the picked image is copied into the sheet, as
  Excalidraw stores any image). It writes only the open sheet (a path the view itself loaded),
  `data.json`, the new sheets the user creates, and the conflict copy. It never lists, renames or
  deletes another note.
- **Identity:** `manifest.json`'s `author` is `matheus-sancha` and `authorUrl`
  `https://github.com/matheus-sancha`, with no email and no `fundingUrl`; the listing matches.
  `LICENSE` stays "Excalimathpad Contributors". Before listing, the history is rewritten to his
  GitHub `noreply` address ([Listing](#listing)).
- **Written promise:** a README "Privacy" section for both homes (no network requests, no
  telemetry, no account, nothing outside the vault, the plugin reads only the open sheet and an
  image you pick; the web app keeps its recovery copy in the browser's IndexedDB), and the
  listing's "Works fully offline; makes no network requests."
- **Checked on every pull request and in Release, blocking both:**
  - **Bundle audit** over `dist-plugin/`: exactly three files; each at most 5,000,000 bytes (both
    sizes printed); the manifest version equals `package.json`'s; and no `./fonts/` path,
    `esm.sh`, `AIza`, `indexedDB`, `localStorage`, `new Function`, `<style>`/`<link>` creation
    outside React DOM's and Radix's own library code, or `http(s)://` host missing from a committed
    allowlist (XML namespaces, licence comments, Excalidraw's Help links and its embed patterns, each
    with why it can't load). **From 1.0.0, a budget per file** beside that cap: the measured
    size of the 1.0.0 build of `main.js` and of `styles.css`, plus about 5%. Going over fails
    `npm run check` with, for example, `main.js is 3,512,004 bytes, over its budget of
    3,500,000. If the growth is meant, raise BUDGET and say why.` Raising a budget is allowed,
    as a deliberate line in a commit that says what was added.
  - **Network-blocked run:** the built bundle loads in headless Chromium against the fake
    `obsidian`, with every non-local request blocked and logged, and opens a sample sheet with
    math, a plot, an image and CJK text. Any attempted request fails, and so does any `<style>` or
    `<link>` added at run time. The page also carries a stand-in for Obsidian's global rules for
    buttons, inputs and selects on a dark theme, and the run fails if a Sheet panel row takes any.
  - **Obsidian's lint:** `eslint-plugin-obsidianmd` over `plugin/` and `src/`, with
    `--max-warnings 0`. UI text is in sentence case in both homes.

### Releases

- **One version** for the web app and the plugin, from `package.json`. npm's `version` script
  copies it into `manifest.json` and adds a line to `versions.json` when `minAppVersion` changes,
  so `npm version <bump>` moves all three in one commit. Tags are `x.y.z`, with no `v`. The first
  release is `0.1.0`; `1.0.0` waits for v1's finish line. `minAppVersion` is `1.7.2`, and
  `versions.json` starts `"0.1.0": "1.7.2"`.
- **The Release button:** a manual Actions workflow (`workflow_dispatch`, patch, minor or major)
  runs `npm version`, commits and tags on `main`, runs `npm run check`, and drafts a GitHub
  release with `main.js`, `manifest.json` and `styles.css` and generated notes. Matheus publishes
  it. The workflow may push to `main`.
- **Before Publish,** Matheus ticks the draft's checklist, kept also in `CONTRIBUTING.md`: install
  the three files in a test vault (by hand or with BRAT), open a sheet, type a line and see its
  result, close and reopen, repeat on one phone or tablet, and (M4e) run the odd-values probe
  ([section 14](#14-engineering-constraints)).
- **Phone and tablet:** `isDesktopOnly: false` ships to strangers only after the CI touch tests
  (Playwright with `hasTouch`, at a phone and a tablet viewport, as Android and as iOS:
  `scripts/touch-run.mjs`, `npm run test:touch`) and Matheus's **device
  checklist** have passed on an iPhone, an iPad, an Android phone and an Android tablet: open
  from the vault, Add math, edit lines and the title, format and rules, Symbols and quick keys,
  tips, save, close and reopen, a sync round trip, and the keyboard with the bottom sheet. It runs
  before the first such release and before any release that changes touch, panel or overlay
  code, and its result, with devices and OS versions, goes in the release notes. If any device
  fails, that release ships `isDesktopOnly: true`.
- **Betas through BRAT:** releases before the listing are installed by Matheus through BRAT, on
  the work laptop and his devices, and carry `isDesktopOnly: false` so the device checklist can
  run on them. Fixes ship as `0.1.x`.
- **To 1.0.0** (M4e): `0.2.1` is a fix release (#179 and #191). M4e ships as the beta `0.3.0` through
  BRAT, M5 follows, and the release after it is `1.0.0`, the version submitted to the
  community list ([Listing](#listing)). A sheet saved by `0.3.0` or later is format 2, which
  `0.2.x` refuses ([section 7](#the-file)), so every device takes the beta before one saves.
- **Before `1.0.0` is published,** besides the draft's checklist and the device checklist
  (M4e and M5 change panel and overlay code, so it runs again on the four devices), Matheus
  checks by hand, on the work laptop in Obsidian: a format 1 sheet saved by `0.2.x` opens
  with its formats and saves as format 2; the pump sheet and the true-position sheet show
  their values; Print… gives a clean PDF through the system dialog (and in the web app in
  Chrome); the panel docks, drags and remembers its width; the plugin's start-up time is
  read; and the odd-values probe (about 8 minutes) has run. On the four devices, also: no
  Print… command, the bottom sheet's sample, and a tablet docking by its width. The lines
  are in `CONTRIBUTING.md` with the rest.
- **Start-up** (M4e): the plugin's own figure in Obsidian's startup-time view is read on the
  work laptop, and recorded on one phone. Loading the app only when the first sheet opens is
  built before `1.0.0` only if the work laptop's figure is over 150 ms; otherwise after.

### Listing

- **Manifest and listing:** id `excalimathpad` (fixed once published), name "Excalimathpad",
  description (172 characters): "Open and edit .excalimathpad calc sheets: an Excalidraw
  whiteboard with live, unit-aware math that recalculates as you edit. Works fully offline; makes
  no network requests."
- **The README, users first** (it is the listing page): the name and that one line; a screenshot
  of a sheet in Obsidian (`.github/assets/obsidian.png`, desktop, the pump sheet with its table
  and plot, the panel on Variables, taken by Matheus for the version submitted); **Get it** (Obsidian's Community plugins,
  or the web app with today's screenshot); **Your first sheet** in about five steps; **Math
  guide**; **Privacy**; **Support**; **Contributing** (a link to `CONTRIBUTING.md` and one line
  to the spec, `CONTEXT.md` and the ADRs); **Licence and credits** (MIT; Excalidraw, math.js,
  KaTeX and the other bundled libraries). Scripts, Build and Deploy, Architecture, Tech Stack and
  Roadmap move to `CONTRIBUTING.md`; Line forms, Things to know and Keyboard Shortcuts move to
  the Math guide.
- **Support, free and best effort:** GitHub Issues with a Bug form (version, home, device, steps,
  a sheet only if it holds nothing confidential) and an Idea form; blank issues and Discussions
  off; no response time; the roadmap follows Matheus's needs. `SECURITY.md` points to GitHub's
  private vulnerability reporting.
- **The preview scan** runs on the listing branch before submission. If it fails only because
  no built `main.js` is committed, the Release workflow commits the built `main.js` at the root in
  the release commit; otherwise `main.js` is never committed.
- **Before submitting, by hand (Matheus):** the history is rewritten so every commit carries
  `110572403+matheus-sancha@users.noreply.github.com` (`git filter-repo` with a mailmap, one
  force-push; every clone re-clones), GitHub support is asked to purge cached refs, and "Block
  command line pushes that expose my email" is turned on. A rewrite cannot recall copies already
  made.
- **The gate to submit** at community.obsidian.md: a clean preview scan, and at least one real
  calculation at work with no data-loss or blocker bug. The version submitted keeps
  `isDesktopOnly: false` only if the device checklist passed. After listing, BRAT is removed and
  the plugin installs from the list.

Decided in: [work laptop](https://github.com/matheus-sancha/excalimathpad/issues/115),
[plugin research](https://github.com/matheus-sancha/excalimathpad/issues/116),
[a sheet in a vault](https://github.com/matheus-sancha/excalimathpad/issues/124),
[data protection](https://github.com/matheus-sancha/excalimathpad/issues/126),
[phone and tablet](https://github.com/matheus-sancha/excalimathpad/issues/127),
[build and release](https://github.com/matheus-sancha/excalimathpad/issues/128),
[Obsidian tab](https://github.com/matheus-sancha/excalimathpad/issues/129),
[listing](https://github.com/matheus-sancha/excalimathpad/issues/130),
[M4d](https://github.com/matheus-sancha/excalimathpad/issues/125).

## 13. Messages

The wording of every user-facing message. `<…>` is filled in. Numbers follow
[section 5](#numbers), in the plain-text form.

**Reading and names**

| When | Message | Arrives |
|---|---|---|
| A name used above its definition | `x is defined below` | M0 |
| A name whose assignment failed | `x has an error above` | M0 |
| `table`, `plot` or `solve` assigned to | `table is a line form: choose another name` | M2 |
| `if` assigned to | `if is a function: choose another name` | M4d |
| A `;` at a line's top level | `one statement per line: split the line at the ;` | M4d |
| A name shadows a unit or built-in (warning) | `K shadows the unit K` | M2 |
| A use that falls back to the unit (warning) | `V reads as the unit V here: the variable is defined below` or `… its definition failed` | M2 |
| A body name not defined above (warning) | `y isn't defined above this line` | M2 |

**Functions**

| When | Message | Arrives |
|---|---|---|
| A value called like a function | `f_d is a value, not a function: write f_d * (...) to multiply` | M2 |
| A function used as a number | `q is a function: call it with q(...)` | M2 |
| Wrong argument count | `h needs 2 arguments, got 1` | M2 |
| Recursion with no end | `loop calls itself without end` | M2 |
| An error inside a body, on the calling line | `in k(1 s): Units do not match` | M2 |
| `in <unit>` on a definition | `Set a function's display unit on the line that calls it` | M2 |

**Units**

| When | Message | Arrives |
|---|---|---|
| Unknown `in xyz` in source | `Unknown unit xyz` | M2 |
| A complex value with a unit, alone or in a list | `a complex value with a unit can't be shown` | 0.2.1 |
| A clause word that isn't a format | `Unknown format @bolt`, `Unknown format @text-purple` | #63, M4c |
| A part of a joined word that isn't a format | `Unknown format @blod in @text-red+blod` | M4d |
| A comment word on a math line | `@L is for comment lines`, `@upright is for comment lines` | M4d |
| A rule on a comment line | `rules need a math line` | M4d |

**Conditionals and text**

| When | Message | Arrives |
|---|---|---|
| Text compared with a number or a unit | `can't compare text with a number` | M4d |
| `<` or `>` on text | `text can only be compared with == or !=` | M4d |
| `if()` with other than three arguments | `if needs 3 arguments: if(cond, a, b)` | M4d |
| A condition that isn't true or false | `if: the condition must be true or false` (the same for `? :`) | M4d |
| A condition that is a list or a matrix | `if: the condition must be one value; use a list line instead` | M4d |
| A unit compared with a bare number | `can't compare 3 m/s with 0: give the 0 a unit` | M4d |
| `in <unit>` on a text | `text has no unit: take off "in kPa"` | M4d |

**Rules** (all warnings)

| When | Message | Arrives |
|---|---|---|
| A condition that fails to evaluate | `if v > v_max: <message>`, such as `if v > 3 kg: Units do not match` | M4c |
| A condition that isn't true or false | `if v: not true or false` | M4c |
| An assignment in a condition | `if v = 3: a rule can't assign; write ==` | M4c |
| `result` on a line with no single value | `if result > 3: a rule needs a value` | M4c |
| `result` on a table line | `if result > 3: a table has no result; use its list names` | M4c |

**Solve**

| When | Message | Arrives |
|---|---|---|
| A solved value with `guess`, or with no clause | `solve needs a range: ", for Q = <from> .. <to>"` | M4c |
| A solve function with `for` | `a solve function takes a guess: ", guess f = <value>"` | M4c |
| No root in the range | `no root found for x in -10 .. 10`, `no root found for Q in 1 .. 30 L/s` | M4c |
| No root, and no point of the range had a value | `no root found for Q in 1 .. 30 L/s (the equation has no value in the range)` | M4c |
| No root after inner failures | `no root found for Q in 1 .. 30 L/s; last inner error: <message>` | M4c |
| More than 100 roots | `more than 100 roots for x in 0 .. 1000: narrow the range` | M4c |
| A range solve that mentions a list | `a range solve can't use the list a_s; use a solve function with a guess` | M4c |
| A missing end, or a step | `for Q needs two ends and no step: "for Q = <from> .. <to>"` | M4c |
| `from` not below `to` | `for Q = 30 L/s .. 1 L/s: from must be below to` | M4c |
| Ends of different kinds | `for Q = 1 L/s .. 30 m: the ends must be the same kind` | M4c |
| An end fails | `for Q: <message>` | M4c |
| Units of the two sides differ, with a range | `for Q = 1 m .. 30 m: Hp(Q) - Hs(Q) units do not match` | M4c |
| No guess (a solve function, from M4c) | `solve needs a guess: ", guess Q = <value>"` | M3 |
| No root | `no root near Q = 15 L/s (searched 0.9 .. 240 L/s)` | M3 |
| No root, on a call | `in f(1.86·10⁵, 4.399·10⁻⁴): no root near f = 0.02 (searched <range>)` | M3 |
| Outer solve fails after inner failures | `no root near Q = 15 L/s (searched <range>); last inner error: <message>` | M3 |
| Units of the two sides differ | `guess Q = 15 m: Hp(Q) - Hs(Q) units do not match` | M3 |
| Iteration cap | `no convergence for Q after 100 iterations` | M3 |
| The guess fails | `guess Q: <message>` | M3 |
| The guess isn't a number or a quantity | `guess Q: not a number or a quantity` | #70 |
| No equation, or more than one `=` | `solve needs one equation: "<left side> = <right side>"` | #70 |
| No root, and no point near the guess had a value | `no root near Q = 15 L/s (the equation has no value near the guess)` | #70 |
| A side isn't a number or a quantity | `a side of the equation is not a number or a quantity` | #70 |

**Ranges, tables, plots**

| When | Message | Arrives |
|---|---|---|
| Ends with units and no step | `a range with units needs a step, such as "step 1 L/s"` | M4 |
| Zero step, or one pointing away | `step 0 m never reaches the end` | M4 |
| Start, end and step of different kinds | `start, end and step must be the same kind` | M4 |
| Too many points | `Q_s has more than 10,000 points` | M4 |
| Lists of different lengths | `Q_s has 30 values, x has 11` | M4 |
| A body reaching an outside list | `pass Q_s as an argument` | M4 |
| Failed points on a line | `1 of 30 points failed. At Q_s = 0 L/s: solve found no root` | M4 |
| Aggregate over a failed point | `H_s has a failed point` | M4 |
| Mixed kinds on a plot | `H_s is a length, P is a power: one plot shows one kind` | M4 |
| Unknown clause | `Unknown plot setting xyz` | M4 |
| Log axis with zero or negative | `x log needs values above 0` | M4 |
| All of a series' points failed | `H_s: every point failed. At Q_s = 1 L/s: <message>` | M4 |
| A plot with no y | `a plot needs x and at least one y: plot(Q_s, Hs(Q_s))` | #77 |
| A plot's x that isn't a list | `x must be a list: 2 m is a single value` | #77 |
| A mark that isn't one value of x's kind | `mark 2 s: one value of x's kind` | #77 |
| An axis range of another kind | `y 0 s .. 4 s: the range must be the axis's kind` | #77 |
| `in <unit>` after a whole plot line | `a plot takes its units on its arguments: plot(Q_s in L/s, …)` | #77 |
| A table with no list among its arguments | `a table needs a list, such as table(Q_s)` | #76 |
| `in <unit>` after a whole table line | `a table takes its units on its arguments: table(Q_s in L/s)` | #76 |
| A range's start, end or step isn't a single number or quantity | `the range's step must be a number or a quantity`, `a range takes single values, not a list` | #74 |
| An index past the end | `x_r has 2 values` | M4c |
| An index that isn't a whole number from 1 | `x_r[0]: an index is a whole number from 1` | M4c |
| An index on something that isn't a name | `an index goes on a name: x_r[2]` | M4c |
| `a:b` with too many points | `1:1e7 has more than 10,000 points`, `0:1e-7:1 has more than 10,000 points` | M4e |
| A math.js builder with too many values | `zeros(1e8) has more than 10,000 values`, `ones(3000, 3000) has more than 10,000 values`, `nthRoots(2, 1e7) has more than 10,000 values` | M4e |
| An end of `a:b` that isn't a finite number | `a range's ends must be finite numbers: log(0) is -∞`, `a range's ends must be finite numbers: 1/0 is ∞` | M4e |
| A call that is slow without building anything large | `combinations(1e9, 5e8) is too large to compute` | M4e |
| One single value against a list in a plot | `x must be a list: 2 m is a single value` (two single values draw a point) | M4e |
| A `point` that isn't two single values of the axes' kinds | `point (Q_s, 2 m): a point is two single values, (x, y)` | M4e |
| A circle's radius that isn't one positive value of the axes' kind | `circle 2 s: the radius is one positive value of the axes' kind` | M4e |
| A circle's centre that isn't two single values | `circle (Q_s, 0 m) r: the centre is two single values, (x0, y0)` | M4e |
| `equal`, or a circle, with x and y of different kinds | `equal scales need x and y of the same kind` | M4e |
| `equal` with both ranges typed | `equal with both x and y ranges typed: leave one out` | M4e |

**App**

| When | Message | Arrives |
|---|---|---|
| Newer file | `This sheet was saved by a newer Excalimathpad. Update the app.` | M1 |
| File that doesn't parse | `This file isn't a sheet, so it wasn't opened.` | M1 |
| Recovery copy | `Restore unsaved changes to pump-sizing.excalimathpad?` or `… to an untitled sheet?` | M1 |
| Opening with unsaved changes | `Save changes to pump-sizing.excalimathpad?` Save, Don't save, Cancel | M1 |
| A save that fails | `Couldn't save pump-sizing.excalimathpad: <reason>` | M1 |
| The picker or the file read fails | `Couldn't open the file: <reason>` | M1 |
| Hint, one math element selected | `Double-click a line or press Enter to edit` (on touch: `Double-tap a line, or tap Edit in Math settings`, M4d) | M1 |
| Browser's Print, on the web | `Use Print… from the app's menu` | M5 |
| The pages couldn't be built (notice) | `The pages couldn't be built, so nothing was printed.` | M5 |

**Unexpected failures** (M4e)

| When | Message |
|---|---|
| An unexpected failure while a line is read | `this line hit an unexpected error in Excalimathpad` |
| An unexpected failure while an element is drawn | `this element hit an unexpected error in Excalimathpad` |
| An unexpected failure while a chart is drawn | `this chart hit an unexpected error in Excalimathpad` |
| An unexpected failure in a panel tab | `this tab hit an unexpected error in Excalimathpad` |
| The view fails as a whole | `This sheet hit an unexpected error in Excalimathpad.` then `Your sheet is kept up to the last finished line.` and, with a line open, `You were typing:` |
| The screen's actions | `Reload the sheet`, `Copy details`, `Copy`, `Report this error` |
| A copy button, once its text is on the clipboard | `Copied` |
| The last line of the copied details | `(no sheet content is included)` |

**Panel** (M4d)

| When | Message | Arrives |
|---|---|---|
| Format tab, nothing open | `Open a line or a title to format it: double-click it, or select its element and press Enter.` (on touch: `Double-tap a line, or tap Edit`) | M4d |
| Format tab, a blank line | `This line takes no format.` | M4d |
| A true rule overriding a pressed property | `A rule sets the text colour while v > 3 m/s.` | M4d |
| Symbols tab, no line open | `Open a line to insert` | M4d |
| Format tab's sample, a plot line | `Its chart is drawn on the sheet.` | M4e |
| Rules list, a rule with an empty condition | `a rule needs a condition` | M4e |

**In a vault** (M4d)

| When | Message | Arrives |
|---|---|---|
| An outside change met unwritten work (notice) | `pump-sizing changed elsewhere. Your version was saved beside it as pump-sizing (conflict 2026-11-14 1532).` | M4d |
| A write that fails (notice) | `Couldn't save pump-sizing.excalimathpad: <reason>. Your work is still open.` | M4d |
| New sheet's file can't be created (notice) | `Couldn't create Untitled.excalimathpad: <reason>.` | M4d |
| The vault image picker's field | `Pick an image from the vault to place on the sheet` | M4d |
| A picked image over 4 MB (Excalidraw's own toast) | `File is too big. Maximum allowed size is 4MB.` | M4d |
| A newer or unreadable file | The two file messages above, in the view; it never writes the file | M4d |
| No regex lookbehind (iOS below 16.4) | `Excalimathpad needs iOS 16.4 or later.` | M4d |
| Welcome hint, on touch | `Tap More tools, then Add math, then tap the sheet` | M4d |

Decided in: [solve](https://github.com/matheus-sancha/excalimathpad/issues/19),
[functions](https://github.com/matheus-sancha/excalimathpad/issues/27),
[ranges](https://github.com/matheus-sancha/excalimathpad/issues/20),
[plots](https://github.com/matheus-sancha/excalimathpad/issues/31),
[file](https://github.com/matheus-sancha/excalimathpad/issues/12),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38),
[all-roots solve](https://github.com/matheus-sancha/excalimathpad/issues/92),
[conditional formats](https://github.com/matheus-sancha/excalimathpad/issues/94),
[programming forms](https://github.com/matheus-sancha/excalimathpad/issues/132).
The M4d wordings not quoted in a ticket were written for this spec and are for Matheus to
confirm on its pull request.

## 14. Engineering constraints

What was tested, and fails silently or wrongly if skipped. Module design isn't here: that's the
Engineer's design gate. Tested on Excalidraw 0.18.1, math.js 15.2 and Chromium.

**Engine**

- **Setup order:**
  1. `Unit.setUnitSystem('si')`.
  2. `createUnit` for each app unit.
  3. Delete the entries those calls added to each `Unit.UNIT_SYSTEMS[system]`.
  4. Disable `createUnit` in the namespace.

  A plain `createUnit` makes the new unit a display unit in every system: `0.01 m^2 * 1.8 m/s` shows
  `285.306 gpm`. **Add a test:** results with the app units registered match results without them.
  ([app units](https://github.com/matheus-sancha/excalimathpad/issues/24))
- **math.js's unit system stays fixed at SI.** The unit system and balancing are an app formatter in
  `src/math/`, because `to` can't balance and `auto` is global state.
  ([Mathcad research](https://github.com/matheus-sancha/excalimathpad/issues/15),
  [ADR 0003](adr/0003-sheet-evaluates-in-reading-order-in-one-scope.md))
- **Number format:** `math.format(value, { precision: d, notation: 'auto', lowerExp: -3, upperExp: d })`
  gives the cell forms, and padding the mantissa keeps table zeros. `toPrecision` isn't a substitute.
  ([numbers](https://github.com/matheus-sancha/excalimathpad/issues/30))
- **Results typeset from `math.format`'s text.** `simplify()` gave a different prefix.
  ([typesetting](https://github.com/matheus-sancha/excalimathpad/issues/13))
- **The custom `toTex` handler** covers math.js's upright-parameter bug, and a name's output starts with
  a space (`\cdotv` breaks KaTeX). KaTeX is a direct dependency, loaded lazily.
  ([typesetting](https://github.com/matheus-sancha/excalimathpad/issues/13),
  [functions](https://github.com/matheus-sancha/excalimathpad/issues/27))
- **A comment-only line** parses to `ConstantNode(undefined)`, which the engine reports as **empty**, not
  a value. ([comments](https://github.com/matheus-sancha/excalimathpad/issues/36))
- **Iteration is the app's:** evaluate the expression once per index, with each list name bound to its
  *i*-th value. Nothing goes through math.js's matrix arithmetic.
  ([ranges](https://github.com/matheus-sancha/excalimathpad/issues/20))
- **The solver** compiles the residual with the captured `parse`. The unknown takes the guess's unit, and
  the solver sees SI numbers. ([libraries](https://github.com/matheus-sancha/excalimathpad/issues/18))
- **The range search (M4c)** is our own code on the Brent `src/math/solver.ts` has, with no library:
  sample, Brent on each sign change, the crossing check, the dip pass. Both additions are needed: without
  the check `tan x = 1` on 0 .. 10 returns its three poles as roots, and without the dip pass a double root
  is missed. `math.polynomialRoot`, `math.eigs` and `math.rationalize` were tried and aren't used.
  ([all-roots research](https://github.com/matheus-sancha/excalimathpad/issues/91),
  [`all-roots-solve.md`](research/all-roots-solve.md))
- **A rule's condition (M4c)** is evaluated after its line has run, in a layer over the scope at that
  point with `result` bound. Nothing it does reaches the scope the next line sees.
  ([conditional formats](https://github.com/matheus-sancha/excalimathpad/issues/94))
- **Writing a format (M4c)** must keep every rule as typed: today `writeFormat` drops the words it doesn't
  know. The clause reader has to accept the hyphen in `@text-red`.
- **An index (M4c)** is read by the app before math.js, whose own `x[2]` indexes its matrices. Lists never
  become matrices.
- **Text `==` and `!=` (M4d):** math.js 15.2 errors on `"Approved" == "Approved"`. Add `equal` and `unequal`
  signatures for two strings, and a text-against-number error, at setup, before `import` is disabled.
  The research probed a fresh instance only: confirm them in the hardened one, and pin them with a test.
  ([`mathcad-programming.md`](research/mathcad-programming.md))
- **`if()` (M4d)** is an app function with `rawArgs`, so only the branch taken is evaluated, as the index
  is. `toTex` gains cases for `ConditionalNode`, `if()`, and string and boolean constants, flattening a
  conditional in the last branch into the same brace. `display.ts` shows text unquoted.
- **One statement (M4d):** math.js runs `x1 = 5; y1 = x1 * 2` as a block and shows `[10]`. The reader finds
  a top-level `;` (outside brackets and strings) and makes it the line's error before math.js.
- **Joined words (M4d):** `readSegment` in `lineForm.ts` reads `+`-joined words, `FormatRule.word` becomes
  a list, and a writer for rules (`{ words, condition }` rows in order) sits next to `writeFormat`. A rule
  the panel didn't change keeps its exact `text`. As built (#145): `FormatRule.words`, `writeRules` over
  `RuleRow`s (a row keeping its `text`, or written by `ruleText` in the order text, highlight, bold,
  underline); each rule carries its `start` and `end` in the line. Each rule's live state is
  `SheetLine.ruleStates`. A comment line's clause reads joined words too. From M4e (#197) the list
  writes through `pressRules`, into the stored clause, and + Add rule's row is `newRule`.
- **A comment's format (M4d):** the comment split stays first. A line whose code is only a clause, with
  text after the `#`, is read as a formatted comment line; ADR 0005 is amended.

**Scene writes**

- **Source:** `updateScene({ elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY })` with
  `newElementWith(el, { customData: { ...el.customData, source } })`. A plain `{ ...el, customData }` is
  silently not recorded. Never `EVENTUALLY` or the default: afterwards later updates to that anchor drop
  off the undo stack. ([undo research](https://github.com/matheus-sancha/excalimathpad/issues/10))
- **A change Excalidraw didn't capture comes first:** its arrow-key nudge and Link editor leave
  the anchor's `version` ahead of its last captured copy. `updateScene` then swaps the anchor for
  that copy before capturing, so a source write lands but adds no step, and undo can't reach it.
  `writeAnchorSource` first parks `version` at 0 in an uncaptured update, then captures with
  `version` one above where it was. So each write adds 2 to `version`, and it adds no step when
  nothing was pending. This relies on how `updateScene` compares versions, which isn't public, so
  a contract test pins it. Matheus accepted this for now on 2026-11-04.
  ([#41](https://github.com/matheus-sancha/excalimathpad/issues/41))
- **That comparison has to go at the next Excalidraw upgrade:** upstream's `App.tsx` no longer calls
  `filterUncomittedElements` (checked on `master` at `7ded689ca`, 2026-11-04). In the review of
  [PR 47](https://github.com/matheus-sancha/excalimathpad/pull/47), on the `next` build
  `0.18.0-3c916c5`, this workaround left an extra undo entry on plain line commits, and the contract
  tests failed. Removing it then likely means a nudge and the next line share one undo step, unless
  upstream's new store offers something better.
- **Size:** `newElementWith` + `CaptureUpdateAction.NEVER`, only for anchors whose size changed by more
  than half a pixel. Snap-back must also restore `x` and `y`: the top-right handle moved `y` by 45 px.
  ([auto-size](https://github.com/matheus-sancha/excalimathpad/issues/29))
  - As built (#44): `src/canvas/anchorSize.ts` writes the sizes and snaps handles back from `onPointerUp`'s
    `originalElements` (not after the rotate handle). A `NEVER` write also updates Excalidraw's captured copy of
    the anchor, so `writeAnchorSource` finds nothing pending and a line commit after size writes stays one step.
    The overlay measures in `useAnchorSizes` and writes through the session's `keepClean`; a write waits while
    `sizeWritesWait` (in `anchorSize.ts`) reads Excalidraw as mid-gesture or in one of its editors.
  - From M4c (#100): where the snap-back runs today, a handle's dragged width is kept as `customData.width`
    and only its height is put back. The stored width and Excalidraw's resize must land in one undo step,
    and the contract test "Resize handles can be let go of and put back" changes with it.
  - From M4c (#95): a title's format is `customData.titleFormat`, written under the same rules as a title.
- **Add math:** select the new element in the same `updateScene`, or undo takes two steps when something
  was selected before. ([gestures](https://github.com/matheus-sancha/excalimathpad/issues/28))
- **The line field only takes what the user typed.** Setting its value while typing clears its browser
  undo. ([undo steps](https://github.com/matheus-sancha/excalimathpad/issues/11))

**Gestures**

- **Overlay stays `pointer-events: none`,** except the open line editor, the unit field and the plot
  popover (until M4d, also the format bar, whose `.math-format-bar` CSS and exception go). The unit slot and
  ⚙ let pointer-down through and open on `click`.
- **Panel controls that act on the open line (M4d)** never take focus: `mousedown` prevented,
  `tabIndex={-1}`, as the bar's buttons were; a blur would leave the line. This covers the Format tab, the
  Rules list, the Symbols and Constants buttons, Done, ↑ ↓, Edit and the quick keys. Option B of
  [`panel-acts-on-open-line.md`](research/panel-acts-on-open-line.md):
  - `listenToCanvas` skips presses from inside `.sheet-sidebar`. Today it hears them in capture on
    `root`, which holds the panel, and leaves the line before the button sees its press.
  - One panel-wide `mousedown` prevention sits on the view's document, in the **bubble** phase. In
    capture, or on the sidebar itself, Radix's tab triggers stopped switching.
    As built (#143): above React's root, in the bubble phase: the page's document on the web, the view's
    container in a vault, since the plugin adds no listener to the global document (section 12a).
  - `MathOverlay` reports the open target: `onEdit(target)`, with `target` null or
    `{ anchorId, lineIndex | 'title', text }`, on each keystroke. `LineEditControl` gains
    `setFormat(format)`, `setTitleFormat(format)`, `moveTo('title' | 'first')` and `insert(text)`; the
    insert reaches the live `LineField` through a ref and uses `execCommand('insertText')`, so the
    field's text undo keeps it.
    As built (#143): the overlay finds its one open field (`.math-element__field`) rather than holding a
    ref; where `execCommand` isn't there (jsdom), `setRangeText` and an `input` event.
  - A focused `<select>` isn't a text input to Excalidraw's shortcuts, so Delete there deleted the
    selected element and R switched to Rectangle. Every panel control stops its keys reaching
    Excalidraw. The `type="text"` rule for fields inside Excalidraw's container gains a `<select>` clause.
    As built (#143): a box with no box of its own (`display: contents`) around the panel's tabs stops each
    key's React propagation, so Excalidraw's `onKeyDown` never hears it and the panel's own handlers still
    run; `listenToCanvas` doesn't hand the gestures a key aimed at the panel either.
  - As built (#144): the caret after a press is `caretAfterFormat`. Which rules are true for a
    line's own row is `SheetLine.ruleTruth`; the Format tab's override note names the first true
    rule per property. The touch hint is passed in (`touch`) and left off until #147 tells touch
    apart.
  - As built (#7 and #58 follow-up): an overlay hover is found from geometry on the canvas's `pointermove`
    (`slotAt`, `tipAt`), never from the overlay's own events; a `title` attribute there never shows. The
    root's `pointerleave` (not in capture) hides a problem's tip.
- **Capture `dblclick` on the stage, capture `keydown` on `document`,** for double-click, Enter and M. Stop
  them there. Act on Enter only when one math anchor is selected, the tool is the selection tool, no
  modifier is held, and the target isn't an input, textarea, contenteditable or button.
  - As built (#43): `src/canvas/canvasEvents.ts` registers them. The pointer listeners (`dblclick`,
    `pointerdown`, `click`) sit on the box Excalidraw fills, `SheetCanvasHandle.root`, a sibling of the
    overlay, so the field's own clicks never reach them.
    Keys act only when their target is inside that box or is the page's body: the app's own dialogs keep
    theirs. Nothing acts while Excalidraw is busy (its text or line editor, a shape being drawn, a menu,
    dialog, popup or context menu open).
  - **Touch (M4d, #147):** two taps don't become a `dblclick` first. Excalidraw 0.18.1 runs its own double
    tap from a native `touchstart` on its interactive canvas: a second one-finger touch within 300 ms of the
    first calls its double-click handler directly. So the same box also captures `touchstart`, follows
    that count, and offers the second touch to the double-click rule; one it takes is stopped and
    cancelled, so neither Excalidraw nor the browser's mouse events and `dblclick` see it. On iOS
    Excalidraw cancels every `touchstart` on its canvas, so a tap sends no `click`: a touch's click is its
    `pointerup`, handed over a task later, and the browser's own click after a touch is skipped.
  - A press leaves the open line before Excalidraw sees it, so a drag starts on the committed scene. A
    click is a press whose `click` follows with the anchor's `x` and `y` unchanged, on an anchor that owns
    the point by the double-click's rule.
  - A locked anchor is never selected: Excalidraw's hit-testing skips it and selects what lies under it. So
    a locked anchor owns the point unless something above it is selected.
  - The line field ignores a `mousedown` with `detail` 2 or more before any press of its own: it continues
    a double-click begun on another line, and would select a word.
  - Viewport to scene is `stageToScene` after taking off `offsetLeft` and `offsetTop`: the same formula,
    pinned against `viewportCoordsToSceneCoords` (`viewport.test.ts`), with no Excalidraw import in the
    overlay.
- **Which line was hit comes from geometry:** viewport to scene with `viewportCoordsToSceneCoords`, undo the
  rotation, find the row by `offsetTop` and `offsetHeight`.
- **Leaving an edit gives the keyboard back** by focusing `.excalidraw`.
- **Add math is a custom tool:** `setActiveTool({ type: 'custom', customType })`, with the placing click
  from `onPointerUp`. Re-apply the crosshair two animation frames after each `pointermove`.
  - As built (#45): `src/canvas/addMath.ts` holds the tool, the placing click (`watchPlacing`) and the
    crosshair. The anchor goes at `pointerDownState.origin`, selected in the same `updateScene`, after the
    tool returns to selection. The button is in `renderTopRightUI` and gives the keyboard back to
    `.excalidraw`, or Esc and M would stay on the button. The ghost is the overlay's, from a capture
    `pointermove` on the box Excalidraw fills.
  - A title is `customData.title`, written by `writeAnchorTitle` under the same rules as a source write
    (#64). The header's box comes from the DOM (`[data-title]`, `offsetTop` and `offsetHeight`), and
    `onHeader` (`lineHit.ts`) says when a point is on it. An edit on the title is a line edit at
    `TITLE_LINE` (-1), so the one-edit rule and the field are shared.
  - An element left with no text is removed by `removeAnchor` (`src/canvas/mathAnchor.ts`): `isDeleted`
    and the deselect in one `IMMEDIATELY` write, after the same pending-change record a source write makes.
- **Anything in `src/canvas/` only:** runtime imports of Excalidraw, `exportToSvg`, and the `.excalidraw`
  focus query.
- **In the plugin (M4d)** the keys and pointer listeners registered on `document` and `window` today
  (`canvasEvents.ts`, `FileChrome`, `useFileRoutes`) are bound to the view's own container and document
  instead, and `useFileRoutes` isn't installed. The core-key pass-through list is a tested constant
  (`src/canvas/vaultKeys.ts`), heard on the view's container in the capture phase: a core key Obsidian's
  keymap marked `defaultPrevented` stops there, the swallowed ones always do. Built in #137.
- **The pop-out bridge (M4d, #137).** In an Obsidian pop-out window the plugin's code runs in the main
  window, so the unforked Excalidraw's `window` and `document` listeners (its drags, its outside clicks,
  copy, cut and paste, `keyup`) and its dialogs (`document.body`) are the main window's: without help a drag
  there never ends, a placing click places nothing, `?` opens Help in the main window and paste does nothing.
  `src/canvas/popoutBridge.ts` copies the pop-out's pointer, touch, `keyup` and clipboard events onto the
  main document, only a sheet's (a press anywhere, for outside clicks); never `keydown`, which would reach
  Obsidian's main-window keymap. A move and a release go from the main body, since Excalidraw's drag reads on
  only for an `HTMLElement` of the code's own window; a press keeps its target. While a clipboard event runs,
  the main document's `activeElement` and `elementFromPoint` and `navigator.clipboard` are the pop-out's. A
  dialog box Excalidraw adds to the main body moves into the pop-out whose sheet had the last press or key,
  and the body's `removeChild` finds it there. Each sheet view notes that on its own container, so no listener
  goes on a global. It follows a tab Obsidian moves (`onWindowMigrated`).

Evidence: [`excalidraw-gestures.md`](research/excalidraw-gestures.md).

**Contract tests to add,** as `layers.test.ts` does. Built names the issue that added it:

| Behaviour | Test | Built |
|---|---|---|
| `#ffffff01` counts as not transparent for hit-testing | Pointer down inside an unselected anchor selects it | #43, `mathAnchor.excalidraw.test.tsx` |
| `onDoubleClick` runs in React's bubble phase | A double-click stopped at the stage adds no text element | #43, `canvasEvents.excalidraw.test.tsx` |
| Key handling runs in the bubble phase, at or below the root | Enter stopped on `document` opens no editor | #43, `canvasEvents.excalidraw.test.tsx` |
| No built-in shortcut for M | M leaves the tool unchanged when not intercepted | #45, `addMath.excalidraw.test.tsx` |
| `.excalidraw` takes focus | Enter works after leaving an edit | #43, `gestures.excalidraw.test.tsx` |
| A `NEVER` write updates the captured copy | A line commit after size writes is one step (control: an uncaptured size change is a second step) | #44, `anchorSize.excalidraw.test.tsx` |
| Resize handles set the chosen width | From M4c (#110): a width drag stores `customData.width`, keeps the top and height, and is one undo step with Excalidraw's resize; below the floor it goes back to automatic; a height-only drag snaps back (control: without it, the anchor resizes) | #44, #110, `anchorSize.excalidraw.test.tsx` |
| `sizeWritesWait`'s app-state flags | Set while a shape is drawn, an element dragged, a handle held or the text editor open; clear afterwards | #44, `anchorSize.excalidraw.test.tsx` |
| The dark theme is `--theme-filter` | The overlay's filter is one of the package's `--theme-filter` values | #44, `layers.test.ts` |
| Order of the panel's children in `.panelColumn` | The reduced panel hides what comes before Opacity | #46, `mathSelection.excalidraw.test.tsx` |
| `.HintViewer` holds the hint | The hint's replacement shows | #46, `mathSelection.excalidraw.test.tsx` |
| A `NEVER` restore from `onChange` lands before the change is recorded | Paste styles on math adds no undo step (control: without the restore, it adds one) | #46, `anchorStyle.excalidraw.test.tsx` |
| Radix's tab trigger switches on its own `mousedown` | With the panel-wide prevention on `document` in bubble, a tab press switches tabs and the line stays open | M4d |
| `data-prevent-outside-click` keeps a floating sidebar open | A press in the line field leaves the floating panel open (control: without it, it closes) | M4d |
| A focused `<select>` gets Excalidraw's shortcuts | Delete on a focused Settings `<select>` leaves the selected element (control: unpatched, it deletes it) | M4d |
| Two taps reach the app first | Two touches within 300 ms that the app takes never reach Excalidraw: no editor, no label (control: left, Excalidraw opens its editor); a tap's click is its release; and, by touch in Chromium at a phone and a tablet, as Android and as iOS, a double tap on a selected element's line opens it while a drawing on top keeps Excalidraw's | #147, `canvasEvents.excalidraw.test.tsx` and `scripts/touch-run.mjs` (`npm run test:touch`, in CI) |
| Hidden items in the plugin | Web Embed, Mermaid, Browse libraries and Copy as SVG aren't in their menus, and Ctrl+/ and Ctrl+Shift+P open no palette | #137, `vaultItems.excalidraw.test.tsx` (the selectors pick exactly those items, and `SheetCanvas.css` hides them; jsdom applies no CSS) |
| Excalidraw answers Ctrl+P and Ctrl+Shift+E | Confined, Ctrl+P that Obsidian took shows no toast and Ctrl+Shift+E opens no export (controls: unconfined, both do) | #137, `vaultItems.excalidraw.test.tsx` |
| Excalidraw listens on the code's window in a pop-out | In a pop-out tab, and one moved there, a drag moves, M and a click place, `?` opens Help there and Esc removes it, a paste adds text and a copy writes the element (control: the main window's tab) | #137, `scripts/popout-run.mjs` (`npm run test:popout`, in CI) |

**File:** serialize with `serializeAsJSON(…, "local")`, then add the block. Excalidraw's own Ctrl+S and Ctrl+O
must be taken over, because its save drops the block. `UIOptions.canvasActions` turns off `loadScene`,
`saveToActiveFile`, `saveAsImage` and `export`. That isn't enough in 0.18 (#42): Ctrl+Shift+S
(`saveFileToDisk`) isn't in `canvasActions` and always runs, Ctrl+Shift+E opens the image export dialog
outside the action manager, and a dropped scene file replaces the scene as an undo step. So the app takes
Ctrl+S, Ctrl+Shift+S, Ctrl+O and Ctrl+Shift+E, and drops of scene files, on the window in the capture phase
(`src/canvas/fileRoutes.ts`, contract-tested). The file name is placed from Excalidraw's rendered ☰ button and
toolbar, not from numbers copied out of its CSS.
Excalidraw reports a change only after React commits, so a flow that has just written a line reads the
scene itself rather than wait for `onChange`.
([file](https://github.com/matheus-sancha/excalimathpad/issues/12),
[chrome](https://github.com/matheus-sancha/excalimathpad/issues/17))

**Print.** Each part is needed. Without them, rows or math vanish from the PDF with no error.

- **The print view** is built from the same views as the overlay, in scene coordinates.
  Drawings come from `exportToSvg`, without the anchors.
- **Scale with `transform`,** not `zoom`, whose measured heights drift.
- `@page { size: …; margin: 0 }`, with the 15 mm margin and footer drawn inside each page.
- `contain: strict` on each page, or a scaled sheet prints 3 of 30 rows.
- `overflow: hidden` on the frame.
- `visibility: hidden` on boxes outside a page's slice, or text comes up twice in search.
- `height: 100vh` per page, not `297mm`.
- `print-color-adjust: exact` on the grey footer.
- **Await** the SVG export and Plot, build the pages, await `document.fonts.ready`, and only then call
  `window.print()`. **Printing before fonts load gives no math at all.**

Evidence: [Chromium PDF](https://github.com/matheus-sancha/excalimathpad/issues/34) and `docs/research/print-pdf.md`
(lands with [its PR](https://github.com/matheus-sancha/excalimathpad/pull/35)).

**PWA**

- Copy `node_modules/@excalidraw/excalidraw/dist/prod/fonts` to `dist/fonts/` (`rename: { stripBase: 5 }`).
- Set `window.EXCALIDRAW_ASSET_PATH = new URL(".", location.href).href` in `index.html`. Not `"./"`, which breaks
  sub-path hosting.
- `maximumFileSizeToCacheInBytes: 4 MiB`.
- `registerType: 'prompt'`. `autoUpdate` could lose an unsaved sheet.

Evidence: [`offline-pwa.md`](research/offline-pwa.md).

**Plugin** (M4d)

- Mount `<App>` in the view's `contentEl`. The view's `getViewData()` is the existing serialiser, and
  `setViewData(data, clear)` today's open. A write follows `saveKey`, not every `onChange`.
- `fileManager.getNewFileParent` gives the folder for a new sheet; `onRename` keeps the tab.
- Excalidraw's run-time font URLs are strings in its code, not imports: the build rewrites them, and the
  audit fails on any `./fonts/` left.
- `minAppVersion` 1.7.2 covers `DeferredView` (1.7.2) and `View.scope` (1.5.7).

Evidence: [`obsidian-plugin.md`](research/obsidian-plugin.md).

**Other research notes:** [`excalidraw-undo-customdata.md`](research/excalidraw-undo-customdata.md),
[`panel-acts-on-open-line.md`](research/panel-acts-on-open-line.md),
[`mathcad-programming.md`](research/mathcad-programming.md),
[`mathcad-units.md`](research/mathcad-units.md),
[`mathjs-katex-typesetting.md`](research/mathjs-katex-typesetting.md),
[`solver-and-plot-libraries.md`](research/solver-and-plot-libraries.md).

**M4e**

- **Injected failures,** in `npm run check`: a test makes a line (its parse included), an
  element, a chart, a panel tab and the view throw on purpose, and checks what shows, that the
  rest keeps working, that the failed view writes nothing, and that the copied details hold no
  sheet text (`src/failure/injected.excalidraw.test.tsx` on the web,
  `plugin/test/failure.test.ts` in a vault).
- **The typing test,** in `npm run check`: every Math guide example, the true-position sheet
  and the pump sheet, one character at a time, through the engine and the view (4,765 states
  and 59 s on one core when measured). It fails on any throw and on any state that reaches the
  per-line guard. It reads its lines from the guide and the acceptance sheets
  (`src/typing.test.tsx`: every `docs/acceptance/*.md`, so the true-position sheet is typed
  once its file is there).
- **The view's boundary tells the sheet file while React still renders,** before anything is
  unmounted: Excalidraw empties its scene as it unmounts, so a copy taken later would be an
  empty sheet. From that call on the sheet file writes nothing (`fail`, on the web's session
  and the vault's sheet). React can render one failure more than once before it commits; the
  boundary tells it once.
- **A boundary is a class component,** the only one: React has no hook that catches a
  failure. A failure in an effect (a chart's drawing) reaches the same boundary as a
  render's.
- **The sweep test,** in `npm run check`: every function math.js exposes is called with huge
  arguments (`1e8`, `(3000, 3000)`, an infinite end such as `1/0`) and with arguments at the
  limit, and the test fails if any call neither answers nor refuses within 1 s. A math.js
  update that adds a builder fails it. One unit test per message row and per shown form of a
  matrix (`src/math/limits.test.ts`).
  - **How it runs** (`src/math/sweep.test.ts`): about 250 functions, each with 27 argument
    lists, through `evaluateSheet`, under `v = 1:10000`, `m = identity(100)` and `w = 1:100`
    (6,669 calls, about 25 s). The calls run in a child process, since a call that freezes
    can't be stopped from inside its own thread: the child says which call it starts, and one
    still running after 1 s is stopped with its process and fails the test, as one that runs
    the process out of memory does. A call that only reported more than 1 s is run once more
    alone. Node runs the child's TypeScript as it is, so `src/math/` keeps to syntax Node can
    strip (no `enum`, no parameter properties).
  - **Before the limit,** 42 functions failed it: the builders and the functions of the
    list above, and the slow calls bounded below.
  - **The guard wraps what a line can call** (`mathWithTransform`, in `src/math/limits.ts`),
    not math.js's own namespace: `inv`, `det` and the rest keep calling the builders they
    were made with. `a:b` compiles to the visible `range`, so the same check covers it.
  - **The bounds on slow calls,** each refused past it with "is too large to compute". An
    argument that isn't finite is past every bound.

    | Function | Bound |
    |---|---|
    | `bellNumbers`, `stirlingS2` | each argument at most 1,000 |
    | `bernoulli` | 10,000 |
    | `catalan`, `combinations`, `combinationsWithRep`, `composition`, `permutations` | each argument at most 1,000,000 |
    | `isPrime` | a finite number (`isPrime(1/0)` never ended) |
    | `cosh`, `sinh`, `tanh`, `coth`, `csch`, `sech` | a BigNumber at most 10,000 (a plain number answers `∞` at once) |
    | `fft`, `ifft` | 4,096 values |
    | `qr`, `schur`, `mad` | 2,500 values |
    | `median`, `quantileSeq` | 5,000 values (math.js takes quadratic time where many values are equal: `median` of 10,000 zeros took 0.3 s, and over 1 s in CI) |
    | `lyap` | 900 values |
    | `setUnion`, `setIntersect`, `setDifference`, `setSymDifference`, `setIsSubset` | the two sets' sizes multiplied, at most 1,000,000 |
    | `freqz`, `zpk2tf` | the two arguments' sizes multiplied, at most 10,000; `freqz`'s number of points at most 10,000 |
    | `format`, `print`, `bin`, `oct`, `hex` | a precision or a word size at most 1,000, as a number or in options |
    | `quantileSeq` | at most 100 quantiles |

  - **Not bounded:** a legal matrix that is slow for what it holds, not for its size
    (`eigs` and `sqrtm` of a 60 × 60 matrix of random numbers took over 3 s). The sweep's
    matrix is the identity; this is the accepted slow line of section 10.
- **The odd-values probe** (about 8 minutes) is run by hand before a release
  ([section 12a](#releases)): `npm run test:probe` (`src/oddValues.probe.tsx`, about 40,000
  sheets), a line of the release checklist. It fails as the typing test does.
- **The format migration** is tested on every open path, the recovery copy included, and on a
  hand-edited file with a clause both in the text and stored: the step itself, every format
  word, comment lines, rules, titles and the pump sheet in `src/file/sheetFormat.test.ts`;
  Open…, a dropped file and the recovery copy in `src/file/sheetSession.test.ts` and, on the
  real Excalidraw, `src/file/FileChrome.excalidraw.test.tsx`; a vault file and an outside
  change in `plugin/test/vault.test.ts`. The four Playwright runs that open a sheet
  (`scripts/popout-run.mjs`, `touch-run.mjs`, `follow-run.mjs`, `panel-run.mjs`) open a format 1 file, so they
  run the migration in the built plugin.
- **`source` and `formats` in one write:** a nested object in `customData` adds an empty undo
  step, so `formats` is a string, as `titleFormat` is (`writeAnchorSource`,
  `mathAnchor.excalidraw.test.tsx`). **Whatever changes the number of an element's lines
  writes both** (today only Enter and Backspace-join, in `src/overlay/lineEdit.ts`); a write
  that keeps every line in its place (a unit slot, a plot's settings) may leave `formats` out.
- **The engine reads one line:** a line's text and its stored clause are joined into the line
  as it would have been typed (`withFormat`, `src/math/lineForm.ts`) before anything reads
  it, so every form, error and rule is read by the code that read format 1.
- **The docking width** passed to Excalidraw (`UIOptions.dockedSidebarBreakpoint`) and the
  app's own must be one value, or the panel docks where the app thinks it floats. As built
  (#198): `docksAbove(width)` in `src/canvas/panelWidth.ts` is that value. `SheetCanvas`
  holds the width, passes the value to Excalidraw and answers the app from it
  (`SheetCanvasHandle.panelDocks()`); App asks only that, for the launch, an edit's open, a
  jump and the remembered open state, and holds no width of its own.
  - The width reaches Excalidraw as CSS: `SheetCanvas` sets `--sheet-panel-width` on its own
    box, and `SheetCanvas.css` gives it to Excalidraw's `--right-sidebar-width`.
  - Excalidraw reads a changed docking width after its render and draws nothing again, so the
    panel would dock or float one render late: the app calls its public `refresh()` after
    each change of width.
  - The drag handle (`PanelResizeHandle.tsx`) is drawn inside the sidebar, so its presses are
    the panel's and never leave the line; it holds the pointer (`setPointerCapture`) and
    listens on nothing but itself. It is the one panel control in the tab order: focus
    reaches it by Tab, never by a press.
  - jsdom lays nothing out, so the **panel run** (`scripts/panel-run.mjs`,
    `npm run test:panel`, in CI) holds this in Chromium, in the built plugin and the built
    web app: the four widths, the drag and its keys, the docking width following the drag to
    Excalidraw and to the app at the same px, the remembered width after a restart and a
    reload, and every tab at 280 px.
- **The overlay never scrolls** (`overflow: clip`, 0.2.1): the canvas's pan is the only thing
  that moves the math. `overflow: hidden` isn't enough: the browser still scrolls a hidden box to
  show a focused field's caret. The follow run (`scripts/follow-run.mjs`, `npm run test:follow`)
  fails if any box around the math has been scrolled.
- **The line's field is a textarea over a hidden copy of its text** (M4e,
  `src/overlay/MathElementView.tsx`, `MathOverlay.css`): the copy is laid out in the field's
  cell and gives it its size, and the field lies over it, so the two must break at the same
  places. The cell's `max-width` is the field's room (`src/overlay/wrapRoom.ts`), measured by
  laying the element out for a moment with the field asking for nothing. The caret's row is
  read from a second copy split at the caret (`caretPlace`, `src/overlay/caretRow.ts`), since
  a field has no box for its caret. The field stays uncontrolled: its value is set from code
  only when a newline got in by a drop. jsdom lays nothing out, so the follow run holds this
  in Chromium at 1280 px and 880 px: the rows, the wrap width, ↑ and ↓, the suggestion list,
  a pasted newline and the field's own Ctrl+Z.
- **A rule's condition field keeps the line open** (M4e, #197,
  `src/panel/ConditionField.tsx`, `RulesList.tsx`). Three things hold it:
  - The line's field and each condition field carry one mark (`data-line-field`, `LINE_FIELD`
    in `src/canvas/panelPresses.ts`). A blur whose `relatedTarget` carries it doesn't leave the
    line; any other blur does, from either field. A line's field mounted again while a
    condition has the keyboard doesn't take it.
  - The condition being typed is the open line's stored format in the line edit
    (`LineEdit.stored`, `src/overlay/lineEdit.ts`), beside the typed text: the sheet is
    evaluated from it (`withTypedFormat`), and every write of the line, a save, a press, a
    move or a leave, takes it. Nothing about it lives in the panel but the field's text as
    typed, since a rule's own condition is trimmed.
  - Chromium keeps one text undo for all the fields of a page, and a value set from code
    doesn't take a field's entries out of it: Ctrl+Z in the line took back the condition's
    typing first, and moved the keyboard there. Only removing the field does. So a condition
    field is a new element each time it loses the keyboard, and its own Ctrl+Z is stopped
    when its text is what it was when it took the keyboard.
  - jsdom has no layout, no text undo and no real focus order, so the follow run holds this in
    Chromium with real keys and mouse (`scripts/follow-run.mjs`), and the touch run on a phone
    and a tablet. A save of the file commits what is typed, so those runs read the file only
    after a write.
- **Plot:** `aspectRatio` is ignored at fixed sizes, so equal scales are made by setting both
  axis ranges; all four margins are set by the app. Observable Plot is imported by name once
  the new clauses are built.
- **Lighter plugin:** math.js's help texts are stubbed out (in `esbuild.plugin.mjs`, and by an
  alias in `vite.config.ts` for the web app); four unused KaTeX font families are dropped,
  with a test that typesets every guide line and fails on a font class that was dropped. The
  web app isn't trimmed otherwise.
- **Documents:** `npm run check` fails if `CONTEXT.md` is over its budget, its size after the
  split plus about 10%. A tracked `CLAUDE.md` holds the reading route (always `CONTEXT.md`;
  the spec sections an issue names; `docs/context/<module>.md` for a module the issue
  touches; ADRs by number when named) and the writing rule (behaviour goes in the spec;
  `CONTEXT.md` holds the model, the terms and where things are; a "Changes since agreed"
  entry is added only for a change to an agreed rule). Sections 16 to 18 move to
  `docs/spec-history.md`, leaving numbered stubs so citations hold; the finish line stays
  here.
- **Print in the plugin:** the frame's styles must arrive in a way the bundle audit accepts
  (no `<style>` made at run time outside the libraries' own code); the audit's rule is amended
  only if there is no other way.

## 15. Acceptance

v1 is judged on the [pump sheet](acceptance/pump-sizing.md), with
[`pump-sizing.py`](acceptance/pump-sizing.py) as its independent reference.

The four steps:

1. Type the sheet and check the values.
2. Edit `D` to `128.2 mm`, and everything recalculates to the 5" column.
3. Save, close, reopen: same layout, sources and results.
4. Print to PDF: math typeset, table and plot on the pages, nothing cut mid-line.

**Pass bar:** every result matches the reference to 4 significant figures.

**From M4e a second sheet, true position,** is kept in `docs/acceptance/true-position.md` and
is a worked example in the Math guide. It is the sheet Matheus built on his work laptop on
2026-11-15, as it reads once M4e is built:

```text
# True position, RFS (ASME Y14.5)
dx = 0.08 mm
dy = -0.05 mm
T_p = 0.25 mm
TP = 2 sqrt(dx^2 + dy^2) in mm
check = if(TP <= T_p, "Pass", "Fail")
used = TP / T_p * 100
margin = T_p - TP in mm
plot(dx, dy), circle T_p / 2, title "True position"
```

with `@text-green if result == "Pass" @text-red if result == "Fail"` as the `check` line's
stored format. CI feeds its lines through `evaluateSheet` and compares: `TP` 0.1887 mm,
`check` "Pass", `used` 75.47, `margin` 0.06132 mm, and a chart with one point and one circle.
With `dx = 0.12 mm`, `check` is "Fail". The typing test reads this file too
([section 14](#14-engineering-constraints)).

Decided in: [acceptance](https://github.com/matheus-sancha/excalimathpad/issues/9),
[comments](https://github.com/matheus-sancha/excalimathpad/issues/36),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38).

## 16. Milestones and finish line

v1 is built in nine milestones, each usable on a real sheet, with a saved typeset sheet first. The existing
spike is M0, done. M4e and M5 are the last two; they are released together as **1.0.0**, which is v1 done.
M6 is built after 1.0.0.

| Milestone | What it lets Matheus do | Sections |
|---|---|---|
| **M1 Keepable sheet** | Type a typeset sheet, edit it line by line, undo, save it and reopen it | [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [6](#6-undo), [7](#7-file-and-save), [8](#8-app-chrome) |
| **M2 Units & panel** | Read results in the right units and digits, see problems and warnings, change sheet settings | [5](#5-results-units-and-numbers), [8](#8-app-chrome) |
| **M3 Solve** | Solve an equation on a line, including as a function and a solve calling a solve | [9](#9-solve) |
| **M4 Ranges & plots** | Run lines over a range, draw tables and plots | [10](#10-ranges-tables-plots) |
| **M4b Hosted build** | Open the app at a public address on a second machine | [12](#hosted-build) |
| **M4c Improvements** | Find every root in a range, colour text and results, format by rule, set an element's width, format a title | [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [9](#9-solve), [10](#10-ranges-tables-plots) |
| **M4d Plugin & panel** | Open and edit sheets in Obsidian on the work laptop, phone and tablet; format from the panel, with rules; insert symbols; write checks that say "Approved"; format comment lines; read the Math guide | [1](#1-what-v1-is-and-what-it-isnt), [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [5](#5-results-units-and-numbers), [7](#a-sheet-in-a-vault), [8](#8-app-chrome), [12a](#12a-obsidian-plugin), [13](#13-messages) |
| **M4e Room to work** | Keep working when the app fails; keep a line's format out of its text; see long lines wrap; give the sheet more of a small screen; draw a point in a tolerance circle as one clean chart; carry a lighter plugin | [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [7](#the-file), [8](#sheet-panel), [10](#10-ranges-tables-plots), [12a](#releases), [13](#13-messages), [14](#14-engineering-constraints), [15](#15-acceptance) |
| **M5 Print** | Print the sheet to clean PDF pages, from the web app and from Obsidian on a computer | [11](#11-print) |
| **M6 Offline PWA** (after 1.0.0) | Install the app, work offline, open a `.excalimathpad` file from Windows | [12](#12-offline-pwa) |

The issue orders of the built milestones, M1 to M4d, each with its reasons, and what happened along the way
are in [`docs/spec-history.md`](spec-history.md#16-milestones-and-finish-line). The orders still being built stay here.

**M4e's issue order** (added on 2026-11-15 from Matheus's third batch, six items found building a
true-position sheet on his work laptop, on the map
[Spec for the third improvements batch and M5 Print, to 1.0.0](https://github.com/matheus-sancha/excalimathpad/issues/172); M4d's fifteen build
issues are built, #135 to #149; built before M5). Two fixes come first, outside the milestone, released
together as `0.2.1`: #179, and #191, which the fifth issue needs.

1. Documents: a reading route, `CONTEXT.md` by module, the spec's history (#192)
2. Unexpected failures stay small (#193)
3. The 10,000 limit on `a:b` and math.js's builders (#194)
4. A line's format is stored beside it: format 2 and its migration (#195)
5. The line's field wraps (#196)
6. Rules list: a rule's condition is edited in the Format tab (#197)
7. Sheet panel: 320 px, icon tabs, a drag handle, docking by width (#198)
8. The Format tab's sample: 13 px, wrapped, never a chart (#199)
9. Plot: a point, a circle, equal scales, and nothing past the chart (#200)
10. A lighter plugin: math.js's help texts and four KaTeX font families (#201)
11. The Math guide, the README and the true-position sheet (#202)

The documents come first, so every later build session reads the small set. The two failure issues
follow: they are what stops a sheet being lost or frozen, they are independent of the rest, and their
tests (injected failures, typing, the sweep) then guard every later pull request. The stored format is
next and early on purpose: it is the milestone's one change to the file and its first migration, so it
gets the most use before 1.0.0. The wrapping field and the condition field build on it. The panel's width
comes before the sample, which is laid out in it, and the sample after the condition field, which shares
the Format tab. The plot is independent and comes after the panel work; it also imports Observable Plot by
name, since its named imports are final only then. The other two plugin cuts follow. The guide describes
the finished milestone, so it is last, with the second acceptance sheet, and the beta `0.3.0` goes to the
work laptop and the devices through BRAT. Matheus then reads the plugin's start-up time
([section 12a](#releases)).

A source repeat from the size research is removed only by the issue that already edits its file. What is
left, with `evaluate.ts` in four files, the scanner and the palette, is one refactor issue after 1.0.0
(#204); the spec's change log folded into its body, then one home per fact, is another (#205).

**M5's issue order** (M4's five are built, #74 to #78; M5 follows M4e; changed on 2026-11-15):

1. Page row and page breaks (#80)
2. Print view and Print… (#81), in both homes, closed by the hand check of step 4 in both

The third, the browser's own Print (#82), is closed as not planned: its cache is cut, and the one line it
still prints is part of the second issue. The breaks come first: they are one pure function from boxes and
the Page setting, the same in both homes, so every break rule is tested before anything draws a page. The
second issue starts with the Obsidian check that decides its route ([section 17](#17-verify-first)).

**To 1.0.0** (#203): the budgets per plugin file are set from the build, the release checklist of
[section 12a](#releases) is run, and `1.0.0` is released. Then the history is cleaned and the plugin
submitted with that version (#150, M4d's sixteenth issue, by hand).

**Dates:** set a date for M1 when this spec is agreed. Date each later milestone when the previous one lands,
from how long it really took. The v1 end is a forecast only.

**What the pump sheet checks at each milestone.** CI is `src/math/pump-sizing.test.ts`: it feeds the sheet's
lines through `evaluateSheet` and compares with the reference at 4 s.f. It grows each milestone and stays in CI.

| Milestone | CI | By hand (Matheus) |
|---|---|---|
| M1 | none | Type lines 1-13, save, reopen |
| M2 | Lines 1-13, 16, 17 | none |
| M3 | Adds lines 14-28 | none |
| M4 | Adds lines 29-31, and the 4" and 5" columns | Step 2: edit `D` to 5" on screen |
| M4b | none | None from the sheet: the work-laptop check (#85) |
| M4c | Line 26 with its range, in both columns | none |
| M4d | A pass/fail line (NPSH available against required gives `OK` or `NOT OK`), in both columns | Open the pump sheet in a vault on the work laptop; the device checklist ([12a](#releases)) |
| M4e | The check line's format read from where it is stored; the true-position sheet's values and chart ([section 15](#15-acceptance)); both sheets in the typing test | A sheet saved by `0.2.x` opens with its formats, on the beta `0.3.0` |
| M5 | none new | Steps 3-4: save and reopen, print to PDF, in Obsidian on the work laptop and in the web app in Chrome |
| M6 | none | None from the sheet: installing and working offline are M6's own check, after 1.0.0 |

### The finish line

**v1 is done, and released as 1.0.0, when all three hold** (changed on 2026-11-15):

1. The pump sheet passes steps 1-4, step 4 in both homes.
2. The true-position sheet passes its checks ([section 15](#15-acceptance)), and the release checklist
   of [section 12a](#releases) has passed on the build that becomes 1.0.0.
3. Matheus has used it for one real calculation other than the pump sheet. **Met:** the true-position
   sheet, built on his work laptop on 2026-11-15.

Until 2026-11-15 the second condition was "The installed PWA opens a `.excalimathpad` file and works
offline". The Obsidian plugin is now the home that works offline, so M6 is built after 1.0.0 and that
check goes with it.

**Open risks:**

- M1 is large and has one check at its end, so the Project Manager watches its issues to see slip early.
- The nested solve surfaces at M3, after two milestones of UI.
- Condition 3 depends on Matheus having a real calculation to do, so v1 can stay open after the build ends.
- M4c's range solve: its cost on the pump sheet (about 10 ms for `Q_op`) is projected from measured
  per-evaluation costs, not measured with a search in the engine. Every solved value saved with a guess
  becomes an error until its line is rewritten.
- M4d's plugin: the app ran from one 3.5 MB file offline in a probe (#116), not yet inside a real
  Obsidian view with its listeners confined. The double tap, Excalidraw's phone toolbar reaching Add
  math and the bottom sheet above the keyboard pass in Chromium's touch (#147), not yet on a device:
  that is the device checklist's. Obsidian's review, including "build matches
  what's committed", is unverified until the preview scan.
- M4d's text `==`: the `equal` override was probed in a fresh math.js, not in the hardened instance.
- M4e's format 2 is the first file migration. A sheet saved by the beta can't go back to `0.2.x`, and a
  vault synced with a device still on `0.2.x` is refused there.
- M4e was decided from prototypes run in headless Chromium and from screenshots: nothing was run inside
  Obsidian or on a device ([section 17](#17-verify-first)).
- M5's route in Obsidian rests on the system dialog honouring `@page`, unverified until #81's first step.
- Whether the overlay fix of `0.2.1` is what Matheus saw as the chart "spilling out of its box" is not
  confirmed until he looks again.

Decided in: [milestones](https://github.com/matheus-sancha/excalimathpad/issues/37),
[M4c](https://github.com/matheus-sancha/excalimathpad/issues/97),
[M4d](https://github.com/matheus-sancha/excalimathpad/issues/125),
[M4e, M5 and 1.0.0](https://github.com/matheus-sancha/excalimathpad/issues/187).

## 17. Verify first

Everything the tickets marked untested. Check each early in its milestone, and record the result here or in a
Changes line if it changes behaviour.

What is listed here is still open. Every item with a recorded result (passed, changed, measured or found), from
M1 to M4d, is in [`docs/spec-history.md`](spec-history.md#17-verify-first), with the result. When an item here gets its result, it moves there.

**M4b**

- The address opening through the work laptop's network.
- Excalidraw's fonts on the work laptop. No asset path is set in `src/`, so they are expected to come from
  Excalidraw's CDN, a second host a filter could block. Read from the code, not seen in a browser.
- The file pickers under the work laptop's browser policy, and the download and file-input fallback if they
  are turned off.

**M4c**

- A rotated element setting the width and discarding the height: built (#110), not checked by hand.
- The six text colours under the dark theme's filter, on the canvas and on each highlight: still readable.
- The suggestions list after `@`.

**M4d**

- In Obsidian itself, by hand in a test vault: the real Electron pop-out (focus between windows, a dialog
  opened from ☰ there, the eye dropper, a drag or a paste there) and Obsidian's keymap phase, whether it
  marks a key it took `defaultPrevented` (#135, #137).
- On a device: iOS bringing up the keyboard for a line opened from a `touchstart`, and `visualViewport`
  with a real keyboard (#147).
- Whether Obsidian's review passes without a committed `main.js`, by the preview scan: Matheus's step
  before submission ([Listing](#listing)), and its result goes here (#149).

**M5**

- Excalidraw text in Nunito on the pump sheet's heading.
- Staggered side-by-side elements and the no-clean-gap fallback.
- A drawing taller than a page, dark mode, and images in drawings.
- Taking over Ctrl+P with real keys, and a person at an open dialog.
- KaTeX 0.16.47, which the repo resolves, against the 0.19.1 the PDF probe used.
- A hand-set Scale in the dialog, other systems and real printers.
- **In Obsidian on a computer, before the print view is built** (a throwaway two-page frame
  answers all of it in minutes; none of it was run):
  - The system dialog honours `@page { size; margin: 0 }`, so the app's pages are the paper's
    pages. This decides the route. If it fails, the question comes back to Matheus before
    anything is built on it; the known fallback is Electron's own PDF export, a desktop-only
    API with a review risk.
  - Obsidian's own print styles don't reach the frame; KaTeX's fonts load inside the frame
    before it prints.
  - Printing from a pop-out window prints the sheet in that window.
  - Whether the saved PDF can be named `pump-sizing.pdf`. If the system dialog doesn't take
    the name, the file is named by hand there.

**M4e**

- Nothing of M4e's was run inside Obsidian or on a device: the panel's widths stood in for a
  14-inch laptop, the sample's phone was a 390 px window with no keyboard, and the new chart
  was drawn outside the app. Each is seen in the beta `0.3.0`.
- A rule's condition on a device (#197): whether the on-screen keyboard stays up when + Add
  rule moves it from the line to the new row's field, which isn't the tap's own focus; whether
  the bottom sheet shows that field above a real keyboard; and Ctrl+Z between the two fields
  in WebKit and Firefox, which may not share Chromium's one text undo.
- The typing test's time in CI with the new guide examples (59 s when measured).
- The savings of the plugin cuts (87 KB, about 148 KB and 109 KB) were probed as separate
  bundles or read from the source, not measured together.
- The plugin's start-up time in Obsidian, on the work laptop and one phone.
- That the overlay scrolling (0.2.1) is what Matheus saw as the chart "spilling out of its
  box" is not confirmed: he looks again on the beta.
- Unexpected failures were tested in jsdom against the fake `obsidian` only. In Obsidian, on
  the desktop and on a phone: that Report this error opens the browser from a sheet tab and
  from a pop-out window, and that Copy details and Copy reach the clipboard (where it
  refuses, the text shows in a box).
- A failed element's notice is wider than a narrow element, and its two actions take presses
  over the canvas; how it reads on a small element is seen in the beta.

**M6**

- Installing, the Windows "Open with" association, and saving back to an opened file.
- The service worker precaching the lazy plot and KaTeX chunks.

## 18. Decision index

The table of the tickets this spec came from, and the sections each fed, is in [`docs/spec-history.md`](spec-history.md#18-decision-index).
Each section above ends with its own tickets.

## Changes since agreed

- 2026-11-15, [section 4](#symbols-tab) (#146, found while building, for Matheus to confirm on the PR):
  - **The dot marks every letter that is also a constant,** read from the constants list: τ (2π) and φ (the
    golden ratio) are math.js constants too, so they carry it beside π, σ and α.
  - **Spacing reaches the far side too.** A Greek letter or `true` / `false` before a name character gets a
    space after it (`|b` + ρ gives `rho b`), and a call right after a name character gets one before it
    (`a` + `sin` gives `a sin()`), so no click joins a name. A prefix (`not`, `solve`) always ends in one
    space. `? :` goes in spaced, the caret between: `c ? | : `.
  - **Plain text** in an open title or comment line, and in a line's note after its `#`, is the spelling as
    it is, over the selection, the caret after it: no spacing and no wrapping (`sqrt()` in a comment).
  - **The Constants tab shows "Open a line to insert"** over its dimmed rows too, by the same no-line rule.
  - **The typing suggestions** gain the catalogue's other words: `and`, `or`, `not`, `true`, `false` and `in`.
    `guess` stays in them: the catalogue holds it as a suggestion that isn't a button, since the Sheet forms
    group leaves it out.
- 2026-11-15, [section 4](#format-tab) (#144, found while building, not asked): a Format tab press on a
  comment line keeps the caret where it was in the comment text, moving with the `#`. A comment line
  has no code, so `min(selectionStart, codeLength)` would have sent the caret to the start of the line
  on every press.
- 2026-11-13, [section 7](#the-file) (#111, found while building, not asked): a title's format is stored
  as a string of words (`"centre L text-red"`), not an object. Excalidraw compares `customData` one
  level deep when it records a step, so an object there added an empty undo step to every later write
  of the anchor, line commits included. It still holds only what differs.
- 2026-11-13, [section 4](#chosen-width) (#110, the fallback the spec allows): a chosen width re-wraps
  comments on release, not while the handle moves.

- 2026-11-04, [section 6](#6-undo) (#41, agreed by Matheus): selecting and deselecting are
  Excalidraw's own undo steps, found while probing and accepted. So with the element selected, a
  click outside adds a Ctrl+Z that only re-selects, and "the first Ctrl+Z empties the element"
  holds after Esc.
- 2026-11-04, [sections 2](#invariants) and [6](#6-undo) (#41, accepted by Matheus for now): a nudge or
  Link edit becomes its own step only if a line commit follows, a line commit after one adds two
  entries, and a nudge of several elements can split. The line itself is still exactly one step.
  [Section 14](#14-engineering-constraints) says what the next Excalidraw upgrade changes.
- 2026-11-04, [section 16](#16-milestones-and-finish-line) (#41, agreed by Matheus): the bare line
  field and its keys (↑ ↓, Enter, Backspace, Esc, blur) moved from the third issue to the first,
  because section 6 can't hold without them. The third keeps the gestures, the field's final
  layout and Esc's second press.
- 2026-11-05, [sections 7](#7-file-and-save), [13](#13-messages) and [16](#16-milestones-and-finish-line)
  (#42, agreed by Matheus): a scene file dropped on the canvas opens through Open; a plain `.excalidraw`
  saves through Save as on its first Ctrl+S; the recovery copy keeps the file handle and is also cleared
  when another file opens; a failed save has a message; saving during an edit keeps the line open; the seed
  stays on the untitled sheet until Add math.
- 2026-11-05, [sections 7](#7-file-and-save) and [13](#13-messages) (#42 review, Engineer's, for Matheus to
  confirm on the PR): opening picks the file before the unsaved-changes question, because Chromium allows one
  picker per gesture; a picker or read failure has its own message, `Couldn't open the file: <reason>`.
- 2026-11-07, [section 4](#gestures) (#43, agreed by Matheus): a drawing on top of a math element keeps
  Excalidraw's double-click; a grouped element edits straight away; a locked element still edits, its lock
  holding position only; the second Esc deselects whenever the selection includes math, mixed selections too;
  arrows keep binding to math elements, even from inside.
- 2026-11-07, [section 16](#16-milestones-and-finish-line) (#43, agreed by Matheus): the edit field's final
  layout moves from the third issue to the fourth (#44), which builds the grid its cells live in. Until then
  the field sits over the source column, with the live result beside it as plain text.
- 2026-11-07, [section 14](#14-engineering-constraints) (#43, Engineer's, for Matheus to confirm on the PR): Enter,
  Esc and M act only on keys aimed at the canvas, whose target is inside the box Excalidraw fills or is the page's
  body, besides the rule against inputs, textareas, contenteditables and buttons. Keys in the app's own dialogs
  and panels stay theirs: the second Esc had taken Esc away from the open-file question.
- 2026-11-07, [section 4](#4-math-element-look-and-editing) (#44, agreed by Matheus, answers 1-4 on the
  [design](https://github.com/matheus-sancha/excalimathpad/issues/44#issuecomment-6710347368)): a size write
  doesn't move a bound arrow's end, a known limit; in Excalidraw's dark theme the math takes the canvas's own
  filter (#50); the field's 240 px minimum applies to any element with no source, new or emptied; a line that
  doesn't parse shows its raw source over the name, `≔` and expression cells, where the field opens.
- 2026-11-07, [section 4](#problems) (#44, Engineer's, confirmed by Matheus in chat on 2026-11-07): a line that doesn't
  parse also shows its message in the result cell, as any error does, so the reason is on the sheet.
- 2026-11-07, [section 4](#typesetting-names) (#44 review, Matheus, in chat on 2026-11-07: "Greek letter
  (T_α)"): a Greek word that is the whole subscript typesets as its letter, not as an upright word.
- 2026-11-10, [sections 4](#while-editing-a-line) and [8](#8-app-chrome) (#45, agreed by Matheus, answers 1-4 on the
  [design](https://github.com/matheus-sancha/excalimathpad/issues/45#issuecomment-6764076286)): an element holding only
  spaces and blank lines is empty; removing an emptied element is the only undo step, so Ctrl+Z brings it back with
  its last text; M works from any tool, pressing M or the button again keeps placing, and each Add math places one
  element; the welcome screen shows the app's name, the hint and Open….
- 2026-11-10, [section 8](#add-math) (#45, checked in Chromium with real keys and mouse): the crosshair holds while
  the pointer moves, the ghost follows it at any zoom and the click places the element at the ghost; M, the button
  and Esc work; an element placed on top of another leaves it unselected and unmoved; after Add math, a line and
  Esc, Ctrl+Z empties the element and a second removes it, and Ctrl+Shift+Z brings both back; an empty Add math
  left with Esc is removed, and Ctrl+Z brings back the empty box. A placed element makes the sheet dirty, and it
  stays dirty after an empty one is removed, because the undo stack still holds it.
- 2026-11-10, [section 4](#selected-math-element) (#46, agreed by Matheus, answer 1 on the
  [design](https://github.com/matheus-sancha/excalimathpad/issues/46#issuecomment-6764976877)): the border is thin
  (width 1) as this spec says; until #46 anchors were drawn at Excalidraw's bold width (2), so every element's
  border is thinner now, in saved files too once opened. The fixed style also names sharp corners, because the
  reduced panel hides Edges.
- 2026-11-10, [section 4](#selected-math-element) (#46, checked in Chromium with real keys and mouse): opacity set
  in the reduced panel fades the element's math with its border, and the line being edited stays at full
  opacity; new text opens in Nunito. Found: a changed opacity becomes Excalidraw's default for the next shape
  drawn, as for any element; a new math element still starts at 100.
- 2026-11-10, [section 16](#16-milestones-and-finish-line) (agreed by Matheus, in chat): M2 is seven issues, in the
  order listed there. #7 keeps its number as the third.
- 2026-11-11, [section 4](#typeset-grid) (#62, agreed by Matheus, in chat on 2026-11-11, with the
  [design](https://github.com/matheus-sancha/excalimathpad/issues/62#issuecomment-6784530105) approved): each line of a
  math element is its own display, flush left, instead of a grid aligned on `≔` with right-aligned names. This replaces the
  grid agreed in #14. Matheus first asked for left, center and right as a setting per element, then chose one layout and
  no setting. Every sheet looks different when opened, and boxes can get narrower; the size write keeps a clean sheet clean.
  The result and note columns, comment lines, the gutter and unparsed lines are unchanged.
- 2026-11-11, [section 4](#typeset-grid) (#62, checked in Chromium with real keys and mouse): six lines (a comment, three
  assignments, a bare expression, a plain input with a note) all started at the same left edge, the `≔` fell at three
  different places, and the results stayed in one column; opening a line put the field where the equation was; a saved
  sheet reopened with a box 40 px too wide was refitted and stayed clean.
- 2026-11-11, [sections 3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [6](#6-undo) and
  [13](#13-messages) (#63, agreed by Matheus, in chat on 2026-11-11, with the
  [design](https://github.com/matheus-sancha/excalimathpad/issues/63#issuecomment-6792436906) approved): a line with
  code can be bold, underlined and highlighted in one of five colours, for the whole row; the format is a clause of `@`
  words in the line's source, set from a bar beside the open line or with Ctrl+B and Ctrl+U; each change is one line
  commit. The clause is read second, after the comment, so the display unit and the forms move down one step.
- 2026-11-11, [section 4](#typeset-grid) (#63, checked in Chromium with real keys and mouse): bold reached KaTeX's
  glyphs through a rule on `.katex` (weight 700 on the equation and the result); the bands showed behind the row in
  the light and dark themes; the bar sat right of the box, a click on it kept the field focused, and the box's size
  didn't count it. Found: `text-decoration` doesn't reach KaTeX's inline-block boxes, so the underline is a line
  drawn in each cell's background; a bold row is 1 px taller than a plain one.
- 2026-11-11, [sections 2](#terms), [4](#4-math-element-look-and-editing), [6](#6-undo), [7](#7-file-and-save) and
  [8](#sheet-panel) (#64, agreed by Matheus, in chat on 2026-11-11, with the
  [design](https://github.com/matheus-sancha/excalimathpad/issues/64#issuecomment-6792439849) approved): a math element
  can have a title, shown in a header above its lines, and it is optional ("the user can opt to not add the title"). ↑ on
  the first line or the bar's Title button opens it, a double-click on the header edits it, and an empty title removes
  it. So ↑ on the first line no longer stays put, and the bar now shows on every open line, with Title alone where the
  line takes no format. A title change is one undo step; an element holding only a title isn't empty.
- 2026-11-11, [section 4](#typeset-grid) (#64, checked in Chromium with real keys and mouse): the Title button opened the
  title field with the keyboard in it; Enter went to the first line; the header drew bold above the lines with its rule,
  and the box grew to hold it; a double-click on the header edited the title, and one on a line still edited that line;
  ↑ twice from line 2 reached the title; two Ctrl+Z took back the change and then the title, and redo brought both back;
  the title was in the saved file and showed again when it was reopened, clean; emptying it removed the header and kept
  the element.
- 2026-11-11, [section 5](#unit-systems) (#56, Engineer's, for Matheus to confirm on the PR): the kinds list has
  no electrical kinds, so `I * R` would have shown as `20 (kg m^2) / (s^3 A)`. A dimension off the list now shows
  in its named SI unit when there is one (A, C, V, Ω, F, H, S, Wb, T), with a prefix in SI with prefixes (`20 mV`),
  in every system, before composed base units. SI with prefixes steps through these units per kind: length µm,
  mm, m, km; area mm², cm², m², km²; volume mm³, cm³, L, m³; volume flow mL/s, L/s, m³/s; mass flow g/s, kg/s;
  velocity mm/s, m/s, km/s; force mN to MN; pressure Pa to GPa; energy mJ to GJ; power mW to GW; dynamic viscosity
  µPa·s, mPa·s, Pa·s; kinematic viscosity mm²/s, m²/s; frequency Hz to GHz; mass mg, g, kg, t; time µs, ms, s;
  acceleration, density and temperature have one unit. A result shows in the largest one that keeps its number at
  1 or above, so a few read above 1000 (`9290 cm²`). USCS uses BTU for energy, lbf·s/ft² for dynamic viscosity
  and °R for temperature. A result's plain text writes units as math.js does (`1.002 mPa s`, `18.81 L / s`,
  `2 (kg m) / s`); typeset, they read `mPa·s`, `L/s`.
- 2026-11-11, [section 8](#sheet-panel) (#58, checked in Chromium at 1440 and 1000 px wide): Excalidraw docks its
  sidebar only when the editor is wider than 1229 px (`MQ_RIGHT_SIDEBAR_MIN_WIDTH`); narrower, the panel floats over
  the canvas, and a click on the canvas or Esc closes it. At launch on a 1440 px window the panel opened docked on
  Variables; a jump from Problems scrolled to the element, selected it, flashed the line and left the sheet as it was.
- 2026-11-11, [section 8](#sheet-panel) (#58, Engineer's, for Matheus to confirm on the PR): an element without a title
  is labelled by its place in reading order, `Element 2`. A jump's select adds no undo step (`NEVER`, like the second
  Esc's deselect) and gives the keyboard to the canvas, so Enter opens the line. Open or closed is remembered only from
  a wide window, since the floating panel closes by itself after a jump or a click. The Sheet button is the app's own,
  so it can carry the badge and reopen the last tab. Values in Variables read as the result's plain text, with the unit
  typeset.
- 2026-11-11, [section 4](#problems) (#7 and #58, found while building; fixed in the follow-up, checked in Chromium with
  a real mouse): the overlay takes no pointer events, so a hover title on the gutter mark or an error cell never showed
  on screen (true of errors since M1). The gestures now find the mark under the pointer from its screen box, as the
  unit slot does (#60), and the overlay draws the message as a tip: a `⚠`'s warnings, a `●`'s error, and a capped
  error's whole text (only while the cell is cut short). It shows after the pointer rests 500 ms, moves straight to the
  next mark while one shows, and hides when the pointer leaves the mark or the canvas, on a press, and on a scroll,
  zoom or scene change. The press still reaches Excalidraw, which selects and drags as before. The tip stays clear of
  the Sheet panel, and is screen only: never in the scene, the file or print. No `title` is set on overlay content.
- 2026-11-11, [section 14](#14-engineering-constraints) (#60, verify first, measured in Chromium): the slot's
  pointer cursor set two frames after a move, as the crosshair is, flickered while the pointer moved: about half the
  painted frames showed Excalidraw's `move`. Excalidraw sets its cursor in its own move handler and again from a frame
  callback it queues there. The slot now sets the pointer in a microtask after the event and from a frame callback
  queued after Excalidraw's: every painted frame showed the pointer, still or moving.
- 2026-11-11, [section 5](#unit-slot) (#60, Engineer's, for Matheus to confirm on the PR): each kind's list in the slot
  and in Custom is in `src/math/unitSystems.ts` (`SLOT_UNITS`), the app units included; pressure is section 5's own.
  A typed text that matches a unit exactly is highlighted first (`bar` before `mbar`), and the highlight returns to the
  top as you type. `%` is a display unit the app reads itself (`in %` shows the value times 100), since math.js has
  none. A row's slot outline follows the pointer by geometry, selected or not.
- 2026-11-11, [section 13](#13-messages) (#70, Engineer's, for Matheus to confirm on the PR): four solve messages the
  table didn't have, added to it: a guess that isn't a number or a quantity, a line with no equation or more than one
  top-level `=`, no root when no point tried had a value, and a side that is a matrix or a string. A missing guess
  names the first free name in the equation as the unknown (`", guess Q = <value>"`), or `x` if there is none. The
  span searched shows the unit once, after the high end (`searched 0.9 .. 240 L / s`), in the guess's unit. A units
  mismatch quotes the guess as typed (`guess Q = Q_d: …`); no root shows the guess's value (`no root near Q = 15 L/s`).
- 2026-11-11, [section 9](#9-solve) (#70, Engineer's): the bracket search steps out from the guess by 0.1·s·1.6ⁿ
  (s is the guess's size, 1 for a zero guess), right then left, up to 60 steps (about 10¹² times the guess), and skips
  points where the equation has no value. A root at exactly zero that the residual never reaches exactly (`x^3 = 0`)
  can't meet a relative tolerance, so it fails after 100 iterations; a tolerance setting stays out of scope.
- 2026-11-11, [section 9](#9-solve) (#71, Engineer's, for Matheus to confirm on the PR): an outer solve counts a trial
  point as outside the domain only when an inner solve there found no root or didn't converge. Any other error at a
  trial point, a units error included, fails the outer line at once with that error. A solve function's details on
  hover are those of the call the line makes; the details of solves inside its equation are not shown.
- 2026-11-11, [section 4](#solve-details) (#72, Engineer's, for Matheus to confirm on the PR; checked in Chromium with
  a real mouse): the hover reads `Brent, 6 iterations`, then `Residual: -2.06·10⁻¹³` with its SI unit, then
  `Bracket: 0.01864160794462 .. 0.01864160794463`, both at 13 significant digits so the bracket's ends differ. It is
  the problem tip: the same 500 ms rest, the same hiding, and a press or drag from the value still selects and moves
  the element. The dotted underline sits under the value and its unit, and print drops it.
- 2026-11-11, [section 10](#ranges-and-lists) (#74, Engineer's, for Matheus to confirm on the PR): a list's summary
  writes the unit as results do (`30 values, 1 … 30 L / s`); the first value is shown in the last one's unit. A
  failed point is named by the first list the line runs over, in that list's unit (`At Q_s = 0 L / s: …`); when the
  point failed already in that list, by its position (`At point 1: …`). Two messages the table didn't have are added
  to it: a range's start, end or step that isn't a single number or quantity. An aggregate name the sheet defines as
  a function (`max(x) = …`) is the sheet's function, not the aggregate. A bare range (`1 .. 10`, no name) shows its
  summary too.
- 2026-11-11, [section 10](#ranges-and-lists) (#75, Engineer's, for Matheus to confirm on the PR): the hover on a
  list's summary shows every point of a list of up to 7, else the first three and the last three with `…` between,
  each as `index: value` in the line's unit; a failed point reads `5: failed: <message>`. It is the problem tip, with
  no dotted underline (that marks solve details). The count is grey and the two values are typeset.
- 2026-11-12, [section 10](#tables) (#76, Engineer's, for Matheus to confirm on the PR; checked in Chromium with a real
  mouse): a column with no unit of its own, from its argument or from the line that defined its list, shows in the
  unit the sheet's system picks for its largest value, so the whole column shares one unit. Cells show the number
  only; the unit is in the header, in its slot. A header slot's list shows the column's first value in each unit, and
  choosing one wrote `in cm` onto that argument alone as one undo step. A column counts as whole when every number in
  it reads whole after rounding to Digits. Points that fail in a column the table works out itself (`r(Q_s)`) make
  the table line's error, `2 of 8 points failed. At Q_s = 1 L/s: …`, and the table still draws; a list named from
  above (`H_s`) shows its failures on its own line only. A double-click on a table row opened its line. Two messages
  are added to section 13: a table with no list, and `in <unit>` after a whole table line.
- 2026-11-12, [section 10](#plots) (#77, Engineer's, for Matheus to confirm on the PR; checked in Chromium with a real
  mouse): series are named by their argument as typed (`Hs(Q_s)`), in the legend (typeset) and in the y title
  (`Hs(Q_s), Hp(Q_s) [m]`). The y axis takes the first series' unit, chosen as a table column's is. A mark's label is
  its expression and value in x's unit (`Q_op = 18.81 L / s`). The colours are a fixed list of eight, Excalidraw's
  blue first. A failed point's × shows its message on hover through the problem tip; points that fail make the plot
  line's error, as a table's do. A drag from the chart moved the element, and a double-click on it opened the plot
  line. Five messages are added to section 13.
- 2026-11-12, [section 10](#plots) (#78, Engineer's, for Matheus to confirm on the PR; checked in Chromium with a real
  mouse): the ⚙ sits at the chart's top right while its row is hovered. A drag that starts on it moved the element and
  opened nothing; a click opened the popover. The popover's Mark field takes several marks separated by `;`; an axis
  range is written only once both ends are filled; size M, the default, is written as no clause. Text fields write on
  Enter or when they lose focus, the rest at once; each change was one undo step, written before the format clause and
  the note (`plot(Q_s, Hs(Q_s)), mark Q_d, points, size L, title "System" # curve`), in the popover's order. Esc, or
  focus leaving the popover, closes it.
- 2026-11-12, [sections 1](#1-what-v1-is-and-what-it-isnt), [8](#8-app-chrome), [12](#hosted-build),
  [16](#16-milestones-and-finish-line) and [17](#17-verify-first) (agreed by Matheus in chat on 2026-11-12): hosting
  moves out of M6 into a new milestone, M4b Hosted build, built before M5, so the app can be opened on the work
  laptop. The site is public Cloudflare Pages with no Access gate, deployed from CI on each merge to `main`, with a
  build stamp in the ☰ menu and no versioning while Matheus is the only user. What the work laptop allows is
  unknown, so a by-hand check closes the milestone (#83 to #85). M6 keeps the service worker, manifest, icons,
  fonts and file association. An Obsidian plugin is planned after v1 and joins "Not in v1".
- 2026-11-12, [section 8](#8-app-chrome) (asked for by Matheus in chat on 2026-11-12): Add math and the Sheet button
  leave the canvas's top right and become two items in Excalidraw's More tools dropdown, under a Math heading. Sheet
  is renamed Math Settings; the panel it opens keeps its name in this spec, Sheet panel. The Engineer's additions, for
  Matheus to confirm on the PR: the More tools button carries the problem badge and reads as selected while placing,
  since the items are out of sight while the dropdown is closed; the welcome hint reads "Press M, or choose Add math
  under More tools, then click the sheet to place math". Excalidraw has no slot for More tools, so the items are
  drawn into the dropdown's own box, pinned by contract tests. The panel's close button was cut by the window on a
  wide window: the tabs now give way so the header fits.
- 2026-11-12, [section 5](#unit-systems) (asked for by Matheus in chat on 2026-11-12): the unit slot's list for an
  energy also offers the torque units N·m, kN·m, lbf·ft and lbf·in, and the kind reads "Energy, torque" in the
  Settings tab. A torque still shows in `J` by default, since it has energy's dimension.
- 2026-11-12, [sections 5](#constants) and [8](#sheet-panel) (asked for by Matheus in chat on 2026-11-12: a
  Constants list in the panel, in Mathcad's format; "Use g for grams and hr (hrs) for hour. Keep gravity";
  "Everything on the engine"): the Sheet panel gains a Constants tab listing every built-in constant. The common ones
  take Mathcad's short names, `c`, `G`, `h`, `hbar`, `R`, `k`, `N_A`, `sigma` and the rest of the table in section 5.
  `g` stays the gram and gravity stays `gravity`; `h` is the Planck constant, so the hour is written `hr`, and the
  unit slot's lists read `m^3/hr`, `km/hr`, `kg/hr`. The short names are the Engineer's, from memory of Mathcad's
  list, which couldn't be read from the build session: for Matheus to confirm on the PR. Also the Engineer's: a
  sheet's own `R` or `k` is an error above its line, where a unit's name would fall back with a warning, because a
  line that quietly read the gas constant would give a wrong number; taking a short name doesn't warn; the panel
  is 384 px wide so four tabs fit. `hbar` no longer reads as the hectobar.
- 2026-11-13, [section 4](#while-editing-a-line) (asked for by Matheus in chat on 2026-11-12: "a suggestion text
  based on the user writing, kind like google search bar", shown "Automatically"): a list of suggestions under the
  open line. The Engineer's choices, for Matheus to confirm on the PR: nothing is highlighted until ↓, so Enter still
  splits the line and Tab takes the first name; the first Esc closes the list only; no list after a unit typed in
  full, where it would stand in the way of ↓ and Tab on nearly every line; shorter names come before longer ones
  after the sheet's own; the functions offered are a fixed list of everyday ones, not all of math.js's.
- 2026-11-13, [section 4](#typeset-grid) and [Size](#size) (#98, from Matheus's batch #88, "Text using '#' is
  overflowing the results columns"; he chose wrapping in chat): a comment line wraps at the element's width
  where it ran on through and past the results column. The Engineer's choice, for Matheus to confirm on the PR:
  a comment still asks for up to 320 px, the error cap's number. Checked in Chromium: beside wide math, beside
  `x = 2`, and alone. The open field stays one line. His other half, "the user can adjust the width of the block
  and the text adjust accordingly", reopens the box that always fits its content and is a ticket on the map (#90).
- 2026-11-13, [section 8](#sheet-panel) (#99, defect): the Variables and Constants filters are text fields.
  As search fields, Excalidraw ran its shortcuts on what was typed: `s` opened its stroke colours and took the
  keyboard, and a space wasn't typed.
- 2026-11-13, [section 16](#16-milestones-and-finish-line) (agreed by Matheus on the map
  [Spec for the improvements batch before M5](https://github.com/matheus-sancha/excalimathpad/issues/90), from his batch #88): a new milestone, M4c Improvements,
  built before M5, in eight issues (#104 to #111), the solve first ("Solve first"). Each entry below is one of its decisions; the ticket it names holds his
  chosen options, word for word. Items in an entry's last sentence, after "Not asked:", are choices
  the tickets made without asking him, for Matheus to confirm on the PR.
- 2026-11-13, [sections 1](#1-what-v1-is-and-what-it-isnt), [3](#3-sheet-lines-every-form), [9](#9-solve),
  [10](#ranges-and-lists) and [13](#13-messages) (#92, agreed by Matheus; method from the research in #91): a
  solved value takes a search range, `for Q = 1 L/s .. 30 L/s`, and holds every root found in it, ascending;
  `guess` is removed from value lines ("Range only, guess removed") and kept for solve functions, which return
  one root. This replaces #19's required guess for solved values, and "bounds or intervals on the unknown"
  leaves "Not in v1". One root is a single value; up to five are written out; `x_r[1]` takes one value out of
  any list, counting from 1. No root, more than 100 roots and a list in a range solve are errors. A saved value
  line with a guess becomes an error that says what to write. The search is 200 points with Brent on each sign
  change, a check that rejects poles and jumps, and a pass that finds double roots; it reports "roots found in
  a .. b", never "all roots". Not asked: an index goes on a name and takes any whole-number expression; the
  range shows small and grey after the equation, as the guess does; the message wordings other than the three
  he was shown (`no root found for x in -10 .. 10`, `solve needs a range: …`, `a range solve can't use the list
  a_s; …`).
- 2026-11-13, [sections 3](#3-sheet-lines-every-form), [4](#colours-and-rules), [5](#unit-slot),
  [7](#the-file), [8](#sheet-panel) and [11](#11-print) (#93, agreed by Matheus): six fixed text colours. A
  line's is `@text-red`, on its equation and result, and the note stays grey; a bare `@red` stays a highlight,
  so no saved sheet changes. The sheet has one Result colour in Settings, blue by default. The format bar gains
  a second row of dots. A chosen unit loses its tint ("No mark at all"), which reverses section 2's "always
  marked". Not asked: the last of two text colours wins; what is never recoloured; an edited line shows its
  source uncoloured; the bar's fixed word order; the suggestions list offers the format words after `@`.
- 2026-11-13, [sections 3](#3-sheet-lines-every-form), [4](#colours-and-rules), [10](#ranges-and-lists) and
  [13](#13-messages) (#94, agreed by Matheus: "needs to be able to handle multiple conditional formatting"): a
  rule is `@word if <condition>`, each word with its own `if`, any number per line. The first true rule wins
  per property and a plain format is the fallback. A condition reads any name so far plus `result`. On lists
  and tables it is tested per point. A condition that can't be decided is a warning and the result still
  shows. Rules are typed only: the bar leaves them alone. The format clause now starts at the first `@`
  outside a string, where it was the trailing `@` words, so an `@` in the middle of the code is the line's
  format error and no longer math.js's. Not asked: a line in error runs no rules; an assignment in a
  condition is a warning; `result` always means the line's value there; a failed point counts as not true;
  one warning per rule; the five warning wordings. Asked on 2026-11-13 while writing M4c: roots written out
  in one row take a rule's format only if every root is true, as a list's summary does ("Row only if all
  true").
- 2026-11-13, [sections 2](#invariants), [4](#chosen-width), [6](#6-undo), [7](#the-file) and
  [14](#14-engineering-constraints) (#100, agreed by Matheus: "What we can is set the minimum width and the
  user can reduce more, but the user can increase it"): a math element has an optional chosen width, set by
  the resize handles and never below what its math lines need. Dragged narrower, it returns to automatic.
  Comments re-wrap live, math stays at the left, height stays automatic. It is one undo step and is saved with
  the element. This amends #29's box that always fits its content: resize handles no longer snap the width
  back. Not asked: stored as `customData.width`; a comments-only floor of about 120 px; a rotated element
  resizes along its own axis; a left handle can change reading order; print uses the laid-out width.
- 2026-11-13, [sections 2](#terms), [4](#title-format), [6](#6-undo) and [7](#the-file) (#95, agreed by
  Matheus): a title has a format, stored beside it and set from its own three-row bar: bold, italic,
  underline, left, centre or right, four sizes (13, 16, 20 and 26 px), the six text colours, and a highlight
  over the whole header band. The text stays as typed. This reverses #64's "takes no format" and "the title
  has no bar". With no format a title looks as it did. Not asked: stored as `customData.titleFormat`, holding
  only what differs; each press is one undo step; Ctrl+B, Ctrl+I and Ctrl+U; the title's width at its size
  counts toward the floor; emptying the title removes its format.
- 2026-11-14, [section 16](#16-milestones-and-finish-line) (agreed by Matheus on the map
  [Spec for the second improvements batch and the Obsidian plugin, before M5](https://github.com/matheus-sancha/excalimathpad/issues/114),
  from his second batch): a new milestone, M4d Plugin & panel, built before M5, in sixteen issues (#135 to #150), the plugin
  first ("Plugin first"). M4b's work-laptop check (#85) is closed as superseded ("Close as superseded"); the
  history rewrite is its own last by-hand issue ("Own [Matheus] issue, last"); the Settings `<select>` Delete
  defect is fixed in the panel footing issue ("In the panel footing issue"). Each entry below is one of the
  map's decisions; the ticket it names holds his chosen options, word for word. Items after "Not asked:" are
  choices made while writing this spec, for Matheus to confirm on the PR. Not asked: the listing's screenshot
  is taken for the version submitted, not for `0.1.0`, because the plugin ships before the Format tab.
- 2026-11-14, [sections 1](#1-what-v1-is-and-what-it-isnt), [12](#hosted-build) and
  [12a](#12a-obsidian-plugin) (#115, #116, #126, #128, #130, agreed by Matheus): v1 is "for anyone, built
  around Matheus's own engineering work; free and best effort", and gains a second home, an Obsidian
  community plugin built from the same source, for desktop, phone and tablet. It makes no network request,
  stores only in the vault, reads only the open sheet and a picked image, and is audited for both on every
  pull request. One semver for both homes, first `0.1.0`, released from an Actions button as a draft. The
  hosted app's work-laptop fallbacks are dropped. This replaces section 12's "no versions, tags or release
  notes" and "an Obsidian plugin, planned after v1". Not asked: a failed vault write's notice wording.
- 2026-11-14, [sections 2](#invariants), [7](#a-sheet-in-a-vault) and [13](#13-messages) (#124, agreed by
  Matheus): a vault sheet autosaves the Obsidian way; Save, Open, `●`, the leave question, the recovery copy
  and the untitled sheet are dropped there; New sheet by command, ribbon and folder menu; an outside change
  reloads an idle tab and writes a conflict copy for a busy one. The web app's saving is unchanged. ADR 0004
  gains a note. Not asked: the conflict notice's wording; a newer or unreadable file is refused in the view
  as on the web.
- 2026-11-14, [sections 8](#inside-an-obsidian-tab) and [11](#11-print) (#129, agreed by Matheus): inside an
  Obsidian tab, ☰ is the web's minus the file items; the theme follows Obsidian with a per-tab override;
  Obsidian's core keys pass through; the panel stays in the tab and docks by the tab's width; Web Embed,
  Mermaid, Browse libraries, Copy as SVG and the command palette are hidden; four commands, no settings tab;
  everything bound to the view; M5's Print is a command there. Not asked: Print… also stays a ☰ item in the
  plugin.
- 2026-11-14, [sections 1](#1-what-v1-is-and-what-it-isnt), [4](#touch), [8](#on-a-phone) and
  [12a](#releases) (#127, #130, agreed by Matheus): full editing on phone and tablet: a double tap opens a
  line; Done, ↑ ↓ and Edit on the Format tab, on every device; a tap shows a tip; a touch selection reveals
  unit slots and ⚙; quick keys; a bottom sheet on a phone. `isDesktopOnly: false` reaches strangers only after
  CI touch tests and the four-device checklist; betas carry it for Matheus. Below iOS 16.4 the view refuses
  the sheet. This replaces "v1 makes no promises on a touch device" for the plugin. Not asked: the bottom
  sheet about half the view with no line open; finger buttons at least 40 px; the quick keys' order.
- 2026-11-14, [sections 2](#invariants), [4](#problems) and [8](#8-app-chrome) (#118, agreed by Matheus): a
  warning's `⚠` shows only while a line or the title of its element is open, or on its line while a jump
  flashes it; the badge counts errors only, and the panel opens on Problems at launch only for an error. The
  red `●` is unchanged. Fixed behaviour, no setting.
- 2026-11-14, [sections 2](#terms), [3](#3-sheet-lines-every-form) and [4](#typeset-grid) (#119, agreed by
  Matheus): a comment line takes a format, as a clause before its `#`: bold, `@upright`, underline, `@S` /
  `@L` / `@XL` (13, 20, 26 px; M stays 15 px), the six text colours and the five highlights; no alignment, no
  rules; a note is unchanged; size or `@upright` on a math line is its error; the 320 px request scales with
  size. This replaces "Comment lines … take no format" and a comment line among the "never recoloured". ADR
  0005 is amended. Not asked: the order the Format tab writes a comment's words.
- 2026-11-14, [sections 2](#terms), [4](#format-tab), [6](#6-undo), [8](#sheet-panel) and
  [14](#14-engineering-constraints) (#117, #121, agreed by Matheus): the Format tab, first of six icon tabs
  (Format, Symbols, Variables, Problems, Constants, Settings), replaces the format bar and the title's bar: a
  live sample, labelled rows of no-focus buttons, a hint when nothing is open, the title link; an edit opens
  the panel on Format and its end restores it; Ctrl+I on comments; undo unchanged. Panel presses skip
  `listenToCanvas`, with a panel-wide prevention on `document` in bubble. This replaces section 4's format
  bar and title's bar, and #95's "set only from the title's bar". Not asked: the hint wordings as written in
  section 13.
- 2026-11-14, [sections 3](#3-sheet-lines-every-form) and [4](#rules-list) (#123, agreed by Matheus): the
  Format tab's Rules list adds, removes, reorders and formats a line's rules while the condition is typed in
  the line; each row shows its live state or its warning; several words share one `if` as a joined word,
  `@text-red+red+bold if v > 3 m/s`, also valid on plain formats. This replaces "Rules are typed. The format
  bar never writes or changes one" and reverses the last map's out-of-scope "rule builder". #94's
  "two formats under one condition are written twice" stays valid input. Not asked: the joined-word error
  wording.
- 2026-11-14, [sections 1](#1-what-v1-is-and-what-it-isnt), [4](#symbols-tab) and [8](#sheet-panel) (#122,
  agreed by Matheus): the Symbols tab, five groups (Greek, Operators, Functions, Logic, Sheet forms), inserts
  the text the engine already reads at the caret, by the joining, wrapping and spacing rules; one undo step
  each; with no line open, one selected element's last line opens. Constants rows insert their name. One
  catalogue feeds the tab and the typing suggestions. No engine change.
- 2026-11-14, [sections 1](#1-what-v1-is-and-what-it-isnt), [2](#invariants), [3](#3-sheet-lines-every-form),
  [4](#conditionals-and-text-typeset), [5](#shown-result), [10](#ranges-and-lists), [13](#13-messages) and
  [14](#14-engineering-constraints) (#131, #132, agreed by Matheus): readable one-liners only: `? :` and a lazy
  `if(cond, a, b)`, drawn as one flattened brace; `==` / `!=` compare text exactly, and text against a number
  is an error; a text result shows plain; `true` / `false` upright; a top-level `;` is the line's error; a list
  of texts counts each text. The pump sheet gains a pass/fail line. Mathcad's multi-line program and directive
  lines are out of scope. Not asked: the message wordings, apart from "split the line at the ;" and
  "can't compare text with a number"; `in <unit>` on a text is an error; a text has no unit slot.
- 2026-11-14, [sections 2](#terms) and [8](#math-guide) (#120, agreed by Matheus, who typed "Add Cheat Sheet
  but any other name?"): the **Math guide**, `docs/math-guide.md`, for a newcomer engineer, 17 sections, Write |
  Shows | Note tables, self-contained, opened from ☰ → Math guide above Excalidraw's Help in a dialog, offline,
  with every example run in CI. The README's Line forms and Keyboard Shortcuts move into it. Not asked: the
  dialog closes on Esc, ✕ or a click outside and is up to about 760 px wide; the skip marker and build tool
  are the Engineer's.
- 2026-11-14, [sections 1](#1-what-v1-is-and-what-it-isnt), [8](#8-app-chrome) and [12a](#listing) (#130,
  agreed by Matheus): the listing's id, name and description; a users-first README that is also the listing
  page; Bug and Idea forms and `SECURITY.md`; the BRAT beta and the gate to submit; UI text in sentence case in
  both homes, so "Math Settings" becomes "Math settings". The rename lands with the lint, in M4d's first issue.
- 2026-11-14, [section 12a](#data-protection) (#135, found while building, for Matheus to confirm on the PR):
  React DOM and Radix carry `createElement("style")` and `createElement("link")` in their own code, so the
  bundle audit lets through those library sites only, each known by a word near it, and the network-blocked
  run fails on any `<style>` or `<link>` added at run time. The allowlist also holds Excalidraw's Help links
  and its embed patterns, and the plugin turns embeds off (`validateEmbeddable={false}`) so none loads.
- 2026-11-14, [sections 7](#a-sheet-in-a-vault), [12a](#data-protection) and [13](#13-messages) (#136, found
  while building, confirmed by Matheus: "all fine"):
  - **The vault image picker** takes over Excalidraw's image tool: Excalidraw 0.18 opens the operating
    system's file picker from inside `setActiveTool`, so the tool's button and its key 9 are stopped before
    Excalidraw hears them. The picker lists the vault's PNG, JPEG, GIF, WebP, BMP, AVIF and SVG files by
    path. The picked image goes at the centre of the view, sized as Excalidraw's own tool sizes a click-placed
    image, and is selected, as one undo step. An image over Excalidraw's own 4 MB cap is refused with
    Excalidraw's words; Excalidraw would first try to shrink it, and the plugin doesn't. Dropped and pasted
    images stay Excalidraw's.
  - **A busy tab with nothing to keep** (a line open but unchanged) reloads with no copy and no notice.
  - **A conflict copy whose name is taken** gets ` 1`, ` 2`… after the parenthesis, as New sheet numbers its
    names. If the copy can't be written, the tab keeps its work and shows the failed-write notice naming the
    copy; its next save then writes over the outside version, which Obsidian's File recovery and sync history
    still hold.
  - **New sheet** uses the ribbon icon `calculator`, and a create that fails shows
    `Couldn't create Untitled.excalimathpad: <reason>.` and opens no tab.
- 2026-11-14, [sections 8](#inside-an-obsidian-tab) and [12a](#data-protection) (after #136's hand check,
  agreed by Matheus; reopens #129's theme): a sheet's tab keeps "excalimathpad own light or dark setting",
  not Obsidian's mode, and the choice is "remembered" in `data.json`, so every sheet opens in the last mode
  chosen. Built in #137. Not asked: a tab already open keeps its mode when another tab switches.
- 2026-11-14, [sections 8](#inside-an-obsidian-tab), [14](#14-engineering-constraints) and
  [17](#17-verify-first) (#137, for Matheus to confirm on the PR):
  - **The pop-out bridge**, Matheus's choice after the pop-out probe failed ("Build an event bridge"): a sheet
    tab in a pop-out window works as in the main window. The alternatives were to refuse pop-outs with a
    message, or to leave them broken and say so.
  - **A core key passes through by Obsidian's own mark:** it stops at the view only when Obsidian's keymap has
    acted on it (`defaultPrevented`), else it goes on to the sheet, so Obsidian's keys never break whichever
    phase its keymap listens in.
  - **Also hidden:** More tools' Generate heading, left empty once Web Embed and Mermaid go, and Excalidraw's
    AI items (`aiEnabled={false}`).
  - **Open Math guide** is registered with the guide (#148), and **Print…** with M5.
- 2026-11-14, [sections 12a](#releases) and [17](#17-verify-first) (#138, found while building, for Matheus
  to confirm on the PR):
  - **The Release button pushes last:** it bumps and tags locally, runs `npm run check` on the bumped build,
    then pushes the commit and tag to `main` together, and drafts the release only after the push, so a
    failed check changes nothing on `main`.
  - **The first release is the button's minor,** from `0.0.0`; `versions.json` holds `{}` until then and
    gains `"0.1.0": "1.7.2"` in that release's commit. The commit reads "Release x.y.z".
  - Not asked: the checklist's phone or tablet step says to skip it while `manifest.json` has
    `isDesktopOnly: true`, since Obsidian there doesn't load the plugin. `isDesktopOnly` stays `true` until
    Touch (#147).
- 2026-11-14, [section 8](#sheet-panel) (#139, found while building, for Matheus to confirm on the PR):
  - **The launch tab waits for the opened sheet.** It was chosen from the sheet's first evaluation, which
    runs before the scene loads, so a sheet with errors opened on Variables (always, in a vault, where the
    file loads after the view mounts). The panel now opens once the sheet has started and all its math has
    been evaluated: in a vault, once the file is loaded; on the web, once a recovery offer is answered.
  - Not asked: the Problems badge reads "1 error" or "2 errors" to a screen reader.
- 2026-11-14, [sections 3](#3-sheet-lines-every-form), [10](#ranges-and-lists),
  [13](#13-messages), [16](#16-milestones-and-finish-line) and [17](#17-verify-first) (#140, found
  while building, for Matheus to confirm on the PR):
  - **The pump sheet's pass/fail line** is an NPSH check at the operating point, lines 32a to 36 of
    [`pump-sizing.md`](acceptance/pump-sizing.md): an open lower tank, water's vapour pressure at
    20 °C, a 5 m suction lift, 10 m of the pipe and an entry and an elbow on the suction side, and a
    datasheet NPSH required of 3.5 m at the rated flow, growing as the flow squared. It reads `OK` at
    4" and `NOT OK` at 5", about 1 m from the limit either way, so CI runs both branches: the bigger
    pipe moves the pump out on its curve, where it needs more NPSH. The line carries the green and red
    rules of section 3's example. No other expected value changes.
  - **A text list's failed points** come last in its summary, `1 failed` (section 10 said nothing).
  - **A text typed as is is a plain input,** its result cell empty (section 3 said nothing).
  - **A `;` line fails every name it assigns,** so `x1 = 5; y1 = x1 * 2` gives "has an error above"
    for both below it; the check is read before the line forms, so a range or solve can't hide one.
  - **The unit against a bare number** writes the unit's value as a result does, `can't compare
    3 m / s with 0: give the 0 a unit`, in the sheet's system and Digits. A unit's ratio that cancels
    (`(2 m) / (1 m) > 1`) is a number to math.js and still compares.
  - **`<` with text and a number** is `can't compare text with a number`; `text can only be compared
    with == or !=` is for two texts.
- 2026-11-14, [sections 4](#conditionals-and-text-typeset) and [17](#17-verify-first) (#141, found while
  building, for Matheus to confirm on the PR):
  - **A conditional in an earlier branch keeps its own brace,** inside its row: only the last branch
    flattens (section 4 said nothing of the others).
  - **A brace that is an operand sits in brackets,** `(⎧ … ⎩) + 3`, as without them `+ 3` reads as part of
    the "otherwise" row. Not in a fraction or under a root, whose bar or sign already sets it apart.
- 2026-11-14, [sections 3](#3-sheet-lines-every-form), [4](#typeset-grid) and [13](#13-messages) (#142,
  found while building, for Matheus to confirm on the PR):
  - **A comment line's clause error** shows as a math line's does in the gutter, a red `●` with the
    message on hover, and is listed in Problems and counted on its badge. The comment still shows, in the
    clause's other words: `@bold @text-red if x > 3 # Pumps` is bold. A comment has no result cell, so the
    message shows only there (section 4 said nothing).
  - **Any clause with no comment text is a blank line,** an unknown word or a rule in it too: `@blod` and
    `@bold if x > 1` are spacer rows with no error, as `@bold` is (section 3 named only a clause of
    format words).
  - **`@M` is not a word,** and the words are read as written: `@M` and `@l` are `Unknown format`. M is
    a comment's size without a word, as the table says.
  - **Suggestions read a clause at the start of a line as a comment's,** before its `#` is typed: a math
    line needs code before its `@`. There the list holds the comment words and never `if`.
- 2026-11-15, [sections 8](#sheet-panel) and [14](#14-engineering-constraints) (#143, found while building, for
  Matheus to confirm on the PR):
  - **An edit that ends from a press in the panel leaves the panel as it is.** A press in the Variables filter,
    or a row's jump, ends the edit; restoring then closed the panel under the pointer, in Chromium, when it had
    been closed before the edit. The user is working in the panel, so it stays. Esc, a press elsewhere or any key
    after the press puts the restore back.
  - **The panel-wide prevention in a vault** listens on the view's container, not the document (section 14).
  - **The Format and Symbols tabs** hold one line each until #144 and #146 fill them: "For now, format the open
    line or title with the bar beside it." and "Greek letters, operators and functions to insert at the caret
    come here."
  - **A line under a floating panel** is centred in the strip left of the panel, not in the window's middle as a
    jump centres, since the middle can still be under the panel.
- 2026-11-15, [sections 4](#touch), [8](#on-a-phone), [12a](#releases), [14](#14-engineering-constraints) and
  [17](#17-verify-first) (#147, found while building, for Matheus to confirm on the PR):
  - **Two taps aren't a `dblclick`.** The contract test "Two taps become a `dblclick`" is now "Two taps reach
    the app first": the app takes Excalidraw's own double tap, a second one-finger touch within 300 ms. Excalidraw
    doesn't ask where the two touches land, so neither does the app: two quick taps in two places on a
    selected element open the second one's line, where Excalidraw would have opened its editor.
  - **On touch a slot shows only on a selected element,** so a tap on an unselected element's slot selects
    the element; the next tap opens the unit choice (section 4 said a tap opens it).
  - **Touch is the last press in the view:** any press there, the panel's included, decides whether the hint,
    the quick keys and a selection's slots are touch's. A mouse or a pen that hovers turns them back.
  - **The quick keys' `(` types only itself** when nothing is selected, since `)` is its own key, and wraps a
    selection; `,` is tight and the quotes are a pair, as the Symbols tab's `" "` is.
  - **The bottom sheet has a ✕,** and its heights are about half the visible view, and while a line is open
    the lesser of 15 rem and 45 % of it. A line already in the strip above it isn't moved.
  - **On a tablet narrower than 1229 px the floating panel covers More tools,** as on a small desktop window:
    its ✕ closes it.
  - **`isDesktopOnly` is `false` from here,** so the device checklist can run on a beta through BRAT
    (section 12a); the checklist is in `CONTRIBUTING.md` and the release's draft.
  - **Obsidian's lint flags the lookbehind test** once `isDesktopOnly` is `false`
    (`obsidianmd/regex-lookbehind`): `hasLookbehind` builds `(?<=a)b` on purpose, so it is a named exception in
    `eslint.config.mjs`. The community scanner may flag it too; that is for the preview scan (section 17).
- 2026-11-15, [sections 4](#touch), [13](#13-messages) and [17](#17-verify-first) (found while building
  #147, proposed by the Engineer, for Matheus to confirm on the PR): **on touch the canvas hint names the taps.**
  With one math element selected, the hint under Excalidraw's toolbar read "Double-click a line or press Enter
  to edit" on every device. After a touch press it now reads "Double-tap a line, or tap Edit in Math settings":
  the double tap of [Touch](#touch), and the Format tab's **Edit**, whose panel Math settings opens. It differs
  from the Format tab's touch hint ("Double-tap a line, or tap Edit") only in naming where Edit is, since the
  canvas hint shows while the panel may be closed. A mouse or pen press brings back the desktop wording, by the
  same last-press rule. Section 17's hint check gains the touch rule, read in the touch run.
- 2026-11-15, [section 12a](#listing) (#149, agreed by Matheus on the screenshot he took): **the listing's
  screenshot shows the panel on Variables,** not Format, in Obsidian's dark theme with the sheet light.
  Matheus kept the screenshot as taken rather than retaking it. It is retaken only when the look changes a lot.
- 2026-11-15, [section 13](#13-messages) (#179, a hotfix released in 0.2.1, for Matheus to confirm on the PR):
  **a complex value with a unit is a line error,** `a complex value with a unit can't be shown`, alone
  (`z = (3 + 4i) mm`, which showed math.js's own wording) or in a list (`r_t cos(theta) i`, the half-typed
  state of `… in mm`, which took the sheet down). Its value still reaches the lines below, and a complex
  value without a unit shows as before (`2i`). A throw from outside a line's own handling is now that line's
  error and the lines below still run; the full rule for unexpected failures is #180's.
- 2026-11-15, **M4e, M5 and 1.0.0** (agreed by Matheus on the map
  [Spec for the third improvements batch and M5 Print, to 1.0.0](https://github.com/matheus-sancha/excalimathpad/issues/172), written by its last ticket,
  [#187](https://github.com/matheus-sancha/excalimathpad/issues/187)). Six items from building a true-position sheet on his work laptop become milestone M4e, built
  before M5; the two are released as 1.0.0.
  - **[Section 4](#unexpected-failures), 13, 14:** an unexpected failure stays as small as what failed
    ([#180](https://github.com/matheus-sancha/excalimathpad/issues/180), on the facts of [#173](https://github.com/matheus-sancha/excalimathpad/issues/173)).
  - **[Section 10](#ranges-and-lists), 13, 14:** `a:b` and math.js's builders take the 10,000 limit; a large
    matrix is summarised ([#189](https://github.com/matheus-sancha/excalimathpad/issues/189)).
  - **[Sections 3](#3-sheet-lines-every-form), [4](#rules-list), [7](#the-file), ADRs 0002, 0004, 0005:** a
    line's format is stored beside it, the file becomes format 2, a rule's condition is edited in the Rules
    list, and the line's field wraps ([#182](https://github.com/matheus-sancha/excalimathpad/issues/182), on [#175](https://github.com/matheus-sancha/excalimathpad/issues/175); the wrap width from [#190](https://github.com/matheus-sancha/excalimathpad/issues/190)). This reopens "the
    format travels with the line" (#119) and "the condition is typed in the line itself" (#123).
  - **[Section 8](#sheet-panel):** the panel is 320 px, resizable from 280 to 480 px, docks above 640 px plus
    its width, and an edit opens Format only when it docks ([#181](https://github.com/matheus-sancha/excalimathpad/issues/181), on [#174](https://github.com/matheus-sancha/excalimathpad/issues/174)). This replaces the 384 px
    and 1229 px of #121 and #127.
  - **[Section 4](#format-tab):** the sample is 13 px, wraps, and never draws a chart ([#185](https://github.com/matheus-sancha/excalimathpad/issues/185)). This
    replaces "as the sheet shows it" of #121.
  - **[Section 10](#plots), 13:** a point, a circle, equal scales, square, all four margins set by the app
    ([#183](https://github.com/matheus-sancha/excalimathpad/issues/183), on [#176](https://github.com/matheus-sancha/excalimathpad/issues/176) and [#177](https://github.com/matheus-sancha/excalimathpad/issues/177)). Nothing in "Not in v1" is reopened.
  - **[Section 11](#11-print), 1, 13, 16, 17:** Print is for a computer; Obsidian prints a hidden frame
    through the system dialog with no preview; the browser's own Print loses its cache; M5 is two issues
    ([#186](https://github.com/matheus-sancha/excalimathpad/issues/186)).
  - **Sections 12a, 14, 16:** the documents are split and the plugin trimmed before 1.0.0; budgets per
    plugin file and on `CONTEXT.md` from 1.0.0; this file stays the living spec ([#184](https://github.com/matheus-sancha/excalimathpad/issues/184), on [#178](https://github.com/matheus-sancha/excalimathpad/issues/178)).
  - **[Section 16](#the-finish-line), 1, 12, [15](#15-acceptance):** M6 is built after 1.0.0 and the finish
    line's PWA condition goes with it ("M6 after 1.0.0"); the true-position sheet is the second acceptance
    sheet and a Math guide example, and is the real calculation of condition 3 ("Acceptance sheet + guide;
    counts"); the order is "Safety and file format first".
  - **Written as the tickets read them, not asked one by one, for Matheus to confirm on the PR:**
    - *Failures:* "Report this bug" of the mock-up reads "Report this error".
    - *Limits:* a matrix is summarised past 20 values; the sweep's time limit is 1 s; a result that passes
      the limit from legal arguments is checked on its size.
    - *Stored format:* the key is `customData.formats`; a typed clause goes in front of the stored one, and a
      typed word that clashes with a stored one replaces it; the condition field has the line's suggestions;
      the open line shows no marker for a format; + Add rule fills the condition field, not the line; an
      empty condition is `a rule needs a condition`.
    - *Panel:* the handle's keys (← → by 16 px, Home); 28 px tabs at 280 px; the colour rows wrap at 280 px;
      the remembered open state counts only a docked panel's choice.
    - *Sample:* the title's sample is unchanged; the note reads "Its chart is drawn on the sheet." and the
      phone leaves it out; the table's scale has no floor; an error's message wraps.
    - *Plot:* the label's and the legend's wording; the six new messages; a circle always brings equal
      scales; `equal` needs x and y of one kind; the popover's three rows; the square sizes 220, 280, 360.
    - *Print:* "Print…" is the first ☰ item in the plugin; a failed build of the pages opens no dialog and
      shows `The pages couldn't be built, so nothing was printed.`; the plugin may set the window's title
      while the dialog is open; the frame's styles pass the audit; the web app may share the frame; the Page
      row fits at 280 px.
    - *Follow and wrap (with `0.2.1`):* the scroll isn't animated; a pan by hand is left alone until the
      caret next moves; a too-small visible area centres the row; the suggestion list doesn't move the view;
      a Format tab field doesn't move the view; the wrap width is measured once.
    - *Cuts:* math.js's help texts and Plot by name reach the web app too; 150 ms is the plugin's own figure
      on the work laptop, the phone recorded only; the module files follow `CONTEXT.md`'s entries.
    - *This ticket's own:* the milestone's name, "Room to work"; M4e ships as the beta `0.3.0`; Plot by name
      is done in the plot issue (#200), not the plugin-cuts issue; the budgets are set by a release issue
      after M5 (#203), not by M4e's last issue, since M5 adds code; the prototypes under `docs/research/` are
      deleted by the first issue; the true-position reference values (`TP` 0.1887 mm, `used` 75.47,
      `margin` 0.06132 mm) were worked by hand, not run.
- 2026-11-15, [sections 4](#while-editing-a-line) and [8](#8-app-chrome) ([#191](https://github.com/matheus-sancha/excalimathpad/issues/191), a fix released in 0.2.1; the rule
  agreed by Matheus in [#190](https://github.com/matheus-sancha/excalimathpad/issues/190)): **the math is always
  drawn on its box, and the view follows the caret.**
  - **The overlay can't be scrolled by the browser.** It was `overflow: hidden`, which the browser still scrolls
    to show the focused field: typing the 146-character plot line near the window's edge drew the math 671 px
    left of its box, and Enter 453 px above it, where it stayed after Esc.
  - **One follow rule** replaces the two scrolls of M4d (a line under a floating panel centred in the strip left
    of it; a line on a phone centred above the bottom sheet): the least distance that puts the caret's row inside
    the visible area less 48 px, in section 4. A jump from the panel still centres.
  - **Found while building, not asked; say on the PR if any is wrong:**
    - *A docked panel counts too.* Excalidraw draws its docked sidebar over the canvas's right (at 1366 px the
      panel covers x 990 to 1366 of the canvas), so the visible area ends at the panel's left edge whether it
      floats or is docked. #190 said "less a floating Sheet panel".
    - *The caret's row is the open field,* not the result beside it. A field wider than the visible area less
      both margins is followed at its caret; one that fits is kept whole in view.
    - *The caret is followed again when the visible area changes during an edit:* when the panel the edit opened
      is drawn, and on a phone when the keyboard or the sheet resizes (as M4d did). A window resize on a desktop
      doesn't.
    - *Only while the open field has the keyboard,* which is how a Format tab field doesn't move the view. A
      Format tab button rewrites the line with the field still focused, so it follows like a keystroke.
    - *← → Home End and a click in the field don't follow.* #190 lists opening, Enter, ↑ ↓ and typing; the next
      keystroke brings the caret back.
    - *Where a browser has no `overflow: clip`* the overlay stays `hidden` and each scroll is put back at once.
  - **Not verified:** Obsidian itself, a phone's real keyboard, Firefox and Safari. The follow run is headless
    Chromium at 1366 × 768 and 1000 × 800 against the built plugin; the phone's bottom sheet is the touch run's.
- 2026-11-16, [section 12a](#releases) (found at the release, agreed by Matheus): **the two fixes are one
  release, `0.2.1`.** The crash fix (#179) was merged but never released by itself, so the Release button's
  patch after the overlay fix ([#191](https://github.com/matheus-sancha/excalimathpad/issues/191)) made `0.2.1`
  with both in it. Every "0.2.2" in this spec, `CONTEXT.md` and the code's comments now reads 0.2.1; there is no
  0.2.2. The issues and the pull request for #191 still say 0.2.2 in their titles and text.
- 2026-11-16, [section 4](#while-editing-a-line) ([#196](https://github.com/matheus-sancha/excalimathpad/issues/196), found while building, for Matheus to confirm on the
  PR): **the wrap width is measured a second time, once, when the panel the edit opened is drawn.** "The wrap
  width is measured once" (#190) would measure it before the Format tab's panel covers the canvas's right, so
  the first line opened would wrap under the panel. A pan or a resize during the edit still doesn't re-wrap.
  Written into the section as the build read it, not changes to an agreed rule, and also for him to confirm:
  the field shares the wrap width with its row's result and note columns as they are when the line opens, so a
  result that grows while typing (an error's message) can widen the element until the line closes, and the
  field's rows don't jump at each keystroke; the field is never narrower than about 20 characters, as before;
  the wrap width is in the sheet's px (240 px at 100 % zoom); a caret at a row's end counts as on the next row
  for ↑ and ↓; the suggestion list opens under the caret's row.
