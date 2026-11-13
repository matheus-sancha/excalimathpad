Research for wayfinder ticket #91, 2026-11-13.

# Finding every real root of one equation in one unknown, without a guess

Question: which numerical methods can find every real root of `lhs(x) = rhs(x)`
for one unknown, client-side, on the residual the solver already has (a
black-box function of SI numbers that is NaN where the equation has no value)?
What does each need from the user, and what does each fail to promise?

How to read the sources: "observed" means run in this repo on 2026-11-13
(math.js 15.2.0, Node 22) with a throwaway probe that is not committed. Links
to source files are to the project's own repository. Several documentation
hosts were blocked by the session's network policy; every claim that rests on a
page I could not open is marked **unverified**.

## Recommendation

- **Method: scan a range, then Brent on each bracket. Our own code, no
  library.** Sample the residual at 200 evenly spaced points of a search range.
  Every sign change between two neighbouring points with a value is a bracket
  for the Brent routine `src/math/solver.ts` already has. Roots come out in
  ascending order, and the same input always gives the same roots.
- **Two additions make it trustworthy. Both are needed (observed).**
  - **A crossing check.** Brent converges on a pole or a jump as happily as on
    a root. Keep a crossing only if the residual at the converged point is at
    most 1e-6 of the larger residual at the bracket's two sample points. Without
    it, `tan x = 1` on 0..10 returns 3 roots and 3 poles, and a step function
    returns its jump. With it, both are right at every sample count tried.
  - **A dip pass.** Where three neighbouring samples have the same sign and the
    middle one is closest to zero, minimise there (golden section). If the
    minimum crosses zero, there are two roots: Brent on each side. If it only
    touches zero, report one touching root. Without it, a double root and a
    pair of roots closer than the sample spacing are both missed.
- **What the user must write: a search range instead of a guess.** No method
  below finds every root of a general equation with no range. The range also
  gives the unknown its dimension, which the guess gives today
  (`docs/spec-v1.md` section 9). The price for the user is the same as now: one
  clause on the line.
- **What it does not promise.** It finds roots it can see at the sample
  spacing. It can miss two roots that are closer than the spacing where the
  dip between them is hidden, roots of a fast-oscillating residual, and any
  root outside the range. Every tool that scans says the same of itself (see
  Roots.jl below). The spec and the solve details should say "roots found in
  a .. b", never "all roots".
- **Cost: 25 to 40 times one of today's solves, so keep `guess` for solves that
  run many times.** A scan costs 210 to 350 residual evaluations where today's
  solve costs about 8 (observed). That is about 1.5 ms for a Colebrook-sized
  solve and about 50 ms for a 30-point list. A scan inside a scan is about
  0.3 s per outer solve, and about 9 s for a 30-point list of them. That breaks
  the synchronous re-run of ADR 0003. So the guess form should stay as the
  one-root, cheap form, and it is the right form for a solve function called
  from another solve.
- **Polynomials: not a separate path in this batch.** A polynomial is the one
  case where every real root can be found with no range, and I measured a
  robust way to do it (the roots of the derivative bracket the roots, 0.01 to
  0.2 ms). But the app would have to learn that a residual is a polynomial and
  get its coefficients. `math.rationalize` can't do that here: it rejects units
  and user functions and took 3 to 570 ms per call (observed). Our own
  coefficient collector over the parsed line is real work for one benefit:
  no range on polynomial equations. The scan found every root of every
  polynomial in the probe when given a range. Leave it for later.
