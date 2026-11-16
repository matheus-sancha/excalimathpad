# math

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**math** (`src/math/`) — the engine. Interface: `evaluateSheet(blocks)`,
with blocks `{ id, source, formats }` already in reading order (`formats`
is the anchor's stored formats: each line is read as `withFormat(text,
entry)`, its stored clause after any clause typed in its text, ADR 0005 step
2; a line that doesn't parse shows as its text alone) → one `SheetLine` per
line, keyed by block id; never throws: each line is read inside one guard,
its parse included (a parse that threw is rethrown there; `statementNames`
still gives the names it assigns), so a throw from outside a line's own
handling is that line's error and the lines below still run (spec section 4,
Unexpected failures, #193): the message is `UNEXPECTED_LINE`, the result's
`unexpected` holds the failure's raw text and stack, and the typeset form is
the raw source. A `SheetLine` is the line's
`LineResult` (value | error | empty) and its `TypesetLine`, from the same
parse: blank, comment, math (name, expression and note, as TeX) or unparsed
(raw source). `lineForm.ts` (pure) reads a line's comment and its format clause
(`@bold @text-red @yellow`, from the first `@` outside a string) before math.js
sees it (ADR 0005), so a note or a format never reaches math.js. A word with
`if <condition>` is a rule (`FormatRule`: its `words`, condition, exact
`text` and its `start`/`end` in the line). From M4d (#145) a word can be
**joined**, `@text-red+red+bold`: one word, one rule with an `if`; a part
that isn't a format is `Unknown format @blod in @text-red+blod`. `writeRules`
writes a Rules list's `RuleRow`s (a row with its `text` is kept exactly; one
without is `ruleText`, one joined word and one condition), `newRule` is
+ Add rule's row (M4e, #197) and `conditionText` what a condition's field
takes (no `@` or `#` outside a string; `ruleText` also closes a string left
open, so a written rule always reads back as one rule); `writeFormat`
composes the plain words back for the Format tab in a fixed order and keeps
every rule, and `writeCommentFormat` a comment line's (`@bold @upright
@underline @<size> @text-<name> @<highlight>`, M4d, #144); `caretAfterFormat`
says where a press leaves the caret (in the code; in a comment's text, with
its `#`). **The stored format** (spec section 3, Where a line's format
lives, M4e, #195) is also `lineForm.ts`'s, pure: `splitFormat` takes a
line's clause out of its text, `joinClauses` puts a typed clause in front of
a stored one (a typed plain word replaces the stored word of the same
property; rules are all kept), `withFormat` is the line as the engine reads
it, `commitFormat` is what a line commit writes, and `lineFormats` /
`storeFormats` read and write `customData.formats` (one entry per line,
padded or cut; an entry that isn't a clause is none; no text at all for no
format). `pressFormat`, `pressCommentFormat` and `pressRules` are what a
Format tab press writes: the stored clause, and the text only where a clause
typed in it has to move (plain words with a Format tab press, rules with a
Rules list write). A math line carries its `LineFormat` (bold, underline, highlight, text
colour); an unknown clause word is the line's error, reported after the line
ran. A clause's first problem is the form's `formatError`, in section 13's
words (`Unknown format @blod`, and a comment word on a math line, `@L is for
comment lines`). Code that is only a clause is a **formatted comment line**
(M4d, #142): the clause is the comment's `CommentFormat` (a line's words,
`@upright` and a size, `@S`, `@L` or `@XL`; M is the size without one), a
rule there is its error (`rules need a math line`), and with no text after
the `#` the line is blank. A comment line's error is its result; it defines
nothing, so nothing below fails. After a line runs, `runRules` (in `evaluate.ts`) tests its rules in a
`LayeredScope` over the scope with `result` bound, so a condition never
reaches the next line; the first true rule wins per property over the plain
format (`resolveRules`), and the typeset format is the result;
`SheetLine.ruleTruth` says which rules were true for the line's own row (on a
list, at every point; never on a table), so the Format tab names the rule
that sets a property (#144), and `SheetLine.ruleStates` is each rule's
live state for the Rules list (#145): true, false, overridden, a count of
points or rows, or the warning that skipped it. A condition
that can't be decided is one warning per rule. On a list it runs per point
(the summary takes the format only if all are true; the hover counts them);
on a table, per row (`TableView.rowFormats`). `typeset.ts` is the
`toTex` handler of spec section 4, Typesetting names; a name counts as the
sheet's from the line that assigns it down. It also draws **Conditionals and
text, typeset** (#141): `? :` and a three-argument `if()` are one `cases`
brace (`casesTex`), a conditional in the last branch (bracketed or not)
adding rows to it, one in an earlier branch its own brace in its row, and
a brace that is an operator's operand (not a fraction's) in brackets; a
text constant is `\text{“…”}` and `true` / `false` are `\mathrm`. `typesetResult` sets a result's
`math.format` text as number and unit. A plain
input and any line whose value is a function are empty, and their value still
reaches the lines below. All lines
share one scope, fresh for every call (ADR 0003). Each line is parsed once
(captured `parse`) to know what it defines, which turns "Undefined symbol"
into "defined below" / "has an error above". Every known route for an
expression to change the shared math.js instance is closed, each with a
test: `createUnit`, `config`, `import`, `help` (its texts are in neither
build, `noHelpTexts.ts`) and the parser functions are disabled in the namespace (scope-only stubs are bypassed via `parser()`),
and `typed` is shadowed in each run's scope (it cannot be overridden in
the namespace without breaking math.js). Parsed Nodes from `simplifyCore`
/ `simplifyConstant` evaluate against the namespace, where `typed` is the
real registry, so its mutators (`clear`, `addConversion`, ...) are also
disabled in place on `math.typed`. The app units (`appUnits.ts`: `cP`,
`gpm`, ...) are registered once at setup, before `createUnit` is disabled,
and every unit system is then put back as it was, so they show only where
written (spec section 14; a test compares with an engine without them).
A result's `text` is its plain form at 4 significant digits
(`numbers.ts`, pure: `math.format` with `formatOptions`, then `1.235·10⁴`,
`∞`); `resultTex` typesets it (`1.235 \cdot 10^{4}`). Source numbers are
never reformatted. `pump-sizing.test.ts` runs the acceptance sheet's lines,
read from `docs/acceptance/pump-sizing.md`, against the reference at 4 s.f.
(spec section 16); `true-position.test.ts` runs the second sheet's
(`docs/acceptance/true-position.md`, M4e, #202) with the `check` line's
format passed as stored (`SheetBlock.formats`), its chart included (spec
section 15). math.js's own unit system stays fixed at SI, so
units read elsewhere never change a result (#25, ADR 0003). How a result
shows is the app's formatter, `display.ts` (`createDisplay`, given the
instance and the captured `parse`, spec section 5): a trailing `in <unit>`
(`lineForm.ts` takes it off the text, the formatter checks it is a pure
unit, read outside the sheet's scope) shows the value in that unit,
balanced if the kind differs; else the kind's unit in the sheet's system
(`unitSystems.ts`: SI with prefixes by default, SI base, USCS, Custom),
else a named SI unit (`V`, `ohm`), else composed base units.
`evaluateSheet(blocks, settings)` takes the system and Digits. An unknown
display unit is the line's error after it ran. Each `SheetLine` also
carries its `warnings` (`warnings.ts`, pure, read before the line runs).
Each function the sheet defines is wrapped once its line has run
(`functions.ts`, `createCalls`): the wrapper checks the argument count,
stops recursion at a fixed depth, prefixes an error from its body with
`in k(1 s): `, and carries `sheetFunction` (name, parameters); `messageOf`
rewords math.js's errors (a value called, a function used as a number) in
section 13's words. `table`, `plot` and `solve` can't be assigned, nor
`if` (a function, with its own message).
**One statement** (spec section 3, ADR 0005 step 6): `hasTopLevelSemicolon`
(`lineForm.ts`, pure) finds a `;` outside brackets and strings, and
`parseLine` makes it the line's error before any line form is read; every
name the line assigns fails. A `;` in a matrix (`[1, 2; 3, 4]`) is
math.js's.
**Conditionals and text** (spec section 3, M4d; `conditionals.ts`, given
the instance at setup, before `import` is disabled): `if(cond, a, b)` is a
raw-args function in the namespace (`IF_FN`), so only the branch taken
runs. `testCondition` takes only `true` or `false` (a matrix or a list is
its own message), for `if()` and for `? :`, whose `_compile` on this
instance's `ConditionalNode` class `strictConditionals` replaces, so the
node and its text are math.js's own (its TeX is `typeset.ts`'s). `comparisonSignatures` merges
signatures into `equal`, `unequal`, `larger`, `largerEq`, `smaller` and
`smallerEq` (`math.import` merges typed functions): two texts compare
exactly with `==` / `!=`; `<` on text, text against a number or a unit, and a
unit against a bare number are the app's errors, the last naming both values
in the run's settings (`messageSettings`, set by each `evaluateSheet`). A text
shows plain (`display.ts`); `in <unit>` on a text is the line's error after
it ran; a list whose points are all texts summarises as each text counted,
most frequent first (`3 OK, 1 NOT OK`, failed points last).
**Constants** (spec section 5, `constants.ts`, pure data): every math.js
constant in groups, some with a short name (`c`, `k`, `R`, `h`), which
`registerShortConstants` adds to the namespace once at setup. `h` is the
Planck constant, so the hour is `hr`. A short name the sheet also assigns is
the sheet's on every line: `SheetScope` (the run's scope) answers math.js
"Undefined symbol" for it until its line has run, which `explain` words;
the engine's own reads use `holds` and `peek`. `listConstants` gives the
Constants tab its rows.
**The Symbols catalogue** (spec section 4, Symbols tab, M4d; `symbols.ts`,
pure data, no math.js): `SYMBOLS`, every button of the Symbols tab in its
group (`SYMBOL_GROUPS`: Greek, Operators, Functions, Logic, Sheet forms) and
order, each a `SymbolEntry`: its `label` (ρ, √), its `spelling` (`rho`,
`sqrt`), its `hint`, its Greek `row`, the `constant` a Greek letter also is
(read from `CONSTANT_GROUPS`), a sheet form's runnable `example`, and its
`insert`, a `SymbolInsert`: `mode` (`name`, `word`, `prefix`, `spaced`,
`tight`, `wrap`), `text` and `close`. `guess` is `hidden`: a typing
suggestion, not a button. `filterSymbols` and `symbolHover` are the tab's
filter and hovers. It adds no grammar: a test types every entry into a
minimal line and runs it.
A **solve line** (spec section 9) is read as text before math.js sees it
(`solveLine.ts`, pure): a **solved value** is `<name> = solve <lhs> = <rhs>,
for <unknown> = <from> .. <to>` and a **solve function** is
`<name>(<params>) = solve …, guess <unknown> = <expr>`; either one with the
other's clause, or none, is the line's error. Its sides and clause are
parsed with the captured `parse` and compiled once (`solve.ts`,
`createSolver`). Each run evaluates the guess or the range's ends in the
scope at that point with the unknown hidden, then the residual `lhs - rhs`
in a `LayeredScope` where the unknown wins, reduced to SI numbers, so a
dimension mismatch is the app's message. `solver.ts` (pure numbers) has two
searches. `solveNear` steps out from a guess for a sign change, skipping
points with no value (NaN), then runs Brent to 1e-12 relative, 100
iterations at most. `solveRange` samples 200 points of the range, runs Brent
on each sign change, keeps a crossing only if its residual is at most 1e-6
of its samples' (a pole or a jump isn't a root), and runs a dip pass (golden
section) for double roots; more than 100 roots is an error. The solved value
runs once at its line and holds its roots, ascending: one root is a single
value, several a `SheetList`. It refuses a list in its equation or range
(an index on one is fine). The solve function defines a wrapped function
(`sheetFunction.solve`) that solves at each call over the scope as it is
then. A failure throws a `SheetError`; a guess solve's no root and no
convergence are marked `outsideDomain`, which the `in f(…):` wrapper keeps,
so an outer solve counts a trial point where an inner one failed as having
no value there; every other error fails the outer line at once. A solve's
details ride on its line's `solveDetails` (and on a line that is just one
call to a solve function): a guess solve's method, iterations, residual in
SI and bracket; a range solve's range, points, each root with its residual
and touching mark, and the crossings rejected.
**Lists** (spec section 10, `lists.ts`): a `SheetList` holds point results
(a value or an error) and the first list its line ran over, to name a failed
point. A range line is read as text (`rangeLine.ts`, `[name =] a .. b [step
s]`) and `createRanges` steps it in SI numbers, in the start's unit. A line
whose names include a list runs once per point (`iterate` in `evaluate.ts`):
each list name bound to its i-th value in a `LayeredScope`, lists paired,
one compiled expression, no math.js matrices; a point that throws fails
alone. An aggregate (`min`, `max`, `sum`, `mean`, `count`) over a list is
worked out first and stands in the node as a bound name (`foldAggregates`).
A function body that names an outside list fails at its definition. An
**index** (`indexes.ts`, spec section 3) is the app's: after the parse
(`parseSheet`), each `name[i]` becomes a call to `__index`, a raw-args
function in the namespace that reads the name whole and takes its `i`-th
point, counting from 1 (a single value is a list of one). A name inside an
index never makes a line iterate (`withoutIndexes`), and `iterate` works out
an index on a whole list first (`foldIndexes`), so `Q_s[2] + Q_s` reads the
list. The typesetter shows it as `x_r[2]`, brackets at the baseline. A list
result is `{ kind: 'list', text, failed }`: its summary, and the line's
error when points failed. A **table line** (`tableLine.ts`, `table(arg, …)`,
each argument with its own `in <unit>`) gives `SheetLine.table`: columns
(header TeX, unit, a header unit slot) and every row's cells in the table
number form (`tableColumn` in `numbers.ts`: zeros kept, whole columns whole).
The overlay draws it as a second grid row inside the line's row; a header
slot is `data-unit-slot="line:column"`, and choosing a unit writes it onto
that argument (`writeArgumentUnit`). A **plot line** (`plotLine.ts`:
`plot(x, y1, …)`, then clauses) gives `SheetLine.plot`, a `PlotView` of plain
numbers in each axis's unit (null for a failed point), marks, failed points
and settings. From M4e (#200) it also holds `dots` (the two-value form and
each `point`, with its label), `circles` (centre and radius along each axis)
and `equal` (y's units per x's unit, for equal scales; the size is then
square); `readPair` and `readCircle` (`plotLine.ts`) read the clauses' text
and `runPlot` checks their values (section 13's M4e rows). `PlotChart.tsx`
draws it under the line with Observable Plot, imported by name in
`plotMarks.ts` and loaded once behind `import()` (`plotDrawing.ts`), rebuilt
only when the view changes; `plotLayout.ts` (pure) works out the ranges, the
equal scales, the ticks and all four margins first, restating D3's ticks and
tick format so a margin fits the very text Plot draws; legend and title are
HTML, typeset; each failed point's × carries its message as `data-tip`. The
panel run holds the charts in Chromium (jsdom lays nothing out). Its ⚙ (`data-unit-slot="line:gear"`, the slot
target's column `GEAR`) opens `PlotSettings.tsx` on the canvas's click, as a
unit slot does; each change hands back the clause list, which the overlay
writes with `writePlotClauses` as one line commit.
**The limit on math.js's own range and builders** (spec section 10, M4e,
`limits.ts`): `guardEngine(math)`, called last in the engine's setup, wraps
what a line can call (`math.expression.mathWithTransform`; math.js's own code
keeps the functions it was built with) so each guarded function checks its
arguments before it runs: `range` (which `a:b` compiles to) for its points
and its ends, the builders for the values they would build (`builds`), and
the slow calls for their bounds (`SLOW_ARGUMENTS`, `SLOW_BIG`, `SLOW_VALUES`,
`SLOW_PAIRS`, `SLOW_COUNTS`; spec section 14 lists them). A refusal is a
`LimitError`, a `SheetError` worded from the values; the line's own catch
words it as typed with `wordLimit`, which finds the call by running each
candidate node again, innermost first (a refused call stops at its check).
`iterate` refuses a list line whose points would hold more than the limit
between them. `MAX_POINTS` in `lists.ts` is the one number. `largeMatrix` in
`evaluate.ts` shows a matrix of more than 20 values as a list result: a row
of values through `listSummary`, a matrix by its size, with `listPreview`.
`engineFunctionNames()` lists what a line can call, for the sweep test
(`sweep.test.ts`, whose calls run in a child process, `src/test/sweepChild.ts`).
App code must evaluate only
through `evaluateSheet`: math.js functions that depend on the disabled
names (`help`, `rationalize`, a `parser()`'s methods) no longer work. The
only module that imports `mathjs`. Depends on: `mathjs`.
