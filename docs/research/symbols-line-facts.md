# Facts for ticket #360: the `symbols` line

This note gathers facts for the grilling on #360 ("How is a symbols line typeset and worded in
Português, and does the unit-shadow warning apply to a declared symbol?"). It decides nothing.
The background is in the resolutions of #347 (declared symbols, read before math.js), #356
(`symbols F in kN, d in mm`, an optional unit per symbol), #357 (a formula sits in the result
cell) and #359 (Variables, rename and the assistant listing). None of it is built. Line numbers
are on branch `claude/kind-mccarthy-7aeucj` as of 2026-11-26.

## 1. How non-math lines are typeset today

Spec section 3's form table (`docs/spec-v1.md:335-347`) says which forms have a result cell:

- **Comment line** (`# Water at 20 C`) and **formatted comment line** (`@bold @L # Pumps`): no
  result cell. One text cell spans the row. Section 4, Typeset grid (`:637-643`) describes it as
  plain literal text from the row's left edge that ignores the columns, wraps rather than widening the element,
  and holds no typeset math. In code it is the only row without KaTeX
  (`src/overlay/MathElementView.tsx:510-517`). CSS: `grid-column: 2 / -1`, grey
  (`--math-quiet`, `#868e96`), `italic 15px/24px system-ui`, asking for at most 320 px
  (`src/overlay/MathOverlay.css:180-210`). A comment row gets a gutter only for its clause's
  error.
- **Note** (`# …` after code): its own column, after the result, in the comment's style
  (`MathOverlay.css:187-190`). Always grey (section 4, Colours and rules, `:688-690`).
- **Title:** a header above the lines. Plain text, never evaluated (section 4, `:644-648`).
- **Text value** (`status = "OK"`): a plain input, so its result cell is empty. It is typeset
  `\text{“…”}` (section 3, Conditionals and text; `docs/context/math.md`, typeset.ts).
- **Keyword lines** are math rows: `solve`, the range and the `table(…)`/`plot(…)` call are
  typeset as TeX by `typeset.ts` (`src/math/evaluate.ts:1755-1792`). A solve's range or guess and
  a range's step sit small and grey after the equation, inside the expression cell, as an
  `aside` (`MathOverlay.css:530-535`; spec `:651-654`). Solved values and ranges have a result.
  A solve function, a table and a plot have an empty result cell, and the table rows or the chart
  draw under the line.
- **`in <unit>`, plot clauses and the format clause don't show when typeset** (spec `:655-656`).
  A `symbols` line's `in kN` is its content, not a display unit, so it is the exception to this rule.
- **A line that doesn't parse** shows its raw source in red with a wavy underline
  (`MathOverlay.css:150-154`, the `unparsed` case at `MathElementView.tsx:519-525`). That is how
  `symbols F in kN, d in mm` draws today (section 4 below).
- **Print** copies the overlay's DOM (`docs/context/print.md`, `printView.ts`), so a row prints
  as it shows on screen, always in the light theme.

**Prototype precedent.** `docs/research/formula-result-prototype/page.html:92,176,186,249,277`
drew the line as KaTeX (`\mathrm{symbols}`, italic names, `\mathrm{in}`, upright units) in the
quiet grey, spanning `grid-column: 2 / -1`, with no result or note cell. That is a comment's
geometry with math's typesetting. The TUI prototype
(`docs/research/symbolic-trigger-prototype/tui.mjs:110`) printed it dim, as `symbols: F, d`.
Its reader also accepted the singular `symbol` (`trigger.mjs:17`, `/^\s*symbols?\s+/`).

## 2. Português and suggestions

- **Spec section 8, Language** (`:2267-2275`) says that a sheet's source, names, numbers, units and keywords
  "read and show the same in either language". The keywords it lists are `solve`, `for`, `guess`, `step`, `table`, `plot`,
  `if`, `in`, `min`, `max`, `sum`, `mean` and `count`. Section 1's out-of-scope table (`:57`) excludes "translating the math (keywords,
  function names, units…)". Only the words the app writes around the math follow the language.
