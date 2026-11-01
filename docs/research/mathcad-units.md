Research for wayfinder ticket #15, 2026-11-01.

# Mathcad result units vs math.js 15

Question: how do Mathcad's result unit placeholder and worksheet unit systems
work, and what can math.js reproduce?

## Answer

- **Mathcad Prime shows each result in the worksheet's unit system, not in the
  unit you typed.** A value entered as 30 cm displays as 0.3 m in SI
  ([About Units](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/about_units.html)).
  You override a single result by typing into the **unit placeholder** to the
  right of it. Clearing the placeholder and pressing Enter restores the
  default
  ([To Convert Units](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/to_convert_units.html)).
- **An incompatible placeholder unit is not an error in Mathcad. It is
  balanced.** Mathcad keeps your unit and puts the missing dimension to its
  left: 1 N with `m` typed in becomes `1 kg/s² · m`
  ([Unit Balancing](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/unit_balancing.html)).
  So a result whose dimension changes after you chose its unit keeps that
  unit and gains a balancing term. That follows from the doc, but I have not
  observed it (see Unverified).
- **There are three built-in systems (SI, USCS, CGS) plus Custom.** You set
  them per worksheet under Math → Units → Unit System. A Custom system is
  based on one of the three. In it you can swap the base unit for each
  dimension and edit a **Derived Units** list, which holds rules such as
  "1/s → Hz"
  ([Formatting the Unit Display](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/formatting_the_unit_display.html),
  [Custom Units](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/custom_units.html),
  [Setting a Custom Unit System](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/to_set_custom_units.html)).
- **math.js 15.2 can do all of this, but only from app code. Sheet syntax
  alone is not enough.**
  - `x to unit` and `toBest` work in sheet lines today. `to` throws
    `Units do not match (...)` where Mathcad would balance.
  - Unit systems (`Unit.setUnitSystem`, `Unit.UNIT_SYSTEMS`) cannot be
    reached from expressions. App code can reach them.
  - math.js's own automatic simplification does not reproduce Mathcad. It
    auto-prefixes (0.9987 MPa, 1963.5 mm²) and only re-bases when that gives
    fewer units.
  - So the app needs a small "display in system S" formatter, plus a
    placeholder that computes `value / placeholder` and balances the
    leftover. I prototyped both and they work (§3).
- **Bug found while probing: today's result text is not a pure function of
  the sheet.** math.js's default `auto` unit system is global state that every
  unit parse rewrites. The same sheet shows `p = (2 kg)/(3 m*s^2)` as
  `0.667 Pa` on one run, and as `9.67e-5 psi` after any block has evaluated
  `1 psi`. This contradicts ADR 0003. One `Unit.setUnitSystem('si')` at engine
  init fixes it (§2.4).
- **Two acceptance-calc gotchas:**
  - `cP` (and `poise`) are not math.js units. With `createUnit` disabled, the
    sheet must define `cP = 0.001 Pa*s` as a variable, or the app must
    pre-register it.
  - `L/min` fails because `min` resolves to the function `min()`. Units also
    lose to sheet variables: after `L = 100 m`, `to L/minute` means
    "100 m per minute".

## 1. Mathcad behaviour

Primary source: the PTC Mathcad Prime help centre, r12.0. The pages cited are
the same in r8/r9/r11.

### 1.1 Unit placeholder

- **Where it is.** It sits to the right of every evaluated result. It also
  appears on plot axes and in table column headers. It is only visible when
  it holds units or when the region is active
  ([Unit Placeholders](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/unit_placeholders.html)).
- **What you can type.** Mainly units, but it "accept[s] any expression such
  as π or a predefined variable name". That makes it a scaling slot as well
  (same page). User-defined units are recognised only when they carry the
  unit label
  ([Defining Units and Unit Functions](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/defining_units_and_unit_functions.html)).
- **How you edit it.**
  1. Backspace over the units. The result turns grey.
  2. Type the new units.
  3. Press Enter. The units are "balanced if needed" and the result is
     recalculated.

  An empty placeholder plus Enter restores the default units. For arrays,
  conversion works only when all elements have compatible units; elements
  with mixed units each show their own base units and cannot be converted
  ([To Convert Units](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/to_convert_units.html)).
