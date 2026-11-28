# 0009. Formula results come from nerdamer's plain parse, through a bridge of the app's own

- **Status**: accepted, not built. It ships in the symbols release, a minor release after 1.0.0
- **Date**: 2026-11-28

## Context

A tester asked for symbolic results: a line whose names have no value shows a formula instead
of an error, so several lines combine into one formula (`sigma = F / A` and `A = pi * d^2 / 4`
give `4 F / (pi d^2)`). The sheet's engine is math.js (ADR 0003). It substitutes exactly
(`resolve`), but it can't write a combined formula in a form an engineer would print:

- `simplify` is right but rough (`4 * F / d ^ 2 / pi`).
- `simplify` has no bound on its time. A 20-term sum took 10 s, and `2/x^2 - x^(2*z)` never
  returned.
- `rationalize` throws on `sqrt`.

Evaluation is synchronous with no worker (spec section 14), and the plugin's `main.js` has a
5,000,000-byte cap.

Decided by Matheus from 2026-11-25 to 2026-11-28, on the map
[Decide whether Excalimathpad gets symbolic results, and which subset](https://github.com/matheus-sancha/excalimathpad/issues/343):
nerdamer as the engine
([#348](https://github.com/matheus-sancha/excalimathpad/issues/348)), and the bridge and its
ruling ([#355](https://github.com/matheus-sancha/excalimathpad/issues/355)). The behaviour is in
[`docs/spec-v1.md`](../spec-v1.md) section 9a.

## Decision

- **nerdamer 2.1.0 is the engine for formula results,** imported as `nerdamer/core`. esbuild
  stubs the one module that holds its `new Function`, so the bundle audit passes.
- **Only its plain parse is called.** `simplify`, `factor`, `gcd` and `expand` never are, and
  neither are math.js's `simplify` and `rationalize`.
- **math.js stays the engine of the sheet.** It reads the line, substitutes the formulas above
  (`resolve`), checks the units with stand-in values, and typesets the result (`lineTex`).
  nerdamer only cancels.
- **The bridge is the app's own.**
  - It turns every name, decimal and opaque function call into a placeholder atom, so nerdamer
    never sees a sheet name, a unit or a constant.
  - It builds the one fraction itself, because `numerator()` and `denominator()` fail on a sum of
    fractions.
  - It refuses anything outside `+ - * / ^`, unary minus, parentheses, `sqrt` and `abs`.
  - A size guard runs before nerdamer does.
- **Synchronous, with no worker.**

## Alternatives considered

- **Substitution only** (math.js `resolve`). It is exact and instant, but it gives no single
  fraction and no cancelling. Matheus picked nerdamer for its output.
- **math.js `simplify` in a worker, with tidy rules of our own.** The form is still rough
  (von Mises), a worker makes results asynchronous, and in the plugin a worker would have to
  start from a `data:` or blob URL that nobody has tried on iOS.
- **Algebrite 1.4.0.** It is smaller (362 kB), but its last release was in 2021, and it reads `e`
  and `i` as constants. **nerdamer-prime** reads `E` as Euler's number, so `F*L^3/(3*E*I)` came
  back silently wrong.
- **A full CAS** (the Cortex Compute Engine, Giac, SymPy in Pyodide). Each is 5 MB or more, or
  GPL.
- **Gating nerdamer on a size, bridge and hang check first.** Matheus accepted those costs up
  front. The check was still run, to inform the spec, not to gate it.

## Consequences

- `main.js` grows by about 0.41 MB, and `BUDGET` is raised by the measured growth in the
  release's issue. With the Excalidraw upgrade that leaves about 0.4 MB under the cap for
  everything after it.
- What a formula shows is limited by the plain parse.
  - Integers cancel, but decimals and unit literals stay as typed and never combine.
  - `sqrt(a^2)` comes back as `abs(a)`.
  - The order of factors is nerdamer's.
  - No common factor is taken out of a sum.
- If an input is ever found that makes the plain parse run without bound, a sheet freezes until
  a worker with a time limit is added. That is the larger change this decision avoids. Every
  adversarial input tried took under 50 ms, and the slowest case took 1.2 s.
- A second symbolic step, such as `expand`, `factor` or solving for a name, needs nerdamer's
  slow paths, and with them a worker. That would be a new decision, not an amendment.
- The library depends on one committer's recent rewrite (2.0.0 and 2.1.0, from October to
  November 2026). The bridge keeps nerdamer behind one module, so replacing it touches that
  module alone.
