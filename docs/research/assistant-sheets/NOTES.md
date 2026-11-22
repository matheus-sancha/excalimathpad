# Does the model write sheets the engine runs? (prototype, first round)

Throwaway prototype for the wayfinder ticket
[Given the Math guide, does the chosen model write sheets the engine runs?](https://github.com/matheus-sancha/excalimathpad/issues/247).
Run on 2026-11-22 at commit `9093609`: Google's models from a cloud session, Anthropic's on
Matheus's PC (Windows, Node 24.16). OpenAI's default was not run: no key.

## What was run

`prototype.ts` sends a scenario with the first slice's instructions (read from the spec),
the Math guide whole and a short drafting addendum of the prototype's own. Each code block
of the answer is one math element; all of them go through `evaluateSheet`, and each line is
printed with its result, error and warnings. When anything fails, that listing goes back
once (the repair turn). Every run is a file under `runs/<model>/`, with the sheet as the
engine reads it and the answer as written.

    NODE_USE_ENV_PROXY=1 node docs/research/assistant-sheets/prototype.ts \
      --models gemini-4-hydrogen --scenarios pump,beam,position,hydro --guide whole --trials 2

Four scenarios: the testers' pump and beam, the true-position check, and a hydrostatic body
test (Matheus's choice). The true-position sheet is a worked example in the guide, so that
scenario only shows that a model can copy. The floor model's third position run (the one
with the stray line) was the smoke run, and its file was overwritten by a later trial.

## Counts

Lines the engine refused, in the first answer and after one repair turn.

| Model | Guide | Scenario | First answer | After repair | Cost | Time |
|---|---|---|---|---|---|---|
| `claude-sonnet-5-5` (default) | whole | pump, 2 trials | 40 and 43 lines, 0 errors | not needed | $0.10 to $0.12 | 47 to 56 s |
| | whole | beam, 2 trials | 16 lines, 0 errors, both | not needed | $0.05 | 13 to 15 s |
| | whole | position, 2 trials | 8 lines, 0 errors, both | not needed | $0.045 | 6 to 7 s |
| | whole | hydro, 2 trials | 28 lines, 0 errors; 29 lines, 1 warning | not needed; 0 | $0.08; $0.14 | 29; 40 s |
| `claude-haiku-5-5` | whole | pump, 1 trial | 38 lines, 0 errors | not needed | $0.006 | 39 s |
| | whole | beam, position, hydro, 2 trials each | 8 to 33 lines, 0 errors, all six | not needed | $0.003 to $0.005 | 6 to 26 s |
| `gemini-4-hydrogen` (default) | whole | pump | 42 lines, 0 errors | not needed | $0.112 | 253 s |
| | whole | beam | 16 lines, 0 errors | not needed | $0.052 | 288 s |
| | whole | position | 8 lines, 0 errors | not needed | $0.034 | 213 s |
| | none | hydro | 35 lines, 3 errors | 0 errors | $0.072 | 342 s |
| `gemini-3.5-flash-lite` (the floor) | whole | pump, 2 trials | 8 errors + 4 warnings; 3 errors + 4 warnings + 2 failed lists | 0; 0 | $0.014 | 6 s |
| | whole | beam, 2 trials | 8 errors + 2 warnings, both | 0; 0 | $0.011 | 4 s |
| | whole | position, 3 trials | 0; 0; 1 error | not needed; 0 | $0.005 | 2 s |
| | whole | hydro, 2 trials | 3 errors; 0 | 0 | $0.012 | 5 s |
| | none | pump, 2 trials | 33 errors of 33 lines; 23 of 34 | 2; 2 | $0.006 | 9 s |
| | none | beam, 2 trials | 15 of 15; 0 errors + 2 warnings | 15; 0 | $0.003 | 15 s |
| | none | position, 2 trials | 7 of 7; 1 | 0; 1 | $0.002 | 10 s |
| | none | hydro, 2 trials | 13; 5 | 11; 3 | $0.004 | 17 s |

- **Anthropic's two models wrote 15 sheets with no line refused.** The one warning in them
  was a variable named `diff`, which shadows a built-in; the repair turn renamed it and
  changed nothing else.
- **An answer can arrive empty.** Haiku's first two pump runs ended at the prototype's cap of
  8,000 output tokens with no text: thinking counts against `max_tokens`, which Anthropic's
  Messages API requires. At 32,000 the same scenario gave 38 clean lines for 9,001 tokens.
  (A second trial at 32,000 failed on Matheus's PC; its message wasn't kept.) The app's
  adapter has to set this number, and say so when an answer is cut there.
- **With the guide, every sheet ran after at most one repair turn** (the floor model: 9 runs,
  6 with errors in the first answer, 6 of 6 clean after the repair). The default model needed
  none in three runs.
- **Without the guide the floor model can't write the app's forms:** 7 of 8 first answers had
  errors, and 6 of 8 still had them after the repair turn. The default model without the
  guide missed only `min` (3 lines), but that scenario uses few of the app's forms.
- **The default model's fourth scenario with the guide (hydro) was not run:** the key is on
  Google's free tier, which allows 20 requests a day for that model and answered "ok" in 98 s.
  Its times above are the free tier's, not a paid key's.
- **Cost:** both default models think before they write, and thinking is billed as output: a
  drafted sheet cost $0.03 to $0.11 on Gemini and $0.045 to $0.14 on Sonnet, against the
  $0.02 to $0.05 an answer was estimated at. Haiku's cost a tenth of Sonnet's or less.

## What the models got wrong

Lines the engine refused (all in the floor model, unless said):

- **A solved value written with `guess`,** not `for … ..` (the engine's message says how, and
  the repair fixed it).
- **`3 min` for minutes.** `min` is the minimum function; the unit is `minute`. Both models
  did it without the guide, the floor model once with it. The error it gives is math.js's
  own ("Unexpected type of argument in function multiplyScalar"), which doesn't say what to
  type. Worth its own message, whatever the assistant does.
- **A result written after the line** (`R_A = … → 46 kN`), on every line of a sheet.
- **A stray line** (`[E1:9] =`), a reference label copied from the instructions.
- **Units that don't match in a function body,** where a list of flows met a design flow.
- **Names like units** (`L`, `A`, `g`, `E`): warnings, in 4 of 9 floor-model runs with the
  guide; none in either default model's or in Haiku's. The repair turn renamed them.

Forms used with no error in the two default models' sheets: display units, notes, comment
lines, rules (`@text-green if …`), `if()`, a solve function with `guess`, a solved value
with `for`, ranges, a table, a plot with `mark` and with `circle`.

## Sheets that run and are still wrong

The engine's check says nothing about these; they are what Matheus reads the runs for.

- **A made-up pump curve** (floor model, `pump-whole-1`): asked for `H = 28 m - k Q^2` with
  `k` editable, it wrote `Hp(Q) = H_0 - (H_0 - H_sys + H_geo) (Q/Q_r)^2`, a curve bent to
  pass near the design point.
- **A rule that never fires** (floor model, `hydro-whole-2`): `@text-red if result == "Test
  failed"` on a line whose values are "Pass" and "Fail".
- **Invented inputs:** K factors (0.3 and 0.9 for the same elbow in two runs), an allowable
  fraction of yield (0.85, 0.9), hold periods (3 and 15 minutes; 15 and 180), an example
  `I`. The default model marks each one "verify against the governing standard"; the floor
  model mostly doesn't.
- **A friction factor frozen at the design flow** in the system curve (floor model); the
  default model recomputed it at each flow, with a laminar branch.
- **The request not followed** (default model without the guide): a table asked for was
  written as eleven separate lines, and the pass/fail lines as bare `true`.

## Not done

- OpenAI's default (`gpt-6.2-sol`): no key. OpenRouter's serves the same Sonnet 5.5.
- No run without the guide on Anthropic's models.
- The default Gemini model on the hydro scenario with the guide, and second trials.
- Matheus's reading of the sheets for engineering sense.
