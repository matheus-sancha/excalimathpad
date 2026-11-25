Research for wayfinder ticket #345, 2026-11-25.

# How far math.js's `resolve` and `simplify` get on combined engineering formulas

Question: using only math.js as the app has it, how good is the result of
substituting assigned lines into each other (`resolve`) and tidying it
(`simplify`, `simplifyCore`, `rationalize`) on realistic engineering formulas?
Where is the form untidy or wrong, how long does it take, can it be made safe,
and does the reason these functions were dropped before still hold for a new
use: showing a combined formula as a result?

How to read the sources: "observed" means run on 2026-11-25 with math.js
15.2.0 (the version `package-lock.json` pins) on Node 22.23, with throwaway
probes that are not committed. The repository had no `node_modules` in this
session, so math.js 15.2.0 was installed into a scratch directory and the
probes ran there, against plain `create(all)` and against a copy of the app's
disable list. Nothing was run through the app's own engine or its `toTex`
handler; what rests on that is marked **unverified**. Links to math.js are to
its `v15.2.0` tag. `mathjs.org` was blocked by the session's network policy;
the same documents were read from the repository at that tag.

## Answer

- **`resolve` is good and cheap.** It substitutes one line into another
  exactly, keeps brackets where they are needed, follows chains, and refuses a
  loop. 0.0 to 0.2 ms on the five formulas (observed).
- **`simplify` gets the algebra right on all five formulas, and writes it
  untidily.** Every result had the same value as the input at test numbers
  (observed). But the form is a chain of divisions and negative powers:
  `4 * F / d ^ 2 / pi`, `pi ^ 3 * E * d ^ 4 * L ^ (-2) / 64 / K ^ 2`. Typeset,
  that is a fraction inside a fraction. Four extra rules of our own, run as a
  second `simplify` pass, turn most of them into one fraction
  (`4 * F / (d ^ 2 * pi)`); von Mises and a few coefficients stay rough.
- **`simplifyCore` does nothing useful here**, and **`rationalize` is not
  usable**: it writes `0.08333333333333333`, throws on `sqrt`, and did not
  answer in 20 s on `(a+b)^6`.
- **A unit literal becomes a plain symbol.** `2 m * (a + 3 m)` comes back as
  `2 * (3 * m ^ 2 + m * a)`. The algebra is right, the look of a quantity is
  lost, and units of the same kind are never combined (`2 km / 2 m` stays
  `km / m`).