- **No keyword has a Português form or a second spelling.** The format words (`@bold`,
  `@text-red`), the plot clauses (`mark`, `title`, `point`, `circle`, `equal`, `range`, `log`,
  `src/math/plotLine.ts`) and the solve and range words are read in English only. What the
  tables translate is each keyword's **hint**: `src/text/ptBR.ts:373-381` ("o intervalo de busca
  de um solve", "o resultado em uma unidade"). It does not translate the word itself.
- **Name collisions on "symbol":** the Sheet panel already has a **Symbols tab**, `aba
  Símbolos` (spec section 2, `:135`; `src/text/ptBR.ts:50`). math.js's "Undefined symbol x" is
  worded `Símbolo indefinido x` (`src/text/mathjs.ptBR.ts:55`), and #347 keeps that error for a
  typo. The catalogue module is also called `symbols.ts` (`SYMBOLS`).
- **Suggestions** (spec section 4, While editing a line, `:977-1003`; `src/overlay/suggest.ts`).
  The four sources are the sheet's names above the line, functions and line forms, constants and units.
  Keywords come from the Symbols catalogue (`functionSuggestions`, `suggest.ts:257-266`; the
  Sheet forms group, `src/math/symbols.ts:165-179`). Taking `solve`, `guess`, `for` or `step`
  adds a space. `symbols` is not in the catalogue. **After `in` or `to`** the list holds units
  only (`suggest.ts:66-67`). That regex is `/(?:^|[\s)])(?:in|to)\s+[^=,#]*$/`, so on
  `symbols F in k|` it offers units, and after the comma (`…kN, d|`) the full list comes back.
  While a symbol's name is typed, the list offers sheet names, constants, functions and units,
  because nothing there marks a fresh name.

## 3. The unit-shadow warning

- **ADR 0003** (`docs/adr/0003-…md`, Consequences) says a name that is also a math.js unit or
  built-in "is ambiguous in both directions". Below its definition it shadows the unit, and above it (or
  after it fails) lines read the unit. "The variable still wins, but such a name warns."
- **Spec section 5, Warnings** (`:1724-1745`) covers variables, function names, parameters and a
  solve's unknown, checked against math.js units, built-ins and app units. A fallback use is flagged
  as well. Short constants `R`, `k` and `c` don't warn, but `h` and `hbar` do because they are also units.
- **Wording** (spec section 13, `:4208-4209`; `src/text/engine.en.ts:37-39`,
  `src/text/engine.ptBR.ts:62-64`): `K shadows the unit K` / `K encobre a unidade K`,
  `sqrt shadows the built-in sqrt` / `… encobre o nome interno sqrt`, and the fallback
  `V reads as the unit V here: the variable is defined below` / `V é lido como a unidade V aqui:
  a variável é definida abaixo` (or `… its definition failed` / `… sua definição falhou`).
- **Where it is raised:** `src/math/warnings.ts:58-64` (`shadows`, over `definedNames`) and
  `:66-70` (`readsAsUnit`, over `usedNames`), with the solve version at `:113-125`. The facts come
  from `warningsOf` (`src/math/evaluate.ts:959-977`): `isUnit` is
  `math.Unit.isValuelessUnit`, `isBuiltIn` is `name in math`, and `definedBelow` and `definedAbove` come
  from `definedAt`, which is built from each line's `defines` (`evaluate.ts:648-658`). Only
  `parsed` and `solve` lines get warnings. Any other kind returns `[]` (`:976`).
