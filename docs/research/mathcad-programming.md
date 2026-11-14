Research for wayfinder ticket [#131](https://github.com/matheus-sancha/excalimathpad/issues/131), 2026-11-14,
under the map [#114](https://github.com/matheus-sancha/excalimathpad/issues/114). It feeds the grilling ticket
[#132](https://github.com/matheus-sancha/excalimathpad/issues/132).

# Programming in a sheet: Mathcad and its peers, and what math.js already runs

Question: what do Mathcad and comparable live-math tools offer for programming inside a sheet, and how much of
it can Excalimathpad's engine already run or be made to run? Matheus's example: a check that shows "Approved".

**How this was checked.**

- **Engine facts** come from throwaway Vitest probes against math.js **15.2.0** and the app's own `evaluateSheet`
  and `typesetResult`, at `main` 4a25892. The probes were deleted afterwards, and no app code was changed.
  Results marked *(probed)* were observed.
- **The ticket's starting facts** (`status = sigma <= sigma_allow ? "Approved" : "Rejected"` shows `"Approved"`
  with quotes; `ok = …` shows `true`; `f(x) = x > 0 ? x : -x`) were taken as given and not re-derived.
- **Peer facts** cite vendor help pages, PTC support articles, Calcpad's docs and GitHub discussions, and
  Microsoft Support. **Caveat:** this session's network blocked direct fetches from those hosts, so the claims
  rest on search-tool extracts of the cited pages, not on pages read in full. Items marked *(low confidence)* or
  *unverified* could not be pinned to a primary page.

## Answer

- **One line already branches, and a text result already works.**
  - `cond ? a : b` runs today. Only the branch taken is evaluated (`false ? undefinedName : 7` gives `7`) and it
    nests for `else if`.
  - Recursion works (`fact(n) = n <= 1 ? 1 : n * fact(n - 1)`, then `fact(5)` gives `120`), and so do `map` and
    `filter` with an inline function. Those are the only loops math.js has.
  - Typeset, `? :` is already Mathcad-like: a brace of cases, `"Approved", if σ ≤ σ_allow` / `"Rejected",
    otherwise` *(probed)*.
- **What the engine can't do today:**
  - **Compare text with `==`.** `"Approved" == "Approved"` is an error, `Cannot convert "Approved" to a number`
    *(probed)*. So the ticket's own rule, `@text-green if result == "Approved"`, only warns.
    `equalText(a, b)` works today.
  - **An `if(c, a, b)` function** (Mathcad's, SMath's, Calcpad's and Excel's form) doesn't exist: `Undefined
    function if`.
  - **Loops, `return`, `break`, local variables:** none of these exist. A multi-statement function body,
    `h(x) = (t = x^2; t + 1)`, doesn't parse.
- **What the app shows today:**
  - A text result keeps its quotes: `"Approved"`, in the result cell, in a list summary and in table cells.
  - A text literal in the equation is typeset as `\mathtt{"Approved"}`: monospace, quoted.
  - `true` / `false` in a result is upright text. In the equation it is math italic `true`.
- **How the peers do it.** Every tool has two layers:
  1. **An inline function:** Mathcad's and SMath's `if(c, a, b)`, Calcpad's `if(c; a; b)` and `switch`, Excel's
     `IF` / `IFS` / `SWITCH`.
  2. **Control flow:**
     - Mathcad's program region: one 2-D block with a vertical bar, `←`, `if`/`else if`/`else`, `for`, `while`,
       `break`, `continue`, `return` and `try`/`on error`.
     - SMath's `if`/`while`/`line()` blocks.
     - Calcpad's line directives: `#if` … `#end if`, `#for` / `#while` / `#repeat` … `#loop`.
  - **Text results.** Mathcad shows string results **with their quotes**, and there is no setting to hide them.
    Calcpad's inline `if` can't return text at all, so text verdicts come from report lines inside `#if` blocks.
  - **Booleans.** Mathcad, SMath and Calcpad show comparisons as **1 / 0**. math.js shows `true` / `false`.
- **The cheap routes stay inside one statement per line and the closed sandbox.** Both were tried in a probe:
  - **Text `==` / `!=`:** merge a `string, string` signature into `equal` and `unequal` at engine setup, before
    `import` is disabled. `"A" == "A"` gives `true`, `"A" == "a"` gives `false`, and numbers, units and matrices
    compare as before.
  - **A lazy `if(c, a, b)`:** a `rawArgs` function imported at setup, as the app's index already is.
    `if(false, undefinedName, 7)` gives `7`.
- **The costly route is Mathcad's multi-line program.** It breaks "one line is one statement" (spec section 3,
  ADR 0003, ADR 0005). It needs a new ADR, a block form in the line model, and an app interpreter with an
  iteration cap, because the sheet re-runs synchronously on every keystroke.
- **The options for #132** are in [section 6](#6-options-for-the-grilling-ticket-132), each with a worked
  example. The smallest change that meets Matheus's example is **A + B**: text `==`, and quote-less text results.

## 1. Mathcad Prime (and Mathcad 15 where it differs)

Current release: Prime 12, April 2026
([What's new](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/whatsNewMathcadPrime.html)). The free
Prime Express has no programming *(secondary source,
[Rosetta Code](https://rosettacode.org/wiki/Mathcad))*.

### 1.1 Program operators

- **Operators.** The help lists:
  - the Program operator and Local Assignment `←`;
  - the conditionals `if`, `else if`, `else` and `also if`;
  - `for` and `while`;
  - `break`, `continue` and `return`;
  - `try` / `on error`.

  Source: [Programming Operators](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help.html).
- **Conditionals:**
  - Separate `if`s at the same level are each evaluated on their own. `else`, `else if` and `also if` chain on
    the earlier `if`.
  - `else if` goes only directly after an `if` or another `else if`.
  - An empty `else` covers everything left.

  Sources: [Conditional Operators](https://support.ptc.com/help/engineering_notebook/r11.0/en/PTC_Mathcad_Help/conditional_operators.html),
  [Writing If/Else Statements](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/Tutorials/prgm_tutorial/task2-2_Writing_If_Else_Statements.html).
- **A program's value** is the result of the last statement it evaluates, unless `return` is used
  ([About Programs](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/about_programs.html)).
- **Leaving a loop or a program:**
  - `continue` skips the rest of the current pass; `return` exits the program, even from inside a loop.
  - A `while` loop that never changes its condition runs forever.

  Sources: [Operators for Exiting Loops and Programs](https://help.ptc.com/mathcad/en/PTC_Mathcad_Help/operators_for_exiting_loops_and_programs.html),
  [Programming Strategies](https://help.ptc.com/mathcad/en/PTC_Mathcad_Help/programming_strategies.html).
- **`try` / `on error`:** the `on error` branch runs only when `try` returns an error
  ([example](https://help.ptc.com/mathcad/en/PTC_Mathcad_Help/example_using_the_try_on_error_operator.html)).
- **`error("S")`** raises a custom error message, typically inside a program or an `if` *(exact page unverified;
  likely [String Functions](http://support.ptc.com/help/mathcad/en/PTC_Mathcad_Help/string_functions.html))*.

### 1.2 Entering and typesetting a program

- **A program is one 2-D region.** The Program operator (`]`) draws a **vertical bar** with statement
  placeholders beside it. Pressing Enter inside a program adds a line, and Prime has no "addline" command
  *(forum: [Where is the command addline](https://community.ptc.com/t5/Mathcad/Where-is-the-command-addline/td-p/904911))*.
- **Typing a keyword.** Typing `if` and pressing **Ctrl+J** turns it into the program operator. That keeps it
  apart from the `if()` function
  *(forum: [Nesting if-then](https://community.ptc.com/mathcad-7/nesting-if-then-conditional-logic-153292))*.
- **Shortcuts (US layout)** *(low confidence: the shortcut PDFs extract scrambled, and the keys change with
  layout)*: Program `]`, Local Assignment `{`, If `}`, While `Ctrl+]`, Return `Ctrl+\`, Try `Ctrl+[`.
  Sources: [Prime 5 sheet](https://community.ptc.com/sejnu66972/attachments/sejnu66972/PTCMathcad/181873/1/PTC%20Mathcad%20Prime%205.0.0.0%20Keyboard%20Shortcuts.pdf),
  [Prime 11 sheet](https://ptc-p-001.sitecorecontenthub.cloud/api/public/content/c1dfc3ff373c4195ad2f6e1bbe537566?v=309f239d).
- **Nesting.** A branch or loop body is its own sub-block, drawn as a nested bar. *Unverified from a reachable
  page.*

### 1.3 Strings, comparisons, booleans

- **Strings:**
  - You type a string by starting with `"`. The first character is at index 0
    ([To Create a String](https://help.ptc.com/mathcad/en/PTC_Mathcad_Help/to_create_a_string.html)).
  - String functions: `concat`, `num2str`, `str2num`, `strlen`, `search` and `substr`
    ([String Functions](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/string_functions.html)).
  - Typical use: `concat("The maximum span is ", num2str(d/ft), "ft")`
    ([forum](https://community.ptc.com/t5/Mathcad/Concatenating-strings-and-scalars-arrays/td-p/185088)).
- **A string result shows with its quotes,** in matrices too, and there is no built-in way to hide them (PTC
  article [CS434400](https://www.ptc.com/en/support/article/CS434400), Prime 1–10). Excalimathpad today matches
  Mathcad here.
- **Comparison.** The Boolean equal (`Ctrl+=`, a bold `=`) compares scalars, arrays or **strings**. Both sides
  must be the same type, so a string against a number is an error. Strings compare alphabetically
  ([Comparison Operators](http://support.ptc.com/help/mathcad/en/PTC_Mathcad_Help/comparison_operators.html)).
- **Booleans** show as **1 / 0**, and AND, OR, NOT and XOR treat any non-zero value as true
  ([Boolean example](https://support.ptc.com/help/mathcad/r9.0/en/PTC_Mathcad_Help/example_boolean_operators.html),
  [Logical Operators](http://support.ptc.com/help/mathcad/en/PTC_Mathcad_Help/logical_operators.html)).
- **The inline `if(cond, x, y)`** returns x when cond is non-zero, otherwise y. It is separate from the program
  `if` ([Conditional Branching](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/conditional_branching.html)).

### 1.4 Units and errors in a program

- **Units.** Incompatible units in a program are a red error, as anywhere else. A local name can clash with a
  unit (`R`, `g`). Forum sources only:
  [1](https://community.ptc.com/t5/Mathcad/Units-error-when-solving/m-p/492440),
  [2](https://community.ptc.com/mathcad-7/unit-problem-in-mathcad-prime-11-165343).
- **Unverified:**
  - whether the branches must agree in units;
  - exactly how an error inside a branch is highlighted.

### 1.5 Mathcad 15

- **`if` / `otherwise`, with no `else if`:** nested if/otherwise is the workaround
  ([forum](https://community.ptc.com/t5/Mathcad/otherwise-statement/td-p/602533),
  [forum](https://community.ptc.com/t5/Mathcad/Again-else-If-statements/td-p/456)).
- **Entering operators.** They come from the Programming toolbar, and **Add Line** is the toolbar button or `]`.
  Typing the word `otherwise` doesn't work
  ([university tutorial](https://www.engr.colostate.edu/ECE562/mathcad.pdf)).
- Its typeset look is the same as math.js's `toTex` for `? :` (section 3.4): `value if cond` over
  `value otherwise`.

## 2. Peers, for contrast

### 2.1 SMath Studio

- **Programming forms.** [Programming](https://smath.com/wiki/Programming.ashx) covers four:
  - `if(condition, true, false)`;
  - `while(condition, body)`;
  - `for`, whose syntax is *unverified*;
  - `line(…)`, which groups statements into one block, with slots added or removed.
- **`else if`:** you add branches inside the `if` block
  ([forum](https://smath.com/en-US/forum/topic/kbRQyK/If-Else-If-Statements)).
- **Booleans** are 1 / 0
  ([primer](https://smath.com/wiki/GetFile.aspx?File=Tutorials%2FSMathPrimer.pdf)).
- **Text from a branch:** `concat("result is ", num2str(value))`
  ([forum](https://smath.com/en-US/forum/topic/FgLeCS/combining-functions-and-statements)).
- **Unverified:** whether a string result shows its quotes.

### 2.2 Calcpad

- **Conditional blocks.** `#if c` … `#else if c` … `#else` … `#end if`, as **one directive per line**, with any
  number of `#else if` lines. A condition is true when it is non-zero
  ([quick reference](https://calcpad.eu/download/Calcpad-quick-reference.pdf),
  [readme](https://proektsoft.bg/calcpad/readme.html)).
- **Loops:**
  - `#repeat n` … `#loop`, with `#break` and `#continue`;
  - `#for i = a : b` and `#while c`, both since VM 7.0
    ([quick reference](https://calcpad.eu/download/Calcpad-quick-reference.pdf)).
- **Operators.** Comparisons return **1 / 0**, and the logic operators are `∧`, `∨` and `⊕`. The inline functions
  are `if(c; a; b)` and `switch(c1; v1; …; default)` ([readme](https://proektsoft.bg/calcpad/readme.html)).
- **Text.** `"Title"` and `'text'` lines go into the HTML report.
  - **The inline `if()` cannot return text.** The maintainer says to print verdicts from `#if` blocks, as in a
    "satisfied" / "not satisfied" check on `λ ≤ λ_max`
    ([discussion #325](https://github.com/Proektsoftbg/Calcpad/discussions/325)).
  - "String variables" are macros (`#def name$ = …`), not values
    ([macros](https://calcpad.eu/help/60/macros-and-string-variables)).
- **Fit with this app.** The directive form fits one statement per line. But Calcpad's `#` collides with
  Excalimathpad's comment, and a branch there hides or shows whole lines of the report, which is control flow
  across lines.

### 2.3 Excel

- **`IF`:** text must be in double quotes. A missing value_if_false shows 0
  ([IF](https://support.microsoft.com/excel/functions/if-function),
  [nested IF](https://support.microsoft.com/office/if-function-nested-formulas-and-avoiding-pitfalls-0b22ff44-f149-44ba-aeb5-4ef99da241c8)).
- **`IFS`:** returns the first true branch, and `#N/A` when none is true, so the idiom for a default is a last
  test of `TRUE` ([IFS](https://support.microsoft.com/en-us/excel/functions/ifs-function)).
- **`SWITCH`:** matches one value against a list of values, with an optional default
  ([SWITCH](https://support.microsoft.com/en-us/office/47ab33c0-28ce-4530-8a45-d532ec4aa25e)).
- **Text comparison:** `=` ignores case, and `EXACT` doesn't *(third-party sources only:
  [Exceljet](https://exceljet.net/functions/exact-function))*.
- **Booleans:** comparisons show `TRUE` / `FALSE` *(unverified from a Microsoft page)*.

### 2.4 How engineering reports print a check

- **Tekla Tedds:** the utilisation factor, then a bare verdict:
  `UF My = M Ed,y / M y,Rd = 0.072` then `Bending Moment Check (y-y); PASS`
  ([SCI module PDF](https://steel-sci.com/images/tedds-module-%E2%80%93-sci-light-gauge-steel-member-designer.pdf)).
  Some calculations use a sentence: "PASS - Buckling resistance moment exceeds design bending moment"
  ([example calc](https://www.buildteam.com/Flipbook/do_it_yourself_1.pdf)).
- **ClearCalcs:** a pass/fail per demand/capacity ratio, and a "Governing" box that is green or yellow when it
  passes and red when it fails
  ([report](https://clearcalcs.com/features/structural-report),
  [blog](https://clearcalcs.com/blog/3-steps-structural-calculation-with-clear-calcs)).
  The pass limit is not always 1.0
  ([utilization](https://calcs.com/support/measuring-utilization-or-adequacy-of-a-design)).
- **Calcpad:** "satisfied" / "not satisfied" from an `#if` (section 2.2).
- **The convention:** the ratio, then a short verdict word (PASS / FAIL, OK / NOT OK), often coloured. That is
  a text result plus a rule in this app's terms. A vendor example with a ✓ was *not found*.

## 3. math.js 15.2 in Excalimathpad

### 3.1 What already runs

All of the following were probed in `evaluateSheet` unless marked raw.

| Line | Shows | Note |
|---|---|---|
| `ok = sigma <= sigma_allow` | `true` | the ticket's starting fact |
| `status = ok ? "Approved" : "Rejected"` | `"Approved"` | quotes kept |
| `band = sigma < 100 MPa ? "low" : sigma < 140 MPa ? "mid" : "high"` | `"mid"` | nested `? :` is `else if` |
| `bad2 = ok ? undefinedName : 1` | `Undefined symbol undefinedName` | only the branch taken runs; an error shows as the line's error |
| `bad3 = ok ? 1 m + 1 s : 1` | `Units do not match` | units are checked in the branch taken |
| `mixed = ok ? 1 m : "no"` | `1 m` | branches may differ in type and unit; nothing checks them |
| `bad = sigma > 0 ? 1 m : 2 s` | `Unexpected type of argument in function larger (…)` | a unit against a bare `0` is math.js's raw message |
| `r2 = ok ? sigma : 0 MPa in kPa` | `1.2·10⁵ kPa` | a display unit applies to the whole conditional |
| `not ok`, `ok and sigma > 100 MPa` | `false`, `true` | `and`, `or`, `not`, `xor` |
| `n = ok + 0` | `1` | a boolean is 1 / 0 in arithmetic |
| `g(s) = s <= sigma_allow ? "Approved" : "Rejected"`, then `g(200 MPa)` | `"Rejected"` | a check as a function (warns: `g`, `s` shadow units) |
| `fact(n) = n <= 1 ? 1 : n * fact(n - 1)`, then `fact(5)` | `120` | recursion is the only loop |
| `sq = map([1, 2, 3], f(x) = x^2)` | `[1, 4, 9]` | `filter` too; raw `sum(map(1:4, f(i) = i^2))` gives `30` |
| `msg = concat("u = ", format(u, 3))` | `"u = 0.8"` | `format` is math.js's own, not the sheet's Digits or units |
| `x1 = 5; y1 = x1 * 2`, then `y1` | `[10]`, then `10` | **two statements on one line work today**: both names reach the lines below |
| `state = v < 0.25 m/s ? "low" : "high"` over a list | `4 values, "low" … "high"` | per point; `table(Q, v, state)` shows `"low"` cells, quoted |

- **Raw math.js:**
  - `"10" == 10` gives `true`, because a numeric string is converted.
  - `"abc"[2]` gives `b`, `number("12.5")` gives `12.5`, and `string(1.5 kN)` gives `1.5 kN`.
  - `true & false` gives `0`, and `!true` is a syntax error (math.js's `not` is a word).
  - A matrix as the condition is an error: `Unsupported type of condition "DenseMatrix"`.
- **Truthiness in `? :`:** `0`, `""` and `NaN` are false, and `"text"` and `1 m` are true.

### 3.2 What it lacks

- **`==` / `!=` / `<` on text.** Each is an error: `Cannot convert "Approved" to a number`. The working
  alternatives are:
  - `equalText(a, b)` gives `true` / `false` and is case-sensitive;
  - `compareText(a, b)` gives `-1` / `0` / `1`.
- **An `if` function:** `if(true, 1, 2)` gives `Undefined function if`.
- **Loops and blocks:**
  - No `for`, `while`, `break` or `return`.
  - A body with local steps, `h(x) = (t = x^2; t + 1)`, is a syntax error: `Parenthesis ) expected`.
  - math.js has no arrow functions (`x -> x^2` is a syntax error).
- **String functions.** There is no `strlen`, `lower` or `replace`; there are `concat`, `string`, `number`,
  `format`, `size`, `equalText` and `compareText`. `"a" + 1` is an error.

### 3.3 Rules on a text result

- `status @text-green if result == "Approved"` **warns** today, and the text stays default:
  `if result == "Approved": Cannot convert "Approved" to a number` *(probed)*.
- What works today:
  - `status @text-green if ok`: the rule reads `ok` from the scope (probed: green);
  - `@text-green if equalText(result, "Approved")`.
- A rule needs a real boolean (`evaluate.ts`, `runRules`), so `@text-red if n`, with `n` equal to 1, is
  `not true or false`.

### 3.4 How the app typesets it today (`src/math/typeset.ts`)

`toTex` has no case for a `ConditionalNode` or a string or boolean `ConstantNode`, so math.js's own TeX is used
(probed):

| Source | TeX | What it looks like |
|---|---|---|
| `a <= b ? "Approved" : "Rejected"` | `\begin{cases} {\mathtt{"Approved"}}, &\quad{\text{if }\; a\leq b}\\{\mathtt{"Rejected"}}, &\quad{\text{otherwise}}\end{cases}` | a brace, two rows: value, "if" condition / value, "otherwise" (Mathcad 15's look) |
| nested `? :` | a `cases` inside the `otherwise` row | a second brace; grows sideways at each `else if` |
| `"NOT OK"` | `\mathtt{"NOT~OK"}` | monospace, quoted |
| `"x # not a comment"` | `\mathtt{"x~\#~not~a~comment"}` | the comment split leaves a `#` in a string alone |
| `flag = true` | `true` | math italic *true* (KaTeX letters), not upright |
| `not ok`, `a and b`, `a xor b` | `\neg`, `\wedge`, `\veebar` | ¬, ∧, ⊻ |
| `x1 = 5; y1 = x1 * 2` | `…=5;\;\; \n …` | the whole line in the expression cell, no name cell |
| `equalText(s, "A")` | `\mathrm{equalText}\left(…\right)` | an upright function name |

- **A result** goes through `typesetResult`: `"Approved"` becomes `\text{"Approved"}` and `true` becomes
  `\text{true}`. Both are upright text, quoted for a string.
- **A conditional's row height.** The row is as tall as its tallest cell (spec section 4, Typeset grid). A
  two-case brace is about two text lines tall. Not measured.

### 3.5 How a text result meets the rest of the app

- **Display** (`display.ts`, `numbers.ts`):
  - `show` sends a string to `math.format`, which writes it with quotes. `plainNumbers` leaves it alone.
  - A string has no unit slot (`slot` is null).
  - `status in MPa` gives math.js's raw `Unexpected type of argument in function to (…)`, not a sheet message.
- **Lists:** a list of text runs per point. The summary is first … last (`4 values, "low" … "high"`), which says
  little for a verdict.
- **Tables:** `table(Q, v, state)` shows each verdict, quoted, in a column with no unit. A table row rule on
  text needs text equality (section 3.3).
- **Print (M5, not built):** prints what the grid shows, so the quotes and colours print too. There is nothing
  print-specific.
- **Variables tab, Problems:** not probed for text values.

## 4. Where new forms could live

Each route below is weighed against three constraints:

- **The line pipeline** (ADR 0005, `src/math/lineForm.ts`): comment, format, display unit, form, index.
- **One statement per line,** in one scope, in reading order (spec section 3, ADR 0003).
- **The closed sandbox** (`evaluate.ts`): `import`, `createUnit`, `config`, `evaluate`, `parse` and the rest are
  disabled after setup, and `typed` is stubbed per run.

| Route | Where | Cost | Breaks one statement per line? |
|---|---|---|---|
| **Engine override at setup** (`equal`/`unequal` with a `string, string` signature, merged with `typed(old, new)`) | `evaluate.ts`, before `import` is disabled, like the short constants | Small. Probed: `"A" == "A"` is `true`, `"A" == "a"` is `false`; `2 == 2`, `1 m == 100 cm` and `[1,2] == [1,3]` unchanged; `"10" == 10` stays `true`. The rule needs a pinning test for a math.js upgrade. | No |
| **An app function in the namespace** (`if(c, a, b)` with `rawArgs`, as `INDEX_FN`) | `evaluate.ts` setup, a reserved name | Small. Probed: lazy, so `if(false, undefinedName, 7)` gives `7`. Needs `toTex` (a brace like `? :`), the missing-name check and the shadow warning. `if` stays unambiguous after `@word` (`@text-red if if(…)` reads, but looks odd). | No |
| **The typesetter** | `typeset.ts` handler, a case for `ConditionalNode`, string and boolean constants | Small. Pure, per call; no engine change. | No |
| **The display** | `display.ts` `show`, `typesetResult` | Small: a string shows without quotes. It touches what a list summary and table cells show. | No |
| **A new line form** read before math.js | `lineForm.ts` step 4 (beside `= solve`, `..`, `table(`) | Medium: syntax math.js doesn't know, so typesetting, the missing-name check and warnings must each learn it (ADR 0005, Consequences). | No, if the form is one line |
| **Several statements on one line** (`;`) | math.js already does it | Already runs, unspecified: shows `[10]`, a ResultSet; both names reach the lines below; the typeset is the raw line with no name cell. The spec should allow it with defined display, or make it an error. | Yes, today, silently |
| **A program across lines** (Mathcad's bar; Calcpad's directives) | a new block form in the element's lines; an app interpreter | Large: a new ADR amending 0003 and 0005; split, join, copy and undo of a partial block; a typeset bar across rows; one result for many rows; an **iteration cap**, since the sheet re-runs synchronously on every keystroke (ADR 0003) and a `while` that never ends freezes the tab; errors per inner line; the scope a block's locals live in. | Yes |

- **Closed routes that stay closed.** A sheet line can't define a function in the namespace or add a
  conversion, because `import` and `typed.addConversion` are disabled. So text equality can't be a sheet-level
  helper: it has to be the app's, at setup.
- **`#` stays the comment,** so Calcpad's `#if` spelling isn't available. A line directive would need another
  marker, such as a keyword at the line start (`if …:` / `else:` / `end`), which ADR 0005's order would have
  to read first.

## 5. Mapping: peers → this app

| Feature | Mathcad Prime | Calcpad | Excel | Excalimathpad today | Gap / route |
|---|---|---|---|---|---|
| Inline conditional | `if(c, a, b)` | `if(c; a; b)`, `switch` | `IF`, `IFS`, `SWITCH` | `c ? a : b`, nested | `if(…)` as an app function (B) |
| Multi-way | `else if` in a program | `#else if` | `IFS` | nested `? :` (typesets nested braces) | flatten the typeset (C) |
| Text result | string, shown quoted | none from `if()`; `#if` report text | text | string, shown quoted | drop quotes (A) |
| Text comparison | bold `=` on strings | — | `=` (case-insensitive), `EXACT` | error; `equalText` works | `==` on text (A) |
| Boolean shows | 1 / 0 | 1 / 0 | `TRUE` / `FALSE` | `true` / `false` | keep, or show 1/0 or ✓/✗ (A) |
| Local steps | `←` in a program | lines between directives | `LET` | `;` on one line (unspecified) | define `;` (E) or program (D) |
| Loops | `for`, `while`, `break`, `continue` | `#for`, `#while`, `#repeat` | — (arrays) | recursion, `map`, `filter` | program (D) |
| Custom error | `error("…")` | — | — | — | an `error(…)` app function (B) |

## 6. Options for the grilling ticket #132

Each option says what it does, a worked example and what it costs. They combine: A is the base for the rest.
In the examples, a line is followed by `→` and what its row shows.

### A. Text that reads as text (no new grammar)

Make the existing one-liner read well and test cleanly:

- `==` and `!=` compare two texts;
- a text result shows without quotes, upright, in the result cell, list summary and table cells;
- a text literal in the equation is typeset upright in quotes, not monospace;
- `true` / `false` are typeset upright (or as ✓ / ✗; to choose).

```
sigma = 120 MPa
sigma_allow = 150 MPa
status = sigma <= sigma_allow ? "Approved" : "Rejected" @text-green if result == "Approved" @text-red if result != "Approved"
→ status ≔ { "Approved", if σ ≤ σ_allow ; "Rejected", otherwise }      Approved   (green)
```

- **Cost:** small. The engine override at setup and changes to `typeset.ts`, `display.ts` and the tests.
- **Things to choose:**
  - case-sensitivity (Mathcad compares exactly; Excel ignores case);
  - whether `"10" == 10` stays `true` (math.js's conversion);
  - whether a quoted result reads clearer in a table (Mathcad keeps quotes, and has no setting).

### B. Mathcad's `if(c, a, b)` function (and `error`)

An app function, lazy, beside `? :`, for users who know Mathcad, SMath, Calcpad or Excel:

```
check = if(u <= 1, "OK", "NOT OK")
→ check ≔ { "OK", if u ≤ 1 ; "NOT OK", otherwise }      OK
```

- **Options:**
  - typeset the same brace as `? :`, so source differs and the page is the same;
  - an `ifs(c1, v1, c2, v2, …, default)` for a flat multi-way;
  - `error("σ exceeds the limit")` to make a branch the line's error.
- **Cost:** small per function. They become reserved names, and `if` is also the rule keyword after an `@` word
  (it stays unambiguous, but reads twice on a line with a rule).

### C. A flat `else if` brace

The typesetter flattens nested `? :` (and B's `ifs`) into one brace with one row per branch, as Mathcad Prime's
`if` / `else if` / `else` reads:

```
band = sigma < 100 MPa ? "low" : sigma < 140 MPa ? "mid" : "high"
→ band ≔ { "low",  if σ < 100 MPa
           "mid",  if σ < 140 MPa
           "high", otherwise }        mid
```

- **Cost:** `typeset.ts` only.
- **To choose:** the wording of each row ("if", "else if", "otherwise") and the order (Mathcad puts the value
  first in 15, but `if` first in a Prime program).

### D. A program across lines (Mathcad's vertical bar)

A block of lines that makes one value: local names, `if` / `else if` / `else`, `for`, `while`, `break` and
`return`, drawn with a bar. One possible source form, among others, in which the indented lines belong to the
program:

```
classify(u) = program
    if u <= 0.9
        return "OK"
    else if u <= 1
        return "OK (near limit)"
    else
        return "NOT OK"
check = classify(sigma / sigma_allow)
→ check ≔ classify(σ / σ_allow)      OK
```

- **Cost:** large.
  - A new ADR amending 0003 and 0005.
  - The line model gains blocks: split, join, copy, undo, reading order and the open-line editor must each handle
    a partial block.
  - An app interpreter with an iteration cap and a message for it.
  - A per-line error inside a block, and one result for many rows.
  - A typeset bar across rows.
- This is the "A program across several lines" fog on the map. Most checks don't need it (A, B or C cover
  them). Loops are its real gain, and today `map`, `filter`, recursion and ranges cover sweeps.

### E. Local steps on one line (`;`), specified

Specify what already runs:

```
w = (a = b * h; a * h^2 / 6)        ← does not parse today
x1 = 5; y1 = x1 * 2                  ← runs today: [10]; x1, y1 defined below
```

- **Choose between:**
  - make `;` an error, which keeps "one statement per line" true;
  - allow it with a defined display: the last value, not `[10]`, and the names it defines in the Variables tab;
  - an app form for local steps in a function body.
- **Cost:** small to forbid; medium to define. math.js can't parse a block in parentheses, so local steps in a
  body would be the app's.

### F. Calcpad-style directive lines (`if …` / `else` / `end` as their own lines)

Lines that show or hide the lines between them, such as a comment line "Approved" under a branch:

```
if sigma <= sigma_allow
    # Approved
else
    # Rejected — increase the section
end
```

- **Cost:** large, for the same reasons as D: the sheet would have control flow across lines. A hidden line's
  names are undefined below, and the reading order spans elements.
- `#` is the comment, so Calcpad's spelling isn't available.
- Included for contrast. A + a rule already gives the coloured verdict.

**Recommended to put first to Matheus:** A (needed by every other option, and it makes the ticket's own example
work), then whether B and C are wanted for Mathcad familiarity. D and F are the scope question the map's fog
names.

## Unverified and open points

- **Mathcad:**
  - how an error inside a branch is highlighted;
  - whether units must agree between branches;
  - how nested programs are drawn;
  - the exact keyboard shortcuts.
- **SMath:** the `for` syntax, and whether a string result shows quotes.
- **Excel:** `TRUE` / `FALSE` display and case-insensitive `=` (third-party sources only).
- **A vendor report using ✓:** not found.
- **Not probed in the app:**
  - KaTeX rendering of `cases` in the grid, and the row height it gives;
  - the Variables tab and Problems with a text value;
  - print.
- **The proposed engine override:** probed in a fresh math.js instance, not inside the app's hardened instance.
  The Engineer should confirm it before `import` is disabled and pin it with a test, along with that
  `typed(old, new)` merging still works on a math.js upgrade.
