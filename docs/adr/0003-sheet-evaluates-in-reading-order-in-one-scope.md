# 0003. The sheet evaluates in reading order, in one scope, re-run whole on every change

- **Status**: accepted
- **Date**: 2026-10-28

## Context

The core loop of a calc sheet is: define `I` in one place, use it in
another, edit `I`, and see everything downstream update. Until #3 each math
element was evaluated alone, in its own scope. Math elements sit freely on a
2-D canvas (ADR 0002), so "downstream" has to be derived from where they are.
Three things had to be decided: what order the sheet reads in, how names are
shared, and what is re-evaluated when something changes.

Approved by Matheus on issue #3 (design comment, 2026-10-28), with: the
top-then-left order, silent redefinition (math.js's late binding of function
bodies accepted), synchronous recalculation, a two-element seed and plain
`=` only.

## Decision

Decided by Matheus:

- **Reading order** is derived from positions every time, never stored:
  math elements sort by the top of their anchor's visual bounding box, then
  by its left, then by anchor id (Mathcad's rule). A rotated anchor is placed
  by its rotated bounds. Equal tops must compare equal, so upright and
  upside-down anchors use `x`/`y` as they are and other angles are rounded
  to a millionth of a scene unit; otherwise float noise, not left, ordered
  side-by-side elements (PR #6 review).
- **One scope per run.** The sheet's lines run top to bottom in reading
  order, all in one scope. A line sees every name assigned above it, in its
  block or an earlier one, and nothing below. A later assignment silently
  redefines a name for the lines below it. Functions bind late: `f(x) = k * x`
  uses `k`'s value at the call. An assignment that fails (or does not parse)
  removes the name from the scope, so nothing below silently keeps using its
  earlier value.
- **Re-run the whole sheet**, synchronously, on every source edit and every
  change of reading order (move, delete, undo, duplicate). No debounce.

Engineering rules (Engineer's):

- `evaluateSheet(blocks)` in `src/math/` takes blocks already in order and
  knows nothing about geometry; `readingOrder(anchors)` in `src/overlay/`
  knows nothing about math. `MathOverlay` composes them.
- Every run starts from a fresh scope, so the results are a pure function of
  the ordered sources. This is also why there is no reuse between runs:
  math.js mutates values in place (`A[1] = 5` changes the matrix object), so
  a cached scope would carry one run's changes into the next.
- The engine hardening from #2 is unchanged (it lives in the namespace). The
  `typed` stub is seeded per run instead of per block.
- The unit system is fixed to SI at engine setup (amended for #25).
  math.js's default, `auto`, is global state on the instance that every
  unit read updates, so a result's unit depended on what any earlier line
  or run had read: a route for a line to change the engine that the
  hardening above did not close. Expressions cannot reach `Unit` to switch
  it back. A per-run reset of `auto` would not do: within a run a line would
  still change the lines below it, and math.js exposes no way to reset it.
- An undefined name used above its definition says
  `x is defined below`, and one whose assignment
  failed says `x has an error above`. Both rely on math.js's
  `Undefined symbol x` wording, which a test pins.

## Alternatives considered

- **A dependency graph with incremental recalculation** (re-evaluate only
  what depends on the edited name). Less work per keystroke, but it needs
  symbol extraction, cycle handling and redefinition rules, and math.js's
  in-place mutation makes reusing scopes unsafe. A full run of 250 lines
  takes about 9 to 18 ms in Node, which is enough for v1 sheets.
- **Debounced recalculation (~150 ms).** Shows stale results while typing and
  puts timers in every test, for no measured need.
- **Row bands** (elements that overlap vertically form a row, read left to
  right). Closer to the eye for side-by-side elements, but "overlaps" is not
  transitive, so the order can jump as an element moves. Rejected by Matheus
  in favour of top-then-left.

## Consequences

- Editing an input updates every element below it, with no wiring.
- Position is semantics: an element one unit higher on the right is read
  before one on the left. Moving an element can break the elements below it,
  and the error says where the name went.
- Performance is linear in sheet size on every keystroke. If it ever lags,
  the first lever is a per-line compile cache (compiled expressions are
  reusable), not a debounce or a graph.
- A name that is also a math.js unit or built-in (`V`, `A`, `m`, `s`, `g`,
  `i`, `e`, ...) is ambiguous, silently, in both directions. Below its
  definition it shadows the unit: after `V = I * R` (20 V), `U = 5 V` gives
  `100 V`. Above it, or after it fails, lines read the unit: `V * 2` gives
  `2 V`. Matheus kept redefinition silent and the seed uses `U`, which is not
  a unit; warning on such names is issue #7. A test records the fallback.
- Results format in SI whatever units the sheet uses (#25): `1 psi` stays
  `1 psi`, but a computed pressure shows in `Pa` and `5 ft * 2 ft` in `m^2`.
  `to` converts a result. A sheet-level choice of unit system is for the v1
  spec, on top of this.
- Excalidraw does not know the order; nothing in the scene stores it, so
  persistence (still open, ADR 0001) does not need to either.
