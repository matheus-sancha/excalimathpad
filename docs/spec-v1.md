# Excalimathpad v1 spec

**Status:** agreed 2026-11-03 · living
until v1 is done

## 1. What v1 is, and what it isn't

Excalimathpad v1 is a calc sheet for one user, in the browser, with no server: the
Excalidraw whiteboard with live, unit-aware math on it. You type math where you
want it on the canvas, see it typeset with results and units, edit an input and
everything below recalculates, save the sheet to a file, and print it to PDF. It
installs as an offline app. It runs on Chrome and Edge on desktop.

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
| Solve | Systems of equations; bounds or intervals on the unknown; a tolerance setting |
| Units | Units defined by a sheet; scaled display units (`1000 Pa`) |
| Numbers | Digits per result; thousands separators |
| Lists | Two lists forming a grid (cartesian product) |
| Plots | A second y axis; zoom, pan or hover values on curves; renamed axis titles; chosen colours |
| Print | Printing a selection, frame or viewport; a scale setting; page guides on the canvas |
| Editing | Cancelling a line edit; placing the caret at the clicked character |
| Files | Excalidraw's image export; a supported round trip through plain Excalidraw; several sheets in one window |
| Platforms | Touch and mobile layouts; browsers other than Chrome and Edge on desktop (a save and open fallback exists, untested) |

v1 makes no promises on a touch device. A double tap on a math element would still
add a text label to its anchor, and Add math and Enter need a keyboard or button.

