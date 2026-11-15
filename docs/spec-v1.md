# Excalimathpad v1 spec

**Status:** agreed 2026-11-03 · living
until v1 is done

## 1. What v1 is, and what it isn't

Excalimathpad v1 is a calc sheet for anyone, built around Matheus's own engineering
work, with no server; it is free and best effort. It is the Excalidraw whiteboard
with live, unit-aware math on it. You type math where you want it on the canvas,
see it typeset with results and units, edit an input and everything below
recalculates, save the sheet to a file, and print it to PDF. It installs as an
offline app. It runs on Chrome and Edge on desktop.

From M4d it has a second home: an **Obsidian community plugin** that opens
`.excalimathpad` files from a vault in its own tab, on desktop, phone and tablet,
built from the same source ([section 12a](#12a-obsidian-plugin)). The web app stays.
Both homes read and write the same file.

**How to read this spec:**

- This spec says what v1 **will be**, and it wins over the tickets it came from.
  Each section ends with those tickets, for the reasoning.
- [`CONTEXT.md`](../CONTEXT.md) says what the code **is today**. Each Engineer PR
  moves into it the terms and rules it makes true, using this spec's names.
- [`docs/adr/`](adr/) says **why**, for choices that are hard to reverse. An ADR
  item marked with a milestone isn't built yet.
- A change Matheus agrees is edited in here, with a line under
  [Changes since agreed](#changes-since-agreed), in the PR that needs it. Behaviour
  doesn't change without this file changing. When the finish line is met, the
  status becomes "v1 done, historical".

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
| Print | Printing a selection, frame or viewport; a scale setting; page guides on the canvas |
| Editing | Cancelling a line edit; placing the caret at the clicked character; Greek or operator characters in the source (`ρ`, `≤`) and new operators (integral, derivative): the Symbols tab types the text the engine already reads |
| Help | A Help tab in the panel, an example sheet, or a PDF guide: the Math guide is one Markdown file shown in a dialog |
| Files | Excalidraw's image export; a supported round trip through plain Excalidraw; several sheets in one window; embedding a sheet in an Obsidian note (`![[…]]`, as a picture or a live sheet); resolving links between sheets, or to notes, from inside a sheet |
| Platforms | Touch and mobile layouts in the web app; browsers other than Chrome and Edge on desktop (a save and open fallback exists, untested); the plugin on iOS below 16.4; Excalidraw's embeds and library browsing in the plugin; the Sheet panel as a view in Obsidian's sidebar; a plugin settings tab |

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
| **Anchor** | The marked Excalidraw rectangle that carries a math element. Its `customData` holds `kind`, `source` and, each optional, `title`, `titleFormat` and `width` |
| **Line** | One string of an element's source: one statement. See [section 3](#3-sheet-lines-every-form) for its forms |
| **Typeset row** | One line on screen: *gutter · equation (name · `≔` · expression, plus guess, search range or step) · result · note* |
| **Line edit** | The one line shown as raw source, held as *anchor id + line index*. UI state |
| **Line commit** | The moment an edit leaves a line whose text differs from the scene. Writes the source once |
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
| **Format** | A line's `@` words, after its code and before its note: bold, underline, one text colour, one highlight. A comment line's also take italic off and a size (M4d) |
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
saved before M4d reads as before. The clause is text in the line, so split, join, copy,
paste, undo and save carry it, and nothing goes into `customData`.

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
  clause; the condition is always typed in the line.

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
   math.js on its own, after the line has run.
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
source. Each write is one line commit.

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

- The line becomes a one-line source field over the line's equation space, starting
  where the typeset line did, so the text doesn't move. Its result cell shows the live result as plain text, and its note cell is
  empty because the note is in the field.
- The sheet re-runs on every keystroke. Every other line stays typeset and updates
  live.
- **Enter** splits the line at the caret and continues on the new line below. At the
  end of a line, that opens an empty line.
- **↑ / ↓** move the edit to the line above or below.
- **↑ on the first line** goes to the title, and so does the Format tab's **Edit title ↑**
  link (before M4d, the bar's **Title** button), from any line. If the element has no
  title, this opens an empty one. In the title, **↓** or **Enter** go to the first line,
  and Esc or a click outside leave. The title keeps what was typed, trimmed; an empty one
  removes the header.
- **Backspace** at the start joins the line to the one above.
- A **single click on another line** of the element moves the edit there.
- **Formatting** is done in the [Format tab](#format-tab), which opens when an edit starts
  (M4d). Until M4d a floating **format bar** beside the open line did it; the bar and the
  title's bar are removed. **Ctrl+B** and **Ctrl+U** toggle bold and underline from the
  field, on a math line, a comment line and the title. **Ctrl+I** toggles italic on a
  comment line (writing or removing `@upright`) and on the title, and does nothing on a
  math line. A clause typed by hand shows live, like any other typing.
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
  split it yourself with Enter.
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
- **Height is always automatic.** It follows the wrapped content.

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

### Rules list

From M4d, on a math line only, under the Format tab's rows. Its header says "first true wins,
top to bottom". No field in the panel takes the keyboard, so the line never leaves while rules
are edited: **the condition is typed in the line itself**, with its suggestions and units.

Each row is one rule, in the line's order, and holds no-focus controls:

- a **format chip**, drawn in the rule's format, which opens the Text, Highlight and Style
  rows for that rule under it. A rule's last property can't be taken off: its "none" is
  disabled, and ✕ removes the rule;
- its **condition**, read-only, as typed; a click puts the caret at the end of that
  condition in the line;
- **↑ ↓** to reorder, and **✕** to remove;
- its **live state**, beside the condition: "true" or "false"; on a list "12 of 30 points",
  on a table "4 of 10 rows"; "true, overridden" when every property it sets is won by a
  rule above; or `⚠` and the reason, in amber ("units of different kinds", "not true or
  false", an undefined name), the same warning the line carries.

**+ Add rule** writes ` @text-red if <name> ` at the end of the clause, before any note, and
puts the caret after it, so the user types `> 3 m/s`. `<name>` is the name the line defines,
or `result` on a line with none; on a table line it writes ` @text-red if ` alone. The new
rule is last, so lowest in priority, and its row opens its format controls at once.

- A row the list writes is one joined word and one condition
  ([section 3](#3-sheet-lines-every-form)). A rule typed the old way is its own row and is
  never rewritten unless changed.
- Add, remove, reorder and each format change is one press: one line commit, the line kept
  open. A press made with the caret inside the clause puts it back at the same rule's
  condition. Typing a condition is ordinary typing, under the field's own Ctrl+Z.

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
  step. The line stays open. The field's text undo starts fresh after it, because the app
  rewrote the field.
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

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [ { "customData": { "kind": "math", "source": "D = 102.3 mm\n…" } } ],
  "appState": { },
  "files": { },
  "excalimathpad": {
    "format": 1,
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
the close button all fit its width (the panel is 384 px wide, since Excalidraw's own 302 px is too narrow for four tabs), so the close button is never cut by the window. Open at
launch on a wide window, on Variables, or on Problems
if the opened sheet has any errors (from M4d; before, any problem). Open or closed is
remembered per browser, not in the file. On a small window (1229 px or less) it floats over
the canvas, and closes after a jump or a click on the canvas.

**From M4d the panel has six tabs,** in the order **Format, Symbols, Variables, Problems,
Constants, Settings**. Each is an icon with a tooltip; the active tab also shows its name.
The Problems badge sits on its icon. Format is the [Format tab](#format-tab) and Symbols the
[Symbols tab](#symbols-tab).

- **An edit opens the panel on Format.** When a line or the title opens and none was open,
  the panel opens on Format, or switches to it. Moving within the edit keeps whichever tab
  shows, so a tab picked during the edit stays. When the edit ends, the panel returns to how
  it was: closed if it was, else its tab. Closed during an edit, it stays closed until the
  next. The automatic open and restore are never remembered as the user's choice.
- **On a small window** the same rule holds. The fields carry `data-prevent-outside-click`,
  so a press in them keeps the floating panel; a press on the canvas still closes it, and
  the next edit reopens it. If the open line would sit under the panel, the view scrolls it
  clear, as a jump does.
- **A press in the panel never leaves the line.** Its controls that act on the open line
  are no-focus buttons. A typed field in it (a filter) takes focus, and so leaves an open
  line. A focused control in the panel never passes a key to Excalidraw: Delete on a focused
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
  wider than 1229 px and floating when narrower, so a split pane floats it. Each tab has its
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

From M4d, in the plugin on a phone (`Platform.isPhone`). A tablet follows the 1229 px rule
above.

- **The Sheet panel is a bottom sheet** across the view instead of the right sidebar. While a
  line is open it sits just above the on-screen keyboard and is short: the quick keys, the
  tab icons and a few rows of the tab, which scroll inside it. With no line open it is
  taller, about half the view. Its ✕ closes it, as Math settings does. The tab contents are
  the same components.
- The open-then-restore rule holds, and the view scrolls the open line into the space left
  above the sheet and the keyboard.
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

Decided in: [print](https://github.com/matheus-sancha/excalimathpad/issues/21),
[Chromium PDF](https://github.com/matheus-sancha/excalimathpad/issues/34),
[comments](https://github.com/matheus-sancha/excalimathpad/issues/36),
[panel](https://github.com/matheus-sancha/excalimathpad/issues/32),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38),
[text colours](https://github.com/matheus-sancha/excalimathpad/issues/93).

## 12. Offline PWA

Built in M6. The app installs and works fully offline, and a `.excalimathpad` file opens from Windows.

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
    with why it can't load).
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
  result, close and reopen, and repeat on one phone or tablet.
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

### Listing

- **Manifest and listing:** id `excalimathpad` (fixed once published), name "Excalimathpad",
  description (172 characters): "Open and edit .excalimathpad calc sheets: an Excalidraw
  whiteboard with live, unit-aware math that recalculates as you edit. Works fully offline; makes
  no network requests."
- **The README, users first** (it is the listing page): the name and that one line; a screenshot
  of a sheet in Obsidian (`.github/assets/obsidian.png`, desktop, light theme, the panel on
  Format, taken by Matheus for the version submitted); **Get it** (Obsidian's Community plugins,
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
| Browser's Print with an empty cache | `Use Print… from the app's menu` | M5 |

**Panel** (M4d)

| When | Message | Arrives |
|---|---|---|
| Format tab, nothing open | `Open a line or a title to format it: double-click it, or select its element and press Enter.` (on touch: `Double-tap a line, or tap Edit`) | M4d |
| Format tab, a blank line | `This line takes no format.` | M4d |
| A true rule overriding a pressed property | `A rule sets the text colour while v > 3 m/s.` | M4d |
| Symbols tab, no line open | `Open a line to insert` | M4d |

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
  underline) and `writeNewRule`; each rule carries its `start` and `end` in the line, so the list puts
  the caret at a condition's end and a press follows the rule the caret was in. Each rule's live state is
  `SheetLine.ruleStates`. A comment line's clause reads joined words too.
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

## 15. Acceptance

v1 is judged on the [pump sheet](acceptance/pump-sizing.md), with
[`pump-sizing.py`](acceptance/pump-sizing.py) as its independent reference.

The four steps:

1. Type the sheet and check the values.
2. Edit `D` to `128.2 mm`, and everything recalculates to the 5" column.
3. Save, close, reopen: same layout, sources and results.
4. Print to PDF: math typeset, table and plot on the pages, nothing cut mid-line.

**Pass bar:** every result matches the reference to 4 significant figures.

Decided in: [acceptance](https://github.com/matheus-sancha/excalimathpad/issues/9),
[comments](https://github.com/matheus-sancha/excalimathpad/issues/36),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38).

## 16. Milestones and finish line

v1 is built in nine milestones, each usable on a real sheet, with a saved typeset sheet first. The existing
spike is M0, done.

| Milestone | What it lets Matheus do | Sections |
|---|---|---|
| **M1 Keepable sheet** | Type a typeset sheet, edit it line by line, undo, save it and reopen it | [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [6](#6-undo), [7](#7-file-and-save), [8](#8-app-chrome) |
| **M2 Units & panel** | Read results in the right units and digits, see problems and warnings, change sheet settings | [5](#5-results-units-and-numbers), [8](#8-app-chrome) |
| **M3 Solve** | Solve an equation on a line, including as a function and a solve calling a solve | [9](#9-solve) |
| **M4 Ranges & plots** | Run lines over a range, draw tables and plots | [10](#10-ranges-tables-plots) |
| **M4b Hosted build** | Open the app at a public address on a second machine | [12](#hosted-build) |
| **M4c Improvements** | Find every root in a range, colour text and results, format by rule, set an element's width, format a title | [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [9](#9-solve), [10](#10-ranges-tables-plots) |
| **M4d Plugin & panel** | Open and edit sheets in Obsidian on the work laptop, phone and tablet; format from the panel, with rules; insert symbols; write checks that say "Approved"; format comment lines; read the Math guide | [1](#1-what-v1-is-and-what-it-isnt), [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [5](#5-results-units-and-numbers), [7](#a-sheet-in-a-vault), [8](#8-app-chrome), [12a](#12a-obsidian-plugin), [13](#13-messages) |
| **M5 Print** | Print the sheet to clean PDF pages | [11](#11-print) |
| **M6 Offline PWA** | Install the app, work offline, open a `.excalimathpad` file from Windows | [12](#12-offline-pwa) |

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

**M5's issue order** (M4's five are built, #74 to #78; M5 follows M4d):

1. Page row and page breaks (#80)
2. Print view and Print… (Ctrl+P) (#81)
3. The browser's own Print (#82)

The breaks come first: they are one pure function from boxes and the Page setting, so every break rule is
tested before anything draws a page. Print… comes before the browser's own Print, which builds the same pages
from a cache and only adds the `beforeprint` route and its fallback.

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
| M5 | none new | Steps 3-4: save and reopen, print to PDF |
| M6 | none | None from the sheet: finish-line condition 2 checks it |

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

### The finish line

**v1 is done when all three hold:**

1. The pump sheet passes steps 1-4.
2. The installed PWA opens a `.excalimathpad` file and works offline.
3. Matheus has used it for one real calculation other than the pump sheet. This can happen any time after M5.

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

Decided in: [milestones](https://github.com/matheus-sancha/excalimathpad/issues/37),
[M4c](https://github.com/matheus-sancha/excalimathpad/issues/97),
[M4d](https://github.com/matheus-sancha/excalimathpad/issues/125).

## 17. Verify first

Everything the tickets marked untested. Check each early in its milestone, and record the result here or in a
Changes line if it changes behaviour.

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
- The address opening through the work laptop's network.
- Excalidraw's fonts on the work laptop. No asset path is set in `src/`, so they are expected to come from
  Excalidraw's CDN, a second host a filter could block. Read from the code, not seen in a browser.
- The file pickers under the work laptop's browser policy, and the download and file-input fallback if they
  are turned off.

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
- The six text colours under the dark theme's filter, on the canvas and on each highlight: still readable.
- A text colour reaching KaTeX's glyphs in the equation and the result, as bold had to (#63).
- The suggestions list after `@`.
- A title at XL: the header's height, the floor it sets, and the anchor following both. **Passed (#111),**
  in Chromium with real keys and mouse: "Pump @ 50 Hz #2" at XL, centred, red on yellow, gave a 42 px
  header; the anchor grew to fit, and the title kept its characters. Every press on the title's bar
  left the title field focused.

**M4c, also checked in Chromium (#107, #109, #111)**

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
  ([section 14](#14-engineering-constraints)) every check passes in the pop-out, and in a tab opened in the
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
  outweighs the app's one-class rules. Fixed by the view's CSS guard ([12a](#one-source-two-builds)) and
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
  with GitHub connected, so it is his step, on #149's branch before submission ([Listing](#listing)), and
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

**M5**

- Excalidraw text in Nunito on the pump sheet's heading.
- Staggered side-by-side elements and the no-clean-gap fallback.
- A drawing taller than a page, dark mode, and images in drawings.
- Taking over Ctrl+P with real keys, and a person at an open dialog.
- KaTeX 0.16.47, which the repo resolves, against the 0.19.1 the PDF probe used.
- A hand-set Scale in the dialog, other systems and real printers.
- The browser's own Print right after a drawing edit, which could show a slightly old drawing.

**M6**

- Installing, the Windows "Open with" association, and saving back to an opened file.
- The service worker precaching the lazy plot and KaTeX chunks.

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
