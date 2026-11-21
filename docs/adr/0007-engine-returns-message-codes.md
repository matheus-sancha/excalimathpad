# 0007. The engine returns message codes, and the app words them

- **Status**: accepted, 0.6.0, not built
- **Date**: 2026-11-21

## Context

Until 0.6.0 the app's own text was English, written inline where it shows, and the engine
(`src/math/`) built its errors and warnings as English sentences: about 135 messages in 13
files, plus the words inside results (a list's summary, a matrix's size, a plot's default
title, solve details). The app also read two of its own sentences back with a regex
(`N of M points failed.`, and `N values` turned into `N roots`). 0.6.0 makes the app's own text
follow ☰ → Language, English or Português (Brasil). The engine is pure: no React, no
Excalidraw, run whole on every change ([ADR 0003](0003-sheet-evaluates-in-reading-order-in-one-scope.md)),
and its results are compared in about 130 tests and by the Math guide's CI test.

Decided by Matheus on 2026-11-21, on the map
[Spec for 0.6.0: Excalimathpad's own text in Português (Brasil)](https://github.com/matheus-sancha/excalimathpad/issues/284)
("Engine returns codes", while charting; #287 for math.js's errors). The behaviour is in
[`docs/spec-v1.md`](../spec-v1.md) sections 8 (Language), 13 and 14.

## Decision

- **`evaluateSheet` returns a code and its arguments** for every error, warning and rule
  warning, and for the words inside a result; `planRename` does the same for its refusals. The
  engine holds no words and doesn't know the language.
- **The places that show a result word it,** through the text table of the language shown:
  the overlay, the Sheet panel, the print view, and the guide's test.
- **A math.js error is a code with math.js's raw text as its argument.** A fixed table of known
  patterns words it in Português; anything else passes through as math.js wrote it. The app
  never reads its own words back; it reads math.js's English only where math.js gives nothing
  else, each pattern with a test.

## Alternatives considered

- **The engine takes the language as an argument and returns words.** Smaller change, but a
  language switch would re-run the sheet, the engine would depend on the text tables, and every
  engine test would be tied to one language's words.
- **Translate the English sentences at the edge by pattern.** No engine change, but every
  message becomes a regex over English, the brittle read-back this removes.

## Consequences

- A language switch re-words what is shown without re-running the sheet, and a sheet's results
  are the same in both languages, as section 8 requires.
- Every new engine message adds a code and a wording in both tables; the type check fails a
  missing one.
- Existing engine tests keep comparing English, through the English table, until they are
  moved to codes.
- A math.js upgrade that rewords a known pattern fails CI, as its read-back patterns already do.