- **Not recommended:** `math.polynomialRoot` (cubic at most), `math.eigs` on a
  companion matrix (failed to converge on `x⁴ + 1`, observed), a Chebyshev
  proxy (fails on any residual with a pole or a hole in its domain, observed),
  interval arithmetic (needs the equation's formula, not a black box), and
  deflation (not possible on a black box without dividing by known roots, which
  only hides them from a method that still needs guesses).

Questions this leaves for the grilling ticket are listed at the end.

## Comparison

| Method | Needs from the user | Double roots (touching) | Complex roots | Poles and jumps | Holes in the domain | Evaluations per solve | Promise |
|---|---|---|---|---|---|---|---|
| **Scan + Brent, crossing check, dip pass** (recommended) | A range | Found by the dip pass | Not found (real line only) | Rejected by the crossing check | Skipped, as today | 210–350 at 200 samples | Roots visible at the sample spacing |
| Scan + Brent, plain | A range | **Missed** | Not found | **Reported as roots** | Skipped | 200–350 | Sign changes only |
| Log grid over all magnitudes, then the same | Nothing but the unknown's unit | Found | Not found | Rejected | Skipped | 290–1,360; thousands on a periodic residual | Roots separated by the grid's ratio, between 1e-9 and 1e9 |
| Polynomial: derivative roots as brackets | Nothing, but the residual must be a known polynomial | Found exactly | Not returned | None exist | None exist | None (works on coefficients) | Every real root, to about degree 10 |
| Polynomial: companion matrix eigenvalues | Same | Come back as a complex pair 1e-8 apart | Returned | None | None | None | Every root, if the eigenvalue routine converges |
| Chebyshev proxy (Chebfun's method) | A range, and a smooth residual on all of it | Found | Can be returned | **Wrong answers** | **Fails** | 33–65 samples plus an eigenvalue problem | Every root of a smooth function |
| Interval Newton | A range, and the formula in interval arithmetic | Reported as "unknown" | Not found | Handled | Handled | Not a black-box method | **Proof** that no root is missed |
| Today: bracket out from a guess + Brent | A guess | Missed | Not found | Brent gives up at a hole; a pole can be returned | Skipped | 8–14 | One root near the guess |

## Scan a range, then Brent

### What other tools do

- **Julia's Roots.jl `find_zeros(f, a, b)`** is this method, and is the closest
  prior art. It needs the interval. It splits it into `no_pts - 1 = 11`
  subintervals, checks `k = 8` pairs of points in each for a sign change, runs
  bisection on each bracket and a derivative-free search elsewhere, then
  re-scans between the zeros it found, to a depth of 4
  ([source and docstring](https://github.com/JuliaMath/Roots.jl/blob/master/src/find_zeros.jl)).
  Its own documentation lists where it under-reports: "if the initial interval,
  `(a,b)`, is too wide", "if there are zeros that are very nearby", and when
  "the function is flat" (same file). It also says "The algorithm might
  identify more than one value for a zero", which it merges.
- **SciPy's `brentq`** is the single-bracket building block: `f` "must be
  continuous, and f(a) and f(b) must have opposite signs"
  ([source](https://github.com/scipy/scipy/blob/main/scipy/optimize/_zeros_py.py)).
  SciPy ships no all-roots routine in that module (read of the same file).
- **GNU Octave's `fzero`** takes one starting point or a two-point bracket with
  a sign change and returns one zero. Given one point, it searches outward for
  a bracket, as our solver does
  ([source](https://github.com/gnu-octave/octave/blob/default/scripts/optimization/fzero.m)).
- **Mathcad's `root`** (**unverified**: support.ptc.com was blocked, so this is
  the help text as a search engine quoted it, from the Prime 11 page
  [Finding Roots](https://support.ptc.com/help/mathcad/r11.0/en/PTC_Mathcad_Help/finding_roots.html)).
  `root(f(var1, var2, ...), var1, [a, b])`: "If a and b are specified, root
  finds var1 on the interval [a, b]. Otherwise, var1 must be defined with a
  guess value before root is called." With a guess it uses the secant or
  Mueller's method, with a bracket Ridder's or Brent's. "For functions with
  multiple roots, the returned root depends on the guess value." It returns one
  root per call. Mathcad has no function that returns every root of a general
  equation.
- **Mathcad solve blocks** (**unverified**, same reason): "For systems having
  more than one solution, the solution returned depends on the guess values."
  The help's own way to get another solution is a different guess or an added
  inequality ([Example: Solve Block with Multiple
  Guesses](https://support.ptc.com/help/mathcad/r9.0/en/PTC_Mathcad_Help/example_solv_block_with_multiple_guesses.html)).
- **SMath Studio's `solve`** (**unverified**: forum posts seen only as search
  extracts, e.g. [Using calculation -
  solve](https://smath.com/en-US/forum/topic/zCv2AC/Using-calculation---solve)).
  It returns all real roots found in a range. `solve(expr, var)` uses a global
  range set in Tools > Options > Calculation > "Roots (range)", and
  `solve(expr, var, from, to)` takes the range on the call. Users report roots
  missed because they lay outside the global range (one names [-20, 20]). This
  is the nearest existing design to what Matheus asked for, and its main
  complaint is the hidden default range.

### Probe (throwaway, not committed)

The scan is about 45 lines on top of the existing Brent: sample `n + 1` points,
treat a non-finite residual as NaN, Brent on each sign change, crossing check,
dip pass. Ranges were -10.07 .. 10.3 unless stated, so that no sample lands on
a root by luck. Cells are roots found / true roots, with residual evaluations.

| Case | n = 50 | n = 100 | n = 200 | n = 1000 |
|---|---|---|---|---|
| `x² = 4` | 2/2 (61) | 2/2 (111) | 2/2 (209) | 2/2 (1008) |
| `(x-1)(x-2)(x-3)` | 3/3 (66) | 3/3 (116) | 3/3 (214) | 3/3 (1012) |
| `sin x = 0.5` on 0..10 | 4/4 (70) | 4/4 (118) | 4/4 (217) | 4/4 (1016) |
| `(x-1)²`, a double root | 1/1 (90) | 1/1 (138) | 1/1 (237) | 1/1 (1034) |
| `(x-1)⁴` | 1/1 (90) | 1/1 (138) | 1/1 (237) | 1/1 (1034) |
| `x² + 1e-6`, a near miss with no root | 0/0 (113) | 0/0 (163) | 0/0 (263) | 0/0 (1063) |
| `tan x = 1` on 0..10, three poles | 3/3 (209) | 3/3 (251) | 3/3 (350) | 3/3 (1135) |
| `1/x = 0`, a pole and no root | 0/0 (151) | 0/0 (201) | 0/0 (301) | 0/0 (1101) |
| `1/(x-1) = 2` | 1/1 (109) | 1/1 (155) | 1/1 (253) | 1/1 (1050) |
| Roots at 1 and 1.001 | 2/2 (133) | 2/2 (178) | 2/2 (274) | 2/2 (1063) |
| `sqrt(x) = x - 2`, no value for x < 0 | 1/1 (55) | 1/1 (105) | 1/1 (204) | 1/1 (1004) |
| A step at 0.3, a jump and no root | 0/0 (92) | 0/0 (141) | 0/0 (240) | 0/0 (1037) |
| van der Waals, CO₂ at 280 K and 5.5 MPa, molar volume 0.05..5 L/mol | **1/3** (63) | 3/3 (123) | 3/3 (220) | 3/3 (1014) |
| Roots at 1e-3, 1 and 1e3, on -2000..2000 | 3/3 (144) | 3/3 (185) | 3/3 (280) | 3/3 (1069) |
| `sin(1/x)` on 0.01..1, 31 roots | **5/31** | **9/31** | **11/31** | **21/31** |

What the probe shows:

- **200 samples is a sound default.** Every case but the last is right from 100
  samples up. 50 misses two of the three van der Waals roots, which sit in the
  first 4 % of the range. 200 keeps a margin for a cost of about 200
  evaluations.
- **The two additions are not optional.** At 200 samples without the dip pass:
  the double root and the quadruple root are missed (0/1), the pair at 1 and
  1.001 is missed (0/2), and the roots at 1e-3 and 1 are missed (1/3). Without
  the crossing check, `tan x = 1` gains 3 false roots and the step gains 1.
- **A touching root is a judgement, not a fact.** The dip pass reports a touch
  when the minimum is within 1e-9 of the neighbouring samples' size. `x² + 1e-6`
  is correctly not a root at that threshold. A residual that comes closer to
  zero than that without reaching it would be reported as a root. Floating
  point can't tell the two apart.
- **A fast-oscillating residual is out of reach** (`sin(1/x)`). More samples
  help slowly. No finite scan fixes it.
- **Holes in the domain cost nothing.** A NaN sample is skipped, as in the
  solver today, so the scan never needs a value outside the domain.

### With no range: a grid over all magnitudes

Observed: the same scan on 0 and ±10^k for k from -9 to 9, at 8, 16 or 32
points per decade (291, 579 or 1,155 points).

- It found every root of every polynomial case above at 8 per decade, the
  three van der Waals roots, and the roots at 1e-3, 1 and 1e3.
- It missed one of the pair at 1 and 1.05 at every density: the dip between
  two roots 5 % apart is hidden when neighbouring points are 7 % to 33 % apart.
- **On a periodic residual it returns hundreds of roots.** `sin x = 0.5` gave
  59 roots at 8 per decade and 251 at 32, and `tan x = 1` cost 9,450
  evaluations. A no-range default would need a cap on the number of roots and
  a message for when it is reached.
- **It still needs the unknown's dimension from somewhere,** because the grid
  is in SI numbers and the residual needs a quantity.

So "no range" is possible for well-separated roots, at 1.5 to 6 times the cost
of a 200-sample scan, and it behaves badly on trigonometric equations. A
written range is the predictable design. A default range is the grilling
ticket's call.

## Polynomials

### What math.js gives

- **`math.polynomialRoot` stops at cubics.** Its documentation says it
  "Currently operates only on linear, quadratic, and cubic polynomials using
  the standard formulas for the roots"
  ([source](https://github.com/josdejong/mathjs/blob/develop/src/function/algebra/polynomialRoot.js)).
  Observed: a quartic throws "only implemented for cubic or lower-order
  polynomials". It returns complex roots as `Complex` values
  (`polynomialRoot(2, -2, 1)` gives `1 + i`, `1 - i`) and a double root once
  (`polynomialRoot(1, -2, 1)` gives `[1]`). It takes coefficients, not an
  expression.
- **`math.eigs` on a companion matrix is not reliable** (observed).
  - `x⁴ + 1`: throws "The eigenvalues failed to converge".
  - `(x-1)²(x+3)(x-5)`: the double root comes back as `1 ± 3.7e-8 i`, so a
    "real roots only" filter would need a tolerance and a polish step.
  - `(x-1)³(x-2)`: the triple root comes back as 0.99998 and `1.00001 ± 1.7e-5 i`.
  - Wilkinson's degree-20 polynomial: 6 of the 20 real roots come back complex.
  - Time: 0.4 to 57 ms.
- **`math.rationalize` can't serve as the detector here** (observed). It does
  return the coefficients of a polynomial, low power first, substitutes names
  from a scope, and even clears a denominator (`1/(x-1) - 2` gives `[3, -2]`
  over `x - 1`, and the van der Waals equation gives the cubic). But it throws
  on a unit in the scope, on a user function (`g(x) - 1`: "There is an unsolved
  function call"), on `sqrt(x)` and on a non-integer or negative power. It took
  3 to 36 ms on small inputs and 571 ms to expand `(x-1)(x-2)(x-3)(x-4)`. The
  sheet evaluates in quantities and calls user functions, so most real lines
  would fall through.

### What other tools do

- **NumPy `roots`:** "The algorithm relies on computing the eigenvalues of the
  companion matrix"
  ([source](https://github.com/numpy/numpy/blob/main/numpy/lib/_polynomial_impl.py)).
  It takes coefficients and returns complex roots.
- **GNU Octave `roots`** also takes a coefficient vector
  ([source](https://github.com/gnu-octave/octave/blob/default/scripts/polynomial/roots.m)).
- **mpmath `polyroots`** uses the Durand–Kerner iteration and warns about
  repeated roots: "Provided there are no repeated roots, polyroots can
  typically compute all roots of an arbitrary polynomial to high precision"
  ([source](https://github.com/mpmath/mpmath/blob/master/mpmath/calculus/polynomials.py)).
- **Mathcad `polyroots(v)`** (**unverified**, search extract of the Prime 11
  page linked above): it returns the roots of the polynomial whose
  coefficients are in `v`. "By default, polyroots uses the LaGuerre method
  which is iterative and searches for solutions in the complex plane", and the
  Companion Matrix method "converts the equations into an eigenvalue problem".
- **Every one of these takes coefficients the user types.** None detects that
  an equation is a polynomial. That is the part we would have to build.

### A method that fits our solver (observed)

Between two neighbouring real roots of a polynomial lies a root of its
derivative (Rolle's theorem). So the real roots of the derivative, plus a bound
on the roots' size (Cauchy: 1 + the largest ratio of a coefficient to the
leading one), split the line into pieces that each hold at most one root. Find
the derivative's roots the same way, down to degree 1, and run Brent on each
piece with a sign change. A derivative root where the polynomial is zero is a
multiple root. This is 30 lines, uses only Horner evaluation and the Brent we
have, needs no range, and returns real roots only.

| Polynomial | Result | Time |
|---|---|---|
| Roots 1, 2, 3, 4 | 1, 2, 3, 4 | 0.06 ms |
| `x⁴ + 1` | none | 0.005 ms |
| `(x-1)²(x+3)(x-5)` | -3, 1, 5 | 0.009 ms |
| `(x-1)³(x-2)` | 1, 2 | 0.008 ms |
| Roots 1 and 1.001 | 1, 1.001 | 0.007 ms |
| Roots 1 to 10 | all 10, to 10 digits | 0.09 ms |
| Roots 1e-3, 1, 1e3, 1e6 | all 4 | 0.012 ms |
| van der Waals cubic (coefficients from `rationalize`) | 7.9956e-5, 1.49077e-4, 2.36919e-4 m³/mol | 0.011 ms |
| Wilkinson, roots 1 to 20 | **9 of 20, some wrong** | 0.2 ms |

The Wilkinson failure is the coefficients' fault, not the method's: at degree
20 the roots are not determined by double-precision coefficients. The method
is sound to about degree 10.

**Getting the coefficients is the open cost.** The reliable way is our own
evaluator over the parsed equation that carries a list of coefficients instead
of a number through `+`, `-`, `*`, division by something free of the unknown,
and whole-number powers, and that evaluates every other sub-expression as a
constant with math.js, units included. Anything else that touches the unknown
(a function call, a fractional power) means "not a polynomial: scan instead".
Seeing through a user function (`Hp(Q)` in the acceptance sheet is a quadratic
in `Q`) needs the function's body, which makes it larger again. I did not
build this. Estimate: 100 to 150 lines plus tests.

## Chebyshev proxy (Chebfun)

- **How Chebfun does it:** `roots` "works by recursively subdividing the
  interval until the resulting CHEBTECH is of degree less than 50, at which
  point a colleague matrix is constructed to compute the roots"
  ([source](https://github.com/chebfun/chebfun/blob/master/%40chebtech/roots.m)).
  The file cites Good (1961) for the colleague matrix and Boyd (2002) for
  rootfinding through a Chebyshev expansion. It needs a range, and a function
  that a polynomial approximates well on it.
- **Observed here**, with a degree 32 or 64 interpolant and `math.eigs`:
  - Polynomials: exact, and the interpolant shows the degree (coefficients
    past degree 3 are below 1e-15 for a cubic). That is a way to detect a
    polynomial numerically, on a range.
  - `sin x = 0.5`: 4/4, but 50 ms for a 22 × 22 eigenvalue problem.
  - Any pole (`tan x = 1`, `1/x`, `1/(x-1) = 2`, van der Waals): wrong roots,
    or `math.eigs` fails to converge, after 0.1 to 3.9 s.
  - A hole in the domain (`sqrt(x)`): can't start, because it needs a value at
    every node.
  - Roots at 1e-3, 1 and 1e3 on -2000..2000: 1 of 3 right. The small roots are
    lost to rounding at that scale.
- **Verdict:** the best method for smooth functions and the wrong one for this
  app. Engineering residuals have poles and domain edges (Colebrook has no
  value for f ≤ 0), and math.js's eigenvalue routine is too slow and too
  fragile to carry it.

## Interval methods

- **IntervalRootFinding.jl** is the reference: "In principle, it guarantees to
  find *all* roots inside a given box", "or report subboxes for which it is
  unable to provide guarantees"
  ([docs source](https://github.com/JuliaIntervals/IntervalRootFinding.jl/blob/master/docs/src/index.md)).
  Each result is `:unique` (exactly one root) or `:unknown`. A double root is
  `:unknown`: "the two double roots are reported as being possible roots
  without guarantee" (same page).
- **Why it doesn't fit:** it evaluates the function on intervals, so it needs
  every operation in interval arithmetic, and a derivative. Our residual is a
  black box that runs math.js with units, user functions and inner solves. An
  interval version of the engine is a second engine.
- Roots.jl's own documentation makes the same contrast: its scan can miss
  zeros, where IntervalRootFinding gives guaranteed results (the `find_zeros`
  docstring linked above).

## Deflation

- For a polynomial, deflation means dividing out each root as it is found. It
  needs coefficients, and it is what a companion-matrix or Durand–Kerner
  method replaces. **Unverified:** the standard warning that deflation loses
  accuracy unless roots are removed in a careful order (Wilkinson; Numerical
  Recipes section 9.5) is from memory. I could not open a source for it.
- For a black box, the analogue is solving `f(x) / ((x - r₁)(x - r₂)…) = 0`
  from new guesses. It still needs guesses, it has no stopping rule (when no
  further root is found, is there none, or was the guess poor?), and each
  division adds a pole. It does not answer the question asked. Not probed.

## Cost in this engine

Observed on the acceptance sheet (`docs/acceptance/pump-sizing.md`), through
`evaluateSheet`:

| Sheet | Time per run | Solves | Residual evaluations |
|---|---|---|---|
| Lines 1–28 | 12.3 ms | 13 | 105 |
| Whole sheet, with the 30-point range, table and plot | 15.5 ms | 73 | 633 |

- **Today a solve costs about 8 residual evaluations** (105 / 13, and 8 for the
  direct Colebrook call), and an inner evaluation costs about **6 µs**
  (3.2 ms for the 528 evaluations the range adds).
- **A 200-sample scan costs 210 to 350 evaluations,** about 25 to 40 times as
  many. Projected from the figures above, not measured in the engine:
  - one Colebrook-sized solve: about 1.5 ms;
  - once per point of a 30-point list: about 45 ms;
  - a scan whose residual calls a function that scans (the acceptance sheet's
    `Q_op` calling Colebrook): 200 × 1.5 ms, about 0.3 s;
  - that, once per point of a 30-point list: about 9 s.
- **So where a scan may run matters.** A value-form solve that scans, calling
  solve functions that keep a guess, costs 200 × 8 × 6 µs, about 10 ms. That
  is within what ADR 0003's synchronous re-run can carry. A scan nested in a
  scan is not.
- Raw math.js cost, for reference: 0.5 µs per evaluation of a unitless cubic
  or Colebrook residual, 4.1 µs with units.

## What the grilling ticket has to settle

- **Range or default.** The method needs a range. Is it written on the line
  (it then also gives the unknown's unit), or is there a default (the grid over
  all magnitudes, or a setting as in SMath), and where does the unit come from
  then?
- **`guess` stays, as the one-root form.** The cost figures argue for keeping
  it, at least for solve functions and anything called from another solve.
  Whether a solve function may scan at all is open.
- **The wording of the promise.** The result is "the roots found in a .. b".
  The details could show the range, the sample count and how many crossings
  were rejected as poles or jumps.
- **Touching roots.** Reported as roots, or flagged in the details? The
  threshold is ours to fix (1e-9 of the neighbouring samples in the probe).
- **A cap on the number of roots,** with a message, for periodic equations over
  a wide range.
- **Fixed numbers, as with the tolerance today:** 200 samples, the 1e-6
  crossing check, the 1e-9 touch threshold. No settings, nothing saved.
- **Complex roots are not found by anything recommended here.** `x² + 1 = 0`
  gives "no root found in a .. b".
