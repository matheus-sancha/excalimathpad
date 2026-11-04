# 0003. The sheet evaluates in reading order, in one scope, re-run whole on every change

- **Status**: accepted
- **Date**: 2026-10-28
- **Amended**: 2026-11-01 (#25: results format in a fixed unit system, SI)
- **Amended**: 2026-11-03 (spec v1, [`docs/spec-v1.md`](../spec-v1.md): results show
  through the sheet's settings, unit-named names warn, local unknowns and per-point
  lines). Amended items name the milestone that builds them; until then
  [`CONTEXT.md`](../../CONTEXT.md) says what the code does.

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
  earlier value. Two cases sit inside this rule (ADR 0005): a solve's unknown is local
  to its own line (#19; M3), and a line that uses a list runs once per point, with the
  list's name bound to that point in the run's scope (#20; M4).
- **Re-run the whole sheet**, synchronously, on every source edit and every
  change of reading order (move, delete, undo, duplicate, or a size change on a
  rotated element, #29). No debounce. While a line is edited, the run uses the
  line's text from memory, and the scene gets it at the line commit (#11; M1).

Engineering rules (Engineer's):

- `evaluateSheet(blocks)` in `src/math/` takes blocks already in order and
  knows nothing about geometry; `readingOrder(anchors)` in `src/overlay/`
  knows nothing about math. `MathOverlay` composes them.
- Every run starts from a fresh scope, so the results are a pure function of
  the ordered sources. This is also why there is no reuse between runs:
  math.js mutates values in place (`A[1] = 5` changes the matrix object), so
  a cached scope would carry one run's changes into the next.
- The engine hardening from #2 is unchanged (it lives in the namespace). The
  `typed` stub is seeded per run instead of per block. The app's extra units register
  once at setup, before `createUnit` is disabled, and what they add to the unit systems
  is stripped, so they don't change how other results show (#24; M2).
- math.js's unit system is fixed to SI at engine setup (#25). math.js's default,
  `auto`, is global state on the instance that every unit read updates, so a result's
  unit depended on what any earlier line or run had read: a route for a line to change
  the engine that the hardening above did not close. Expressions cannot reach `Unit` to
  switch it back. The sheet's unit system isn't this setting: it is an app formatter
  above the engine (#15, #16; M2).
- A result's **value** is a pure function of the ordered sources. A **shown result**
  also depends on the sheet's unit system and Digits, passed to the formatter, so
  changing a setting re-shows results and changes no value (#16, #30; M2).
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
- **Reset math.js's `auto` unit system per run** instead of fixing SI
  (#25). Separate runs would repeat, but a line would still change how the
  lines below it in the same run show their results.
- **Switch math.js's unit system to the sheet's choice** (#15, #16). `to` throws where
  the sheet should balance, and it would reopen global state on the engine.
- **Show a kept unit as written** (`1 psi`, `60 mi / h`), as #25 did. A result with no
  chosen unit now always follows the sheet's system, so switching the system moves all
  of them together (#16).
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
- Performance is linear in sheet size on every keystroke, multiplied by solves and list
  points: the pump sheet runs 30 Colebrook solves for its table on each run, plus nested
  solves for `Q_op`. A 91-row sweep took 30 ms in the research (#18), and it gets measured
  at M3 and M4. If it ever lags, the first lever is a per-line compile cache (compiled
  expressions are reusable), not a debounce or a graph.
- A name that is also a math.js unit or built-in (`V`, `A`, `m`, `s`, `g`,
  `i`, `e`, ...) is ambiguous in both directions. Below its definition it shadows the
  unit: after `V = I * R` (20 V), `U = 5 V` gives `100 V`. Above it, or after it fails,
  lines read the unit: `V * 2` gives `2 V`. The variable still wins, but such a name
  warns on its line, as do function names, parameters and a solve's unknown (#7, #27;
  M2). Plain redefinition of any other name stays silent, as Matheus chose. A test
  records the fallback.
- How results display (a product decision, #16 and #30; M2, replacing what #25 chose). A
  result shows in its display unit, a trailing `in <unit>` on its line, else in the
  sheet's unit system (SI with prefixes by default), at the sheet's Digits. A trailing
  `in` or `to` with a pure unit comes off the line as its display unit, and a unit of
  the wrong kind is balanced rather than an error. A conversion inside an expression
  stays math.js's own. Until M2, results show as #25 left them: `5 ft * 2 ft` is
  `0.9290304 m^2`, `1 psi` stays `1 psi`, and `to` converts.
- Excalidraw does not know the order; nothing in the scene stores it, so the sheet file
  (ADR 0004) does not need to either.
