Research for wayfinder ticket #173, 2026-11-15.

# Which half-typed lines make the engine or the view throw?

Everything here was observed by running the code, at two commits: **0.2.0**
([`32ad990`](https://github.com/matheus-sancha/excalimathpad/tree/32ad9906e80a78285781878d28c9c4d1e2403d76),
the code Matheus crashed) and **the hotfix**
([`6dd4030`](https://github.com/matheus-sancha/excalimathpad/commit/6dd40305881a551393bde8dce73b28d9c2c292fa),
"A complex value with a unit is a line error, and one line's throw stays on its line", #179). The three
harnesses are in [`half-typed-lines/`](half-typed-lines/); no app code was changed. A claim marked
**inferred** was read from the source and not run.

## Answer

**One cause throws, and the hotfix removed it. Nothing else throws, in the engine or in the view, across
about 180,000 typed states. But three lines that don't throw freeze the sheet or kill the tab, and no
guard can catch those.**

| # | Cause | Where | 0.2.0 | Hotfix | Shortest sheet |
|---|---|---|---|---|---|
| 1 | A **named list of complex quantities** (a list, times a unit, times `i`) is summarised for the Variables tab outside the line's own error handling | engine | **throws**, the view unmounts | line error `a complex value with a unit can't be shown` | `w = 0 .. 4` then `k = 2 i m * w` |
| 2 | math.js's own range `a:b` with **an infinite end** builds an array until memory runs out | engine | not run (**inferred** the same: the hotfix didn't touch it) | **freezes 6 to 7 s per keystroke, 1.1 to 2.6 GB**, then the line error `Invalid array length` | `log(0):5`, or `1:1/0` |
| 3 | math.js's own range `a:b` and its matrix builders have **no size limit** | engine | not run (**inferred** the same) | **freezes for tens of seconds, or the process dies** | `1:1e7` (43 s, 2 GB), `zeros(1e8)` (dies) |
| 4 | A stray `%` turns a range into 100 times the points, and each point is solved again for the table and again for the plot | engine | not run (**inferred** the same) | slow, not frozen: the pump sheet goes from 41 ms to about 600 ms per keystroke | the pump sheet with `Q_s = 1 L/s .. 30 L/s% step 1 L/s` |

Cause 1 is Matheus's crash and the only throw. Causes 2 to 4 were not asked for by the ticket's words
("throws") but are the same failure for the user, and worse for 2 and 3: the line being typed is lost
with the tab.

**The typing test is cheap enough to keep in `npm run check`** in its plain form: every guide example,
the true-position sheet and the pump sheet, one character at a time, through the engine and the view,
is 4,765 states in **59 s on one core** (28 s for the engine alone; 9 s for the true-position sheet
alone). The suite today is 78 s of wall time on 4 cores, 240 s of CPU. The wide runs (typos, 10 to 12
minutes each) are not for CI.

## What was run

Three harnesses, each validated against 0.2.0 before its result on the hotfix was trusted.

**1. The typing harness** ([`typing-harness.test.tsx.txt`](half-typed-lines/typing-harness.test.tsx.txt),
vitest and jsdom). The sheets are the 13 sections of `docs/math-guide.md` that hold examples (each
section's examples as one sheet, as `src/math/math-guide.test.ts` runs them), the map's true-position
sheet, and the 43 lines of `docs/acceptance/pump-sizing.md`: 195 lines. For each state it calls
`evaluateSheet`, then does what the app does with the result at a keystroke:

- `readLine` and `readPlot` on the typed text, `suggest` at the caret with the sheet's names,
  `variableGroups` and `problemRows` (the Sheet panel's rows);
- renders `LineSample` (the same `TypesetRow` the grid draws: KaTeX, the result cell, the list
  preview, a table, a plot's title and legend) for every line the keystroke changed, the lines below
  included;
- renders the `FormatTab` on the typed line (the sample, the buttons, the Rules list);
- calls `drawChart` with Observable Plot on every plot the evaluation returns.

It records every throw with its stage, every throw the per-line guard caught (through a one-line
hook added to the guard for the run and removed after), every `console.error`, and every stage over
150 ms.

| Mode | What is typed | States | Throws at the hotfix | Guard catches |
|---|---|---|---|---|
| A | each line, one character at a time, the lines above in place | 4,765 | 0 | 0 |
| B | the same, with the lines below in place (an edit in a finished sheet) | 4,765 | 0 | 0 |
| D | each finished line with one character deleted, at every position | 4,765 | 0 | 0 |
| T | a stray token after every second prefix (26 tokens: ` i`, `[`, `"`, `..`, `%`, ` @`, `#`, ` in `, `,`, `(`, `)`, `=`, `;`, `^`, `/`, ` mm`, `.`, `:`, `!`, `-`, ` to `, ` if `, ` step `, `@bold if `, and so on) | 63,310 | 0 | 0 |
| M | one of 12 tokens inserted at every position of a finished line, lines below in place | 59,700 | 0 | 0 |

At 0.2.0, mode A finds exactly one throw: `zone_x = r_t cos(theta) i` on the true-position sheet,
`TypeError: Unexpected type of argument in function number`, from `Unit.toNumber` called by
`systemUnit` (`src/math/display.ts:106` at `32ad990`). That is the fact the map's Notes hold, so the
harness sees what Matheus saw.

**2. The odd-values probe** ([`odd-values-probe.test.tsx.txt`](half-typed-lines/odd-values-probe.test.tsx.txt)).
Typing the guide only meets the values the guide uses. The crash came from a value of a kind no line
expected, so the probe sends 58 values (complex, complex with a unit, matrices, strings, booleans,
`1/0`, `0/0`, `1e400`, `null`, ranges that are empty, reversed, complex or mixed in unit) through 88
uses (`in mm`, `* i`, times a list, an index, `if`, `sum`, a function body, `table`, `plot` and each of
its clauses, `solve` and its guess, a format rule, a range's start, end and step), each bare, bracketed
and assigned to a name that a later line, a table and a plot then read: **39,802 sheets**, through the
engine, the panel rows, `LineSample`, `FormatTab` and `drawChart`.

- At the hotfix: **0 throws, 0 guard catches.**
- At 0.2.0: **206 throws, all cause 1**, all at `src/math/display.ts:106`. The shortest is
  `w = 0 .. 4` then `k = 2 i m * w`; others are `k(a) = 2 m * i` then `q = k(w)`, and `k(a) = i * u`
  then `q = k(w)` with `u = 3 mm`.

The probe's first version had no named results and found nothing at 0.2.0. The throw needs the name:
the list's summary for the Variables tab (`variablesOf`) is what ran outside the line's handling. The
same list as a bare expression was already a line error at 0.2.0.

**3. The browser run** ([`typing-browser.mjs.txt`](half-typed-lines/typing-browser.mjs.txt), made from
`scripts/touch-run.mjs`). The built plugin (`dist-plugin/main.js` of the hotfix) in headless Chromium
against the fake `obsidian`, at 1400 × 900. A real double-click opens a line, and real key presses type
all 195 lines, Enter between them, with the Sheet panel open on Format as the app opens it. **4,765 keys,
0 page errors, 0 console errors**, the element still drawn and the field holding the typed line after
every line, the charts drawn. This covers what jsdom can't: `MathOverlay`, the measured sizes, the open
field, real KaTeX layout and Observable Plot in a real SVG.

## Cause 1, and where a throw is caught

At 0.2.0 `evaluateSheet` threw, and it runs inside a `useMemo` during `MathOverlay`'s render
([`src/overlay/MathOverlay.tsx:280`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/src/overlay/MathOverlay.tsx#L280)).
The app has **no error boundary**: a search of `src/` and `plugin/` for `componentDidCatch`,
`getDerivedStateFromError` and `ErrorBoundary` finds nothing, and both roots are a bare `createRoot`
with no `onUncaughtError`
([`src/main.tsx:22`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/src/main.tsx#L22),
[`plugin/SheetView.ts:271`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/plugin/SheetView.ts#L271)).
So a throw in any render takes the whole view down, canvas and drawings included (**inferred** from
React's rule for an uncaught render error; the map's Notes record that it happened).

What catches a throw today, at the hotfix:

| Place | What it catches | What the user sees |
|---|---|---|
| Each line's own handling in `evaluateLine` (about 25 `try` blocks in `src/math/evaluate.ts`) | every error math.js or the sheet raises while a line is parsed and run | the line's error, in the words of section 13 where the sheet has them, else math.js's |
| The per-line guard ([`src/math/evaluate.ts:622`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/src/math/evaluate.ts#L622), added by #179) | anything else thrown while one line is read: its warnings, its typeset form, its rules, its variables | that line's error with the raw message, the line shown as plain text, the lines below still run |
| `texToHtml` ([`src/overlay/katex.ts:50`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/src/overlay/katex.ts#L50)) | TeX that KaTeX can't render | the line's source as plain text |
| **Nothing** | `parseLine` for every line, which runs before the guard ([`src/math/evaluate.ts:570`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/src/math/evaluate.ts#L570)): `readLine`, `readPlot`, `display.readTarget`, `statementNames` | the view unmounts |
| **Nothing** | every React render: the grid, the panel's tabs, the sample, the suggestions | the view unmounts |
| **Nothing** | `drawChart`, called in an effect ([`src/overlay/PlotChart.tsx:36`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/src/overlay/PlotChart.tsx#L36)) | the view unmounts (**inferred**: an effect's throw is an uncaught error too) |

None of the three unguarded places threw in any run. The guard itself caught nothing in any run, so at
the hotfix it is a net with nothing in it: every state reached a worded line error or a value by the
line's own handling.

## Causes 2 and 3: a line that freezes or kills the tab

The sheet's own range, `a .. b`, stops at 10,000 points with the line error
`x has more than 10,000 points`
([`src/math/lists.ts:53`](https://github.com/matheus-sancha/excalimathpad/blob/6dd40305881a551393bde8dce73b28d9c2c292fa/src/math/lists.ts#L53);
observed: `x = 0 .. 1e9` answers in 12 ms). math.js's own range, `a:b`, and its matrix builders pass
through with no limit. Each line below was run alone, in its own process, with a 2 GB heap and a 90 s
limit:

| Line | Time | Memory | Result |
|---|---|---|---|
| `log(0):5` | 7.4 s | 1.1 GB | `Invalid array length` |
| `1:1/0` | 6.6 s | 2.6 GB | `Invalid array length` |
| `w = 0 .. 2` then `log(w - 2):5` | 6.0 s | 1.1 GB | "3 of 3 points failed" |
| `1:100000` | 1.0 s | 240 MB | the whole matrix as the result's text |
| `1:1000000` | 5.6 s | 562 MB | the same |
| `1:1e7` | 43 s | 2.0 GB | the same |
| `0:1e-7:1` | 38 s | 1.9 GB | the same |
| `ones(3000,3000)` | 27 s | 1.1 GB | the same |
| `zeros(1e8)`, `range(0,1e8)` | | | the process died, out of memory |
| `identity(5000)`, `nthRoots(2, 1e7)` | | | still running at 90 s |
| `combinations(1e9, 5e8)` | 32 s | 232 MB | `NaN` |

The times are the engine's alone. The view then typesets the result's text, a matrix of up to millions
of numbers, through KaTeX; that cost was **not measured**. The sheet evaluates at every keystroke, so a
freeze repeats on each key until the line changes, and the keys typed meanwhile queue behind it.

How a half-typed line gets there: `log(w - 2):5` came out of the probe, not out of the guide, and `:`
is a typo away from `;` and `.`. The typo runs (T and M) put a `:` after every second prefix and found
no freeze in the guide's lines, so on the sheets Matheus has written this is rare. It is listed because
its cost is the highest of the four and because the per-line guard, or any `try`, cannot stop it: the
loop is inside math.js and JavaScript has one thread.

Checked and fine: `f(n) = f(n - 1)` gives `f calls itself without end` in 11 ms; `1e8!`, `9^9^9` and
`gamma(1e7)` give `∞` at once; a 10,000-point list through a table (406 ms) and a plot (170 ms).

## Cause 4: slow, not broken

The pump sheet evaluates in a median 41 ms. With one stray `%` in its range,
`Q_s = 1 L/s .. 30 L/s% step 1 L/s`, the range has 3,000 points in place of 30 (observed:
`3000 values, 0.001 … 3 m^3 / s`), and the sheet takes about 600 ms: 328 ms more at `table(Q_s, Hs(Q_s), Hp(Q_s))` and 538 ms more at
`plot(Q_s, Hs(Q_s), Hp(Q_s)), mark Q_op`, each of which runs the nested solve at every point again.
Nothing is lost; typing lags while the `%` is there.

The engine holds no memory between runs: 20,000 evaluations of a sheet with a 181-point plot stayed at
86 to 92 MB of heap, 3.3 ms each.

## Is the test cheap enough for `npm run check`?

| Variant | States | One core | Finds cause 1 at 0.2.0 |
|---|---|---|---|
| Mode A, the true-position sheet only, engine and view | 561 | 9 s | **inferred** yes: it is the line that throws |
| Mode A, all 195 lines, engine only | 4,765 | 28 s | **inferred** yes: the throw is the engine's |
| Mode A, all 195 lines, engine and view | 4,765 | 59 s | yes |
| Modes B and D | 4,765 each | 84 s, 118 s | (not run at 0.2.0) |
| The odd-values probe | 39,802 | 458 s | yes, 206 times |
| Modes T and M | 63,310 and 59,700 | 662 s and about 600 s | (not run at 0.2.0) |
| The browser run | 4,765 keys | 158 s | (not run at 0.2.0) |

`npx vitest run` today: 78 s of wall time, 240 s of CPU, on this 4-core machine, in 67 files. Mode A
with the view is one more file of 59 s. Vitest runs files side by side, so the wall time should grow by
less than that (**inferred**, not measured together). Mode A reads its lines from the guide and the
acceptance sheet, so it grows with them and needs no list of its own.

Two things the harness needed that a kept test must keep: it calls testing-library's `cleanup` every
200 states and keys its "already drawn" set by a hash, because without them it ran out of memory itself
(a leak in the harness, not in the app).

What mode A does not cover, and the other runs did once: values no guide example uses (the probe),
typos (T, M), and the real browser. They found nothing at the hotfix, and they are too slow for every
commit.

## What this leaves open

- The guard's words. An unexpected throw shows math.js's raw message
  (`Unexpected type of argument in function number (expected: number or BigNumber or …`). No state
  reaches it today, so the choice of words is free.
- The three places with no catch (the parse stage, every render, the chart's effect) did not throw in
  180,000 states. Whether they get a guard anyway is a rule, not a finding.
- Causes 2 and 3 need a limit or a refusal before math.js runs, not a catch. Which lines to refuse
  (`:` ranges, the matrix builders, a result's size) is not decided here.