- **Probed today** (an `evaluateSheet` probe run outside the repo): `F = 2 kN` gives
  `F shadows the unit F`. `m = 3` and `A = 2` warn the same way. `h = 2` gives
  `h shadows the unit h`, and `E = 5` gives `E shadows the built-in E`. So under today's code:
  - A later value under a declaration (`F = 2500 N`, #347) **warns at `warnings.ts:63`**.
  - A declared name used below (`sigma = F / A`) warns at `:69` only if the name is not
    `inScope`, is assigned on a later line, and is a unit. Whether that happens depends on whether a
    declaration binds the name in the scope and adds to `definedAt`.
  - The `symbols` line itself raises nothing new. As a new `ParsedLine` kind it would fall
    through to `[]` at `evaluate.ts:976`, unless it is added there.
- **Rename** (spec section 4, Renaming a name, `:1382-1384`) shows the same warning under the
  field, "a rename allows what typing the name in a line allows". `planRename` takes it from the
  target line's own `shadows` warning (`src/math/rename.ts:135-136`), so a rename to `F` of a
  symbol, whose target is the `symbols` line, shows no warning unless that line raises one.

## 4. Collisions with today's reader

- **`symbols` is a free name today.** It is not reserved: `RESERVED` is `table`, `plot` and `solve`,
  plus `if` (`evaluate.ts:2143-2161`, message `lineFormName`, `:991-992`). It is not a unit or a
  built-in either. The probe gives `symbols = 3` (no warning, value 3), `y = symbols * 2` (6) and
  `symbols(x) = x^2` (a function). No sheet in `docs/math-guide.md`, `docs/acceptance/` or the
  guide examples uses it.
- **Today's results:** `symbols F` and `symbols x` give `Undefined symbol symbols`, because math.js reads an
  implicit product. `symbols F, d` and `symbols F in kN, d in mm` give `Unexpected operator ,`.
- **Read order:** spec section 3 (`:533-560`) and `readLine` (`src/math/lineForm.ts:177-206`)
  take off the comment, then the format clause, then the **display unit**, and only then look for
  a form. `splitDisplayUnit` (`lineForm.ts:283-313`) would take `in mm` off `symbols F in kN, d
  in mm` as the line's display unit. So the step at which a `symbols` line is recognised decides
  three things: whether it can carry a `# note`, whether it can carry an `@` format, and what its last `in` means.
- **`symbols L in in`** depends on reading a target that starts with an inch, which `splitDisplayUnit` does
  for `in in^2`. That was assumed in #356 and has not been tried.
- **Rename and listing:** a new kind needs `readSheetLine`, `rolesOf` and `signature`
  (`src/math/rename.ts`) and `listSheet` (`src/assistant/listing.ts`), as #359 found.
- **ADR 0005** lists the line forms that are read before math.js. A new form amends it.

## Questions for the grilling

1. Does the line draw as a comment (grey, spanning the row) or as a math row with a result cell?
   If it spans the row, is it typeset KaTeX as in the prototype, or literal text as a comment is?
2. Which colour does it take: the comment's grey, the equation's black, or the line's text colour? Does it take a
   `@` format at all?
3. Does `in kN` show when typeset, against the rule that `in <unit>` is hidden? How does a pure-number symbol
   (`symbols x`) look next to one with a unit?
4. Can the line carry a `# note`? Is it read before or after the comment and format steps, and
   before the display-unit step?
5. Does it have a result cell, and what goes there: empty, the names, an error?
6. Is `symbols` English-only like every other keyword, or is a second spelling accepted? Is the
   singular `symbol` accepted, as the prototype's regex did?
7. Does the collision with the Symbols tab and "Símbolo indefinido" call for another word, or for
   a Português hint that tells them apart?
8. Does `symbols` join the Symbols catalogue, so that it appears in the Sheet forms group and the typing suggestions?
   What does the list offer while a new name is typed after it, and after a comma?
9. Is the shadow warning dropped, kept or reworded for a declared `F`, `m` or `A`? This applies on the
   `symbols` line itself, on a later value (`F = 2500 N`), and on uses below.
10. Is a declared name in `definedAt` (and so counted as "defined above or below" for the fallback
    warning), and does it bind in the scope?
11. Does a declared constant's short name (`R`, `k`, `c`) or a built-in (`E`, `pi`, `sqrt`) follow the
    same rule as a unit?
12. Does rename's warning under the field follow whatever the line warns, or something of its own
    for a symbol?
13. Does `symbols` become a reserved name, so that `symbols = 3` gives "symbols is a line form"? What
    happens to a sheet that already assigns it?
