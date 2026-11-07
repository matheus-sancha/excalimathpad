# 0005. The app reads its line forms before math.js sees a line

- **Status**: accepted; step 1, the comment, built (#44, `src/math/lineForm.ts`); steps 2
  and 3 not built yet (M2 to M4)
- **Date**: 2026-11-03

## Context

v1's sheet language needs more than math.js parses: a solve with a guess, a range with a
step, tables, plots with settings, display units that balance, comments that sit in a
column. ADR 0003's sandbox disables `import`, `parse` and `createUnit` inside expressions, so
sheet lines can't add functions to math.js, and every saved sheet depends on how lines read,
so this is costly to change later.

Decided across the line-form tickets, by Matheus on 2026-11-01 to 11-03 (#16, #19, #20, #31,
#36). The forms themselves are in [`docs/spec-v1.md`](../spec-v1.md) section 3.

## Decision

Each line is plain source text, one statement. The app reads it in this order, and the rest
goes to math.js:

1. **Comment:** split at the first `#` outside a string.
2. **Display unit:** take off a trailing top-level `in` or `to` whose target is a pure unit,
   read outside the sheet's scope.
3. **Form:** recognise `= solve`, `..`, `table(` and `plot(`, and take off their clauses.

What the app writes into a line (a display unit, plot clauses) is text in that same line, in
front of any `#`. So split, join, copy, paste, undo and save carry it, and one line stays one
string.

Engineering rules (Engineer's):

- The sandbox stays closed. The app's code uses the captured `parse` to compile a solve's
  residual and a list line's expression. Sheet lines can't reach it.
- Iteration over a list is the app's: one run of the expression per index, with no math.js
  matrix arithmetic, so `Q_s^2` means each point squared.
- `table`, `plot` and `solve` are reserved names.

## Alternatives considered

- **Functions added to math.js** (`solve(...)`, `range(...)`) through `import`. A solve needs
  its equation unevaluated, and the sandbox closes `import` on purpose. It would also let a
  solve appear mid-expression, which Matheus ruled out (#19).
- **Mathcad's Given/Find regions,** or a marked element type for solves. Matheus chose the one-line
  statement over both, and the pump sheet needs a solve as a function body (#9, #19).
- **Metadata beside the source** for display units and plot settings, in `customData`. Split, join
  and copy would each have to carry it. A suffix in the source gets all of that for free (#16).

## Consequences

- Source reads as typed, and a sheet file needs no change when a new clause is added.
- Line forms are syntax math.js doesn't know, so typesetting, the missing-name check and the
  shadow warning must each handle them; a solve line's parts go through math.js separately.
- `#`, `..`, `step`, `guess` and `= solve` have to stay unambiguous against math.js's own grammar,
  and a math.js upgrade could clash with them. The pump sheet's CI test covers every form.
- A name directly before `(` stays a function call, because that's math.js's rule: `f_d (L_p/D)`
  errors when `f_d` is a number, with a readable message. Making it multiply would let a mistyped
  function name silently multiply.
- A display unit is display-only. A trailing `in bar` no longer converts as math.js would; a
  conversion inside the expression still does.
