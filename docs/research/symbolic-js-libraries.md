Research for wayfinder ticket #346, 2026-11-25.

# Symbolic JavaScript libraries for combining and simplifying formulas

Question: if math.js's own `simplify` is not good enough, which browser-side
symbolic libraries could substitute assigned formulas into each other and
simplify the result, inside the plugin's size cap? The only use in scope is
showing a combined formula (`sigma = F/A`, `A = pi*d^2/4` gives
`4F/(pi d^2)`). Solving and calculus are out of scope.

## Recommendation

- **Three libraries fit the cap and get both examples right: nerdamer 2,
  Algebrite and nerdamer-prime.** Each adds 0.36 to 0.60 MB to `main.js`, so
  the plugin stays near 4.0 to 4.2 MB, under 5,000,000 bytes.
- **First choice if a library is needed: nerdamer 2.1.0.** It is Apache-2.0
  (the same licence as math.js), released this month, and it keeps `E`, `I`,
  `e` and `i` as plain symbols, which matters for `F*L^3/(3*E*I)`. It costs
  597 kB minified (178 kB gzip). The risk is its age: version 2 is a rewrite
  first released on 2026-10-02.
- **Second choice: Algebrite 1.4.0.** It is the smallest (362 kB, 86 kB gzip)
  and its text output, `4*F/(d^2*pi)`, is the only one math.js parses straight
  into one clean fraction. But its last release was in April 2021, and it
  reads `e` and `i` as constants, rejects non-ASCII names and prints decimals
  cut short (`0.666667...`).
- **nerdamer-prime 1.5.0 works but reads `E` as Euler's number**, so
  `F*L^3/(3*E*I)` came back silently wrong. It is usable only if every sheet
  name is renamed before the library sees it.
- **Cortex Compute Engine gave the best output and does not fit.** Version
  0.201.5 is 5.29 MB minified on its own, more than the whole cap.
- **No WebAssembly CAS fits.** The plugin delivers one `main.js` and reaches
  no host, so a `.wasm` file has to be inlined as base64 (4/3 of its size).
  The smallest, GiNaC, is about 3.0 MB that way and is GPL. Giac is GPL and
  14 MB. Pyodide with SymPy is about 19 MB.
- **Whatever is chosen, rename names on the way in and out.** Map each sheet
  name to a neutral placeholder (`x1`, `x2`, ...) before the library and back
  after. That removes every difference below about `E`, `e`, `i`, Greek
  letters, subscripts and unit names, and keeps the library's own TeX out of
  the app, which typesets from math.js text.
- **Units should not reach the library.** None of the pure JavaScript
  candidates that fit knows units. They keep `kN` and `mm` as ordinary
  symbols, which is harmless for a formula made of names.

## The budget

`main.js` is about 3.40 MB in `CONTEXT.md`. The audit's own record is newer:
3,589,407 bytes at its last raise, with a budget of 3,595,000 and a hard cap
of 5,000,000 (`scripts/audit-plugin.mjs`, `BUDGET` and `MAX_BYTES`). So there
are about 1.41 MB to the cap today. Any library below needs the budget raised
on purpose. An install delivers `main.js`, `manifest.json` and `styles.css`
and nothing else (`FILES` in the same script), so a lazy chunk or a separate
`.wasm` file is not an option.

## Comparison

Sizes are one entry file that imports the library and runs the stress example,
bundled with esbuild (`--bundle --minify --format=iife --platform=browser`),
then `gzip -9`. Measured on 2026-11-25 in Node 22.23.5. "Fits" is against the
1.41 MB left. Output columns are observed, not from documentation.