Decided in: [map](https://github.com/matheus-sancha/excalimathpad/issues/8),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38).

## 2. Terms and invariants

One name per concept, used the same in conversation, code, tests, docs and the UI.

### Terms

| Term | Means |
|---|---|
| **Sheet** | All live math elements in reading order, plus drawings and settings. The unit of evaluation |
| **Reading order** | By the top of each anchor's visual bounds, then its left, then its id. Derived, never stored |
| **Math element** | A block of source lines anchored at a scene position, shown as a typeset grid |
| **Anchor** | The marked Excalidraw rectangle that carries a math element. Its `customData` holds `kind` and `source` |
| **Line** | One string of an element's source: one statement. See [section 3](#3-sheet-lines-every-form) for its forms |
| **Typeset row** | One line on screen: *gutter · name · `≔` · expression (+ guess or step) · result · note* |
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
| **Solve line** | A line with `= solve`. Defines a **solved value** or, with parameters, a **solve function** |
| **Equation, residual** | `lhs = rhs` on a solve line. The solver sees `lhs - rhs` |
| **Unknown** | A name bound only inside its own solve line's equation |
| **Guess** | An expression evaluated each time the solve runs. It gives the search's start and the unknown's dimension |
| **Solve details** | Method, iterations, final residual and bracket. Shown on hover, never saved |
| **Range** | `a .. b step s`. Evaluates to a list |
| **List** | An ordered sequence of point results (value or error), all of one kind |
| **Iterating line** | A line that mentions a list outside an aggregate. Runs once per point |
| **Aggregate** | `min`, `max`, `sum`, `mean`, `count`. Takes a list, gives one value |
| **Table line, plot line** | `table(…)` and `plot(…)`. Display only; each defines no name and draws under itself |
| **Clause** | A comma-separated setting after a plot line or solve line, such as `mark Q_op` or `guess Q = 15 L/s` |
| **Series, mark** | One list drawn on a plot; a value of the x kind drawn as a guide, dot and label |
| **Comment line, note** | A line starting with `#`; the text after `#` on a line with code |
| **Sheet file** | Excalidraw scene JSON + the `excalimathpad` block. The sheet's only durable form |
| **Dirty** | The scene or settings changed since the last save or open |
| **Recovery copy** | The whole sheet file, its name and its file handle in IndexedDB. Exists only while dirty |
| **Sheet panel** | Excalidraw's sidebar with the tabs Variables, Problems and Settings |
| **Placing** | The UI mode between Add math and the click that creates the anchor |
| **Print pages** | The sheet laid out for its Page setting. Computed at print time, never stored |
| **Unbreakable box** | A math line, table row, plot, or drawing that fits a page. A break doesn't pass through one |
| **Pump sheet** | The [acceptance sheet](acceptance/pump-sizing.md) |

**Retired names:** *placeholder* (unit slot or display unit), *sheet default*
(unit system), *solve block* (solve line), *side panel* (Sheet panel), *pipe-flow
acceptance sheet* (pump sheet).

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
- After every evaluation and every pointer release, an anchor's size equals its
  content size. A size write never adds an undo step and never changes a value.
- Everything visible in an upright element is inside its anchor, so it can be
  clicked and dragged.
- After every scene change, an anchor has the fixed style. Only `opacity` varies. A
  restored style adds no undo step.
- An element's math, on screen and in print, has its anchor's opacity.
- Hover content is never printed or saved.
- Comments and notes never change a result. They live only in the line's source,
  and a note is always the last part of a line.

**Units and numbers**

- A display unit, Digits and the unit system never change a value, only how it
  shows. Lines below use the full value.
- A result with no display unit always follows the unit system. A chosen unit is
  always marked (tint).
- Every plain number has no more significant digits than Digits, and no digit that
  rounding invented.
- The source a user typed is never rewritten, except for what a slot or popover
  writes when asked.

**Solve**

- The residual's dimension is checked at the guess. A mismatch is an error at any
  trial point.
- A converged result lies inside a bracket of width no more than the fixed
  tolerance. Anything else is an error, never a value.
- The same sheet gives the same solve.
- A solved value runs once per run, at its line. A solve function runs at every
  call, and its definition can fail only for syntax.

**Functions and lists**

- A definition never has a value or a display unit. Whether a function's result can
  be computed is decided at each call, and any error lands on the calling line.
- A warning never changes a result.
- A list's length is fixed by its range. A failed point never removes or shifts
  other points: index *i* is always the *i*-th value of the range.
- Iteration happens at the line, never inside a function body.
- A plot shows one kind on y and one on x. Clauses never change a value.

**Undo and files**

- A line commit's source change is exactly one undo step, and keystrokes are none. A commit
  can also record a nudge or Link edit before it as a step of its own ([section 6](#6-undo)).
- Sheet undo never runs while a line is being edited.
- A source write is never `EVENTUALLY` or the default capture.
- Settings changes never enter Excalidraw's undo history.
- A file is written only by Save or Save as.
- The app never writes a file whose `format` is newer than its own, and never opens
  one.
- Excalidraw's own file and export actions are never reachable.
- The Sheet panel shows only what the last evaluation produced.
- The same scene, results and Page give the same print pages. Printing never changes
  the scene.

Decided in: the Model part of each ticket in [section 18](#18-decision-index).

## 3. Sheet lines: every form

Built in M1 to M4, as tagged below. Assignment is plain `=`; `:=` isn't accepted.
Typeset, an assignment shows `≔`. One line is one statement.

| Form | Example | Built in | Result cell |
|---|---|---|---|
| Blank | an empty line, or a bare `#` | M1 | Empty; a spacer row |
| Comment line | `# Water at 20 C` | M1 | None; one text cell spans the row |
| Assignment | `v_d = v(Q_d)` | M0, M1 | Value |
| Plain input | `D = 102.3 mm` | M0, M1 | Empty, unless it has a display unit |
| Bare expression | `2 * pi` | M0, M1 | Value; name and `≔` cells empty |
| Function definition | `Hp(Q) = H_0 - (H_0 - H_r) (Q/Q_r)^2` | M0, M1 | Empty; problems only |
| Solve line, value | `Q_op = solve Hp(Q) = Hs(Q), guess Q = 15 L/s` | M3 | Value |
| Solve line, function | `f(Re, r) = solve …, guess f = 0.02` | M3 | Empty; problems only |
| Range | `Q_s = 1 L/s .. 30 L/s step 1 L/s` | M4 | List summary |
| Table line | `table(Q_s, Hs(Q_s), Hp(Q_s))` | M4 | Empty; rows draw under the line |
| Plot line | `plot(Q_s, Hs(Q_s), Hp(Q_s)), mark Q_op` | M4 | Empty; the chart draws under the line |

Any form with code can end with a `# note`. Any line with a value can end with
`in <unit>`, on the left of the note:

```
dP_pipe = f_d * (L_p/D) rho v_d^2 / 2 in kPa # friction only
```

A solve line follows the same rule: `in <unit>` comes last, after the guess. It sets the
result's display unit and doesn't convert the guess. A clause added later goes before it.

```
Q_op = solve Hp(Q) = Hs(Q), guess Q = 15 L/s in L/s
```

**How a line is read, in this order:**

1. **Comment:** split at the first `#` outside a string. Nothing after it is read.
2. **Display unit:** take off a trailing top-level `in` or `to` whose target is a
   pure unit. The target is read outside the sheet's scope, so a variable named `K`
   doesn't change what `in K` means. A conversion inside the expression
   (`(a in bar) + …`) stays math.js's own.
3. **Form:** recognise solve (`= solve`), range (`..`), `table(` and `plot(`, and
   take off their clauses.
4. **The rest goes to math.js.**

**Rules for what the app writes:** the unit slot and the plot popover write before
the `#`, so a line reads `D = 102.3 mm in cm # 4" Sch 40`. Neither puts the line in
source, and each write is one line commit.

**Parsing notes that catch people:**

- A name directly before `(` is a function call. `f_d (L_p/D)` errors if `f_d` is a
  number; write `f_d * (L_p/D)`. See [section 13](#13-messages) for the message.
  `(…)(…)` and `2 (…)` multiply as usual.
- `min` is a math.js function, so litres per minute is `L/minute`.
- `table`, `plot` and `solve` are reserved. Assigning to one is an error on the line.

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
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38).

## 4. Math element: look and editing

Built in M1. Hover details arrive with M3; the unit slot with M2.

### Typeset grid

- A math element is a **worksheet block**. Lines form a grid aligned on `≔`: names
  right-aligned, then `≔`, then expressions left-aligned.
- A row is as tall as its tallest cell.
- **Result column:** one per element, right of its longest expression, after a thin
  column rule. A value shows typeset, without a leading `=`. Columns aren't lined up
  across elements.
- **Note column:** one per element, right of the result column, in the same text
  style as a comment line. A plain input's empty result cell keeps its note in line
  with the others.
- **Comment line:** plain literal text from the row's left edge, ignoring the
  columns. No formatting, typeset math or `##` headings.
- **Empty cells:** a plain input and a function definition leave the result cell
  empty. A bare expression leaves name and `≔` empty.
- **Solve line:** `Q_op ≔ solve H_p(Q) = H_s(Q)`, with the guess small and grey after
  the equation, inside the expression cell.
- **Range line:** `Q_s ≔ 1 L/s … 30 L/s`, with the step small and grey after it.
- `in <unit>` and plot clauses don't show when typeset. They show in source.

### Typesetting names

Lines typeset through math.js `toTex` with one custom handler, then KaTeX.

- Text after the first `_` is the subscript: upright if multi-letter, italic if one
  letter or digits (`L_pipe`, `H_0`, `Q_s`).
- A Greek word becomes its letter when it is the whole base or is followed by a
  capital (`rho_w` → ρ_w, `DeltaP` → ΔP).
- Other multi-letter names are one italic word (`Re`, not R·e).
- Parameters follow the same rule as names in the body.
- Definitions use `≔`.
- Results typeset from the text `math.format` shows: number and unit split, unit
  typeset.
- Micro shows as `µm`, not math.js's `um`.

### Problems

| Problem | Gutter | Elsewhere |
|---|---|---|
| Error | Red `●` | Its message takes the result cell, in red |
| Line that doesn't parse | Red `●` | Raw source in red with a wavy underline, in place of the typeset expression; any `#` part stays in it, so no note cell |
| Warning | Amber `⚠` | Message on hover over the mark; the line's value still shows |

**An error is capped** at about 320 px of the result column and ends in an ellipsis.
The full text is on hover and in the Problems tab.

### Solve details

Hovering the result of a solve line (`Q_op`), or of a line that is just one call to a
solve function (`f_d = f(Re_d, eps/D)`), shows the method, iterations, residual with
its unit, and the bracket. A dotted underline marks a result that has details. A line
where the solve runs deeper (`H_d = Hs(Q_d)`) and a solve function's definition show
none. Hover is screen-only.

### Gestures

- **Single click** selects the anchor. **Dragging from anywhere** on it moves it.
  There is no grip. Both are Excalidraw's own behaviour.
- **Double-click on a line** edits that line, with the caret at the end. A chart or
  table counts as part of its line's row. Excalidraw's own first click decides whose
  double-click it is: math's when it selected the element, on its own or through its
  group, so a **grouped** element edits straight away. A **drawing on top** of the
  element took that click, so it keeps Excalidraw's double-click (its label). A
  **locked** element still edits: the lock holds its position only.
- **Arrows bind** to a math element, even when drawn from inside it, and follow it
  when it moves.
- **Enter** on one selected math element edits its **last line**, with the caret at
  the end.
- The rotate handle works. **Resize handles snap back** to the fit, in place.

### While editing a line

- The line becomes a one-line source field spanning the name, `≔` and expression
  cells. Its result cell shows the live result as plain text, and its note cell is
  empty because the note is in the field.
- The sheet re-runs on every keystroke. Every other line stays typeset and updates
  live.
- **Enter** splits the line at the caret and continues on the new line below. At the
  end of a line, that opens an empty line.
- **↑ / ↓** move the edit to the line above or below.
- **Backspace** at the start joins the line to the one above.
- A **single click on another line** of the element moves the edit there.

**Leaving:**

- **Esc** goes back to typeset with the element still selected. A second **Esc**
  deselects everything whenever the selection includes a math element, mixed
  selections too. Excalidraw doesn't do this itself, so the app does. A selection of
  drawings only keeps Excalidraw's Esc.
- A **click outside**, or starting a drag on the element, also leaves.
- Leaving always keeps what was typed. There is no cancel.
- An element left with no text is removed when the edit leaves it, whether new or
  emptied. An element holding only comments isn't empty.

### Size

A math element's box always fits its content. The app measures the content and writes
the size to the anchor, live, while typing too.

- **Counts toward width:** name, `≔` and expression cells, a solve's guess, a range's
  step, result values, list summaries, tables, charts, notes, comments and the gutter.
- **Doesn't:** error text past its cap.
- **A very long line widens the element.** One source line stays one row. You can
  split it yourself with Enter.
- **The top-left corner stays put,** and the box grows right and down. An upright
  element's size change can't change reading order or re-run the sheet. A rotated
  element keeps its rotated top-left corner in place, which can change its visual top
  and so reading order.
- **Empty content:** a new element's field has a minimum width of about 240 px. An
  empty line elsewhere keeps its one-row height.
- A size write doesn't mark the sheet dirty. Opening a sheet measures again.

### Selected math element

| Selection | Panel | Hint |
|---|---|---|
| One math element | Opacity, Layers, Actions | "Double-click a line or press Enter to edit" |
| Several math elements | Opacity, Layers, Align, Actions | Excalidraw's own |
| Math and drawings | Excalidraw's full panel; opacity reaches the math, other styles only the drawings | Excalidraw's own |

Actions stays whole, including Link. The panel can still cover math at the left of the
view; that's accepted.

**Anchor style is fixed, except opacity:** stroke `#868e96`, dashed, thin; background
`#ffffff01`, solid; roughness 0. If paste styles, a mixed selection or a hand-edited
file changes these, the app writes them back with no undo step.

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
[chrome](https://github.com/matheus-sancha/excalimathpad/issues/17).

## 5. Results: units and numbers

Built in M2.

### Shown result

A shown result is the line's value in its display unit, balanced if the kinds differ;
else in the unit system for its kind; else in composed base units of the system.

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
- **A chosen unit is tinted**, so it stands out after the system changes. The tint
  doesn't print.
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
- **Not undo steps:** keystrokes, size writes, style restores, settings changes and
  results.

Decided in: [undo steps](https://github.com/matheus-sancha/excalimathpad/issues/11),
[undo research](https://github.com/matheus-sancha/excalimathpad/issues/10),
[auto-size](https://github.com/matheus-sancha/excalimathpad/issues/29),
[chrome](https://github.com/matheus-sancha/excalimathpad/issues/17).

## 7. File and save

Built in M1. Settings fill in as M2 and M5 add them.

### The file

A sheet is Excalidraw's own JSON with one extra top-level block, saved as
`.excalimathpad`. Each anchor's source is in its `customData`.

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
      "page": { "size": "A4", "orientation": "portrait" }
    }
  }
}
```

- `system` is `si-prefixed`, `si-base` or `uscs`. A non-empty `custom` makes it Custom.
  `size` is `A4` or `Letter`, and `orientation` is `portrait` or `landscape`.
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

Decided in: [file](https://github.com/matheus-sancha/excalimathpad/issues/12),
[undo research](https://github.com/matheus-sancha/excalimathpad/issues/10),
[unit slot](https://github.com/matheus-sancha/excalimathpad/issues/16),
[numbers](https://github.com/matheus-sancha/excalimathpad/issues/30),
[print](https://github.com/matheus-sancha/excalimathpad/issues/21).

## 8. App chrome

Built in M1 (☰ file items, file name, Add math) and M2 (Sheet button and panel). Print…
and the Page row arrive in M5; until then Ctrl+P is the browser's own and prints the
screen. There is no app bar: the chrome lives inside Excalidraw's own UI slots.

```
☰  ● pump-sizing.excalimathpad                  ∑ Add math (M) · Library · Sheet ②
```

- **☰ menu:** Open… (Ctrl+O), Save (Ctrl+S), Save as… (Ctrl+Shift+S) and Print… (Ctrl+P)
  at the top. Excalidraw's own Open, Save to… and Export image… are removed. Its other
  items stay: Find on canvas, Help, Reset the canvas, dark mode, canvas background.
- **File name** beside the ☰ button, with `●` while dirty.
- **Window title:** the name without its extension, with `●` while dirty: `● pump-sizing`.
  An unsaved sheet reads `● Untitled`. While printing, the title drops the mark, so the PDF is
  named `pump-sizing.pdf`, because Save as PDF names the file from the title.
- **∑ Add math** is the primary button, labelled with its shortcut **M**.
- **Sheet** opens and closes the panel, with a red badge counting errors and warnings
  while the sheet has problems.
- An empty untitled sheet shows Excalidraw's welcome screen, with a hint for M / Add math.

### Add math

Pressing Add math or **M** turns the cursor into a crosshair with a ghost box. The next
click on the canvas places the element there, selected, with its first line open for
typing. It can be placed on top of an existing element. **Esc** before clicking cancels.
Placing isn't in the scene and isn't an undo step until the click.

### Sheet panel

Excalidraw's docked sidebar. Open at launch on a wide window, on Variables, or on Problems
if the opened sheet has any. Open or closed is remembered per browser, not in the file. On
a small window it floats over the canvas, and closes after a jump or a click on the canvas.

| Tab | Holds |
|---|---|
| **Variables** | A filter box, then every name in reading order, grouped by element, labelled by the element's position. Row: typeset name, value, unit, in the unit system and Digits. A name defined twice appears twice. A line with an error shows "error". A list shows its summary (`30 values, 1 … 30 L/s`). A function shows its signature, `H_s(Q)`, with `function` or `solve function` as the value and a blank unit. Comments and notes don't appear |
| **Problems** | Errors `●` and warnings `⚠` in one list in reading order, each with its message and "element, line n · name". Comments and notes don't appear |
| **Settings** | Unit system, and for Custom its kind → unit table. Digits, 2 to 15. Page: A4 or Letter, portrait or landscape |

- **Clicking a variable or problem jumps to it:** the view scrolls the element into the
  middle, selects it and flashes the line for about 1.5 s. With reduced motion it's a static
  outline that clears on the next click.
- **Settings aren't part of undo.** Changing one re-shows every result, refits boxes and
  marks the sheet dirty. Ctrl+Z doesn't reach it.

Decided in: [chrome](https://github.com/matheus-sancha/excalimathpad/issues/17),
[gestures](https://github.com/matheus-sancha/excalimathpad/issues/28),
[functions](https://github.com/matheus-sancha/excalimathpad/issues/27),
[numbers](https://github.com/matheus-sancha/excalimathpad/issues/30),
[ranges](https://github.com/matheus-sancha/excalimathpad/issues/20),
[Chromium PDF](https://github.com/matheus-sancha/excalimathpad/issues/34).

## 9. Solve

Built in M3. A solve is one line. v1 solves one equation in one unknown, with our own Brent
solver in `src/math/`.

```
Q_op = solve Hp(Q) = Hs(Q), guess Q = 15 L/s
f(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02
f_d = f(Re_d, eps/D)
```

- **Form:** `<name>[(<params>)] = solve <lhs> = <rhs>, guess <unknown> = <guess expr>`. It
  defines exactly one name. A solve can't appear mid-expression (`2 * solve …`): solve into
  a name, then use the name.
- **Guess: required.** It can be any expression, evaluated each time the solve runs, in the
  scope at that point: names above, plus the parameters in the function form. It can't use
  the unknown. The unknown takes its **dimension** from the guess's unit.
- **Unknown: local to the line.** Inside the equation it wins over every other meaning: a
  variable above, a unit, or the function being defined (in Colebrook, `f` inside is the
  unknown, not a recursive call). It isn't defined below the line. If it's a unit name, the
  shadow warning still shows.
- **Result:** the value only, in its display unit or the unit system. Details are on hover.
  Nothing extra prints.
- **Tolerance:** fixed. Brent stops when the bracket is within about 1e-12 relative of the
  root, with a cap of 100 iterations, which is an error. There is no setting, so nothing is
  saved.

**Failure:** an error on the line that ran it, with the cause named. A failed solve never
shows a best-effort value.

- **Value form:** the error is the solve line's result. A failed line removes its name, so
  lines below say `has an error above`.
- **Function form:** the solve runs only when called, so the error lands on the **calling**
  line and names the function and its arguments.
- **A guess that fails to evaluate** is the line's error.

**Nested solves:** an inner failure counts as "outside the domain". When the outer search
tries a point where an inner solve fails (Colebrook at Q ≤ 0), it treats that like a NaN and
searches the other side. Only if the outer solve ends without a root does its line error,
and the message carries the last inner cause. **Units errors are never swallowed:** they fail
the line at once, because no trial point can fix them.

Decided in: [solve](https://github.com/matheus-sancha/excalimathpad/issues/19),
[libraries](https://github.com/matheus-sancha/excalimathpad/issues/18).

## 10. Ranges, tables, plots

Built in M4.

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

**A list result shows one row high,** as a summary: `30 values, 12.04 … 33.18 m` (count,
first … last, unit). Hovering it shows the first and last few values with their index.

**A failed point fails only itself:**

- The line gets a red `●` with "1 of 30 points failed" and the first point's message.
- The summary reads `29 of 30 values`.
- A table cell shows a red — with its message on hover.
- An aggregate over a list with a failed point is an error.

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
[libraries](https://github.com/matheus-sancha/excalimathpad/issues/18).

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
| Drawings, typeset grid, notes, results as they show on screen, column rule, tables, plots with legend, marks, gaps and × | All app and Excalidraw chrome, the panel, selection, the line editor, anchor borders, the ⚙ and popover, hover details, the dotted underline, the chosen-unit tint |
| Errors: red `●` and message. A plot's gutter `●` | Warnings: the `⚠`, because its message lives on hover |

An element's math prints at its anchor's opacity. Colours are always a white page in light colours,
whatever the dark mode or canvas background.

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

Decided in: [print](https://github.com/matheus-sancha/excalimathpad/issues/21),
[Chromium PDF](https://github.com/matheus-sancha/excalimathpad/issues/34),
[comments](https://github.com/matheus-sancha/excalimathpad/issues/36),
[panel](https://github.com/matheus-sancha/excalimathpad/issues/32),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38).

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
- **Hosting:** Cloudflare Pages, free HTTPS, with Cloudflare Access as an optional gate. The app holds
  no data, so a public URL is acceptable. Fallback: install from `npm run preview` on localhost.
- The build stays static files with a relative `base`.

Decided in: [PWA](https://github.com/matheus-sancha/excalimathpad/issues/22),
[file](https://github.com/matheus-sancha/excalimathpad/issues/12),
[libraries](https://github.com/matheus-sancha/excalimathpad/issues/18).

## 13. Messages

The wording of every user-facing message. `<…>` is filled in. Numbers follow
[section 5](#numbers), in the plain-text form.

**Reading and names**

| When | Message | Arrives |
|---|---|---|
| A name used above its definition | `x is defined below` | M0 |
| A name whose assignment failed | `x has an error above` | M0 |
| `table`, `plot` or `solve` assigned to | `table is a line form: choose another name` | M2 |
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

**Solve**

| When | Message | Arrives |
|---|---|---|
| No guess | `solve needs a guess: ", guess Q = <value>"` | M3 |
| No root | `no root near Q = 15 L/s (searched 0.9 .. 240 L/s)` | M3 |
| No root, on a call | `in f(1.86·10⁵, 4.399·10⁻⁴): no root near f = 0.02 (searched <range>)` | M3 |
| Outer solve fails after inner failures | `no root near Q = 15 L/s (searched <range>); last inner error: <message>` | M3 |
| Units of the two sides differ | `guess Q = 15 m: Hp(Q) - Hs(Q) units do not match` | M3 |
| Iteration cap | `no convergence for Q after 100 iterations` | M3 |
| The guess fails | `guess Q: <message>` | M3 |

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

**App**

| When | Message | Arrives |
|---|---|---|
| Newer file | `This sheet was saved by a newer Excalimathpad. Update the app.` | M1 |
| File that doesn't parse | `This file isn't a sheet, so it wasn't opened.` | M1 |
| Recovery copy | `Restore unsaved changes to pump-sizing.excalimathpad?` or `… to an untitled sheet?` | M1 |
| Opening with unsaved changes | `Save changes to pump-sizing.excalimathpad?` Save, Don't save, Cancel | M1 |
| A save that fails | `Couldn't save pump-sizing.excalimathpad: <reason>` | M1 |
| The picker or the file read fails | `Couldn't open the file: <reason>` | M1 |
| Hint, one math element selected | `Double-click a line or press Enter to edit` | M1 |
| Browser's Print with an empty cache | `Use Print… from the app's menu` | M5 |

Decided in: [solve](https://github.com/matheus-sancha/excalimathpad/issues/19),
[functions](https://github.com/matheus-sancha/excalimathpad/issues/27),
[ranges](https://github.com/matheus-sancha/excalimathpad/issues/20),
[plots](https://github.com/matheus-sancha/excalimathpad/issues/31),
[file](https://github.com/matheus-sancha/excalimathpad/issues/12),
[spec contents](https://github.com/matheus-sancha/excalimathpad/issues/38).

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
- **Add math:** select the new element in the same `updateScene`, or undo takes two steps when something
  was selected before. ([gestures](https://github.com/matheus-sancha/excalimathpad/issues/28))
- **The line field only takes what the user typed.** Setting its value while typing clears its browser
  undo. ([undo steps](https://github.com/matheus-sancha/excalimathpad/issues/11))

**Gestures**

- **Overlay stays `pointer-events: none`,** except the open line editor, unit field and plot popover. The
  unit slot and ⚙ let pointer-down through and open on `click`.
- **Capture `dblclick` on the stage, capture `keydown` on `document`,** for double-click, Enter and M. Stop
  them there. Act on Enter only when one math anchor is selected, the tool is the selection tool, no
  modifier is held, and the target isn't an input, textarea, contenteditable or button.
  - As built (#43): the pointer listeners (`dblclick`, `pointerdown`, `click`) sit on the box Excalidraw
    fills, `SheetCanvasHandle.root`, a sibling of the overlay, so the field's own clicks never reach them.
    Keys act only when their target is inside that box or is the page's body: the app's own dialogs keep
    theirs. Nothing acts while Excalidraw is busy (its text or line editor, a shape being drawn, a menu,
    dialog, popup or context menu open).
  - A press leaves the open line before Excalidraw sees it, so a drag starts on the committed scene. A
    click is a press whose `click` follows with the anchor's `x` and `y` unchanged.
  - Viewport to scene is `stageToScene` after taking off `offsetLeft` and `offsetTop`: the same formula,
    pinned against `viewportCoordsToSceneCoords` (`viewport.test.ts`), with no Excalidraw import in the
    overlay.
- **Which line was hit comes from geometry:** viewport to scene with `viewportCoordsToSceneCoords`, undo the
  rotation, find the row by `offsetTop` and `offsetHeight`.
- **Leaving an edit gives the keyboard back** by focusing `.excalidraw`.
- **Add math is a custom tool:** `setActiveTool({ type: 'custom', customType })`, with the placing click
  from `onPointerUp`. Re-apply the crosshair two animation frames after each `pointermove`.
- **Anything in `src/canvas/` only:** runtime imports of Excalidraw, `exportToSvg`, and the `.excalidraw`
  focus query.

Evidence: [`excalidraw-gestures.md`](research/excalidraw-gestures.md).

**Contract tests to add,** as `layers.test.ts` does. Built names the issue that added it:

| Behaviour | Test | Built |
|---|---|---|
| `#ffffff01` counts as not transparent for hit-testing | Pointer down inside an unselected anchor selects it | #43, `mathAnchor.excalidraw.test.tsx` |
| `onDoubleClick` runs in React's bubble phase | A double-click stopped at the stage adds no text element | #43, `gestures.excalidraw.test.tsx` |
| Key handling runs in the bubble phase, at or below the root | Enter stopped on `document` opens no editor | #43, `gestures.excalidraw.test.tsx` |
| No built-in shortcut for M | M leaves the tool unchanged when not intercepted | |
| `.excalidraw` takes focus | Enter works after leaving an edit | #43, `gestures.excalidraw.test.tsx` |
| Order of the panel's children in `.panelColumn` | The reduced panel hides what comes before Opacity | |
| `.HintViewer` holds the hint | The hint's replacement shows | |

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

**Other research notes:** [`excalidraw-undo-customdata.md`](research/excalidraw-undo-customdata.md),
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

v1 is built in six milestones, each usable on a real sheet, with a saved typeset sheet first. The existing
spike is M0, done.

| Milestone | What it lets Matheus do | Sections |
|---|---|---|
| **M1 Keepable sheet** | Type a typeset sheet, edit it line by line, undo, save it and reopen it | [3](#3-sheet-lines-every-form), [4](#4-math-element-look-and-editing), [6](#6-undo), [7](#7-file-and-save), [8](#8-app-chrome) |
| **M2 Units & panel** | Read results in the right units and digits, see problems and warnings, change sheet settings | [5](#5-results-units-and-numbers), [8](#8-app-chrome) |
| **M3 Solve** | Solve an equation on a line, including as a function and a solve calling a solve | [9](#9-solve) |
| **M4 Ranges & plots** | Run lines over a range, draw tables and plots | [10](#10-ranges-tables-plots) |
| **M5 Print** | Print the sheet to clean PDF pages | [11](#11-print) |
| **M6 Offline PWA** | Install the app, work offline, open a `.excalimathpad` file from Windows | [12](#12-offline-pwa) |

**M1's issue order:**

1. Source in `customData` + undo steps + bare line field and its keys
2. Save, open, recovery copy, ☰ items
3. Gestures and Esc's second press
4. KaTeX grid with the edit field's final layout, auto-size, comments
5. Add math (M), empty removal
6. Reduced panel + hint, Normal font

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
| M5 | none new | Steps 3-4: save and reopen, print to PDF |
| M6 | none | None from the sheet: finish-line condition 2 checks it |

**Along the way:**

- **M1's line 2:** `mu = 1.002 cP` shows an unknown-unit error until M2 registers the app units. Results keep
  today's formatting until M2. M1's check doesn't judge values, so neither blocks it.
- **Line 6's warning** is checked at M2, when the shadow warning lands.
- **Settings:** the Settings tab arrives in M2, its Page row in M5. The Print… menu item arrives in M5.
- **The seed:** until Add math (the fifth issue), the untitled sheet starts with the two seeded elements,
  loaded clean, because an empty sheet has no other way to get a math element. Add math removes them.

### The finish line

**v1 is done when all three hold:**

1. The pump sheet passes steps 1-4.
2. The installed PWA opens a `.excalimathpad` file and works offline.
3. Matheus has used it for one real calculation other than the pump sheet. This can happen any time after M5.

**Open risks:**

- M1 is large and has one check at its end, so the Project Manager watches its issues to see slip early.
- The nested solve surfaces at M3, after two milestones of UI.
- Condition 3 depends on Matheus having a real calculation to do, so v1 can stay open after the build ends.

Decided in: [milestones](https://github.com/matheus-sancha/excalimathpad/issues/37).

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
  the slot itself is untried.
- The reduced panel's CSS on `.panelColumn` children, and the hint's replacement through `.HintViewer`.
- Restoring style with `NEVER` from `onChange`: paste styles on math alone may leave an empty undo entry.
- Restoring `x` and `y` on snap-back, resizing several selected elements or a group, and a handle on a rotated
  element.
- Measuring real KaTeX rows: `offsetWidth` and `offsetHeight`, again when a `ResizeObserver` fires as fonts load.
- Line hit-testing on rows of different heights.
- Rotated elements keeping their rotated top-left, and the half-pixel threshold.
- A size write not marking the sheet dirty.
- A size write during Excalidraw's own text edit, or while drawing a new shape.
- Starting a drag while a line is being edited. **Passed (#43):** the press leaves the line before Excalidraw
  sees it, so the line is one step and the move is Excalidraw's own; Ctrl+Z takes the move, then the line. In
  Chromium with real input and as a contract test.
- Grouped and locked anchors. **Changed (#43):** a click on a grouped anchor selects the group, and
  Excalidraw's double-click enters the group; a locked anchor can't be selected, and Excalidraw's double-click
  adds a text element on it. Now a double-click edits either straight away (see Changes). Contract tests; not
  tried by hand.
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
  lands in the field, where the browser selects the word under the pointer, as in any text field. Accepted.

**M3, M4**

- The nested solve on the pump sheet (`f_d`, `Q_op`, and the table).
- Run time: the sheet runs 30 Colebrook solves for the table on every keystroke, plus `Q_op`'s nested solves. A
  91-row sweep took 30 ms in the research, so it's probably fine, but measure it.
- The mark label's position, log scale and `points`, tried only as prototype switches.
- The clause parser and lazy loading of Observable Plot, not built in the prototype.

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

## Changes since agreed

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
- 2026-11-07, [section 4](#gestures) (#43, agreed by Matheus): a drawing on top of a math element keeps
  Excalidraw's double-click; a grouped element edits straight away; a locked element still edits, its lock
  holding position only; the second Esc deselects whenever the selection includes math, mixed selections too;
  arrows keep binding to math elements, even from inside.
- 2026-11-07, [section 16](#16-milestones-and-finish-line) (#43, agreed by Matheus): the edit field's final
  layout moves from the third issue to the fourth (#44), which builds the grid its cells live in. Until then
  the field sits over the source column, with the live result beside it as plain text.
- 2026-11-05, [sections 7](#7-file-and-save) and [13](#13-messages) (#42 review, Engineer's, for Matheus to
  confirm on the PR): opening picks the file before the unsaved-changes question, because Chromium allows one
  picker per gesture; a picker or read failure has its own message, `Couldn't open the file: <reason>`.
