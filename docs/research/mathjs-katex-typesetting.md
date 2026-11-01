Research for wayfinder ticket #13, 2026-11-01.

# Can math.js and KaTeX typeset sheet lines with units and engineering names?

## Answer

**Yes, but not with math.js's default `toTex` alone.** Every acceptance-sheet line goes through `node.toTex()` and KaTeX 0.16.47 without a single KaTeX error, but the default output is wrong in a few places and plain in others. One custom **handler function** passed as `toTex({ parenthesis: 'auto', handler })` fixes all of them. It needs no `math.import`, so our sandbox does not get in the way. Rendered samples: [mathjs-katex-typesetting-samples.html](mathjs-katex-typesetting-samples.html). It shows every line three ways: the default, `parenthesis: 'auto'`, and the custom handler with the result.

What a later session needs to act on:

1. **Default `toTex` has two real bugs for us.**
   - (a) **Sheet variables named like units look like units.** `L = 120 m` typesets `L` upright, as `\mathrm{L}`. `SymbolNode` asks "is this a unit name?" against the math.js namespace, not the sheet scope ([SymbolNode.js L188-L193](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/node/SymbolNode.js#L188-L193)). `L` is the litre, `h` is the hour, and so on.
   - (b) **Function parameters after the first render as units.** `f(Re, k) = …` typesets as `\mathrm{f}\left(Re,\mathrm{k}\right)`. `params.map(toSymbol)` passes the array index as `toSymbol`'s `isUnit` argument ([FunctionAssignmentNode.js L250](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/node/FunctionAssignmentNode.js#L250), [latex.js L308](https://github.com/josdejong/mathjs/blob/v15.2.0/src/utils/latex.js#L308)). Observed in the probe. It looks like an upstream bug; we have not checked whether an issue exists.
2. **Default output is merely plain in these places:**
   - `_` is escaped, so `L_pipe` shows as the literal text "L_pipe", not L<sub>pipe</sub> ([latex.js `escapeLatex`/`toSymbol` L302-L318](https://github.com/josdejong/mathjs/blob/v15.2.0/src/utils/latex.js#L302-L318)).
   - Multi-letter names are bare letters, so `Re` reads like R·e.
   - Quantities become fractions: `50 m^3/h` turns into a fraction with "50 m³" on top and "h" below.
   - Number and unit are joined by `~`, a full space.
   - `to bar` renders as `→ bar`.
   - User function names are upright.
   - `=` is used for definitions.
   - `parenthesis: 'auto'` removes redundant brackets: `Q / (pi*D^2/4)` loses its `\left(\right)` ([docs: Parenthesis](https://mathjs.org/docs/expressions/customization.html#parenthesis)). Use it.
   - `implicit: 'show'` turns `2 pi D` into `2·π·D`, but it also turns `101.6 mm` into `101.6·mm` ([docs: Implicit multiplication](https://mathjs.org/docs/expressions/customization.html#implicit-multiplication)). Leave it at `hide` and let the handler format quantities.
   - Greek **whole names** already work by default: `rho` gives ρ, `mu` gives μ, `Delta` gives Δ ([latex.js `latexSymbols` L6](https://github.com/josdejong/mathjs/blob/v15.2.0/src/utils/latex.js#L6)). `DeltaP` and `rho_w` do not.
3. **The customisation route is a single `handler(node, options)` callback.** math.js runs it for every node, and returning `undefined` keeps math.js's own output for that node ([docs: Handler](https://mathjs.org/docs/expressions/customization.html#handler), [Node.js L352-L360](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/node/Node.js#L352-L360)). The handler needs the **sheet's defined names**, which `evaluateSheet` already collects in `definedAt`. With those it can tell a variable `L` from the unit `L`. The other route, a `toTex` property on functions registered through `math.import` ([docs: Custom LaTeX handlers](https://mathjs.org/docs/expressions/customization.html#custom-latex-handlers)), is closed after hardening and would not reach sheet functions anyway (details below).
4. **Proposed naming rule** (implemented in the probe):
   - The text after the first `_` is the subscript. Multi-letter subscripts are upright: `L_pipe` gives L<sub>pipe</sub>. Single letters and digits stay italic: `D_i` gives D<sub>i</sub>.
   - A Greek word becomes its letter when it is the whole base, or when a capital letter follows it: `rho_w` gives ρ<sub>w</sub>, `DeltaP` gives ΔP, `deltaT_max` gives δT<sub>max</sub>, `eta_pump` gives η<sub>pump</sub>. `piston` stays "piston".
   - Other multi-letter bases are set as one italic word with `\mathit{}`.
   - **`dP` is not turned into ΔP.** Guessing from a leading `d` would misfire. Write `DeltaP`, or type `ΔP` directly: math.js identifiers accept Greek Unicode ([parse.js L544-L546](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/parse.js#L544-L546)), and the probe rendered it fine.
5. **Results:** a math.js `Unit` has no `toTex` (`Unit.prototype.toTex` is `undefined`, observed). Typeset the result from the **same text the sheet already shows**: split `math.format(value)` into the number and the unit string, then parse the unit string and typeset it with the same unit formatter. Do not rebuild the unit from `unit.units` or `unit.simplify()`. `format` simplifies and also applies the best prefix ([Unit.js L1195-L1206](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L1195-L1206)). For example, `dP` formats as `36.45 kPa`, but `simplify()` gives the same quantity in `mPa` (observed). Dimensionless results such as `Re` and `fD` come back as plain numbers (observed).
6. **KaTeX is not in our entry bundle today.** It is a transitive dependency: `@excalidraw/excalidraw` → `@excalidraw/mermaid-to-excalidraw` → `mermaid` → `katex@0.16.47` (`npm ls`). Vite already emits it as a lazy chunk, `katex-*.js`, 258.6 kB minified (77.4 kB gzip). It is fetched only when Mermaid renders `$$…$$`. Importing it statically from `main.tsx` moves it into the entry chunk:

   | Asset | Before | After static import | Change |
   |---|---|---|---|
   | JS entry, minified | 1,961 kB | 2,223 kB | +261 kB |
   | JS entry, gzip | 597.7 kB | 675.4 kB | +77.7 kB |
   | CSS, minified | 143.2 kB | 171.7 kB | +28.5 kB |
   | CSS, gzip | 22.7 kB | 30.9 kB | +8.2 kB |
   | KaTeX font files | none | 59 | +59 |

   All "after" figures come from a throwaway build, since reverted. The font files are woff2, woff and ttf; the woff2 files total 292 kB, and the browser fetches only the faces a page uses. **Add `katex` as a direct dependency** (`^0.16.47`, so npm dedupes it with Mermaid's copy) rather than importing a transitive package. Alternatively, `import('katex')` lazily so it shares the existing chunk at no cost to the entry.
7. **Side finding that blocks the acceptance sheet as written:** `mu = 5 cP` fails with `Undefined symbol cP`. math.js 15.2 has no poise or centipoise unit (observed; there is no `poise` in [Unit.js](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js)). `createUnit` is disabled in our sandbox. Either write `mu = 5 mPa s` (1 cP = 1 mPa·s) or give the sheet a way to define units. This belongs on its own ticket.

## What the default produces (observed)

Probe: `math.parse(line).toTex(opts)` with mathjs 15.2.0, then `katex.renderToString(tex, { throwOnError: true, strict: 'error' })` with KaTeX 0.16.47. `throwOnError` makes bad TeX throw instead of rendering red, and `strict: 'error'` makes non-LaTeX input throw ([KaTeX options](https://katex.org/docs/options)). Every default and `auto` string rendered without error.

| Line | Default `toTex()` | Problem |
|---|---|---|
| `D = 101.6 mm` | `D=101.6~\mathrm{mm}` | fine; `~` is a wide space |
| `Q = 50 m^3/h` | `Q=\frac{50~{\mathrm{m}}^{3}}{\mathrm{h}}` | quantity split into a fraction |
| `rho = 850 kg/m^3` | `\rho=\frac{850~\mathrm{kg}}{{\mathrm{m}}^{3}}` | ρ correct; fraction again |
| `mu = 5 cP` | `\mu=5~ cP` | `cP` is not a unit, so it renders as the variables c·P and evaluation fails |
| `L = 120 m` | `\mathrm{L}=120~\mathrm{m}` | **variable shown as the unit L (litre)** |
| `v = Q / (pi*D^2/4)` | `v=\frac{ Q}{\left(\frac{\pi\cdot{ D}^{2}}{4}\right)}` | redundant parentheses; `auto` removes them |
| `Re = rho*v*D/mu` | `Re=\frac{\rho\cdot v\cdot D}{\mu}` | `Re` reads as R·e |
| `f(Re, k) = 0.25/log10(…)^2` | `\mathrm{f}\left(Re,\mathrm{k}\right)=\frac{0.25}{{\log_{10}\left(…\right)}^{2}}` | **`k` upright (index-as-`isUnit` bug)**; log₁₀ fine |
| `fD = f(Re, 0.045 mm / D)` | `fD=\mathrm{f}\left( Re,\frac{0.045~\mathrm{mm}}{ D}\right)` | user function upright |
| `dP = fD*L/D*rho*v^2/2` | `dP=\frac{\frac{ fD\cdot\mathrm{L}}{ D}\cdot\rho\cdot{ v}^{2}}{2}` | `L` upright; nested fraction follows the left-associative tree |
| `dP_bar = dP to bar` | `dP\_bar= dP\rightarrow\mathrm{bar}` | literal underscore; `→ bar` |
| `D_i = sqrt(4*Q/(pi*v))` | `D\_i=\sqrt{\frac{4\cdot Q}{\left(\pi\cdot v\right)}}` | literal underscore; √ fine |
| `x = 2 pi D` | `x=2~\pi~ D` | implicit multiplication becomes spaces |

The templates for `log10`, `sqrt` and `to` come from [latex.js L134](https://github.com/josdejong/mathjs/blob/v15.2.0/src/utils/latex.js#L134) and [L249](https://github.com/josdejong/mathjs/blob/v15.2.0/src/utils/latex.js#L249), and from the operator map at [L94](https://github.com/josdejong/mathjs/blob/v15.2.0/src/utils/latex.js#L94). Hidden implicit multiplication becomes `~` ([OperatorNode.js L662-L664](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/node/OperatorNode.js#L662-L664)). The only unit with a special TeX form is `deg` (°); every other unit becomes `\mathrm{name}` ([latex.js L298-L318](https://github.com/josdejong/mathjs/blob/v15.2.0/src/utils/latex.js#L298-L318)).

## The customisation (probe handler)

The handler lives in the throwaway probe, which is not committed. Its shape is what to build:

- **`SymbolNode`**
  - A sheet-defined name goes to `nameTex(name)`, the naming rule above, even when the name is also a unit.
  - Otherwise a unit name becomes `\mathrm{…}`.
  - A built-in such as `pi` returns `undefined`, which keeps math.js's `\pi`.
  - **Always prefix the output with a space.** math.js glues operands straight onto operators, so `\cdot` followed by `v` becomes `\cdotv`, an undefined control sequence. KaTeX threw on this in our first probe run. math.js's own `SymbolNode` adds the same space for the same reason ([SymbolNode.js L194-L200](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/node/SymbolNode.js#L194-L200)).
- **`AssignmentNode` / `FunctionAssignmentNode`**: `name ≔ expr`, using `\coloneqq` (Mathcad's definition sign; KaTeX renders it under `strict: 'error'`, observed). Function parameters are added to the defined names while rendering the body. This also fixes bug 1b.
- **`FunctionNode`**: a sheet-defined function becomes an italic name plus `\left(args\right)`. Built-ins such as `log10` and `sqrt` return `undefined` and keep math.js's templates.
- **`OperatorNode`**
  - A *quantity literal* is one number followed by units joined with `*`, `/` and `^`, like `50 m^3/h` or `5 mPa s`. It renders inline as `50\,\mathrm{m}^{3}/\mathrm{h}`, with a thin space.
  - `x to unit` renders only `x`, because the result placeholder already shows the unit (Mathcad style). This can be made optional.
- **Results**: render `= result` after the expression. Skip it when the right-hand side is a literal (`D ≔ 101.6 mm`), as Mathcad does.

**Limits seen:**
- `rho*9.81 m/s^2 * 30 m` parses as `((rho*9.81 m)/s^2)*…`, so a quantity sitting in the middle of a product still turns into a fraction. Write `g = 9.81 m/s^2` on its own line, or put the quantity in parentheses.
- Left-associative chains such as `fD*L/D*rho*v^2/2` typeset as nested fractions. That is faithful to the tree; writing `fD*(L/D)*…` reads better.
- The handler is untyped in TypeScript: `toTex(options?: object)` ([types/index.d.ts L4716](https://github.com/josdejong/mathjs/blob/v15.2.0/types/index.d.ts#L4716)).
- math.js's Greek table is not exported. The package `exports` map exposes only the entry points (observed in `node_modules/mathjs/package.json`), so we keep our own list of about 40 names.

## How the sandbox constrains this

`src/math/evaluate.ts` overrides `import` in the namespace, and that replaces `math.import` on the instance itself. Calling `math.import(...)` after hardening throws "import is not supported" (observed in the probe, which hardens the same way).

- **Closed: the `toTex` property route.** It attaches `toTex` to functions *before* importing them ([docs](https://mathjs.org/docs/expressions/customization.html#custom-latex-handlers)). `FunctionNode` then looks it up as `math[this.name].toTex` ([FunctionNode.js L484-L486](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/node/FunctionNode.js#L484-L486)). After hardening that path is closed, and it would only cover namespace functions anyway. A sheet function like `f(Re, k)` lives in the run's scope.
- **Unaffected: the handler route.** It is a per-call option on `Node.toTex` and touches no shared state. The `toTex` call belongs inside `src/math/`, the only module allowed to import `mathjs`, typically next to `evaluateSheet`. It would return a TeX string per line, using the parsed node and the `definedAt` names that `evaluateSheet` already has.

## Bundle note

- **Today: lazy chunk.** Excalidraw loads Mermaid support only through a dynamic `import("@excalidraw/mermaid-to-excalidraw")` (observed in `@excalidraw/excalidraw/dist/prod/index.js`). Mermaid loads KaTeX with `await import('katex')` only for `$$` math ([mermaid common.ts L331 at mermaid@11.17.2](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.17.2/packages/mermaid/src/diagrams/common/common.ts#L331)). Our build therefore holds KaTeX as a separate lazy chunk that a sheet never loads.
- **Static import: measured cost.** The table in Answer item 6 has the figures. KaTeX's chunk merges into the entry chunk.
- **A note on project docs:** `CONTEXT.md` already notes `npm audit` advisories in Excalidraw's transitive dependencies, katex among them. A direct dependency would make katex ours to track.
- **Not verified:** whether a lazily imported KaTeX plus its CSS causes a visible flash on first render. The probe did not run in a browser.

## Not verified

- **No browser check.** The samples HTML was generated and every TeX string passed `katex.renderToString` with `throwOnError: true`, but nobody looked at the page in a browser. Its CSS loads from `https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css`, which returned HTTP 200 (checked with curl), and it needs network access to show fonts.
- **Unicode under a different KaTeX `strict` setting.** Greek Unicode names such as `ρ` and `ΔP` rendered with `strict: 'error'`. Behaviour under other `strict` settings was not checked.
- **Upright multi-letter subscripts** (L<sub>pipe</sub>) follow the usual engineering convention for descriptive subscripts. The convention was not checked against ISO 80000-2, which is not freely available.
- **Upstream bug report.** We did not check whether bug 1b (`params.map(toSymbol)`) is already reported upstream.
