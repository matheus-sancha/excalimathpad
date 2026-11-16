# Acceptance sheet: true position

The second sheet v1 is judged on (the **true-position sheet**, from M4e): a hole's
position tolerance, RFS, to ASME Y14.5. The sheet takes the hole's measured
deviation from its true position, works out the diameter of the zone it sits in,
says `Pass` or `Fail` against the tolerance, and draws the point inside the
tolerance circle. It is the sheet Matheus built on his work laptop on
2026-11-15, as it reads once M4e is built.

- Inputs in mm. The deviations `dx` and `dy` are from the true position; the
  tolerance `T_p` is a diameter, so the circle on the chart has radius `T_p / 2`.
- There is no script: the values are worked by hand below.
- Behaviour is in [`docs/spec-v1.md`](../spec-v1.md), section 15. The sheet is
  also a worked example in the Math guide (section 10, Plots).

## Pass bar

`TP`, `check`, `used` and `margin` match the values below to **4 significant
figures**, and the chart has one point and one circle. With `dx = 0.12 mm`,
`check` is `Fail`.

## Steps

1. **Type the sheet and check the values,** the `check` line green.
2. **Edit `dx` to `0.12 mm`.** `check` turns to `Fail`, in red, and the point
   moves out of the circle.
3. **Save, close, reopen.** Same layout, sources, formats and results.

## The sheet, line by line

One math element. The `check` line's format is stored beside it, not in its
text: type it at the end of the line and it moves there when you leave the
line, or set it from the Format tab's Rules list.

| # | Source | Stored format | Exercises |
|---|---|---|---|
| c | `# True position, RFS (ASME Y14.5)` | — | whole-line comment |
| 1 | `dx = 0.08 mm` | — | input: deviation in x; the line edited in step 2 |
| 2 | `dy = -0.05 mm` | — | input: deviation in y |
| 3 | `T_p = 0.25 mm` | — | input: the position tolerance, a diameter |
| 4 | `TP = 2 sqrt(dx^2 + dy^2) in mm` | — | display unit |
| 5 | `check = if(TP <= T_p, "Pass", "Fail")` | `@text-green if result == "Pass" @text-red if result == "Fail"` | pass/fail line: `if()`, text, two rules read from the store |
| 6 | `used = TP / T_p * 100` | — | dimensionless result |
| 7 | `margin = T_p - TP in mm` | — | display unit |
| 8 | `plot(dx, dy), circle T_p / 2, title "True position"` | — | a point, a circle, equal scales and a title, as one line |

Why the lines are written this way:

- **`TP`, not `T`:** `T` is the tesla, and a name like a unit warns.
- **`in mm` on lines 4 and 7.** Without it the unit system would show
  `188.7 µm`; the drawing gives the tolerance in mm.
- **Line 8 needs no helper line.** Two single values draw one labelled point,
  and a circle gives the chart equal scales, so the circle is round.

## Expected results

Worked by hand, at `dx = 0.08 mm`, `dy = -0.05 mm`, `T_p = 0.25 mm`:

- `TP = 2 √(0.08² + 0.05²) = 2 √0.0089 = 0.188680 mm`
- `used = 0.188680 / 0.25 × 100 = 75.472`
- `margin = 0.25 − 0.188680 = 0.061320 mm`
- At `dx = 0.12 mm`: `TP = 2 √(0.0144 + 0.0025) = 0.26 mm`, over `T_p`.

| Line | `dx = 0.08 mm` | `dx = 0.12 mm` |
|---|---|---|
| `TP` | 0.1887 mm | 0.26 mm |
| `check` | Pass, green | Fail, red |
| `used` | 75.47 | 104 |
| `margin` | 0.06132 mm | -0.01 mm |

**The chart** (line 8): one point, labelled `(0.08, −0.05) mm`, and one circle
of radius 0.125 mm about the origin, with equal scales: a square chart, 280 px
a side. The axes read `dx [mm]` and `dy [mm]`, and the title "True position".