| Library | Version, last release | Licence | Min / gzip | Fits | `F/A`, `A = pi*d^2/4` | `M*c/I`, `I = b*h^3/12` | Verdict |
|---|---|---|---|---|---|---|---|
| math.js `simplify` (baseline) | 15.2.0 in the repo; [15.3.0 on npm, 2026-11-23](https://www.npmjs.com/package/mathjs) | Apache-2.0 | 0 extra (already in `main.js`; `create(all)` alone measured 661 kB / 190 kB) | yes | `4 * F / d ^ 2 / pi` | `12 * M * c / h ^ 3 / b` | Correct, but a chain of divisions; its TeX is a fraction inside a fraction |
| [nerdamer](https://www.npmjs.com/package/nerdamer) | 2.1.0, 2026-11-20 | Apache-2.0 (1.x was MIT) | 597 kB / 178 kB | yes | `4*F*(pi*d^2)^-1`; TeX `\frac{4 \cdot F}{d^{2} \cdot \pi}` | `12*M*c*(b*h^3)^-1`; TeX `\frac{12 \cdot M \cdot c}{b \cdot h^{3}}` | **First choice** |
| [Algebrite](https://www.npmjs.com/package/algebrite) | 1.4.0, 2021-04-14 | MIT | 362 kB / 86 kB | yes | `4*F/(d^2*pi)`; TeX `\frac{4F}{d^2\pi}` | `12*M*c/(b*h^3)` | Second choice: best text, not maintained |
| [nerdamer-prime](https://www.npmjs.com/package/nerdamer-prime) | 1.5.0, 2026-07-24 | MIT | 486 kB / 179 kB (all); 452 kB / 169 kB (core + Algebra) | yes | `4*F*d^(-2)*pi^(-1)`; TeX `\frac{4 \cdot F}{d^{2} \cdot \pi}` | `12*M*b^(-1)*c*h^(-3)` | Works; `E` is Euler's number |
| [@cortex-js/compute-engine](https://www.npmjs.com/package/@cortex-js/compute-engine) | 0.201.5, 2026-11-25 | MIT | 5,286 kB / 1,609 kB | **no** | `\frac{4F}{\pi d^2}` | `\frac{12Mc}{bh^3}` | Best output; too big |
| [math-expressions](https://www.npmjs.com/package/math-expressions) | 3.0.0-alpha.1, 2026-09-20 | GPL-3.0 OR Apache-2.0 | about 130 kB of JavaScript over math.js, plus a 1,773 kB `.wasm` (2,364 kB as base64) | **no** | `4 F/(d^2 π)` | `12 M c/(b h^3)` | Good output; needs wasm; alpha |
| [@khanacademy/kas](https://www.npmjs.com/package/@khanacademy/kas) | 3.1.1, 2026-10-28 | MIT | 86 kB / 26 kB | yes | `4*F*pi^(-1)*d^(-2)` | `12*M*c*b^(-1)*h^(-3)` | Reject: no fraction form, splits names |
| [ts-cas](https://www.npmjs.com/package/ts-cas) | 1.0.1, 2026-11-18 | MIT | 14 kB / 5 kB | yes | `(d^2*1/4*pi)^-1*F` | `(h^3*1/12*b)^-1*c*M` | Reject: does not combine the numbers |
| [mathsteps](https://www.npmjs.com/package/mathsteps) | 0.2.0, 2017-10-27 | Apache-2.0 | not measured; depends on math.js 3.11.2, a second copy of math.js | no | 0 steps, unchanged | 0 steps, unchanged | Reject: archived, did not simplify |
| [ginac-wasm](https://www.npmjs.com/package/ginac-wasm) | 0.5.0, 2021-11 | **GPL-2.0-only** | 2,199 kB `.wasm` (2,932 kB as base64) + 67 kB | **no** | not run | not run | Reject: GPL and size |
| Giac/Xcas wasm: [@basthon/xcas-wasm](https://www.npmjs.com/package/@basthon/xcas-wasm), [giac](https://www.npmjs.com/package/giac) | 0.1.5, 2025-11; `giac` 1.23.69823, 2021-04 | **GPL-3.0-or-later** | 14,017 kB `.wasm` + 457 kB | **no** | not run | not run | Reject: GPL and size |
| Pyodide + SymPy: [pyodide](https://www.npmjs.com/package/pyodide), [sympy](https://pypi.org/project/sympy/) | 314.0.8, 2026-11-13; SymPy 1.14.0, 2025-04-27 | MPL-2.0; BSD | 9,598 kB `.wasm` + 2,546 kB standard library + 6,299 kB SymPy wheel + 568 kB mpmath wheel, about 19 MB before base64 | **no** | not run | not run | Reject: size |
| SymEngine wasm | no browser package on npm | MIT | n/a | n/a | not run | not run | Nothing to install (see below) |

### More observed output

`bending2` is `M*c/I` with `I = b*h^3/12` and `c = h/2`. `EI` is
`F*L^3/(3*E*I)` with `I = pi*d^4/64`. `sqrt` is `sqrt(I/A)` with the circle's
`I` and `A`. `sum` is `F/A + M*c/I` with `A = b*h`, `I = b*h^3/12`, `c = h/2`,
asked to simplify.

| Library | bending2 | EI | sqrt | sum |
|---|---|---|---|---|
| math.js `simplify` | `6 * M / h ^ 2 / b` | `F * L ^ 3 * 1 / E * 64 / 3 / d ^ 4 / pi` | `sqrt(d ^ 2 / 16)` | not run |
| nerdamer 2.1.0 | `6*M*(b*h^2)^-1` | `(64/3)*F*L^3*(pi*E*d^4)^-1` | `(1/4)*abs(d)` | `(b*h^2)^-1*(6*M+F*h)` |
| Algebrite 1.4.0 | `6*M/(b*h^2)` | `64*F*L^3/(3*E*d^4*pi)` | `(1/16*d^2)^(1/2)` | `(6*M+F*h)/(b*h^2)` |
| nerdamer-prime 1.5.0 | `6*M*b^(-1)*h^(-2)` | `(2553519872/325368125)*F*L^3*d^(-4)*pi^(-1)` (**wrong**: `E` became 2.718...) | `(1/4)*abs(d)` | `(6*M+F*h)*(b*h^2)^(-1)` |
| Compute Engine 0.201.5 | `\frac{6M}{bh^2}` | `\frac{64FL^3}{3\pi Ed^4}` | `\frac{\vert d\vert}{4}` | not run |
| math-expressions | `6 M/(b h^2)` | `64 F L^3/(3 E d^4 π)` | `sqrt(d^2)/4` | not run |
| KAS 3.1.1 | `6*M*b^(-1)*h^(-2)` | `64/3*F*L^(3)*E^(-1)*pi^(-1)*d^(-4)` | `0.25*d` (a float, and the absolute value is lost) | not run |

`math.rationalize` is no help: it turned `F/(pi*d^2/4)` into
`F / (0.25 * pi * d ^ 2)` and refused the `sqrt` case with "There is an
unsolved function call" (observed, math.js 15.2.0).

## Text and TeX, in and out

The app typesets from math.js text, so the useful question is whether math.js
can parse what the library prints.

| Library | Takes | Gives | math.js parses its text into |
|---|---|---|---|
| nerdamer 2 | math.js-style text (`F/A`, `pi*d^2/4`, `sqrt()`), a substitution map as the second argument | text, TeX (`toTeX()`), and `numerator()` / `denominator()` | `4 * F * (pi * d ^ 2) ^ (-1)`: parses, but shows a power of -1. Build `num/(den)` from `numerator()` and `denominator()` instead: `64*F*L^3` and `3*pi*d^4*E` (observed) |
| Algebrite | text close to math.js's; assignment with `=`, or `subst()` | text, TeX (`printlatex()`) | `4 * F / (d ^ 2 * pi)`: one clean fraction |
| nerdamer-prime | as nerdamer 1.x; `convertFromLaTeX()` worked on `\frac{F}{\frac{\pi d^2}{4}}` | text, TeX | `4 * F * d ^ (-2) * pi ^ (-1)`; `numerator()` and `denominator()` exist here too |
| Compute Engine | LaTeX or MathJSON only. `ce.parse('F/(pi*d^2/4)')` read `pi` as `p*i` and gave `\frac{(-4\imaginaryI)F}{pd^2}` | LaTeX, MathJSON, and a text form (`(4F) / (pi * d^2)`) that quotes long names (`"sigma_max" / "F_Ed"`), which math.js reads as strings | needs a MathJSON converter both ways |
| math-expressions | text, LaTeX, MathML | text with implicit multiplication (`4 F/(d^2 π)`), LaTeX | parses |
| KAS | its own text and TeX subset | text, TeX with negative powers (`4F\pi ^{-1}d^{-2}`) | parses, with negative powers |

nerdamer 2's own `convertFromLaTeX` has a bug on this input: it read `\pi d`
as one name and returned `4*F*pid^-2` (observed). Do not rely on its TeX
input.

Decimals: nerdamer 2 prints `0.85*f_ck/1.5` as
`0.56666666666666666667*f_ck` in text and `\frac{17 \cdot f_{ck}}{30}` in
TeX. nerdamer-prime prints `(17/30)*f_ck`. Algebrite prints
`0.566667...*f_ck`, with a literal `...`, which cannot be parsed back.
A formula with a decimal factor needs its own rule whichever is chosen.

## Names, constants and unit-like symbols

| Input | nerdamer 2 | Algebrite | nerdamer-prime | Compute Engine (LaTeX) | math-expressions | KAS |
|---|---|---|---|---|---|---|
| `E*I*e*i` | all four kept as symbols | `i` is the imaginary unit, `e` the constant; `E`, `I` kept | `E` became 2.718...; `I`, `e`, `i` kept | `e` and `i` are constants; `E`, `I` kept | all kept | not run |
| `sigma_max/F_Ed` | kept; TeX `\frac{\sigma_{max}}{F_{Ed}}` | kept; TeX does not subscript | kept | kept from `\sigma_{max}` | **split**: `a d x σ_m/F_E` | not run |
| `σ` (non-ASCII) | accepted | syntax error | "σ is not a valid variable name" | n/a | n/a | not run |
| `gamma*H` | kept | kept | kept | `\gamma` became `EulerGamma` | kept | not run |
| `10*kN/(25*mm^2)` | `(2/5)*kN*mm^-2` | `2*kN/(5*mm^2)` | `(2/5)*kN*mm^(-2)` | from `\mathrm{kN}`: a `Quantity`, printed as `\qty[...]{\frac{2}{5}}{kN/mm^{2}}` | **split**: `2 N k/(5 m^3)` | **split**: `2/5*k*N*m^(-3)` |

Only Compute Engine has units of its own (a `Quantity` head and a
`UNITS_DICTIONARY` export, observed in 0.201.5). The others treat a unit name
as a symbol, which is what the combined formula needs: it is shown in names,
and values with units stay in math.js.

## Maintenance

| Library | State |
|---|---|
| nerdamer | Releases 1.1.13 (2021-11-17), then nothing until 2.0.0-rc.1 (2026-09-19), 2.0.0 (2026-10-02), 2.0.1 (2026-11-01) and 2.1.0 (2026-11-20) ([npm](https://www.npmjs.com/package/nerdamer?activeTab=versions)). The README calls version 2 "a rewrite in TypeScript" and points 1.x users to nerdamer-prime; 24 open issues ([repository](https://github.com/jiggzson/nerdamer), read 2026-11-25). Needs `BigInt`. |
| nerdamer-prime | A fork of nerdamer 1.x; its stated aim is bug fixes and compatible improvements, not new features. 27 open issues, 9 open pull requests ([repository](https://github.com/together-science/nerdamer-prime)). Releases 1.4.0 (2026-01-27) and 1.5.0 (2026-07-24). |
| Algebrite | Last release 1.4.0 on 2021-04-14; 84 open issues, 6 open pull requests; the README says nothing about maintenance ([repository](https://github.com/davidedc/Algebrite)). |
| Compute Engine | 309 versions on npm, eight of them between 2026-11-23 and 2026-11-25; 6 open issues, 4 open pull requests ([repository](https://github.com/cortex-js/compute-engine)). Still 0.x. `package.json` asks for Node 26.13 or newer. |
| mathsteps | Archived by its owner on 2024-08-29, with 61 open issues ([repository](https://github.com/google/mathsteps)). |
| KAS | Released from Khan Academy's Perseus repository, 3.1.1 on 2026-10-28 ([npm](https://www.npmjs.com/package/@khanacademy/kas)). Built to compare student answers, not to print formulas. |
| math-expressions | Alpha. Its README says the package is now a thin layer over a Rust core compiled to wasm, and that the wrapper does not free the wasm handles it returns (README in the 3.0.0-alpha.1 package). |

## Why Compute Engine does not fit

Its size grew about nine times in 2026. The same entry, bundled the same way:

| Version | Published | Min / gzip |
|---|---|---|
| 0.30.2 | 2025-07 | 602 kB / 162 kB |
| 0.55.0 | 2026-03 | 1,053 kB / 281 kB |
| 0.100.0 | 2026-07 | 2,125 kB / 592 kB |
| 0.150.0 | 2026-09 | 4,127 kB / 1,209 kB |
| 0.201.5 | 2026-11-25 | 5,286 kB / 1,609 kB |

The `./core` sub-path of 0.201.5 is no smaller (5,263 kB): it imports the same
chunks. 0.30.2 gave the same LaTeX as 0.201.5 on the stress, bending and EI
examples, and it would fit. But pinning a version sixteen months and about
270 releases behind a 0.x library means carrying it without fixes. The bundle
also names two hosts (`cortexjs.io`, `oeis.org`) and has one `fetch(` call,
each of which the plugin audit would have to allow.

## WebAssembly candidates

- **Giac/Xcas.** Both npm packages are GPL-3.0-or-later. The wasm in
  `@basthon/xcas-wasm` 0.1.5 is 14,016,856 bytes. The `giac` npm package
  holds the C++ source, not a browser build. GPL in one bundled `main.js`
  would put the plugin, which is MIT, under GPL terms.
- **GiNaC** (`ginac-wasm`) is GPL-2.0-only, last published in 2021, and about
  3.0 MB once inlined.
- **Pyodide + SymPy** is about 19 MB in four files before base64, and SymPy
  would also have to be read from memory, not fetched.
- **SymEngine.** A registry search found only
  `@emscripten-forge/symengine` (24 kB, a conda-style package record, not a
  browser module). `github.com/symengine/symengine.js` returned 404.
  **Unverified** whether a usable wasm build exists elsewhere.

## Other packages found and not tested

From `npm search` on 2026-11-25, listed so they need not be looked up again:
`@isopodlabs/symbolic` 0.1.0 (MIT, 2025-12), `mathlify` 0.4.12 (MIT, 2025-06,
"a focus on presentation"), `stemcmicro` 0.9.42 and `symbolic-math` 0.9.103
(MIT, Eigenmath ports, 10 to 15 MB unpacked), `casper-math` 0.1.8,
`guacyra` 0.0.35, `coffeequate` 1.3.0 (2016), `@lumilla/star` 0.3.4 (Rust,
marked UNLICENSED), `mathrok` 1.1.4 and `@lakutata/math` 3.3.2 (21 and 26 MB
unpacked). None is both established and small; none was run.

## How this was measured

- Network: the npm registry and PyPI were reachable; `bundlephobia.com`,
  `cdn.jsdelivr.net`, `mathjs.org`, the Giac site and the GitHub API were
  not. GitHub repository pages were read through a fetch tool. So sizes come
  from real installs and esbuild, not bundlephobia.
- Installs went into a scratch directory outside the repository, with
  `--ignore-scripts`. Nothing was added to the repository.
- The plugin's own build (`esbuild.plugin.mjs`) was not run with a library
  added. Its trims may move a size by a little. Treat the sizes as within a
  few per cent.
- Speed, in Node, 50 runs of the bending2 case: nerdamer 2 26 ms,
  nerdamer-prime 22 ms, Algebrite 63 ms, Compute Engine 265 ms. Load time:
  nerdamer 2 48 ms, nerdamer-prime 28 ms, Algebrite 20 ms, Compute Engine
  332 ms. None is a concern for one formula at a time.

## Open points and unverified claims

- **One run gave wrong-looking Algebrite output.** After nerdamer-prime had
  run a batch of expressions in the same process, Algebrite printed floats
  (`1.273240...*F/(d^2.0)`) for inputs it otherwise prints exactly. With
  nerdamer-prime taken out of the batch the output was exact, and single
  calls did not reproduce it. Both depend on `big-integer`; the cause was not
  found. It only matters if two of these libraries were ever bundled
  together.
- **nerdamer 2's licence is Apache-2.0** by its `package.json`, `LICENSE.md`
  and README; 1.x was MIT. No note on the change was found.
- Commit dates of the repositories were not obtained; "last release" is from
  npm.
- math.js's documentation for `simplify` could not be reached, so whether
  options or custom rules could make it print one fraction is **not
  checked** here. That is the cheaper route if it works, at zero bytes.
- Whether Algebrite's and nerdamer's parsers accept every form a sheet line
  can hold (ranges, indices, units written with a space, function
  definitions) was not tested. The examples were plain products, quotients,
  powers and `sqrt`.
- Behaviour on a phone inside Obsidian was not tested. nerdamer 2 needs
  `BigInt`.
