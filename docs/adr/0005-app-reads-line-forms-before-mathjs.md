# 0005. The app reads its line forms before math.js sees a line

- **Status**: accepted; the comment built (#44) and the format clause built (#63), both in
  `src/math/lineForm.ts`; the display unit built (#56), taken off the text there and
  checked as a pure unit by the engine; the solve built (#70), read in
  `src/math/solveLine.ts`; the range built (#74), read in `src/math/rangeLine.ts`; `table(` built (#76), read
  in `src/math/tableLine.ts`; `plot(` built (#77), read in
  `src/math/plotLine.ts`; the index built (#104), read after the parse in
  `src/math/indexes.ts`; the solved value's `for` range built (#105), read in
  `src/math/solveLine.ts`; rules built (#109), read in `src/math/lineForm.ts` and run after
  the line in `src/math/evaluate.ts`
- **Amended**: 2026-11-11 (#63): the format clause, read after the comment.
  2026-11-13 (M4c; #92, #94): rules in the format clause, a solved value's
  `for` range, and the index. The index (#104), the `for` range (#105) and the rules
  (#109) are built.
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
2. **Format:** take off the trailing `@` words (`@bold`, `@underline`, a colour). Decided by
   Matheus on 2026-11-11 (#63): a format lives in the line's source, like a display unit.
3. **Display unit:** take off a trailing top-level `in` or `to` whose target is a pure unit,
   read outside the sheet's scope.
4. **Form:** recognise `= solve`, `..`, `table(` and `plot(`, and take off their clauses.

Amended on 2026-11-13 for M4c, decided by Matheus (#92, #94):

- **Step 2 takes everything from the first `@` outside a string,** where it took the trailing
  `@` words: a format word can be followed by `if <condition>`, which makes it a rule. The
  condition is ordinary math.js, compiled with the captured `parse` and evaluated after the
  line has run, with `result` bound to the line's value. It never changes the scope.
- **A solved value's clause is `for <unknown> = <from> .. <to>`,** and `guess` stays the solve
  function's. The `..` inside a solve line's clause belongs to the solve, not to a range line.
- **5. Index:** `name[…]` is the app's, read before math.js: one value out of a list, counting
  from 1. Lists are the app's own (see the engineering rules), so math.js's matrix index never
  sees them.

What the app writes into a line (a display unit, plot clauses, a format) is text in that same line, in
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
- `@` was chosen for the format clause because math.js rejects it: `U = I * R @bold` is a syntax
  error there, where `style bold`, `[bold]`, `| bold` and `!bold` all parse as math (tried on
  math.js 15.2).
- `#`, `@`, `..`, `step`, `guess`, `for`, `if` after an `@` word, `name[…]` and `= solve` have to stay unambiguous against math.js's own grammar,
  and a math.js upgrade could clash with them. The pump sheet's CI test covers every form.
- A name directly before `(` stays a function call, because that's math.js's rule: `f_d (L_p/D)`
  errors when `f_d` is a number, with a readable message. Making it multiply would let a mistyped
  function name silently multiply.
- A display unit is display-only. A trailing `in bar` no longer converts as math.js would; a
  conversion inside the expression still does.