- **Time: 2 to 25 ms for these formulas, with no upper bound.** A sum of 20
  terms took 10 s. `simplify('2/x^2 - x^(2*z)')`, six leaves, did not return
  in 20 s (observed; math.js issue
  [#3764](https://github.com/josdejong/mathjs/issues/3764) is open). No check
  on the input can promise an answer, so `simplify` can't run on the thread
  that evaluates the sheet on every keystroke.
- **It can be made safe for the engine, but only off the main thread.** The
  engine can keep its own `simplify` and `resolve`, as it keeps `parse`, and
  they work after the names are disabled for lines (observed on a copy of the
  disable list). The remaining risk is time, and only a worker that can be
  killed bounds it.
- **The earlier reasons don't cover this use.** Spec section 14's `simplify()`
  note is about a unit's `simplify()` method, not the algebra function. Its
  `rationalize` note is about reading a polynomial's coefficients for the
  solver. The functions are disabled so that a *line* can't call them. Nobody
  tried them for showing a combined formula.

## What was tried before, and why

Three separate things in the documents use these names. None of them is a
verdict on a combined formula.

- **"Results typeset from `math.format`'s text. `simplify()` gave a different
  prefix."** ([spec section 14, Engine](../spec-v1.md#14-engineering-constraints)).
  This is `Unit.prototype.simplify()`, the unit method, not `math.simplify`.
  The research it cites says: do not rebuild a result's unit from
  `unit.simplify()`, because `format` also picks the best prefix; `dP` formats
  as `36.45 kPa` and `simplify()` gives it in `mPa`
  ([`mathjs-katex-typesetting.md`](mathjs-katex-typesetting.md), recommendation
  5). It is a rule about typesetting a *value*, and it still holds for values.
  It says nothing about an expression tree.
- **"`math.polynomialRoot`, `math.eigs` and `math.rationalize` were tried and
  aren't used."** ([spec section 14, Engine](../spec-v1.md#14-engineering-constraints)).
  `rationalize` was tried as a way to learn that a solve line's residual is a
  polynomial and to read its coefficients. It was dropped because it throws on
  a unit in the scope, on a user function, on `sqrt(x)` and on a non-integer
  power, and took 3 to 571 ms
  ([`all-roots-solve.md`](all-roots-solve.md), "`math.rationalize` can't serve
  as the detector here"). Those faults are the same ones found below, so this
  reason does carry over: `rationalize` is no better for display.
- **`simplify`, `derivative` and `resolve` in `DISABLED_IN_EXPRESSIONS`**
  ([`src/math/evaluate.ts`](../../src/math/evaluate.ts), the list and its
  comment). The comment gives the reason: the list follows math.js's own
  hardening advice, so that one line can't change the shared engine or reach
  the parser from inside an expression. math.js's security page names exactly
  these: "`evaluate`, `parse`, `simplify`, `derivative`, and `resolve` which
  parse arbitrary input into a manipulable expression tree", under "extra (has
  functional impact)"
  ([security.md, Less vulnerable expression parser](https://github.com/josdejong/mathjs/blob/v15.2.0/docs/expressions/security.md#less-vulnerable-expression-parser)).
  The spec's only other mention is the message a line gets,
  `simplify is not supported in a math element`
  ([section 13](../spec-v1.md#13-messages)). `rationalize` and `symbolicEqual`
  are not on the list; they fail in the app because they are built after the
  override and depend on the disabled names (the comment above `const parse`
  in `evaluate.ts`).
- **`docs/spec-history.md` has no entry on symbolic `simplify`** (searched for
  `simplif`, `rationaliz`, `derivative`: no match). `project-size.md` only
  counts their bytes: `simplify`, `derivative` and `rationalize` are 25 KB,
  and `simplifyCore`, `simplifyConstant` and `leafCount` share their code
  ([`project-size.md`](project-size.md)).
- **Git history: unverified.** This checkout is shallow (137 commits, the
  oldest is #187), so the commit that first disabled the functions could not
  be read. [ADR 0003](../adr/0003-sheet-evaluates-in-reading-order-in-one-scope.md)
  calls it "the engine hardening from #2".

So the disabling is about who may call the functions, not about what they
return. An engine-level use, on Nodes the engine parsed itself, is the same
position `parse` is in today: disabled for a line, kept for the engine.

## Observed: the five formulas

Each formula was parsed, the scope's lines substituted with
`math.resolve(node, scope)` (the scope's values are parsed Nodes), and the
result passed to each function. TeX is math.js's own
`toTex({ parenthesis: 'auto', implicit: 'hide' })`, the options
[`typeset.ts`](../../src/math/typeset.ts) uses, without the app's handler.
Times are one call after a warm-up.

### sigma = F/A with A = pi*d^2/4

| Step | Result | Time |
| --- | --- | --- |
| `resolve` | `F / (pi * d ^ 2 / 4)` | 0.1 ms |
| `simplifyCore` | `F / (pi * d ^ 2 / 4)` (unchanged) | 0.2 ms |
| `simplify` | `4 * F / d ^ 2 / pi` | 8.2 ms |
| `rationalize` | `F / (0.25 * pi * d ^ 2)` | 12.2 ms |
| `simplify`, then the tidy rules | `4 * F / (d ^ 2 * pi)` | + 1.0 ms |

TeX of `simplify`: `\frac{\frac{4\cdot\mathrm{F}}{{ d}^{2}}}{\pi}`. After the
tidy rules: `\frac{4\cdot\mathrm{F}}{{ d}^{2}\cdot\pi}`.

### Bending stress M*c/I with I = b*h^3/12 and c = h/2

| Step | Result | Time |
| --- | --- | --- |
| `resolve` | `M * h / 2 / (b * h ^ 3 / 12)` (the tree is `M * (h/2) / (…)`) | 0.1 ms |
| `simplify` | `6 * M / h ^ 2 / b` | 6.7 ms |
| `simplify`, `realContext` | `6 * M * h / h ^ 3 / b` (won't cancel `h`) | 3.4 ms |
| `rationalize` | `0.5 * M * h / (0.08333333333333333 * b * h ^ 3)` | 4.5 ms |
| `simplify`, then the tidy rules | `6 * M / (h ^ 2 * b)` | + 0.5 ms |

With `c` left free, `simplify` gives `12 * M * c / h ^ 3 / b`. The tidy TeX is
`\frac{6\cdot M}{{\mathrm{h}}^{2}\cdot\mathrm{b}}`. This is the best case:
the textbook `6M / (b h²)`, with the factors in an unusual order.

### Von Mises, plane stress

`sqrt(sx^2 - sx*sy + sy^2 + 3*txy^2)` with `sx = F/A`, `sy = 0`,
`txy = T*r/J`, `J = pi*d^4/32`, `r = d/2`, `A = pi*d^2/4`.

| Step | Result | Time |
| --- | --- | --- |
| `resolve` | `sqrt((F / (pi * d ^ 2 / 4)) ^ 2 - F / (pi * d ^ 2 / 4) * 0 + 0 ^ 2 + 3 * (T * d / 2 / (pi * d ^ 4 / 32)) ^ 2)` | 0.2 ms |
| `simplifyCore` | the same with the `* 0` term gone; `0 ^ 2` stays | 0.3 ms |
| `simplify` | `sqrt(16 * F ^ 2 * pi ^ (-2) / d ^ 4 + 3072 * T ^ 2 * (1 / 2 / d ^ 3 / pi) ^ 2)` | 35.5 ms |
| `simplify`, `exactFractions: false` | `sqrt((768 * T ^ 2 + 16 * d ^ 2 * F ^ 2) * pi ^ (-2) / d ^ 6)` | 26.5 ms |
| `rationalize` | throws `There is an unsolved function call` | 5.5 ms |
| `simplify`, then the tidy rules | `sqrt(16 * F ^ 2 / (pi ^ 2 * d ^ 4) + 3072 * T ^ 2 * (1 / (2 * d ^ 3 * pi)) ^ 2)` | + 1.9 ms |

All have the right value. None is what an engineer would write
(`(4 / (pi d²)) · sqrt(F² + 48 T²/d²)`, or the two stresses kept apart):
`3072` and a `1/2` inside a square that is never worked out. The two option
settings give visibly different shapes for the same input, which shows how
much the result depends on rule order and not on a target form.

### Euler buckling pi^2*E*I/(K*L)^2

| Step | Result (I = pi*d^4/64) | Time |
| --- | --- | --- |
| `resolve` | `pi ^ 2 * E * pi * d ^ 4 / 64 / (K * L) ^ 2` | 0.1 ms |
| `simplify` | `pi ^ 3 * E * d ^ 4 * L ^ (-2) / 64 / K ^ 2` | 10.1 ms |
| `simplify`, `exactFractions: false` | `0.015625 * pi ^ 3 * E * d ^ 4 * L ^ (-2) / K ^ 2` | 8.2 ms |
| `rationalize` | `0.015625 * pi ^ 3 * E * d ^ 4 / (L ^ 2 * K ^ 2)` | 8.3 ms |
| `simplify`, then the tidy rules | `pi ^ 3 * E * d ^ 4 / (L ^ 2 * 64 * K ^ 2)` | + 1.1 ms |

`simplify` splits `(K*L)^2` and then puts `L` back as `L ^ (-2)` in the
numerator and `K ^ 2` in the denominator: one formula, two notations. TeX:
`\frac{\frac{{\pi}^{3}\cdot E\cdot{ d}^{4}\cdot{\mathrm{L}}^{-2}}{64}}{{\mathrm{K}}^{2}}`.
With `I = b*h^3/12` the shape is the same
(`pi ^ 2 * E * b * h ^ 3 * L ^ (-2) / 12 / K ^ 2`, 8.0 ms).

### A unit literal: 2 m * x, with x = a + 3 m

| Step | Result | Time |
| --- | --- | --- |
| `resolve` | `2 m * (a + 3 m)`, TeX `2~\mathrm{m}\cdot\left( a+3~\mathrm{m}\right)` | 0.0 ms |
| `simplify` | `2 * (3 * m ^ 2 + m * a)` | 2.2 ms |
| `rationalize` | `2 * a * m + 6 * m ^ 2` | 6.8 ms |

`2 m` parses as `2` times the symbol `m`, and `simplify` treats `m` like any
other name. That is consistent, so the algebra holds, but:

- The quantity is taken apart: `3 m` becomes `3 * m ^ 2` inside a bracket, and
  the result no longer reads as a length times a length.
- Units of one kind are not combined: `3 m + 2 cm` and `3 ft + 2 m` come back
  unchanged, `(5 mm)/(2 m)` gives `mm * 5 / 2 / m` and `2 km / 2 m` gives
  `km / m`, where the sheet's value is `1000` (all observed). Not wrong, but
  the reader has to finish the job.
- Same units do fold: `3 m + 2 m` gives `5 * m`, `5 kN/m * 2 m` gives
  `10 * kN`, `5 N m / m` gives `5 * N`.
- A conversion stops it: `5 m to cm` and `2 m * x in cm` come back as typed.
- A decimal with a unit gets a fraction: `9.81 m/s^2 * 2 kg` gives
  `m * kg * 981 / 50 / s ^ 2`.

`resolve` alone keeps the literal exactly as typed, and its TeX is right.

## Where the form is untidy

- **Division chains and negative powers.** `simplify` rewrites every division
  as a negative power (`n/n1 -> n*n1^-1`) and converts back at the end with
  rules that match only some shapes (the rule list is `simplify.rules`, 54
  entries, in
  [`simplify.js`](https://github.com/josdejong/mathjs/blob/v15.2.0/src/function/algebra/simplify.js);
  listed by a probe). What is left is `a / b / c` and stray `L ^ (-2)`.
- **Factor order.** Numbers land in the middle or at the end:
  `kN * L ^ 2 * 5 / 8 / m`, `P * L * 3 / 2 / h ^ 2 / b`,
  `q * L ^ 4 * 1 / E * 3 / 2 / h ^ 3 / b` (a stray `* 1 / E`). math.js issue
  [#2055](https://github.com/josdejong/mathjs/issues/2055), "Simplify sometimes
  misorders monomials", is open.
- **Decimals turn into fractions by default.** `1.2*D + 1.6*L` gives
  `D * 6 / 5 + L * 8 / 5`, `0.85*fc*a*b` gives `fc * a * b * 17 / 20`,
  `0.333*x` gives `x * 333 / 1000`, `9.80665*m` gives
  `m * 1.96133e+5 / 20000`. The documented cap, `fractionsLimit` 10000
  ([`simplify.js`](https://github.com/josdejong/mathjs/blob/v15.2.0/src/function/algebra/simplify.js),
  options), did not stop `3.14159*d^2/4` from becoming
  `d ^ 2 * 3.14159e+5 / 4e+5` (observed). With `exactFractions: false`
  decimals stay as typed, but then every exact fraction becomes a decimal:
  `1/3*x` gives `0.3333333333333333 * x`, `x/0.9` gives
  `1.1111111111111112 * x`, `b*h^3/12` gives `0.08333333333333333 * …`.
  Neither setting is right for a sheet that has both `1.2` and `1/12`.
  Issue [#2398](https://github.com/josdejong/mathjs/issues/2398), "Don't
  convert between fractions and decimals in simplify", is open.
- **Constant functions are evaluated.** `sqrt(2)*x` gives
  `1.4142135623730951 * x` with either setting. `pi` stays a symbol.
- **It does not expand or factor to a target.** `(a+b)^2`, `(a+b)*(a-b)`,
  `(x^2-1)/(x-1)` and `sin(x)^2+cos(x)^2` come back unchanged;
  `rho*g*h + rho*v^2/2` is factored to `rho * (g * h + v ^ 2 / 2)`, which
  nobody asked for.
- **A tidy pass helps, and it is our rules, not math.js's.** A second call,
  `simplify(node, rules)`, with
  `n1/n2/n3 -> n1/(n2*n3)` and `n1*n2^(-c1) -> n1/n2^c1` (both `repeat`), and
  `n1^(-c1) -> 1/n1^c1`, gave one fraction for stress, bending, Euler and the
  beam cases in 0.4 to 1.9 ms, all with the right value (observed). It did
  not fix factor order (`L ^ 2 * 64 * K ^ 2`, `P * L * 3 / (2 * …)`) or von
  Mises.

## Where the form is wrong

Wrong here means: not equal to the input for some value the sheet can hold.
The default context is "very permissive", in math.js's own words
([algebra.md](https://github.com/josdejong/mathjs/blob/v15.2.0/docs/expressions/algebra.md#simplify)).

| Input | `simplify` (default) | Wrong when |
| --- | --- | --- |
| `x/x` | `1` | `x = 0` |
| `x*y/x` | `y` | `x = 0` |
| `0*x` | `0` | `x` is a quantity (the sheet's value is `0 m`), `∞` or NaN |
| `(x^2)^(1/2)`, `(x^2)^0.5` | `x` | `x < 0` (open: [#3329](https://github.com/josdejong/mathjs/issues/3329)) |
| `a*b - b*a` | `0` | `a`, `b` matrices (open: [#2614](https://github.com/josdejong/mathjs/issues/2614)) |
| `x^(1/2)^2` | `x ^ (1 / 4)` | not wrong: `^` is right-associative; shown because it surprises |

All observed. `simplify.realContext` keeps `x/x` and `(x^2)^(1/2)`, at the
cost of a worse form elsewhere (bending above stays `6 * M * h / h ^ 3 / b`).
`simplify.positiveContext` allows both cancellations, and gave the same forms
as the default on all five formulas. A sheet value is not always a positive
real (a list, a matrix, a text, zero), so a combined formula shown under the
default context is an identity "for the usual case", not a checked one. On the
five formulas this did not bite: every simplified form evaluated to the input's
value at test numbers, to 1e-9 relative (observed).

It also refuses some lines outright: a conditional (`a > 0 ? … : …`), an
assignment and a function assignment throw
`Unimplemented node type in simplifyConstant`, so the engine has to hand it
the right-hand side only, and has no simplified form for a `? :` line.
`resolve` handles the conditional. An index `v[1] + v[1]` comes back
unchanged, and a user function is left as a call (`2 * f(a) + g(5)`):
`resolve` does not open a function's body.

## Time

| Call | Time (observed) |
| --- | --- |
| Building `simplify`, `resolve`, `rationalize`, `derivative`, `symbolicEqual` the first time | 34 ms, once |
| First `simplify` after that | 16 ms |
| `resolve`, any of the five | 0.0 to 0.2 ms |
| `simplifyCore`, any of the five | median under 0.05 ms |
| `toTex`, any result | median under 0.2 ms |
| `simplify`: stress, bending, Euler, unit literal (median of 200) | 3.4, 3.3, 6.0, 2.1 ms |
| `simplify`: von Mises (median of 200; max) | 21.9 ms; 52.6 ms |
| `simplify`, a sum of 5, 10, 20 terms `k·xⁿ/(c·y)` (25, 50, 100 leaves) | 48 ms, 233 ms, 10.3 s |
| The same, 40 terms | no answer in 20 s |
| `simplify`, a product of 4, 8, 12, 16 two-term sums | 5, 7, 23, 71 ms |
| `simplify('1e-7*x')`, `simplify('1.23456789e-9*x')` | 51 ms, 88 ms (2 ms with `exactFractions: false`) |
| `simplify('2/x^2 - x^(2*z)')` | no answer in 20 s |
| `simplify('ones(300,300)')`, `('ones(1000,1000)')` | 1.8 s, 18.6 s |
| `rationalize('(a+b)^3')`, `('(a+b)^4')` | 32 ms, 824 ms; neither collects like terms |
| `rationalize('(x-1)*(x-2)*(x-3)*(x-4)')` | 777 ms |
| `rationalize('(a+b)^6')`, `('(a+b+c)^3')`, `('(x+1)^8')` | no answer in 20 s each |
| `resolve` of a chain where each line uses the one above twice, depth 10, 15, 20 | 4.5 ms (3,071 leaves), 73 ms (98,303), 1.8 s (3,145,727) |
| The same, depth 24 | no answer in 20 s |

Two things follow.

- **For the formulas a person writes on one or two lines, the cost is a few
  milliseconds**, against under a millisecond for a solve
  ([`solver-and-plot-libraries.md`](solver-and-plot-libraries.md),
  Performance). That is per line that shows a combined formula, not per
  sheet.
- **There is no bound.** `simplify` loops over its rules until the text of the
  expression repeats (the `visited` loop in
  [`simplify.js`](https://github.com/josdejong/mathjs/blob/v15.2.0/src/function/algebra/simplify.js)),
  with no iteration or time limit, and its matcher tries every split of a sum
  or a product. The six-leaf input above never repeats. math.js has three open
  reports of this:
  [#3764](https://github.com/josdejong/mathjs/issues/3764) ("simplify does not
  terminate on `2/x^2 - x^(2*z)`"),
  [#3693](https://github.com/josdejong/mathjs/issues/3693) ("Infinite loop
  when simplifying") and, for `rationalize`,
  [#3351](https://github.com/josdejong/mathjs/issues/3351) ("gets stuck or
  takes too long"). Titles read from GitHub's search API; the issue bodies
  could not be fetched, so what #3693 and #3351 reproduce is **unverified**.

## Can it be made safe

There are two risks: a line changing the engine, and a frozen sheet.

**Changing the engine: yes, this can be closed.**

- The engine can take its own references before the override, as it does for
  `parse`. On a copy of the disable list, `simplify`, `resolve`,
  `rationalize`, `symbolicEqual` and `derivative` captured first all worked
  afterwards, on Nodes and on strings, while `simplify("a+a")` typed in an
  expression still failed with the app's message (observed). A line gains
  nothing: the names stay disabled.
- `simplify` folds constants by calling functions, so it runs code. On plain
  `create(all)`, `simplify('createUnit("foo9")')` threw and still created the
  unit (observed). On the copy of the disable list it returned the call
  unevaluated and created nothing, because the constant folder looks the
  function up in `mathWithTransform` at call time and gets the disabled stub
  ([`simplifyConstant.js`](https://github.com/josdejong/mathjs/blob/v15.2.0/src/function/algebra/simplifyConstant.js),
  `_eval`). For the same reason a guard put on `mathWithTransform.ones` was
  honoured: `simplify` of `ones(3)` came back as `ones(3)` (observed). So the
  disable list and [`limits.ts`](../../src/math/limits.ts) both reach inside
  `simplify`. Whether every guard in `limits.ts` does, through the real
  `guardEngine`, is **unverified**: this was a one-function copy.
- The input would be the engine's own parsed Nodes, and the output is only
  typeset, never evaluated, so the `typed` route that `simplifyCore` opens for
  a line (the comment on `TYPED_MUTATORS` in `evaluate.ts`) does not arise.

**A frozen sheet: not on the main thread.**

- `limits.ts` works by checking a call's arguments before math.js runs it,
  because "no `try` can stop a call that freezes the sheet" (its header). That
  needs a property of the input that bounds the time. For `simplify` there is
  none: six leaves never finish, and 100 leaves of an ordinary sum take 10 s.
  A leaf limit (`math.leafCount`, which still works in the app) would stop the
  large cases and the `resolve` chain, and would not stop #3764.
- So the only bound is to run it where it can be killed: a worker with a
  time limit, falling back to the `resolve`d form, which is always available
  in under a millisecond. The sheet's run is synchronous (ADR 0003), so the
  tidied form would arrive after the results, as the typeset chunk does today.
  Whether a worker fits the plugin's single `main.js` with no network (ADR
  0006) was not tried: **unverified**.
- `resolve` needs its own guard either way: a leaf count on the result, or a
  count kept while substituting. It refuses a loop by itself
  (`recursive loop of variable definitions among {a, b}`, observed), which a
  sheet read top to bottom can't form anyway.
- `resolve` takes a scope of Nodes. A scope holding a quantity breaks
  `simplify` (`simplify('F/A', { A: unit })` throws in `equalScalar`), and a
  number is substituted as a value (`F / 2`), so the engine would pass each
  name's parsed right-hand side, not the run's scope (observed).

## Does the earlier reason still hold

- **For lines calling these functions: yes.** Nothing here argues for taking
  `simplify`, `derivative` or `resolve` off the disable list. math.js's own
  advice stands, and `simplify` on a line would add an unbounded call that the
  sweep test's one second per function can't hold.
- **For `rationalize`: yes, and more so.** It was dropped for throwing on
  ordinary lines and for its time. For display it also writes decimals where
  the source had fractions and leaves `a * b + b * a` uncollected.
- **For the engine showing a combined formula: there was no earlier reason.**
  The `simplify()` note in section 14 is about a unit's method. The open
  questions for this use are the ones measured here: the form needs our own
  tidy rules and still misses on formulas like von Mises, the default context
  cancels what may be zero, a unit literal is taken apart, and the call needs a
  worker.

## Options this leaves

Not a decision; what the measurements allow.

- **`resolve` only.** Show the substituted formula as it is:
  `F / (pi * d ^ 2 / 4)`. Exact, keeps unit literals and typed numbers, under
  a millisecond, safe on the main thread with a leaf limit. Untidy in the way
  the user's own lines are untidy, and never wrong.
- **`resolve`, then `simplify` and our tidy rules, in a worker with a time
  limit.** Textbook forms for quotient formulas (`6 M / (h² b)`), rough ones
  for anything with a root or several terms, a choice to make between `6/5`
  and `0.0833…`, and identities that assume non-zero values.
- **`resolve`, then our own small pass** (flatten nested fractions, cancel
  equal powers, gather numbers), without `simplify`. Not measured here; it is
  the route that could keep unit literals and typed decimals, and it would be
  ours to bound.

## Not verified

- Anything through the app's engine: the probes used plain `create(all)` and a
  copy of the disable list, not `evaluateSheet`, `guardEngine` or the app's
  `toTex` handler. `lineTex` taking a simplified Node, and how it draws
  `L ^ (-2)` or a unit that has become a symbol, were not run.
- A worker in the Obsidian plugin's bundle.
- The bodies of math.js issues #3693, #3351, #3329, #2614, #2398 and #2055
  (titles and open state only, from GitHub's search API on 2026-11-25).
  #3764's input was reproduced here.
- The first commit of the disable list (shallow checkout).
- Timings are Node 22 on this session's machine, not a browser.
