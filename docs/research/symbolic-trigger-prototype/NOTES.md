# Prototype: how a line asks for a symbolic result

Throwaway. Wayfinder ticket #347, map "Decide whether Excalimathpad gets symbolic results, and
which subset". Run: `node docs/research/symbolic-trigger-prototype/tui.mjs` (after `npm ci`).

`trigger.mjs` is the pure logic: a sheet of `name = expr` lines evaluated under one of three
triggers, using math.js 15.2.0's `resolve` for substitution (and `simplify` behind the tidy
toggle). `tui.mjs` is the shell, with three sample sheets typed the way each mode needs them.

- **request**: a line ending in `->` may show a formula; every bare name on it with no value is a
  symbol. Elsewhere an unknown name is an error, and so is using a formula without `->`.
- **auto**: any line whose names have no value shows a formula.
- **declared**: `symbols F, d` makes those names symbols from that line down.

In every mode, a formula whose symbols all have values by the line that uses it gives a number
(`sigma_num = sigma` gives 46.87 MPa once `b`, `h`, `c`, `M` are assigned).

## What it showed (before any verdict)

- **A name with no value is often a unit, not a symbol.** math.js reads `F` (farad), `h` (hour),
  `b` (bit), `g` (gram), `H` (henry), `A` (ampere), `L`, `T`, `K`, `N`, `t` as units, and `E` as
  Euler's number. Today that fallback is the sheet's rule (ADR 0003). So **auto** can't tell the
  force `F` from the farad: `sigma = F / A` keeps `F` as a unit, and `I = b * h^3 / 12` gives
  `0.08333 b h^3` in bit-hours, a number, not a formula. Only a trigger where the user names the
  symbols (the `->` line, or `symbols`) can override a unit name.
- **auto turns a typo into a formula.** `n = s_y / sigam` shows `s_y / sigam` instead of
  "Undefined symbol sigam", and a forgotten value (`rho`) does the same on a plain numeric sheet.
- **request** needs `->` on every line of the chain, including the one that turns the formula
  back into a number. **declared** needs one line up front and keeps the typo error.
- A unit written after a number (`250 MPa`, `2 kN m`) can be told apart from a symbol by its
  place: the prototype treats a name in an implicit product that starts with a number as a unit.

## Verdict

To be filled in from the ticket's resolution.
