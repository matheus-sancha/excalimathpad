# Math guide

Excalimathpad puts live, unit-aware math on an Excalidraw sheet. You place **math elements** where you want them, type one statement per line, and each line shows typeset with its result and unit. Change an input and every line below it recalculates. This guide shows every form, key and setting, with examples you can type as they are.

## Contents

1. [A first sheet](#1-a-first-sheet)
2. [Lines and names](#2-lines-and-names)
3. [Units](#3-units)
4. [Numbers and constants](#4-numbers-and-constants)
5. [Functions](#5-functions)
6. [Checks and conditions](#6-checks-and-conditions)
7. [Solve](#7-solve)
8. [Ranges and lists](#8-ranges-and-lists)
9. [Tables](#9-tables)
10. [Plots](#10-plots)
11. [Comments and notes](#11-comments-and-notes)
12. [Formatting](#12-formatting)
13. [The Symbols tab](#13-the-symbols-tab)
14. [The Sheet panel](#14-the-sheet-panel)
15. [Files and recovery](#15-files-and-recovery)
16. [Keys and gestures](#16-keys-and-gestures)
17. [Common messages](#17-common-messages)

**How to read the examples:**

- In a table, **Write** is what you type on one line, **Shows** is what its result cell then shows, and **Note** says why. A **—** means the result cell stays empty.
- A grey block is a short sheet: each line's result follows its `→`.
- ● is an error on the line. ⚠ is a warning: the line keeps its value.
- The examples in each section run top to bottom as one sheet, so a name defined in one row is used by the rows below it.

## 1. A first sheet

1. Press **M**, or open Excalidraw's **More tools** and choose **∑ Add math**, then click the sheet where the math should go. On a phone or tablet: tap More tools, then Add math, then tap the sheet.
2. Type `R = 10 kohm` and press **Enter**. Enter starts the next line.
3. Type `I = 2 mA`, press **Enter**, and type `U = I * R`. It shows `20 V`.
4. Press **Esc** to leave the line. Double-click the `I` line, change it to `I = 3 mA`, and watch `U` become `30 V`.

```sheet
R = 10 kohm
I = 2 mA
U = I * R                → 20 V
```

- A line shows its **result** only when it computes something. `R = 10 kohm` is a **plain input**, so its result cell stays empty.
- The sheet reads every math element **top to bottom, then left to right**, as one sheet. A line sees only the names defined above it, in its own element or in an element higher on the sheet.
- An element left with no text is removed when you leave it.
- Drawings, arrows and Excalidraw text live on the same sheet. They never take part in the math.

## 2. Lines and names

One line holds one statement. Assignment is a plain `=`; Mathcad's `:=` isn't accepted. Typeset, an assignment shows `≔`.

| Write | Shows | Note |
|---|---|---|
| `D = 102.3 mm` | — | A plain input: a name and a value as typed |
| `A_p = pi D^2 / 4` | `82.19 cm²` | An assignment shows its value. `pi D^2` multiplies |
| `2 * pi` | `6.283` | A bare expression: a value with no name |
| `D` | `102.3 mm` | A name on its own shows its value |
| `x = 1` | — | |
| `x = 2` | — | A later assignment redefines the name for the lines below it |
| `x` | `2` | |
| *(an empty line)* | — | A blank line is a spacer row |

**Names** start with a letter and hold letters, digits and `_`.

- Text after the first `_` is a subscript: `A_p` shows as A with p below, `H_0` as H with 0 below.
- A Greek word becomes its letter: `rho_w` shows ρ with w below, `DeltaP` shows ΔP, `T_alpha` shows T with α below.
- A name used above the line that defines it is an error: `x is defined below`. A name whose own line failed is an error below it: `x has an error above`.
- `table`, `plot`, `solve` and `if` belong to the app and can't be assigned to.

**Parsing that catches people:**

- **A name directly before `(` is a function call.** Write `f_d * (L/D)`, not `f_d (L/D)`. Brackets after brackets, or after a number, multiply as usual: `2 (a + b)`.
- **Don't name a variable after a unit** (`V`, `A`, `m`, `s`, `L`, `g`). The name then hides the unit on every line below it, and the line warns.
- **One statement per line.** A `;` outside brackets is an error that says to split the line there.

| Write | Shows | Note |
|---|---|---|
| `V = 3` | — ⚠ `V shadows the unit V` | `V` is the volt |
| `w = 5 V` | `15` | `5 V` now means 5 times the variable, not 5 volts |

## 3. Units

Write a unit after a number: `15 L/s`, `102.3 mm`, `1.002 cP`, `20 degC`. Units multiply and divide like names, and every operation checks dimensions.

| Write | Shows | Note |
|---|---|---|
| `Q = 15 L/s` | — | Volume flow |
| `D = 102.3 mm` | — | |
| `v_d = Q / (pi D^2 / 4)` | `1.825 m/s` | The unit comes from the calculation |
| `v_d in km/hr` | `6.57 km/hr` | `in <unit>` at the end picks the unit shown |
| `D in in` | `4.028 in` | Inches. On the input's own line, `D = 102.3 mm in in` shows the same |
| `p_1 = 1 bar` | — | |
| `p_1 in psi` | `14.5 psi` | |
| `p_1 in m` | `1·10⁵ m·kg/(m²·s²)` | A unit of the wrong kind is balanced, as in Mathcad: what is left over shows in base units |
| `0.05 in %` | `5 %` | A number with no unit can show in percent |
| `y_b = 2 kg + 3 m` | ● `Units do not match` | Adding different kinds is an error |

**Choosing a unit with the mouse.** Hover a result and click its unit: that is its **unit slot**. A list opens with **Sheet units** at the top, then the units of the same kind, each with the value. Type to filter, use **↑ ↓**, and press **Enter**. **Esc** cancels. Choosing writes `in <unit>` at the end of the line for you; choosing Sheet units removes it.

**Unit systems.** A result with no `in` follows the sheet's unit system, set in the [Sheet panel](#14-the-sheet-panel)'s Settings tab:

- **SI with prefixes** (the default) keeps the number between 1 and 1000 where it can: `45.43 kPa`, `5.412 kW`.
- **SI base units** uses no prefixes: `4.543·10⁴ Pa`.
- **USCS** uses ft, ft³/s, psi, hp, lb/ft³ and the like.
- **Custom** starts from one of the three and sets your own unit for chosen kinds, such as bar for every pressure.

**Units the app adds** to math.js's own, on every sheet:

| Write | Shows | Note |
|---|---|---|
| `mu_w = 1.002 cP` | — | Dynamic viscosity: `cP`, `poise` |
| `1 St in cSt` | `100 cSt` | Kinematic viscosity: `cSt`, `St` |
| `n_r = 1450 rpm` | — | Rotation: `rpm` |
| `n_r in Hz` | `24.17 Hz` | |
| `2 cfm in L/s` | `0.9439 L/s` | Flow: `gpm`, `cfm` |
| `1 kcal in kJ` | `4.184 kJ` | Energy: `kcal` |
| `3 tf in kN` | `29.42 kN` | Force: `tonf` (2000 lbf), `tf` (1000 kgf) |

**Units that catch people:**

- **`h` is the Planck constant, so the hour is `hr`:** `2 hr`, `m^3/hr`, `km/hr`. After `in`, which reads units only, `in km/h` still means per hour.
- **`g` is the gram.** Standard gravity is `gravity`.
- **`min` is the minimum function,** so litres per minute is `L/minute`.
- **A torque** has the dimension of an energy and shows in `J` until you choose `N·m` (`in N*m`).

## 4. Numbers and constants

Every result shows with **Digits** significant digits, 4 unless the Settings tab says otherwise (2 to 15). What you type is never reformatted, and lines below always use the full value.

| Write | Shows | Note |
|---|---|---|
| `1234` | `1234` | |
| `12345` | `1.235·10⁴` | From 10^Digits up, a number shows in powers of ten |
| `185997` | `1.86·10⁵` | Trailing zeros are dropped in a result |
| `0.01864` | `0.01864` | |
| `0.0004399` | `4.399·10⁻⁴` | Below 0.001, powers of ten again |
| `1 / 3` | `0.3333` | |
| `1 / 0` | `∞` | |
| `sqrt(-4)` | `2i` | A complex result shows both parts |
| `(3 + 4i) mm` | ● `a complex value with a unit can't be shown` | A complex value takes no unit, alone or in a list |

**Constants.** Every math.js constant is built in under its own name, and the common ones also have a short name, as in Mathcad. The [Sheet panel](#14-the-sheet-panel)'s Constants tab lists them all.

| Write | Shows | Note |
|---|---|---|
| `pi` | `3.142` | Also `e`, `phi`, `tau` |
| `gravity in m/s^2` | `9.807 m/s²` | Standard gravity has no short name |
| `c in m/s` | `2.998·10⁸ m/s` | Speed of light, also `speedOfLight` |
| `R in J/(mol*K)` | `8.314 J/(mol·K)` | Molar gas constant, also `gasConstant` |
| `k in J/K` | `1.381·10⁻²³ J/K` | Boltzmann constant |
| `N_A in 1/mol` | `6.022·10²³ mol⁻¹` | Avogadro constant |
| `e_c = 5 mm` | — | A sheet may take a short name: from here on `e_c` is this eccentricity, on every line of the sheet |
| `e_c` | `5 mm` | |

The other short names are `G`, `h`, `hbar`, `sigma`, `e_c`, `epsilon_0`, `mu_0`, `Z_0`, `m_e`, `m_p`, `m_n`, `m_u`, `a_0`, `alpha` and `R_inf`.

## 5. Functions

A **function definition** is a name with parameters, `=`, and a body. It shows nothing unless it has a problem. Its body runs at each call, with the values names have at that moment.

| Write | Shows | Note |
|---|---|---|
| `sq(x) = x^2` | — | A definition |
| `sq(3 m)` | `9 m²` | A call |
| `k_s = 2 N/m` | — | |
| `F_s(x) = k_s * x` | — | A body can use any name defined above |
| `F_s(10 cm)` | `200 mN` | |
| `hyp(a, c_2) = sqrt(a^2 + c_2^2)` | — | Several parameters, separated by commas |
| `hyp(3 m, 4 m)` | `5 m` | |
| `hyp(3 m, 4 m) in cm` | `500 cm` | `in <unit>` goes on the calling line |
| `fact(n) = n <= 1 ? 1 : n * fact(n - 1)` | — | A function may call itself, if it has an end |
| `fact(5)` | `120` | |
| `r = sq` | — | A function can be given another name |
| `r(4)` | `16` | |
| `sq(1, 2)` | ● `sq needs 1 argument, got 2` | |
| `sq + 1` | ● `sq is a function: call it with sq(...)` | |
| `y_u(x) = x + z_u` | — ⚠ `z_u isn't defined above this line` | A warning, not an error: the call below works, because `z_u` exists by then |
| `z_u = 1` | — | |
| `y_u(1)` | `2` | |

Every function works point by point on a list; see [Ranges and lists](#8-ranges-and-lists).

## 6. Checks and conditions

Comparisons give `true` or `false`: `<`, `>`, `<=`, `>=`, `==` and `!=`, joined with `and`, `or` and `not`. A unit on one side needs a unit on the other.

Two forms choose a value by a condition, and run only the branch taken: `if(cond, a, b)`, and `cond ? a : b`. Write more than two branches by nesting them. Typeset, both draw one brace, read as "value, if condition" with "otherwise" on its last row.

| Write | Shows | Note |
|---|---|---|
| `sigma = 120 MPa` | — | |
| `sigma_allow = 140 MPa` | — | |
| `ok = sigma <= sigma_allow` | `true` | `true` and `false` show as words |
| `check = if(sigma <= sigma_allow, "Approved", "Rejected")` | `Approved` | Text is written in double quotes and shows without them |
| `band = if(sigma < 100 MPa, "low", sigma < 140 MPa ? "mid" : "high")` | `mid` | Three branches, by nesting |
| `status = "OK"` | — | A text typed as is, like a plain input |
| `status == "OK"` | `true` | `==` and `!=` compare texts exactly |
| `"Approved" == "approved"` | `false` | Case counts |
| `v = 2 m/s` | — | |
| `if(v > 1 m/s, 1, 2)` | `1` | |
| `v > 0` | ● `can't compare 2 m/s with 0: give the 0 a unit` | |

A check reads best as text, and it can colour itself with [rules](#12-formatting):

```sheet
check_2 = if(sigma <= sigma_allow, "Approved", "Rejected") @text-green if result == "Approved" @text-red if result != "Approved"   → Approved
```

- Branches may be of different kinds: `if(ok, sigma, "too high")` is allowed.
- Text compares only with text, and only with `==` and `!=`: `"10" == 10` is an error, not true.
- Arithmetic on `true` and `false` treats them as 1 and 0.

## 7. Solve

A **solve line** finds where an equation holds. It comes in two forms.

**A solved value** searches a range and holds every root it finds there, in ascending order. Write `name = solve <left> = <right>, for <unknown> = <from> .. <to>`.

| Write | Shows | Note |
|---|---|---|
| `x_r = solve x^3 - 6x^2 + 11x = 6, for x = 0 .. 10` | `1, 2, 3` | Several roots are a list, written out up to five |
| `x_2 = x_r[2]` | `2` | `[2]` takes the second root |
| `y_r = solve y^2 = 2, for y = 0 .. 10` | `1.414` | One root is a single value |
| `H_0 = 30 m` | — | Pump head at no flow |
| `H_r = 20 m` | — | Pump head at the rated flow |
| `Q_r = 20 L/s` | — | |
| `Hp(Q) = H_0 - (H_0 - H_r) * (Q/Q_r)^2` | — | Pump curve |
| `Hs(Q) = 10 m + 0.02 m * (Q / (1 L/s))^2` | — | System curve |
| `Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s in L/s` | `21.08 L/s` | The operating point. The ends give the unknown its unit |
| `z_n = solve z^2 = -1, for z = 0 .. 10` | ● `no root found for z in 0 .. 10` | |

- The unknown (`x`, `Q`) belongs to its line: it isn't defined below it.
- The search samples 200 points and refines every sign change. It can miss two roots closer than its spacing, so it says "roots found", never "all roots". Hover a result for the details: method, range, points and each root's residual.
- Six roots or more show a summary, such as `12 roots, 3.142 … 37.7`.

**A solve function** has parameters and starts from a guess. Write `name(<params>) = solve <left> = <right>, guess <unknown> = <value>`. It runs at every call and gives one root, near the guess.

| Write | Shows | Note |
|---|---|---|
| `f(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02` | — | Colebrook's friction factor. Inside the equation `f` is the unknown |
| `f_d = f(1.86e5, 4.4e-4)` | `0.01864` | Hover it for the method, iterations and residual |

- A solved value takes `for`; a solve function takes `guess`. Each tells you if you swap them.
- A solve function can call another solve, and a range search can call a solve function.
- A solve can't sit inside an expression (`2 * solve …`): solve into a name, then use the name.

## 8. Ranges and lists

A **range** is `from .. to step s`, and makes a **list**. A list shows as one summary row: how many values, the first and the last. Hover it for the values with their index.

| Write | Shows | Note |
|---|---|---|
| `Q_s = 1 L/s .. 30 L/s step 1 L/s` | `30 values, 1 … 30 L/s` | With units, the step is required |
| `n = 1 .. 10` | `10 values, 1 … 10` | Without units, the step is 1 |
| `t_d = 10 .. 1 step -3` | `4 values, 10 … 1` | A negative step counts down. The end is kept only if a step lands on it |
| `n^2` | `10 values, 1 … 100` | A line that uses a list runs once per point |
| `sum(n)` | `55` | Aggregates take the whole list: `min`, `max`, `sum`, `mean`, `count` |
| `mean(n)` | `5.5` | |
| `n[3]` | `3` | An index takes one value, counting from 1 |
| `n[count(n)]` | `10` | The last value |
| `verdict = if(n > 5, "big", "small")` | `5 small, 5 big` | A list of texts counts each text |
| `n[11]` | ● `n has 10 values` | |
| `x_h = 0 .. 1 step 0.25` | `5 values, 0 … 1` | |
| `x_h + n` | ● `x_h has 5 values, n has 10` | Lists on one line pair up point by point, so they need the same length |

- Every function works point by point with no special syntax, solve functions included.
- A function's body can't reach a list from outside: pass the list as an argument.
- **A failed point fails only itself.** The line shows `●` with "1 of 30 points failed" and the first message, and its summary counts the good values (`29 of 30 values`). An aggregate over a list with a failed point is an error.
- A solved value with several roots is a list like any other.

## 9. Tables

`table(…)` lays lists out in columns **under its line**, one column per argument, headed by its expression and unit. Every row shows. The line itself has no result.

| Write | Shows | Note |
|---|---|---|
| `Q_t = 0 L/s .. 20 L/s step 5 L/s` | `5 values, 0 … 20 L/s` | |
| `H_t = 10 m + 0.02 m * (Q_t / (1 L/s))^2` | `5 values, 10 … 18 m` | |
| `table(Q_t, H_t)` | A table of 5 rows under the line | `H_t` reads 10.00, 10.50, 12.00, 14.50, 18.00 m |
| `table(Q_t in L/minute, H_t in ft)` | A table in L/minute and ft | Each argument can carry its own unit |
| `table(Q_t, H_t) @green if H_t > 15 m` | A table with its last row highlighted | A rule tests each row |
| `table(2 m)` | ● `a table needs a list, such as table(Q_s)` | |

- A column of whole numbers stays whole; other columns keep their trailing zeros, so the decimal points line up.
- A single value fills its whole column.
- A column header's unit is a unit slot too: picking a unit writes `in <unit>` onto that argument.
- A failed point shows a red — in its cell, with the message on hover.

## 10. Plots

`plot(x, y1, y2, …)` draws a chart **under its line**. `x` must be a list, and every `y` is of one kind. Settings are clauses after it, separated by commas.

| Write | Shows | Note |
|---|---|---|
| `Q_p = 1 L/s .. 30 L/s step 1 L/s` | `30 values, 1 … 30 L/s` | |
| `Hp(Q) = 30 m - 0.01 m * (Q / (1 L/s))^2` | — | A pump curve |
| `Hs(Q) = 10 m + 0.02 m * (Q / (1 L/s))^2` | — | A system curve |
| `Q_m = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s` | `25.82 L/s` | Where they cross |
| `plot(Q_p, Hp(Q_p), Hs(Q_p)), mark Q_m` | A chart with two curves and a guide at the crossing | |
| `plot(Q_p, Hp(Q_p)), points, title "Pump"` | A chart with a dot at each point and a title | |
| `plot(Q_p in m^3/hr, Hp(Q_p) in ft)` | A chart in m³/hr and ft | Each argument can carry its own unit |
| `plot(2 m, Hp(Q_p))` | ● `x must be a list: 2 m is a single value` | |
| `plot(Q_p, Hp(Q_p), Q_p)` | ● `Hp(Q_p) is a length, Q_p is a volume flow: one plot shows one kind` | |

| Clause | Means | Without it |
|---|---|---|
| `mark Q_op` | A dashed guide at that x, a dot on each curve and its value on top. Can repeat | No marks |
| `labels direct` | Series names at the ends of the lines | A legend above the chart |
| `points` | A dot at every point | Lines only |
| `x log`, `y log` | A log axis; every value must be above 0 | Linear |
| `x 0 L/s .. 40 L/s`, `y 0 m .. 40 m` | An axis range, in the axis's kind | Fits the data |
| `size S`, `size L` | 360 × 220 or 640 × 360 | M, 480 × 280 |
| `title "…"` | A title above the chart | None |

Hover a chart and click its **⚙** to set the same clauses without typing: Mark, Series names, Points, x axis, y axis, Size and Title. Each change is written into the line. Charts are static: there is no zoom or pan. Double-click a chart to open its line.

## 11. Comments and notes

A **comment line** starts with `#`. A **note** is the `#` text after the code on a line. Neither ever changes a result.

| Write | Shows | Note |
|---|---|---|
| `# Water at 20 C` | Grey italic text across the row | A comment line |
| `rho = 998 kg/m^3 # density` | — | The note sits in the note column, right of the results |
| `@bold @upright @L # Pumps and pipes` | A large, bold, upright heading | A comment line takes a format in front of its `#` |
| `# call me @home` | Grey italic text | Nothing after a `#` is read, so the `@` stays text |

**A line's parts come in a fixed order:** code, then `in <unit>`, then a format clause, then a note.

```text
dP = f_d * (L_p/D) rho v^2 / 2 in kPa @bold @text-red if dP > 50 kPa # friction only
```

**A comment line's format words:**

| Word | Sets | Without it |
|---|---|---|
| `@bold`, `@underline` | Bold; underline | Off |
| `@upright` | Not italic | Italic |
| `@S`, `@L`, `@XL` | Small, large or extra large | Medium |
| `@text-black` … `@text-gray` | One of six text colours | Grey |
| `@yellow` … `@gray` | One of five highlights behind the row | None |

- A long comment wraps at the element's width. A comment line has no alignment and takes no rules.
- **A title** names an element in a header above its lines. Press **↑** on the first line (or click **Add title ↑** in the Format tab), type it, and press **↓** or **Enter**. It is plain text, never evaluated, and names the element in the Sheet panel. Empty it to remove the header.
- For free text anywhere on the sheet, use Excalidraw's own text tool. It doesn't follow the math when lines are added; group it with the element, or use a `#` line.

## 12. Formatting

A line's **format** is a clause of `@` words after its code and its `in <unit>`, before its note. It never changes a value. The easy way to write one is the **Format tab** of the [Sheet panel](#14-the-sheet-panel), which opens when you edit a line where the panel docks.

**A format is kept beside its line, not in its text.** You can still type the words at the end of a line (in front of the `#` on a comment line): they show as you type, and when you leave the line they move out of its text. The next time you open the line it shows the math and the note alone, and the Format tab shows and changes the format. Copying a line's text copies the math; copying or duplicating the element carries every line's format. A sheet saved by version 0.2 opens with its formats as they were; once saved again it no longer opens in 0.2.

| Write | Shows | Note |
|---|---|---|
| `R_f = 10 ohm` | — | |
| `I_f = 0.2 A` | — | |
| `U_1 = I_f * R_f @bold` | `2 V` | The whole row bold |
| `U_2 = I_f * R_f @underline` | `2 V` | |
| `U_3 = I_f * R_f @text-red` | `2 V` | The equation and result in red. The note stays grey |
| `U_4 = I_f * R_f @yellow` | `2 V` | A highlight: a soft band behind the row |
| `U_5 = I_f * R_f @bold @text-red @yellow # check` | `2 V` | A line can carry one text colour and one highlight |
| `U_6 = I_f * R_f @bold+underline` | `2 V` | Words joined by `+` are one word |
| `U_7 = I_f * R_f @blod` | ● `Unknown format @blod` | A misspelt word is an error; the value still reaches the lines below |
| `U_8 = I_f * R_f @L` | ● `@L is for comment lines` | Sizes and `@upright` are for comment lines |

- **Text colours:** `@text-black`, `@text-blue`, `@text-red`, `@text-green`, `@text-orange`, `@text-gray`.
- **Highlights:** `@yellow`, `@green`, `@blue`, `@red`, `@gray`. A bare colour is always a highlight.
- Every result's number and unit takes the sheet's **Result colour**, blue by default, set in the Settings tab. A line's own text colour wins on its line.

**A rule** is a word followed by `if` and a condition. It applies while the condition is true. Rules are read left to right and **the first true one wins**, so write the strictest limit first. With no true rule, the line's plain words apply.

```sheet
v = 3.4 m/s @text-blue @text-red if v > 3 m/s @text-orange if v > 2 m/s
```

At 3.4 m/s the line is red; at 2.5 m/s, orange; at 1 m/s, blue.

| Write | Shows | Note |
|---|---|---|
| `q_1 = 15 L/s` | — | |
| `q_1 / (0.004 m^2) @text-red if result > 3 m/s` | `3.75 m/s` | `result` is the line's own value, so a line with no name can be tested |
| `v_2 = 3 m/s @text-red+red+bold if v_2 > 2 m/s` | — | One joined word, one condition |
| `v_3 = 1 m/s @text-red if v_3 > 3 kg` | — ⚠ `if v_3 > 3 kg: Units do not match` | A rule that can't be decided is skipped, with a warning |
| `v_4 = 1 m/s @text-red if v_4 > 3` | — ⚠ `if v_4 > 3: can't compare 1 m/s with 3: give the 3 a unit` | |

On a list or a table a rule is tested at each point: a table row whose point is true takes the format, and a list's summary takes it only when every point is true.

**The Format tab.** At its top a sample draws the open line as the sheet will. Below it, one row of buttons per property: **Style** (B and U; I too on a comment line or the title), **Size** (S, M, L, XL, on a comment line or the title), **Align** (the title only), **Text** (six colours or none) and **Highlight** (five or none). Pressing a pressed button takes the format off. On a math line, the **Rules list** shows each rule with its condition, whether it is true now, ↑ ↓ to reorder and ✕ to remove; each condition is a text field on its row, with the line's suggestions: type or change it there, and press Enter. The line you are editing stays open meanwhile. **+ Add rule** adds a rule at the end, with the line's name already in its condition. A title's format is set only here, never typed.

## 13. The Symbols tab

The Sheet panel's Symbols tab is a set of buttons that type, at the caret of the open line, text the sheet already reads. The filter box at its top finds a button by its spelling, its name or its hint (`rho`, `root`, `less`).

| Group | Buttons | Types |
|---|---|---|
| Greek | α β γ … ω, the variants, Γ Δ Θ Λ Ξ Π Σ Υ Φ Ψ Ω | The letter's name: ρ types `rho` |
| Operators | + − · ÷ x² xⁿ √ ∛ ⁿ√ \|x\| n! ( ) [ ] < > ≤ ≥ | `*`, `/`, `^2`, `sqrt()`, `nthRoot()`, `abs()`, `<=` … |
| Functions | The functions the suggestions offer | The function with its brackets |
| Logic | if() ? : == != and or not true false " " | The same text |
| Sheet forms | solve for .. step table() plot() in [ ] | The keyword; hover it for a whole example |

- A Greek letter joins a name right after `_`: `T_` then α gives `T_alpha`. Anywhere else a space comes first.
- A call puts the caret between its brackets, or wraps what you selected: select `a + b`, click √, and get `sqrt(a + b)`.
- Operators and comparisons get a space on each side; `^`, `^2` and `[ ]` go in tight.
- Each insert is one step of the line's own Ctrl+Z.
- With no line open and one math element selected, a click opens its last line and inserts at the end.
- A row of the Constants tab inserts that constant's name the same way.

## 14. The Sheet panel

**Math settings**, under More tools, opens and closes the Sheet panel. A red badge on it counts the sheet's errors. The panel has six tabs, each an icon with a tooltip; the shown tab's name is the heading over its content:

| Tab | Holds |
|---|---|
| **Format** | Formats the open line or title: see [Formatting](#12-formatting). Where the panel docks, it opens when you start editing, and the panel goes back as it was when you stop |
| **Symbols** | Buttons that type at the caret: see [The Symbols tab](#13-the-symbols-tab) |
| **Variables** | Every name in reading order, grouped by element, with its value and unit. A click jumps to its line |
| **Problems** | Every error `●` and warning `⚠`, with its element and line. A click jumps to it. The badge counts errors only |
| **Constants** | Every built-in constant with its value, what it is and the names it is read by. A click inserts its name |
| **Settings** | The unit system (and for Custom, a unit per kind), Digits from 2 to 15, and the Result colour |

- A jump scrolls the element into view, selects it and flashes the line.
- An element with a title is named by its title in Variables and Problems; otherwise by its position on the sheet.
- A press in the panel never leaves the line you are editing; only a press in a filter box does.
- Settings are saved in the sheet's file and are not part of undo.
- The panel is 320 px wide. Drag its left edge to make it anything from 280 to 480 px; a double-click on the edge puts 320 px back. With the edge focused, **←** and **→** move it 16 px and **Home** puts it back. The width is remembered on this device, not in the sheet.
- The panel docks beside the sheet when the window, or the Obsidian tab, is wider than 640 px plus the panel's width (960 px at 320 px). On a narrower one it floats over the sheet, closes on a press outside it, and an edit doesn't open it: select the element, open Math settings, and press **Edit** in the Format tab. On a phone, in Obsidian, it is a sheet along the bottom, above the keyboard.

## 15. Files and recovery

**In the browser,** a sheet is a `.excalimathpad` file on your disk: Excalidraw's own JSON plus the sheet's settings.

- **Ctrl+S** saves, **Ctrl+Shift+S** saves as a new file, and **Ctrl+O** opens one. The same items are in the ☰ menu. You can also drop a file on the sheet.
- A `●` before the file name means unsaved changes. The file changes only when you save.
- A plain `.excalidraw` drawing opens too; its first save asks for a new `.excalimathpad` file, so the drawing keeps its own format.
- **The recovery copy:** while there are unsaved changes, the browser keeps a copy of the whole sheet. If the tab closes before you save, the next launch asks "Restore unsaved changes to …?" with Restore and Discard.
- A file from a newer Excalimathpad is refused rather than overwritten: update the app.

**In an Obsidian vault,** a sheet is a `.excalimathpad` file in the vault and saves itself, as notes do.

- **New sheet** is a command, a ribbon icon, and an item in a folder's menu in the file explorer.
- Copy, rename and move a sheet with Obsidian's own file tools. Obsidian's File recovery and your sync history keep older versions.
- If sync or another tab changes a sheet while you have unsaved work in it, your version is saved beside it as `<name> (conflict <date> <time>)`, and a notice says so. Nothing is overwritten.
- Obsidian Sync carries `.excalimathpad` files only with **Sync all other types** turned on.
- The commands **Add math**, **Toggle Math settings** and **Open Math guide** act on the active sheet. They have no hotkeys until you set some.

**Undo** is Excalidraw's own and covers the math: one step per line you edit, one per press in the Format tab, and one per change of an element's width. While a line is open, **Ctrl+Z** undoes typing inside that line only.

## 16. Keys and gestures

Excalidraw's own keys for drawing are listed in its **Help** (press `?`, or ☰ → Help). These are the keys and gestures of the math.

**Placing and editing:**

| Keys | Does |
|---|---|
| **M** | Add math: click the sheet to place an element. **Esc** cancels |
| Double-click a line | Edits that line, with the caret at the end |
| Double-click the header | Edits the title |
| **Enter**, on one selected element | Edits its last line |
| **Enter** | Splits the line at the caret. At the end of a line, starts a new one |
| **Backspace**, at the start of a line | Joins it to the line above |
| **↑** / **↓** | Moves to the line above or below. **↑** on the first line edits the title |
| A click on another line | Moves the edit there |
| **Esc** | Leaves the line. A second **Esc** deselects |
| A click outside, or a drag | Leaves the line. Leaving always keeps what you typed |
| **Ctrl+B** / **Ctrl+U** | Bold / underline the open line, comment or title |
| **Ctrl+I** | Italic on a comment line or the title |

**Suggestions,** while you type a name:

| Keys | Does |
|---|---|
| **Tab** | Takes the highlighted suggestion, or the first |
| **↓** / **↑** | Moves the highlight into and out of the list |
| **Enter** | Takes the highlighted suggestion; with none highlighted, splits the line |
| **Esc** | Closes the list and keeps the line open |

**Results, sheet and files:**

| Keys | Does |
|---|---|
| A click on a result's unit | Opens its unit slot. **Enter** applies, **Esc** cancels |
| Hover a solve's result | Shows how the solve went |
| Hover a list's summary | Shows its first and last values |
| Hover a chart, then **⚙** | Opens the chart's settings |
| Drag a resize handle | Sets the element's width. Drag it narrower than its math to go back to automatic |
| **Ctrl+Z** / **Ctrl+Shift+Z** | Undo / redo, one line at a time |
| **Ctrl+D** | Duplicates the selected element |
| **Ctrl+S** / **Ctrl+Shift+S** / **Ctrl+O** | Save / Save as / Open, in the browser |

**By touch,** in Obsidian on a phone or tablet:

- **Double-tap** a line or the header to edit it. A tap on another line moves the edit; a tap outside leaves.
- The Format tab's **Done**, **↑** and **↓** stand in for Esc and the arrow keys, and **Edit** opens the selected element's last line.
- While a line is open, **quick keys** sit above the panel's tabs: `_` `^` `=` `(` `)` `*` `/` `,` `..` and a pair of quotes.
- A **tap** shows what hover would: a problem's message, a solve's details, a list's values. A selected element shows its unit slots and its charts' ⚙.

## 17. Common messages

Messages say what is wrong in plain words, in the result cell and in the Problems tab. Hover a `●` or `⚠` for the full text.

| Write | Shows | Note |
|---|---|---|
| `a_1 = b_1 + 1` | ● `b_1 is defined below` | Move the line below the one that defines `b_1` |
| `b_1 = 2` | — | |
| `c_1 = 1 m + 1 s` | ● `Units do not match` | |
| `d_1 = c_1 * 2` | ● `c_1 has an error above` | Fix the first error; the others follow from it |
| `e_1 = 0.02` | — | |
| `e_1 (2)` | ● `e_1 is a value, not a function: write e_1 * (...) to multiply` | |
| `table = 2` | ● `table is a line form: choose another name` | |
| `g_1 = 1; h_1 = 2` | ● `one statement per line: split the line at the ;` | |
| `3 m in xyz` | ● `Unknown unit xyz` | |
| `"10" == 10` | ● `can't compare text with a number` | |
| `if(1 > 0, 2)` | ● `if needs 3 arguments: if(cond, a, b)` | |
| `n_1 = 1 .. 5` | `5 values, 1 … 5` | |
| `L_1 = 1 m .. 3 m` | ● `a range with units needs a step, such as "step 1 m"` | |
| `w_1 = solve w^2 = 4, guess w = 1` | ● `solve needs a range: ", for w = <from> .. <to>"` | A solved value takes `for` |
| `u_1(a) = solve u^2 = a, for u = 0 .. 10` | ● `a solve function takes a guess: ", guess u = <value>"` | A solve function takes `guess` |
| `s_1 = solve x^2 = n_1, for x = 0 .. 9` | ● `a range solve can't use the list n_1; use a solve function with a guess` | |
| `n_1[0]` | ● `n_1[0]: an index is a whole number from 1` | |
| `T = 20 degC` | — ⚠ `T shadows the unit T` | `T` is the tesla. Name it `T_w` instead |

**Opening and saving:**

| Message | Means |
|---|---|
| This sheet was saved by a newer Excalimathpad. Update the app. | The file is from a later version; it wasn't opened or changed |
| This file isn't a sheet, so it wasn't opened. | The file isn't a sheet or a drawing |
| Couldn't save … | The save failed. Your work is still open: save again |
| … changed elsewhere. Your version was saved beside it as … | In a vault: sync or another tab changed the sheet while you had unsaved work |