- **Compatibility check: balancing, not an error.** If the new units "are
  incompatible with the expected dimension", Mathcad adds a unit term to the
  left of the placeholder to keep the dimensions balanced. Examples:
  - N → `m` gives `kg/s²` on the left.
  - Replacing only the kg with C gives a `kg/(s·A)` term.

  Changing the unit system never triggers balancing; compatible units are
  just converted
  ([Unit Balancing](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/unit_balancing.html)).
- **Real unit errors happen elsewhere.** Adding or subtracting incompatible
  dimensions raises a unit-checking error. Torque + energy (same dimension)
  does not. A function's units are checked only when it is evaluated
  ([Unit Checking](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/unit_checking.html)).

### 1.2 Unit systems and default result units

- **The systems.** SI, USCS and CGS, plus Custom (based on one of the three).
  You pick one per worksheet in Math → Units → **Unit System**. The same
  dialog has a **Base Units** option that shows units "as a set of base units
  or compound units"
  ([Formatting the Unit Display](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/formatting_the_unit_display.html)).
  MKS is not offered in Prime. It existed in Mathcad 15 (§1.4).
- **The default display.** Results show in the worksheet's system, not in
  the input unit: 30 cm → 0.3 m, 10 µm → 0.00001 m in SI
  ([About Units](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/about_units.html)).
  So by default there is no automatic prefix: you see 0.00001 m, not 10 µm.
  This is consistent with PTC's `SIUnitsOf` page: before units are
  processed, Mathcad "converts its original unit to its counterpart in the
  current Unit System"
  ([Example: SIUnitsOf](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/example_explaining_SIUnitsOf.html)).
  - *Secondary, consistent:* PTC Community answers say Prime does not
    remember the input unit, and users must set the placeholder on each
    result ([thread](https://community.ptc.com/mathcad-7/units-in-mathcad-prime-140872)).
- **Derived units (N or kg·m/s²?).** Results are simplified to derived units
  by the system's **Derived Units** rules. In a Custom system you can:
  - insert rules, e.g. Hz for 1/s ("the last rule applied takes precedence");
  - remove a rule, which makes that combination fall back to base units;
  - change the base unit per dimension, e.g. in for length.

  You cannot remove core dimensions (length, mass, time). Only
  multiplicative units qualify, so °C, °F and DMS are out
  ([Custom Units](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/custom_units.html),
  [Setting a Custom Unit System](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/to_set_custom_units.html)).
  The docs do not list the default rules for each built-in system.
- **Base dimensions.** Current, length, luminous intensity, mass, money,
  substance, temperature and time
  ([Base Dimensions and Unit Names](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/base_dimensions_and_unit_names.html)).
  Angle is not a dimension, so rad is dimensionless.

### 1.3 Dimensionless results and dimension changes

- **Dimensionless results** (e.g. Reynolds number) show as a plain number.
  This follows from the dimension list above; the PTC docs have no page on
  it. *Secondary:* `rad` and `%` behave as dimensionless pseudo-units, and
  typing `deg` into an angle result's placeholder shows degrees
  ([PTC Community](https://community.ptc.com/t5/Mathcad/How-to-make-angle-a-unit-type-in-Mathcad-Prime-3-1/m-p/14574)).
- **A result whose dimension changes after a unit was chosen.** **Unverified,
  inferred** from [Unit Balancing](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/unit_balancing.html):
  the typed unit stays in the placeholder and a balancing term appears to its
  left, rather than an error. No PTC page describes this exact sequence. I
  could not run Prime to observe it.

### 1.4 Mathcad 15 (legacy), where it differs

*Secondary, PTC Community only; not confirmed in PTC docs:*

- The unit system was chosen in Tools → Worksheet Options → Unit System:
  SI, MKS, CGS, US or None.
- Derived-unit display was a checkbox, "Simplify units when possible", under
  Format → Result → Unit Display
  ([thread](https://community.ptc.com/t5/Mathcad/Default-Units/m-p/140272),
  [thread](https://community.ptc.com/t5/Mathcad/Mathcad-15-Preferred-units-in-results/m-p/359445)).

## 2. math.js 15.2 behaviour

All observations are from throwaway probes, either against `mathjs@15.2.0`
or against this repo's `evaluateSheet` (`src/math/evaluate.ts`). Source
links point at the
[v15.2.0 tag](https://github.com/josdejong/mathjs/tree/v15.2.0).

### 2.1 Conversion (`to`) and compatibility

- **`x to u`, `x in u`, `to(x, u)` and `number(x, u)` all work in sheet
  lines** ([syntax docs](https://github.com/josdejong/mathjs/blob/v15.2.0/docs/expressions/syntax.md#units)).
  Observed:
  - `dp to bar` → `9.9870164222275 bar`
  - `dp to N/mm^2` → `0.99870164222275 N / mm^2`
  - `(50 m^3/h) to L/minute` → `833.33333333333 L / minute`
- **Incompatible target: error, no balancing.** `5 m to bar` →
  `Units do not match ('bar' != '5 m')`
  ([Unit.js#L845](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L845)).
- **Scaled target: error.** `dp to 1000 Pa` →
  `Cannot convert to a unit with a value`
  ([#L848](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L848)).
  Mathcad's "any expression" placeholder therefore needs
  `divide(value, expr)` instead of `to`.
- **Checking compatibility.** `unit.equalBase(other)` is the check
  ([units docs, API](https://github.com/josdejong/mathjs/blob/v15.2.0/docs/datatypes/units.md#api)).
  Observed: `dp.equalBase(unit('bar'))` is true; `dp.equalBase(unit('m'))` is
  false.
- **`to` pins the unit list.** It sets `fixPrefix` and
  `skipAutomaticSimplification`, so the result displays exactly as requested
  ([#L833–L871](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L833-L871)).

### 2.2 Automatic simplification and prefixes (what you see with no placeholder)

- **When simplification happens.** It happens at **format time**, in
  `formatBest`, and only for units produced by arithmetic. Units typed
  directly (`50 m^3/h`) or produced by `to` are shown as-is
  ([#L1195–L1213](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L1195)).
- **How `simplify()` works**
  ([#L957–L1016](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L957)):
  1. If the current unit system has an entry whose dimension matches the
     whole result (FORCE, PRESSURE, ENERGY, POWER, FREQUENCY and so on), it
     uses that unit. Observed: `5 kg/(m*s^2)` → `5 Pa`; `(2 kg)*(3 m/s^2)` →
     `6 N`.
  2. Otherwise it rebuilds the result from the system's base units, but only
     if that gives **fewer** unit factors (`proposedUnitList.length <
     ret.units.length`, [#L1010](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L1010)).
     So a `mm^2` area stays `mm^2` even in SI, and one in `m^2` stays `m^2`
     in USCS.
- **Automatic best prefix.** After simplifying, a result with a single unit
  gets the best prefix automatically
  ([#L1250](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L1250)).
  Observed: `dp` → `0.99870164222275 MPa`; `A` → `1963.4954084936 mm^2`.
  Mathcad would show `998701.64 Pa` and `0.0019635 m^2`.
- **Dimensionless results become plain numbers**, unless
  `config.predictable` is set
  ([getNumericIfUnitless, #L770](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L770)).
  Observed: `Re = rho*v*D/mu` → `3.5297029601269e+5` (type `number`).
  `(2 m)/(1 mm)` → `2000`.
- **Angles differ from Mathcad.** Angle is a math.js base dimension, so
  `rad` is *not* dimensionless: `(2 m)/(1 m) * 1 rad` → `2 rad`, and `rad`
  does not `equalBase` `m/m`. `%` is not a unit either: `100 %` → `1`
  (percentage operator).

### 2.3 `toBest` (math.js ≥ 14.6.0)

- **Status.** New function `toBest(unit, unitList, options)` and method
  `unit.toBest(...)` since 14.6.0
  ([HISTORY.md](https://github.com/josdejong/mathjs/blob/v15.2.0/HISTORY.md),
  [src/function/unit/toBest.js](https://github.com/josdejong/mathjs/blob/v15.2.0/src/function/unit/toBest.js)).
  It is reachable from sheet lines.
- **It picks a prefix, not a unit.** It keeps the result's own unit and only
  chooses among the *prefixes* of the listed units
  ([#L1126–L1160](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L1126)).
  Observed:
  - `toBest(998701.64 Pa, ["bar","kPa"])` → `998.70164 kPa`, not bar
  - `dp.toBest(['bar','kPa','Pa'])` → `9.987e+5 Pa`
- **Use.** Useful for "nice prefix" display. It is not a way to choose
  between units.

### 2.4 Unit systems

- **What exists.**
  - `math.Unit.setUnitSystem(name)` and `getUnitSystem()`
    ([#L3031](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L3031)).
  - `math.Unit.UNIT_SYSTEMS` with `si`, `cgs`, `us`, `auto`
    ([#L2969–L3025](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L2969),
    exported at [#L3407](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L3407)).

  These are not described in the user docs
  ([units.md](https://github.com/josdejong/mathjs/blob/v15.2.0/docs/datatypes/units.md)).
- **What each system defines.** Every system has base units plus derived
  entries: FORCE, ENERGY, POWER, PRESSURE, the electric units, FREQUENCY.
  The non-SI systems override a few:
  - `us`: ft, lbm, degF, lbf, BTU, hp, psi.
  - `cgs`: cm, g, dyn, erg. It keeps Pa (math.js has no barye).
- **The default is `auto`, and it is global mutable state.** On every unit
  parse, the parsed unit replaces the entry for its dimension
  ([#L405–L414](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L405),
  doc comment [#L2967](https://github.com/josdejong/mathjs/blob/v15.2.0/src/type/unit/Unit.js#L2967)).
  Every number-with-unit in a sheet line is such a parse (SymbolNode →
  `new Unit(null, name)`). That includes `to` targets in any block, from any
  earlier run. Observed through `evaluateSheet`, same source, two runs:

  | line | fresh engine | after another block evaluated `1 psi` |
  |---|---|---|
  | `p = (2 kg)/(3 m*s^2)` | `0.66666666666667 Pa` | `9.6691825159135e-5 psi` |
  | `v = Q/(pi*D^2/4)` with `Q = 50 m^3/h` | `25464.790894703 m / h` | `25464.790894703 m / h` |

  The velocity shows **m/h** because `h` was the last time unit parsed. It
  shows m/s instead if a later line parses `s`, e.g. `0.001 Pa*s`. The fix
  is `math.Unit.setUnitSystem('si')` (or a custom one) once at engine
  creation. `parse` then still rewrites `UNIT_SYSTEMS.auto`, but nothing
  reads it.
- **Custom systems are possible from app code.** Add an entry to
  `Unit.UNIT_SYSTEMS` (it is a plain object), then select it with
  `setUnitSystem`. Prototype: clone `si`, set `PRESSURE` to bar → `dp`
  displays `9.98702 bar` and `F` still shows `6 N`.

### 2.5 Sandbox effect (`src/math/evaluate.ts`)

- **Reachable from sheet lines:**
  - `to` / `in`
  - `toBest(...)`
  - `number(x, u)`
  - `splitUnit(...)`
  - unit methods called on values: `u.to("mm")`, `u.toSI()`, `u.toBest()`
- **Not reachable from sheet lines:**
  - `Unit` and `math` are undefined symbols, so `setUnitSystem` and
    `UNIT_SYSTEMS` stay out of reach.
  - `createUnit` and `config` are disabled.

  So a sheet line cannot change the unit system. That is good for
  isolation, and it means the sheet's unit system must be a **sheet setting
  applied by app code**.
- **`math.config` is gone for app code too.** `math.import({config: …},
  {override: true})` replaces it in the namespace. If a later feature needs
  `config.predictable`, capture `math.config` before the override, as is
  already done for `parse`.
- **Custom units such as `cP` need app code.** Since `createUnit` is
  disabled, they need either:
  - app-side registration before hardening (a fixed list, e.g. cP), or
  - sheet variables (`cP = 0.001 Pa*s` works: `mu = 1 cP` →
    `0.001 Pa s`).
- **Name resolution.** A bare name resolves as: sheet scope first, then the
  math namespace (functions/constants), then units
  ([SymbolNode.js#L57–L84](https://github.com/josdejong/mathjs/blob/v15.2.0/src/expression/node/SymbolNode.js#L57)).
  This causes three traps:
  - **Functions shadow units.** `min` is the function, so `L/min` errors with
    `Unexpected type of argument in function divide (... actual: function
    ...)`. Use `minute`.
  - **Sheet variables shadow units.** After `L = 100 m`, `to L/minute` gives
    `Units do not match ('100 m / minute' != '50 m^3 / h')`. After `h = 2 m`,
    `50 m^3/h` → `25 m^2`. After `m = 3`, `5 m` → `15`.
  - A placeholder must therefore be evaluated in a **units-only** context,
    not in the sheet scope: e.g. `math.unit(text)`, or `Unit.parse`.

## 3. Mapping: Mathcad → math.js → gap / workaround

| Mathcad behaviour | math.js 15.2 mechanism | Gap → workaround (app code) |
|---|---|---|
| Placeholder: type a unit, result converts | `value.to(unit)` | None for compatible units. Parse the placeholder with `math.unit(text)`, not the sheet scope (shadowing). |
| Placeholder accepts any expression (scale, e.g. `1000 Pa`, `π`) | `to` rejects units with a value | Show `divide(value, expr)` followed by the placeholder text. Prototype: `998.702 · 1000 Pa`. |
| Incompatible placeholder → **balancing** term, no error | `to` throws `Units do not match` | Compute `r = divide(value, placeholder)`. If `r` is still a Unit, show `r` in system base units, then the placeholder. Prototype: F=6 N, `[m]` → `6 kg / s^2 · m`. Matches PTC's own example. |
| Result dimension changes after unit chosen → (inferred) keeps unit + balancing | Same as above, re-run on each evaluation | Store the placeholder **text** per result line. Re-apply it on every run, then the same balancing path. |
| Clear placeholder → back to system default | Default display | Store nothing / empty string. |
| Worksheet unit system SI / USCS / CGS | `Unit.UNIT_SYSTEMS.si/us/cgs` + `setUnitSystem` | Needs a custom formatter. `simplify()` won't re-base (fewer-units rule) and auto-prefixes. Prototype (≈20 lines): (1) if a derived entry of the system `equalBase`s the value, `to` it; (2) else compose `sys[base]^p` per dimension and `to` that. Observed USCS: A=`0.0211349 ft^2`, v=`23.2072 ft / s`, dp=`144.849 psi`, F=`1.34885 lbf`. CGS: A=`19.635 cm^2`, F=`6e+5 dyn`. |
| No automatic prefixes (0.00001 m, 998701 Pa) | Best prefix applied at format time | Set `fixPrefix = true` on the converted unit (done by `to`). Optionally offer `toBest` as a "nice prefix" toggle. |
| Derived-unit rules (Pa, N, J, W, Hz; custom "1/s → Hz") | Derived entries in a `UNIT_SYSTEMS` object | Add `UNIT_SYSTEMS.custom` from app code. Base units: replace `LENGTH`/`MASS`/…; derived rules: set or delete keys (`PRESSURE: bar`). Only one unit per dimension key: math.js has no ordered rule list. |
| Base Units option (base vs compound units) | `unit.toSI()` | `toSI()` gives SI base units (`kg / (m s^2)`). For non-SI systems, use step (2) of the formatter alone. |
| Dimensionless result shows a number | Unitless `Unit` → `number` | Same. The placeholder on a dimensionless result can only scale (e.g. `%` needs a custom divide by 0.01; math.js `%` is not a unit). |
| rad, % are dimensionless | `ANGLE` is a base dimension in math.js | `rad`/`deg` results stay angle-typed. Mostly harmless. Note it for trig and placeholder checks. |
| Custom units (labelled definitions) | `createUnit` (disabled in sheet) | Pre-register a fixed list (e.g. `cP`) before hardening, or tell users to define variables. |
| Mathcad 15: MKS, "None" systems | `si` covers MKS; no "none" | Out of scope for v1. |

## Unverified and open points

- **Dimension change after a unit was chosen** (keep unit + balancing term)
  is inferred from the Unit Balancing page, not observed in Prime.
- **The default Derived Units list of each built-in Prime system** (e.g.
  whether SI shows `Pa·s` or `kg/(m·s)` for viscosity) is not in the PTC
  docs I found.
- **Whether Prime's placeholder accepts `%` on a dimensionless result** is
  community-sourced only.
- **Mathcad 15 menu paths and options** (MKS, None, "Simplify units when
  possible") are community-sourced only.
