Research for wayfinder ticket #18, 2026-11-01.

# Solver and plot libraries for a solve block and dP-vs-Q plots

Question: which client-side options can solve one implicit equation (Colebrook,
with a guess) and draw plots (dP vs Q), offline in the browser, with math.js
units? What do they cost in bundle size, how do they handle units, and how well
do they fit the zoom-scaled DOM overlay and printing to PDF?

## Recommendation

- **Solver: write it ourselves, in `src/math/`. No library.** math.js 15 has no
  general non-linear root finder. A bracket-from-guess plus Brent solver is 46
  lines and 638 B gzip (measured). math.js evaluates the residual `lhs - rhs`
  with units, and the solver only sees plain SI numbers. In the probe it solved
  Colebrook from the guess fD = 0.02 in 6 Brent iterations (14 residual
  evaluations, 0.8 ms). math.js's own subtraction rejects a dimensionally wrong
  equation ("Units do not match"), so we get the dimension check for free.
- **Systems (Given/Find with several unknowns) are in reach.** Newton with a
  finite-difference Jacobian, with `math.lusolve` for the linear step, solved a
  2×2 pipe-flow system (Darcy + Colebrook) in 5 iterations. A robust version
  needs damping or a line search and residual scaling. That is a follow-up, not
  needed for v1.
- **Plots: lazy-load Observable Plot, or draw plain SVG with `d3-scale` and
  `d3-shape`.** Both give **static SVG**. SVG stays sharp under the overlay's
  CSS `scale(zoom)` and prints as vectors, and neither needs pointer maths
  under a transform. Observable Plot is a measured 102.7 kB gzip lazy chunk
  that Vite splits off, so the 597.9 kB entry is unchanged. Hand-rolled SVG is
  about 10 kB gzip plus roughly 100–150 lines of axis code (estimate).
  Recommended v1 choice: **Observable Plot behind `import()`**, because it
  gives axes, ticks, log scales and labels for free. Switch to hand-rolled SVG
  only if the lazy chunk ever matters.
- **Avoid Plotly here.** The full bundle is 1,446 kB gzip and even the basic
  partial bundle is 396 kB gzip (both measured). Its value is interactivity,
  which a calc sheet that has to print does not need. Also avoid canvas
  libraries (uPlot, Chart.js): under a CSS `scale()` a canvas bitmap blurs when
  zoomed in, and it prints as a raster.
- **Units never reach the plot library.** Every option takes plain numbers.
  Convert each series with `unit.toNumber('kPa')` (math.js) and put the unit in
  the axis label. This is the same work for every library, so it does not
  separate them.

## Comparison

