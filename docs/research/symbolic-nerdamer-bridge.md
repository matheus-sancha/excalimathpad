Research for wayfinder ticket #355, 2026-11-26.

# nerdamer 2.1.0 as the symbolic engine: the bridge, the size, and whether it can hang

Question: what does the spec need to build symbolic results on nerdamer 2.1.0? Its size in the
real plugin build, how a sheet line's math.js node becomes nerdamer text and comes back as a
math.js node for `toTex`, how `numerator()` and `denominator()` give one fraction, how decimals
keep their form, whether any input runs without bound (and so whether a worker is needed), and
the library's release and maintenance state.

Settled before this ticket, not reopened here: nerdamer 2.1.0 is the engine; `symbols F, d`
declares symbols from that line down, overriding a unit or constant of the same name; the first
subset substitutes the formulas above and writes one tidy fraction, with no expand, factor or
partial numbers. Unit policy is a separate ticket.

Everything marked "observed" was run on 2026-11-26 in Node 22.23.5 with math.js 15.2.0 and
nerdamer 2.1.0. The scripts and their saved output are in
[`symbolic-nerdamer-bridge/`](symbolic-nerdamer-bridge/).

## Answer

- **Size: +618,074 bytes in the real plugin build with the whole library, +414,578 with
  `nerdamer/core`.** `main.js` went from 3,589,415 to 4,207,489 bytes (whole) or 4,003,993
  (core only). Both stay under the 5,000,000-byte cap; both are over the 3,595,000 budget, which
  the issue that adds it must raise on purpose (observed, `npm run build:plugin` then
  `npm run audit:plugin`, every change reverted afterwards).
