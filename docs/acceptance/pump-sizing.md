# Acceptance sheet: pump sizing

The real calculation v1 is judged on (the **pump sheet**): water lifted between
two open tanks through one steel pipe with fittings. The sheet finds the system
head and power at a duty flow, then plots the system curve against a chosen
pump's curve and solves for where they cross.

- Water at 20 °C, SI inputs, commercial steel 4" Sch 40.
- [`pump-sizing.py`](pump-sizing.py) is the reference calc. It uses plain floats
  and no math.js, so it checks the app independently. Run it with
  `python pump-sizing.py`.
- Behaviour is in [`docs/spec-v1.md`](../spec-v1.md). Which milestone checks what
  is in its section 16.

## Pass bar

Every result matches the reference to **4 significant figures**. Installed-PWA
offline use isn't an acceptance step; it is finish-line condition 2.

## Steps

1. **Type the sheet and check the values.** Line 6 shows the shadow warning, on
   purpose: `K` shadows kelvin, which the sheet never uses.
2. **Edit `D` to `128.2 mm`** (5" Sch 40). Every line, the table, the plot and
   `Q_op` recalculate and match the 5" column.
3. **Save, close, reopen.** Same layout, sources and results. The undo history
   doesn't have to survive.
4. **Print to PDF.** Math typeset, table and plot on the pages, nothing cut
   mid-line, judged by eye.

## The sheet, line by line

The lines may be typed in one math element or several, as long as reading order
keeps this order. An Excalidraw text element above them reads **Pump sizing**,
and the first math line is the whole-line comment marked `c`. Both check prose
next to math, and the heading also checks Excalidraw text in the Normal font in
print.

| # | Source | Exercises |
|---|---|---|
| c | `# Water at 20 C, 4" Sch 40 steel, between two open tanks` | whole-line comment |
| 1 | `rho = 998.2 kg/m^3` | input |
| 2 | `mu = 1.002 cP` | app unit; plain input, so its result cell stays empty |
| 3 | `D = 102.3 mm` | input; the line edited in step 2 |
| 4 | `L_p = 150 m` | input |
| 5 | `eps = 0.045 mm` | input |
| 6 | `K = 4*0.9 + 2*0.15 + 0.5 + 1.0 # 4 elbows, 2 gate valves, entry, exit` | ⚠ deliberate shadow of kelvin; trailing note |
| 7 | `dz = 12 m` | input |
| 8 | `g_n = 9.80665 m/s^2` | input |
| 9 | `Q_d = 15 L/s` | input; litres must still resolve |
| 10 | `eta = 0.70` | dimensionless input |
| 11 | `A_p = pi D^2 / 4` | unit system display |
| 12 | `v(Q) = Q / A_p` | function |
| 13 | `Re(Q) = rho v(Q) D / mu` | function; dimensionless result |
| 14 | `f(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02` | solve function (Colebrook) |
| 15 | `Hs(Q) = dz + (f(Re(Q), eps/D) L_p/D + K) v(Q)^2 / (2 g_n)` | function calling a solve |
| 16 | `v_d = v(Q_d)` | |
| 17 | `Re_d = Re(Q_d)` | |
| 18 | `f_d = f(Re_d, eps/D)` | direct call: solve details on hover |
| 19 | `dP_pipe = f_d * (L_p/D) rho v_d^2 / 2 in kPa` | display unit |
| 20 | `dP_K = K rho v_d^2 / 2 in kPa` | display unit |
| 21 | `dP_z = rho g_n dz in kPa` | display unit |
| 22 | `H_d = Hs(Q_d)` | unit system display (m) |
| 23 | `P_d = rho g_n Q_d H_d / eta in kW` | display unit |
| 24a | `H_0 = 25 m` | pump datasheet: shutoff head |
| 24b | `H_r = 20 m` | pump datasheet: rated head |
| 24c | `Q_r = 20 L/s` | pump datasheet: rated flow |
| 25 | `Hp(Q) = H_0 - (H_0 - H_r) (Q/Q_r)^2` | function |
| 26 | `Q_op = solve Hp(Q) = Hs(Q), guess Q = 15 L/s in L/s` | solve calling a solve, with units |
| 27 | `H_op = Hp(Q_op)` | |
| 28 | `P_op = rho g_n Q_op H_op / eta in kW` | display unit |
| 29 | `Q_s = 1 L/s .. 30 L/s step 1 L/s` | range with units |
| 30 | `table(Q_s, Hs(Q_s), Hp(Q_s))` | 3 columns, 30 rows; a function with a solve runs at every point |
| 31 | `plot(Q_s, Hs(Q_s), Hp(Q_s)), mark Q_op` | two series; the curves cross at the mark |

Why the lines are written this way:

- **Line 19 needs the `*`.** A name directly before `(` is a function call in
  math.js, so `f_d (L_p/D)` errors because `f_d` holds a number. Line 15's
  `(…) v(Q)^2` and line 25's `(…) (Q/Q_r)^2` have no such name, so they stay
  implicit.
- **Line 24 is three lines,** because a line is one statement. Lettering them
  keeps the other line numbers stable.
- **No name is a math.js unit, except `K`.** `L` would make `15 L/s` below it
  silently mean 15·(150 m)/s. Other clashes avoided: `A` (ampere), `H` (henry),
  `g` (gram) and `Qs` (quettasecond).
- **The range starts above 0,** because Colebrook has no solution at Re = 0. It
  goes to 30 L/s so the 5" crossing (25.21 L/s) is still on the plot.

## Expected results

From `pump-sizing.py`, to 4 significant figures, in the unit shown.

| Line | 4" (`D = 102.3 mm`) | 5" (`D = 128.2 mm`) |
|---|---|---|
| `K` | 5.4 | 5.4 |
| `A_p` | 82.19 cm² (0.008219 m²) | 129.1 cm² (0.01291 m²) |
| `eps/D` | 4.399e-4 | 3.510e-4 |
| `v_d` | 1.825 m/s | 1.162 m/s |
| `Re_d` | 1.860e5 | 1.484e5 |
| `f_d` | 0.01864 | 0.01866 |
| `dP_pipe` | 45.43 kPa | 14.72 kPa |
| `dP_K` | 8.976 kPa | 3.639 kPa |
| `dP_z` | 117.5 kPa | 117.5 kPa |
| `H_d` | 17.56 m | 13.88 m |
| `P_d` | 3.683 kW | 2.910 kW |
| `Q_op` | 18.81 L/s | 25.21 L/s |
| `H_op` | 20.58 m | 17.06 m |
| `P_op` | 5.412 kW | 6.013 kW |

- **The CI test compares values in the unit shown here,** whatever prefix the
  sheet's unit system picks. So `A_p` passes as `8219 mm²` or `82.19 cm²`. In SI
  with prefixes, the app shows `82.19 cm²` (M2, #56).
- **`eps/D` has no line of its own.** It is the second argument of `f` on lines
  15 and 18, and it stays in this table as a reference for checking `f_d`.

### Range table

Line 30's rows. `Hp` doesn't depend on `D`.

| `Q_s` [L/s] | `Hs` [m], 4" | `Hs` [m], 5" | `Hp` [m] |
|---|---|---|---|
| 1 | 12.04 | 12.01 | 24.99 |
| 2 | 12.13 | 12.04 | 24.95 |
| 3 | 12.27 | 12.09 | 24.89 |
| 4 | 12.46 | 12.16 | 24.8 |
| 5 | 12.7 | 12.24 | 24.69 |
| 6 | 12.98 | 12.34 | 24.55 |
| 7 | 13.31 | 12.45 | 24.39 |
| 8 | 13.68 | 12.57 | 24.2 |
| 9 | 14.1 | 12.72 | 23.99 |
| 10 | 14.57 | 12.87 | 23.75 |
| 11 | 15.08 | 13.04 | 23.49 |
| 12 | 15.63 | 13.23 | 23.2 |
| 13 | 16.23 | 13.43 | 22.89 |
| 14 | 16.87 | 13.64 | 22.55 |
| 15 | 17.56 | 13.88 | 22.19 |
| 16 | 18.29 | 14.12 | 21.8 |
| 17 | 19.07 | 14.38 | 21.39 |
| 18 | 19.89 | 14.65 | 20.95 |
| 19 | 20.75 | 14.94 | 20.49 |
| 20 | 21.66 | 15.24 | 20 |
| 21 | 22.61 | 15.56 | 19.49 |
| 22 | 23.61 | 15.89 | 18.95 |
| 23 | 24.65 | 16.24 | 18.39 |
| 24 | 25.74 | 16.6 | 17.8 |
| 25 | 26.87 | 16.98 | 17.19 |
| 26 | 28.04 | 17.37 | 16.55 |
| 27 | 29.26 | 17.77 | 15.89 |
| 28 | 30.53 | 18.19 | 15.2 |
| 29 | 31.83 | 18.62 | 14.49 |
| 30 | 33.18 | 19.07 | 13.75 |

The table above drops trailing zeros because it comes from the script. On the
sheet, table columns keep them (`24.80`), per the spec's section 5.