Sizes are min + gzip (level 9), measured on 2026-11-01. The method is under
[How sizes were measured](#how-sizes-were-measured). math.js `create(all)`
measured the same way is 187.3 kB gzip, which is consistent with CONTEXT.md's
"about 180 kB".

### Root finding

| Option | What it gives | Size (gzip) | Units | Licence / maintenance | Verdict |
|---|---|---|---|---|---|
| math.js 15.2 built-ins | `lsolve`/`usolve`/`lusolve` (linear), `polynomialRoot` (polynomials of degree 3 or less), `solveODE`, `derivative`, `simplify`; **no non-linear root finder** ([function reference](https://mathjs.org/docs/reference/functions.html), [polynomialRoot](https://mathjs.org/docs/reference/functions/polynomialRoot.html); observed: no such name among the 402 keys of `create(all)` in 15.2.0) | already in entry | native | Apache-2.0, active | Use for evaluating the residual and for `lusolve` in systems |
| **Hand-rolled bracket + Brent (+ Newton)** | 1-D robust root, Newton for speed and systems | **0.64 kB** (measured) | residual evaluated by math.js with units; solver works on SI numbers | ours | **Recommended** |
| [`fmin`](https://github.com/benfred/fmin) 0.0.4 | `bisect`, `nelderMead`, `conjugateGradient` (minimisers); no Brent | 1.9 kB | none | BSD-3; last push 2024-10 | Not needed: bisection is 10 lines |
| [`numeric`](https://github.com/sloisel/numeric) 1.2.6 | `uncmin`, `dopri`, `solve` (linear); no 1-D root finder | 25.3 kB | none | npm 1.2.6 published 2012-12; repo last push 2018-09; no `license` field in package.json | Reject: unmaintained |
| `brent-zero-generator` 1.1.1 | Brent as a generator | ~12 kB unpacked (npm) | none | ISC, single maintainer on Bitbucket, 2024-02 | Reject: no gain over 40 lines of our own |
| `@stdlib` | npm search found no root-finding package (unverified beyond a registry search) | n/a | none | | n/a |

### Plotting

| Library | Size (gzip, measured) | Output | Under overlay `scale(zoom)` | Print to PDF | React fit | Offline | Licence / last push |
|---|---|---|---|---|---|---|---|
| [Plotly.js](https://github.com/plotly/plotly.js) `plotly.js-dist-min` 4.2.0 | **1,446 kB** | SVG for `scatter` (WebGL for `scattergl`) | Interactions under CSS transforms were fixed in 1.58.0 ([CHANGELOG](https://github.com/plotly/plotly.js/blob/master/CHANGELOG.md), #5193/#5302; hover in 2.5.0, #5916; [issue #888](https://github.com/plotly/plotly.js/issues/888)) | vector | imperative `newPlot` in an effect | yes for 2-D traces; geo traces fetch `https://cdn.plot.ly/un/` (string found in the bundle) | MIT / 2026-10 |
| Plotly basic partial bundle `plotly.js-basic-dist-min` 4.2.0 (scatter, bar, pie only, per its README) | **396 kB** | SVG | as above | vector | as above | as above | MIT / 2026-10 |
| [uPlot](https://github.com/leeoniya/uPlot) 1.6.32 | **23.3 kB** (Vite lazy chunk: 22.2 kB) | **Canvas 2D** (README), including the axes | Blurs and the cursor maths break under `transform: scale` ([issue #469](https://github.com/leeoniya/uPlot/issues/469): the maintainer says crisp output would need a per-instance pixel ratio) | raster | imperative | yes | MIT / 2026-10 (last npm release 2025-03) |
| [Chart.js](https://www.chartjs.org/docs/latest/) 4.6.1, tree-shaken line chart | **55.7 kB** (`chart.js/auto`: 69.3 kB) | **Canvas** ("renders chart elements on an HTML5 canvas", docs) | needs a re-render with [`devicePixelRatio`](https://www.chartjs.org/docs/latest/configuration/device-pixel-ratio.html) times zoom to stay sharp | raster; needs a resize hook ([printing resizable charts](https://www.chartjs.org/docs/latest/configuration/responsive.html#printing-resizable-charts)) | imperative or react-chartjs-2 | yes | MIT / 2026-10 |
| [Vega-Lite](https://github.com/vega/vega-lite) 6.5 + Vega 6.4 via vega-embed 7.3 | **284.5 kB** (with `vega-interpreter` for CSP and no embed: 263.3 kB) | SVG or canvas ([`renderer` option](https://github.com/vega/vega-embed#options), SVG by default in embed) | fine with SVG | vector with SVG | imperative | yes | BSD-3 / 2026-10 |
| **[Observable Plot](https://observablehq.com/plot/) 0.6.17** | **86.9 kB** (esbuild); **102.7 kB own chunk** in the real Vite build, importing d3 chunks that Excalidraw's lazy Mermaid code already emits | **SVG** (observed: `plot()` returns `<svg>`, or `<figure>` once a title or legend is set) | fine: static SVG, no pointer maths unless the `tip` mark is used | vector | returns a DOM node: append it in an effect | yes | ISC / 2026-10 (pre-1.0; last npm release 2025-02) |
| Hand-rolled SVG + [`d3-scale`](https://github.com/d3/d3-scale) + [`d3-shape`](https://github.com/d3/d3-shape) | **9.8 kB** | SVG (React renders it as JSX) | fine | vector | native JSX | yes | ISC / 2026-02 |

For reference, the excalimath plugin
([tamerUAE/excalimath](https://github.com/tamerUAE/excalimath), `packages/core/src/plugins/graph/plotRenderer.ts`)
uses `plotly.js-dist-min` ^3.5.0. It renders in an off-screen div, takes the
SVG, and inserts it as an Excalidraw **image element** through a data URL. So
it uses Plotly as an SVG generator, not as an interactive chart.

## Solver details

### Probe (throwaway, not committed)

Setup: math.js 15.2.0 `create(all)` in Node 24. The equation is split at `=`.
`(lhs) - (rhs)` is parsed and compiled once and evaluated with a `Map` scope.
The unknown gets the unit of its guess:

- a unitless guess is passed through as a number;
- a guess with a unit becomes `math.unit(x, guess.toSI().formatUnits())`.

A residual that comes back with a unit is reduced to SI with
`r.toSI().toNumber(...)`. The bracket search expands geometrically from the
guess by ±10 % × 1.6ⁿ and accepts a sign change between the guess and either
side, so it never steps outside the domain (for example `sqrt(fD)` with
`fD < 0`, where math.js returns a complex number and the residual becomes
`NaN`). Brent follows Brent (1973), *Algorithms for Minimization without
Derivatives*, ch. 4, as in Numerical Recipes' `zbrent`. Newton uses a
forward-difference derivative with step h = 1e-7·|x|.

Results (observed):

| Case | Result | Cost |
|---|---|---|
| Colebrook, k = 0.045 mm, D = 101.6 mm, Re = 29 600, guess fD = 0.02, **Brent** | fD = **0.02470670028**, \|residual\| = 5.7e-14, bracket [0.0200, 0.0251] | 6 iterations, 14 residual evaluations (7 for bracketing), 0.8 ms |
| Same, **Newton** (FD derivative) | fD = 0.02470670028 | 5 iterations, 10 evaluations, 0.2 ms |
| Haaland explicit approximation (sanity check) | fD = 0.02440 (1.3 % low, as expected for Haaland) | |
| Unknown with a unit: `Q = pi/4*D^2*v`, Q = 30 m³/h, v = 2 m/s, guess D = 50 mm | D = **72.836562 mm**, equal to the closed form `sqrt(4Q/(πv))` | 7 iterations, 19 evaluations |
| Wrong dimensions: `Q = pi/4*D^2` | math.js throws "Units do not match" on the first evaluation | |
| 2×2 system: dP = fD·L/D·ρ·v²/2 and Colebrook with Re = ρvD/μ; dP = 5 kPa, L = 100 m; guesses v = 1 m/s, fD = 0.02 | v = **0.69306778 m/s**, fD = **0.021151555** (substituting back gives dP = 5.000 kPa) | Newton with an FD Jacobian and `math.lusolve`: 5 iterations, 15 system evaluations, 6 ms |
| Table: Q = 10..100 m³/h step 1 (91 rows), Colebrook solved per row, then dP | dP(100 m³/h, L = 100 m) = 102.18 kPa | 30 ms for all 91 rows (including string re-parsing every row) |

### Implications for the design

- **Where it lives.** The solver belongs in `src/math/`, the only module that
  may import `mathjs` (CONTEXT.md). It should compile the equation Nodes with
  the captured `parse`, like `evaluateSheet` does. `evaluate`, `parse`,
  `derivative` and `simplify` are disabled *inside expressions*. A solve block
  is therefore engine-level syntax (a Given/Find region that the sheet
  recognises), not a math.js function a line can call. If an expression-level
  `find(...)` is wanted, inject it per run into the sheet scope as a closure
  over our own compiled residual, like the `typed` stub.
- **Units contract.** The unknown takes the guess's unit, and the residual's
  dimension is checked by math.js. The solved value is shown in the guess's
  unit, or in whatever unit the user converts to.
- **Brent vs Newton.** Brent with a bracket from the guess is the safer default
  for 1-D: it is guaranteed to converge once a bracket exists, and Colebrook's
  domain edge (fD ≤ 0) is handled by the NaN guard. Newton is faster but can
  step out of the domain. For n > 1 there is no bracketing, so it has to be
  Newton or Levenberg–Marquardt.
- **Symbolic derivative.** `math.derivative` works on the Colebrook residual,
  both unitless and with unit-valued symbols in the scope (observed). An FD
  Jacobian is simpler and accurate enough at these sizes, so symbolic
  differentiation is not needed.
- **Performance.** Sub-millisecond per solve and about 0.3 ms per table row, so
  re-running the whole sheet synchronously on every edit (ADR 0003) still
  holds for v1-sized sheets. Sweeps of thousands of rows would need caching or
  a Worker (not measured).

## Plot details

- **Unit handling (all libraries).** math.js already gives unit-carrying
  vectors. In the observed run, both `Q = (10:10:100) * 1 m^3/h` and
  `10 m^3/h : 10 m^3/h : 100 m^3/h` produced 10-element unit vectors, and
  element-wise `v.^2` kept units. The plot layer converts each series to its
  display unit (`toNumber('m^3/h')`, `toNumber('kPa')`; see
  [units](https://mathjs.org/docs/datatypes/units.html)). It labels the axes
  `Q (m³/h)` and `dP (kPa)`, and rejects a series with mixed dimensions
  through the same conversion error. None of the libraries above knows about
  units.
- **Overlay fit.** `MathElementView` lays math out in scene units and applies
  `transform: translate(...) scale(zoom)` (`src/overlay/MathElementView.tsx`).
  An SVG child scales crisply with that transform, free. A canvas child is
  rasterised at its backing size, then stretched: it is blurry when zoomed in
  unless it is re-rendered at `zoom × devicePixelRatio` on every zoom change.
  Chart.js supports that through `devicePixelRatio`; uPlot does not
  (issue #469). Interactive libraries also have to map pointer coordinates
  through the transform. Plotly fixed this; uPlot did not. A static SVG plot
  avoids both problems. (The blur and print behaviour of canvas versus SVG is
  standard browser behaviour and was not probed here.)
- **Print / PDF.** SVG stays vector in print. Canvas prints as its bitmap, and
  Chart.js documents a resize workaround for print. This is unverified for our
  print path, which is not built yet.
- **Alternative placement.** excalimath's approach (render SVG, insert it as an
  Excalidraw image) would put plots into Excalidraw's own export. It conflicts
  with ADR 0002, where math elements are overlays on anchors, and the image
  would be a stale snapshot unless the overlay rewrites it on every
  evaluation. Not recommended for v1. It is noted here because "print to PDF"
  might later mean Excalidraw's export rather than browser print.

## Lazy loading (observed)

In a throwaway edit to `src/main.tsx`, `() => import('@observablehq/plot')`
and `() => import('uplot')` were added and `vite build` (Vite 8 / Rolldown)
was run. Results:

- The entry chunk stayed **1,961.61 kB / 597.86 kB gzip**, identical to the
  baseline.
- uPlot became its own **22.24 kB gzip** chunk.
- Observable Plot became a **102.67 kB gzip** chunk (`src-*.js`). It imports
  `linear-*`, `time-*`, `ordinal-*` and other d3 chunks that already exist for
  Excalidraw's lazily loaded Mermaid code. The first plot loads those too,
  unless Mermaid's code has already loaded them.

So a plot element can render through `React.lazy` or an `import()` in an
effect, and sheets without plots pay nothing
([Vite: dynamic import](https://vite.dev/guide/features#dynamic-import)). For
offline use, the PWA service worker must **precache the lazy chunks too**, or
the first plot made offline fails. vite-plugin-pwa's default Workbox
`globPatterns` cover `**/*.{js,css,html}`, which would include them
(**unverified**: from memory of the
[vite-plugin-pwa docs](https://vite-pwa-org.netlify.app/guide/static-assets);
there is no PWA plugin in the repo yet).

## How sizes were measured

The packages were installed into a scratch folder: latest versions on
2026-11-01, with math.js pinned to 15.2.0. Each library had a one-line entry
that imports and uses it, for example:

```js
import * as Plot from '@observablehq/plot'
window.P = (d) => Plot.plot({ marks: [Plot.line(d, { x: 'q', y: 'dp' })] })
```

Each entry was bundled with esbuild 0.28.2:
`bundle: true, minify: true, format: 'esm', platform: 'browser'`, with
`NODE_ENV` set to `production`. The output was gzipped with Node's
`zlib.gzipSync(level 9)`, and brotli was measured too. Brotli sizes (kB):

| Library | Brotli (kB) |
|---|---|
| Plotly full | 1,086 |
| Plotly basic | 326 |
| vega-embed | 242 |
| Observable Plot | 74 |
| Chart.js (tree-shaken) | 49 |
| uPlot | 21 |
| d3 helpers | 9 |
| solver | not measured (0.64 kB gzip) |

The Vite chunk numbers come from the real app build with throwaway dynamic
imports, described above. Licences and versions were read from the installed
`package.json` files. Last-push dates come from the GitHub API (`pushed_at`)
and release dates from `npm view <pkg> time`.