- **The bundle audit fails on more than size: nerdamer holds one `new Function`.** It is
  `buildFunction`, nerdamer's compiler of an expression to a JavaScript function, in
  `output/core/functions/build/index.js`. The audit forbids that text ("code built from text at
  run time", `FORBIDDEN` in [`scripts/audit-plugin.mjs`](../../scripts/audit-plugin.mjs)). The
  bridge never calls it. Importing `nerdamer/core` and having esbuild replace that one module
  with a stub that throws removes it: 401,535 bytes for the library alone, no `new Function`
  (observed, [`size-probe.mjs`](symbolic-nerdamer-bridge/size-probe.mjs)). The stub is not
  possible with the default import, which is one prebuilt webpack file (`dist/bundle.js`).
  The audit raised no host or other forbidden text.
- **Never call `simplify` (or anything that factors) on the main thread. It runs for minutes on
  ordinary input.** `simplify` of a sum of four fractions with distinct denominators
  (`a0/b0+a1/b1+a2/b2+a3/b3`) took 83 s; five did not finish in 120 s. A product of ten
  binomials took 17 s (observed, [`hang.mjs`](symbolic-nerdamer-bridge/hang.mjs)). It also
  factors, which the subset rules out: `(a^10-b^10)/(a-b)` came back as a product of three
  factors.
- **nerdamer's plain parse, `nerdamer(text)`, plus `numerator()` and `denominator()`, was fast on
  every input tried,** adversarial ones included: `(a+b)^200`, `9^9^9`, a 100-deep nested
  fraction, a 40-term sum, and `2/x^2 - x^(2*z)` (which hangs math.js `simplify`) each took
  under 50 ms. It cancels like factors (`F/(pi*d^2/4)` gives `4*F` over `pi*d^2`) but does not
  put a sum of fractions over one denominator and does not flatten a fraction three levels
  deep. So **the bridge builds the one fraction itself** (below) and uses nerdamer only to cancel.
- **A worker is not needed for that path, and adding one is costly.** No plain-path case took
  more than 1.5 s, and the slowest (40 fractions over 80 symbols, 1.2 s) is far outside a sheet.
  The spec keeps evaluation synchronous with no worker
  ([spec section 14](../spec-v1.md#14-engineering-constraints)); a worker would make a symbolic
  line's result asynchronous. nerdamer has no time limit or cancel API: its `Settings` has
  iteration and size caps (`MAX_LOOP_ITERATIONS`, `MAX_NUMBER_DIGITS` and others) but nothing
  measured in time (observed, `output/core/Settings.d.ts` in the package), so the only way to
  stop a run is to terminate the worker that holds it, which works (observed: `Worker.terminate()`
  in Node stopped each timed-out `simplify`). If `simplify`, `factor` or `gcd` ever enter the
  subset, a worker becomes necessary.
- **A size guard is still needed, before nerdamer runs, like `limits.ts`.** Two inputs came back
  wrong rather than slow: `10^100000*x` came back as a 100,001-digit integer that math.js reads
  as `Infinity`, and a chain of 30 squarings came back with exponents of `1.07e9`. Refuse a
  formula whose integer literals or integer exponents pass a bound, or whose result text is
  longer than a bound, instead of showing it.
- **nerdamer's `e` and `i` are constants, not plain symbols.** `i^2` gives `-1`, `sqrt(-1)`
  gives `i`, `e` evaluates to 2.718... and `exp(x)` prints as `e^x` (observed). The earlier note
  ([symbolic-js-libraries.md](symbolic-js-libraries.md)) said nerdamer 2 "keeps `E`, `I`, `e`
  and `i` as symbols"; that is true of their printed form but not of their meaning. `E` and `I`
  are plain symbols. With the bridge's placeholders none of this reaches nerdamer.
- **Maintenance: one active committer, releasing often.** 2.1.0 (2026-11-20) is still the `latest` tag on
  npm; the releases before it are 2.0.1 (2026-11-01), 2.0.0 (2026-10-02) and two release
  candidates in September, after nothing since 1.1.13 in 2021
  ([npm registry](https://registry.npmjs.org/nerdamer), read with `npm view nerdamer time`).
  npm lists two maintainers; the ten latest commits (2026-09-19 to 2026-11-20) are all by
  `jiggzson`, the last one "v 2.1.0". The repository has 24 open issues, all but one
  from 2017 to 2021, and is not archived
  ([commits](https://github.com/jiggzson/nerdamer/commits/master),
  [issues](https://github.com/jiggzson/nerdamer/issues)). The package is Apache-2.0, depends
  only on `decimal.js`, and asks for Node 18 or a browser with `BigInt` (`npm view nerdamer`).

## The bridge

[`bridge.mjs`](symbolic-nerdamer-bridge/bridge.mjs) runs small sheets and prints each step;
[`bridge-output.txt`](symbolic-nerdamer-bridge/bridge-output.txt) is its saved output. It uses
the app's own `lineTex` from [`src/math/typeset.ts`](../../src/math/typeset.ts) for the TeX.

### Into nerdamer

1. **Substitute in math.js.** `math.resolve(expr, formulas)` replaces each formula name above
   with its node, as in [the trigger prototype](symbolic-trigger-prototype/trigger.mjs).
   nerdamer's own substitution argument (`nerdamer('F/A', {A: 'pi*d^2/4'})`) gives the same
   result (observed) but would need nerdamer text for every formula.
2. **Every name becomes a placeholder atom, `v1`, `v2`, ..., in order of first use.** That covers
   a declared symbol (`F`, `E`, `I`, `h`, `sigma_max`), a unit literal (`MPa` in `250 MPa`), and
   a math.js constant that was not declared (`pi`, `e`, `E`, `i`). nerdamer then never sees a
   sheet name, so its own meaning of `e`, `i` and `pi` does not matter, and a name like
   `t_xy` or `f_ck` is never read as anything else. The one rule that decides the kind: a
   declared name is a symbol even straight after a number (`3 t_xy^2`); otherwise a name after a
   number is a unit literal; otherwise it is a constant.
3. **Every decimal literal is an atom too.** That is what keeps decimals in their form. Passed as
   numbers, nerdamer turns `0.85*f_ck/1.5` into `0.56666666666666666667*f_ck` in text and
   `17 f_ck/30` through `numerator()`/`denominator()`, and `sqrt(0.5*(...))` into
   `2.0^(1/2)*(...)^(1/2)` over `2` (observed). As atoms, `f_cd = 0.85 f_ck / 1.5` comes back as
   `0.85 f_ck / 1.5`, and `1.2 * D / 2` as `1.2 D / 2`: kept, but not combined with integers.
   Integers go through as numbers and cancel (`12` and `2` in the bending stress give `6`).
4. **A function call other than `sqrt` and `abs` is one atom,** keyed by its text, with its
   arguments already substituted. `sin(pi x / L) / L` stays as written; `log10(x) / log10(x)`
   cancels to `1`. Passed through, nerdamer rewrites some (`log10(x)` became
   `log(x)*log(10)^-1`, `exp(x)` became `e^x`; observed).
5. **Operators:** `+ - * / ^`, unary minus and parentheses go through, fully parenthesised;
   implicit products become `*`. Anything else (`mod`, `!`, comparisons, ranges, indices,
   matrices) is outside the subset and the bridge refuses it.

### One fraction

`nerdamer(text).numerator()` and `.denominator()` on the whole text ("A" in the output) give the
right fraction for products and quotients: `sigma = F / A` with `A = pi d^2 / 4` gives `4 F` over
`pi d^2`; `M c / I` with `I = b h^3 / 12`, `c = h / 2` gives `6 M` over `b h^2`. They fail on two
shapes (observed):

| Line | A: numerator() / denominator() of the whole | B: bridge flattens, nerdamer cancels |
|---|---|---|
| `sigma = F / A + M * (h / 2) / I` | `F * (b h)^-1 + 6 M h^-2 b^-1`, denominator 1 | `(6 M + F h) / (b h^2)` |
| `n = a / (b / (c / d))` | `a / (b (c d^-1)^-1)` | `a c / (b d)` |
| `m = 1 / (1 / a + 1 / b)` | `1 / (a^-1 + b^-1)` | `a b / (b + a)` |

So the bridge ("B") splits the math.js tree into a numerator and a denominator itself: a product
multiplies both, a quotient crosses them, an integer power raises both (a negative one swaps
them), and a sum reduces each term with nerdamer's plain parse and puts them over the least
common multiple of their denominators when every denominator is a monomial, otherwise over
their product. Then `nerdamer('(num)/(den)')` cancels, and its `numerator()` and
`denominator()` are the result. The prototype takes the least common multiple with nerdamer's
`lcm`, which lives in `nerdamer/algebra` (+105 kB on top of `core`, `size-probe.mjs`); for
monomials it is a maximum exponent per atom and the build can compute it itself.

What B does not do: it does not take a common factor out of a sum's terms (a first version that
skipped reducing each term gave `(2 F h^2 + 12 M h) / (2 b h^3)` for the axial-plus-bending
line, and nerdamer's plain parse left it so), and it does not split a square root (`sqrt(I / A)` stays one
factor; nerdamer did reduce it to `abs(d) / 4` for the round bar).

### Back to math.js and `toTex`

`math.parse` reads nerdamer's numerator and denominator text as it is (`4*v1`, `v2*v3^2`,
`v1^-2*v2`). The bridge then turns `x^(1/2)` back into `sqrt(x)`, puts each atom's original node
back in place of its placeholder, and builds `num / den` (or `num` alone when the denominator is
`1`). That node goes to `lineTex` with the sheet's `Names`, so typesetting is the app's own. Some
results, all observed:

| Sheet line (after the formulas above it) | Result | `lineTex` |
|---|---|---|
| `sigma = F / A`, `A = pi * d^2 / 4` | `4 F / (pi d^2)` | `\sigma := \frac{4\cdot F}{\pi\cdot{ d}^{2}}` |
| `sigma = M c / I`, `I = b h^3 / 12`, `c = h / 2` | `6 M / (b h^2)` | `\frac{6\cdot M}{ b\cdot{ h}^{2}}` |
| `P_cr = pi^2 E I / (K L)^2`, `I = pi d^4 / 64` | `pi^3 E d^4 / (64 K^2 L^2)` | `\frac{{\pi}^{3}\cdot E\cdot{ d}^{4}}{64\cdot{ K}^{2}\cdot{ L}^{2}}` |
| `s_vm = sqrt(s_x^2 - s_x s_y + s_y^2 + 3 t_xy^2)` | unchanged | `\sqrt{{ {s}_{x}}^{2}- ...}` |
| `r = sqrt(I / A)`, round bar | `abs(d) / 4` | `\frac{\left\| d\right\|}{4}` |
| `f_cd = 0.85 f_ck / 1.5` | `0.85 f_ck / 1.5` | `\frac{0.85\cdot {f}_{\mathrm{ck}}}{1.5}` |
| `q = 250 MPa * b / F` | `250 MPa b / F` | `\frac{ 250\,\mathrm{MPa}\cdot b}{ F}` |
| `p = (a b)^2 / a^3` | `b^2 / a` | `\frac{{ b}^{2}}{ a}` |

Points the spec has to settle, each shown by the output:

- **`sqrt(a^2)` gives `abs(a)`.** nerdamer assumes nothing about sign, so a diameter comes back
  as `|d|`. Keep it, or let the spec say symbols are positive and drop the `abs` on the way back.
- **Order of factors is nerdamer's,** not the line's: `x * i` for `i x`, `b + a` for `a + b`,
  `d^2 pi` in nerdamer's own TeX. Placeholders numbered by first use did not make it follow the
  line.
- **math.js reads `M (h / 2)` as a call of `M`.** The sheet already refuses that for a value
  ("a is a value, not a function: write a * (...) to multiply", `src/math/evaluate.test.ts`). The
  spec should say whether a declared symbol gets the same error or is read as a product; the
  prototype reads it as a product.
- **Decimals stay but don't combine.** `1.2 D / 2` is kept as typed. Combining them would need
  nerdamer's rational form and a rule for when to print a decimal again.

### Units

nerdamer knows no units. Unit names reach it only as atoms, where they behave as plain symbols:
`F / (25 mm^2)` stays `F / (25 mm^2)`, and `2 kN m / b * b` gives `2 kN m` (observed). Two units
of the same dimension are unrelated symbols to it (`mm` and `m` would not cancel to `1/1000`).
Unit policy is left to its own ticket.

## Hang test in detail

[`hang.mjs`](symbolic-nerdamer-bridge/hang.mjs) runs each input in its own worker thread, with
nerdamer's plain parse and with `simplify`, and terminates the worker after 5 s.
[`hang-output.txt`](symbolic-nerdamer-bridge/hang-output.txt) is the run.
[`bridge-stress.mjs`](symbolic-nerdamer-bridge/bridge-stress.mjs) times the bridge's own path
([output](symbolic-nerdamer-bridge/bridge-stress-output.txt)).

| Input | Plain parse | `simplify` |
|---|---|---|
| `(a+b)^30`, `(a+b)^200` | 5 ms, unexpanded | 47 ms, 362 ms |
| `(a+b+c+d)^12` | 7 ms | 2.2 s |
| `2/x^2 - x^(2*z)` | 6 ms | 19 ms, `(2-x^(2+2*z))/x^2` |
| sum of 4 fractions | under 10 ms | 83 s (separate run) |
| sum of 10, 20, 40 fractions | 8 to 13 ms | killed at 5 s |
| product of 10 binomials | under 25 ms | 17 s (separate run) |
| product of 20 binomials | 21 ms | killed at 5 s |
| nested fraction, 100 deep | 47 ms, not flattened | 1.4 s |
| `9^9^9`, `x^(10^9)/x`, `2^(10^6)*x` | under 10 ms, kept as powers | under 15 ms |
| `10^100000*x` | 39 ms, a 100,001-digit integer | 70 ms, the same |

nerdamer's own tracker has closed reports of hangs in `simplify`, `solve`, `sum` and definite
integrals, the latest closed on 2026-11-20
([issue search](https://github.com/jiggzson/nerdamer/issues?q=is%3Aissue+hang+OR+freeze+OR+infinite),
read through a fetch tool, issue bodies not read).

## A worker inside the Obsidian plugin

Not built here. What is known:

- An install delivers only `main.js`, `manifest.json` and `styles.css` (`FILES` in
  `scripts/audit-plugin.mjs`), so a worker cannot be a separate file. A CommonJS `main.js` has
  no `import.meta.url`, which is why Excalidraw's own worker cannot start in the plugin; the
  Excalidraw plugin starts its workers from `data:text/javascript;base64,...` URLs
  ([obsidian-plugin.md, Workers](obsidian-plugin.md#workers)). A nerdamer worker would have to be
  built the same way, with nerdamer inside the worker's text and not in the main bundle.
  Whether that starts on Obsidian for iOS is **unverified**.
- A worker makes a symbolic line's result arrive later, so `evaluateSheet` would stop being one
  synchronous call for those lines. That is a larger change than the library.

## Limits of this research

- The GitHub API was blocked for this repository (the session's GitHub access covers only this
  project), so the repository facts come from its web pages read through a fetch tool: commit
  dates and authors, open-issue titles and counts. Pull request counts and issue bodies were
  not read.
- The stubbed `nerdamer/core` was measured on its own (401,535 bytes), not inside the real
  plugin build; the real-build figures are for the unstubbed whole library and `core`.
- The worker was tested in Node's `worker_threads`, not in a browser, not in Obsidian on
  desktop or on a phone.
- The bridge is a prototype in plain JavaScript, not the engine: it reads lines with plain
  math.js (`create(all)`), not the app's own reading (formats, units registered by the app,
  `in` clauses, tables, ranges, functions defined on the sheet), and it handles only
  assignments of formulas. No value line, no mixing of a formula with a value was run.
- "No hang on the plain path" means none was found in the cases above; it is not a proof.
- Speed was measured in Node on this machine; a phone will be slower.
