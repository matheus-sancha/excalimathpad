Research for issue #358, 2026-11-26.

# Formula library: sources for energy and rotation, fluid mechanics, and electricity

Question: the first built-in set (issue #351) adds three groups beyond
mechanical design: energy and rotation (7 entries), fluid mechanics (7) and
electricity and magnetism (6). For each entry, which primary source can it
cite, with a locator, and is there a freely readable second citation? Which
formulas have a usual form that differs between sources or regions, and which
form should the entry use?

The legal rule is the one already agreed in
[`formula-library-sources.md`](formula-library-sources.md): cite anything, copy
only the mathematics in our own notation, draw our own figures, write our own
worked examples, and copy nothing from CC BY-SA or BY-NC-SA material
(Wikipedia, OpenStax, LibreTexts), which serves as a pointer only. This note
does not repeat that analysis.

## How far each claim was checked

The session's network blocked every publisher and government site tried
(`grc.nasa.gov`, `ntrs.nasa.gov`, `nist.gov`, `standards.doe.gov`,
`en.wikipedia.org`, `archive.org`, `feynmanlectures.caltech.edu`). Only
`raw.githubusercontent.com` could be fetched. No textbook could be opened.
The marks follow the earlier note, with one more:

- **[fetched]**: I downloaded the file and read it.
- **[observed]**: I ran it in this repository's engine (`evaluateSheet`,
  math.js 15.2.0) and saw the result.
- **[search]**: a web search returned the claim as an excerpt of the linked
  page. I did not open the page.
- **[unverified]**: from memory. Not checked in this session. **Every
  textbook section and equation number in this note is [unverified] unless
  marked otherwise**: the search tool could not show a single equation number
  from Hibbeler, Munson, White, Nilsson & Riedel or Halliday, and numbering
  changes between editions. A later session with the books must confirm each
  locator before it goes into an entry.

## Answer

- **Energy and rotation.** First citation: Hibbeler, *Engineering Mechanics:
  Dynamics*, 14th ed. (Pearson), chapters 14 (work and energy, power), 16
  (rotation about a fixed axis), 17 (moment of inertia) and 18 (kinetic
  energy of a rigid body); *Statics* ch. 4 for `T = F r`. Free second: the
  US Department of Energy's *DOE Fundamentals Handbook: Classical Physics*
  (DOE-HDBK-1010-92), Module 5 "Energy, Work, and Power"; NIST SP 811 for the
  rpm conversion.
- **Fluid mechanics.** First citation: Munson et al., *Fundamentals of Fluid
  Mechanics* (Wiley), chapters 2 (hydrostatics), 3 (Bernoulli), 5 (mass flow,
  energy, pump power) and 8 (pipe flow, Reynolds number, Darcy friction
  factor); White, *Fluid Mechanics* (McGraw Hill), ch. 6, as the alternative.
  Free second: *DOE Fundamentals Handbook: Thermodynamics, Heat Transfer, and
  Fluid Flow*, Vol. 3 (DOE-HDBK-1012/3-92), Module 3 "Fluid Flow"; NASA
  Glenn's Beginner's Guide page on the Reynolds number.
- **Electricity and magnetism.** First citation: Nilsson & Riedel, *Electric
  Circuits*, 11th ed. (Pearson, 2019), chapters 1 to 3 (power, Ohm's law,
  series and parallel), 6 (energy in inductors and capacitors), 7 (RC time
  constant) and the balanced three-phase chapter. Force on a conductor:
  Halliday, Resnick & Walker, *Fundamentals of Physics* (Wiley), the
  "Magnetic Fields" chapter. Free second: *DOE Fundamentals Handbook:
  Electrical Science* (DOE-HDBK-1011/1-92 to /4-92).
- **The DOE Fundamentals Handbooks are the one freely readable source that
  covers all three groups.** They are archived US government handbooks with a
  full PDF on the DOE standards site and OSTI. Whether every volume is free of
  copyright (some were written by a contractor) was not checked, so the
  agreed "write it ourselves" rule applies to them too.
- **Forms, in short:** three-phase power with line-to-line voltage and line
  current (`sqrt(3) U_L I_L cos(phi)`); the Darcy friction factor, never
  Fanning; head loss as a head, with the pressure drop as a second line;
  Bernoulli in its pressure form; the Reynolds number with dynamic viscosity
  and the inner diameter; `omega = 2 pi n` with no `rad` anywhere; standard
  gravity (`gravity`, 9.80665 m/s²), not 9.81. The reasons are in
  [Formulas whose usual form differs](#formulas-whose-usual-form-differs).
- **Two findings from the engine change how entries are written**, beyond
  the sources. `rad` is a unit of its own in math.js, so an angular velocity
  typed in `rad/s` leaves a stray `rad` in a power or a speed; and many usual
  symbols (`V`, `A`, `F`, `L`, `C`, `T`, `B`, `m`, `g`, `h`) are units, so an
  entry that defines one breaks its own later lines. See
  [What the engine does with these formulas](#what-the-engine-does-with-these-formulas).

## Sources, one by one

Same columns as the earlier note. Every source may be cited; the last column
says whether anything beyond the mathematics may be copied.

| Source | Good for | Status | Copy from it? |
| --- | --- | --- | --- |
| Hibbeler, *Engineering Mechanics: Dynamics*, 14th ed. (Pearson) | Energy, power, rotation | Commercial. The 14th edition is on sale [[search] Pearson](https://www.pearson.com/store/en-us/p/engineering-mechanics-dynamics/P200000007372) | No (Pearson, see the earlier note) |
| Meriam & Kraige, *Engineering Mechanics: Dynamics* (Wiley) | Same, as an alternative | Commercial | No [unverified locators] |
| Munson, Okiishi, Huebsch & Rothmayer, *Fundamentals of Fluid Mechanics* (Wiley) | Hydrostatics, Bernoulli, pipe flow | Commercial | No |
| White, *Fluid Mechanics* (McGraw Hill) | Same, as an alternative | Commercial | No (McGraw Hill) |
| Çengel & Cimbala, *Fluid Mechanics: Fundamentals and Applications* (McGraw Hill) | Same; the `fluids` library cites it for the Reynolds number [[fetched] `fluids/core.py`](https://raw.githubusercontent.com/CalebBell/fluids/master/fluids/core.py) | Commercial | No |
| Nilsson & Riedel, *Electric Circuits*, 11th ed. (Pearson, 18 January 2019) [[search] Pearson](https://www.pearson.com/en-gb/subject-catalog/p/electric-circuits-global-edition/P200000005130/9781292261065) | Circuits, three-phase | Commercial | No |
| Halliday, Resnick & Walker, *Fundamentals of Physics* (Wiley) | Force on a conductor | Commercial | No |
| Chapman, *Electric Machinery Fundamentals*, 5th ed. (McGraw Hill) | Force on a wire, three-phase circuits (an appendix), as an engineering alternative | Commercial | No [unverified locators] |
| DOE-HDBK-1010-92, *Classical Physics* | Kinetic and potential energy, work, power | US government handbook, June 1992, archived; PDF also hosted by the Navy's NNPTC [[search] OSTI record](https://www.osti.gov/biblio/10170060), [[search] NNPTC PDF](https://www.navsea.navy.mil/Portals/103/Documents/NNPTC/Physics/doe_phys.pdf) | With care. Probably free of US copyright; authorship not checked |
| DOE-HDBK-1012/3-92, *Thermodynamics, Heat Transfer, and Fluid Flow*, Vol. 3 | Continuity, Bernoulli, head loss, Darcy, laminar and turbulent flow | Same; listed as ARCHIVED [[search] DOE standards page](https://www.standards.doe.gov/standards-documents/1000/1012-bhdbk-1992-v3) | With care, as above |
| DOE-HDBK-1011/1-92 to /4-92, *Electrical Science* (4 volumes) | Ohm's law, series and parallel, inductance and capacitance, AC power | Same [[search] DOE standards page, Vol. 1](https://www.standards.doe.gov/standards-documents/1000/1011-bhdbk-1992-v1), [[search] Vol. 4 PDF at UNT](https://digital.library.unt.edu/ark:/67531/metadc1445305/m2/1/high_res_d/7295869.pdf) | With care, as above |
| NASA Glenn, *Beginner's Guide to Aeronautics*, "Reynolds Number" | Reynolds number | NASA web page; NASA's notice that its material is not protected unless noted is in the earlier note [[search] page](https://www.grc.nasa.gov/www/k-12/airplane/reynolds.html) | With care, per page |
| NIST SP 811 (Thompson & Taylor, 2008), *Guide for the Use of the SI* | rpm to rad/s, standard gravity | NIST staff work, 17 U.S.C. § 105 (earlier note) | With care |
| Penn State *Mechanics Map*, "Power in Rigid Body Systems" | `P = F·v + M·ω` | Open web textbook; licence not checked [[search] page](https://mechanicsmap.psu.edu/websites/14_work_energy_rigid_body/14-3_power_rigid_body/power_rigid_body.html) | Pointer only until its licence is read |
| OpenStax *University Physics* Vol. 2, §11.4 | Force on a conductor | CC BY-NC-SA per OpenStax's current help page (earlier note) [[search] §11.4](https://openstax.org/books/university-physics-volume-2/pages/11-4-magnetic-force-on-a-current-carrying-conductor) | No. Pointer only |
| IEC Electropedia (IEC 60050) | Definitions of line-to-line and phase voltage | Free to read online, copyright IEC | No. Pointer only [unverified] |
| `fluids` (Caleb Bell, MIT) | Cross-check of Reynolds number and head–pressure conversion | MIT code | Read, then write our own; porting brings the MIT notice (earlier note) [[fetched]](https://raw.githubusercontent.com/CalebBell/fluids/master/fluids/core.py) |

## Per entry

"First" is the primary citation; "Second" the freely readable one. All
section numbers are [unverified] except where a mark says otherwise.

### Energy and rotation

| Entry | First | Second |
| --- | --- | --- |
| Angular velocity from rpm, rim speed `v = omega r` | Hibbeler, *Dynamics* 14th ed., §16.3 "Rotation about a fixed axis" | NIST SP 811, Appendix B.8 (factors for units listed alphabetically), revolution per minute to radian per second. The appendix is pointed to by the R package `NISTunits`, which cites it for this conversion [[search] NISTunits docs](https://search.r-project.org/CRAN/refmans/NISTunits/html/NISTrpmTOradianPerSec.html) |
| Power from torque `P = T omega` | Hibbeler, *Dynamics*, ch. 18 (work of a couple moment; power of a rigid body) | Penn State *Mechanics Map*, "Power in Rigid Body Systems", gives `P = F·v + M·ω` [search], pointer only |
| Torque from force `T = F r` | Hibbeler, *Engineering Mechanics: Statics* 14th ed., §4.1 "Moment of a force, scalar formulation" (`M_O = F d`) | DOE-HDBK-1010-92, Module 3 or 4 (force and motion) [unverified that it covers moments] |
| Power from force and speed `P = F v` | Hibbeler, *Dynamics*, §14.4 "Power and Efficiency" [search: the section title in the 14th edition's contents] | DOE-HDBK-1010-92, Module 5 "Energy, Work, and Power" [search] |
| Kinetic energy `½ m v²` | Hibbeler, *Dynamics*, §14.2 "Principle of work and energy" | DOE-HDBK-1010-92, Module 5 [search: it covers kinetic and potential energy] |
| Rotational kinetic energy, disc `½ I ω²`, `I = ½ m r²` | Hibbeler, *Dynamics*, §18.1 "Kinetic Energy" [search: the section title], and the moment-of-inertia table inside the back cover (§17.1) | None found that covers the disc. The inertia is derivable, and the test can integrate it |
| Potential energy `m g h` | Hibbeler, *Dynamics*, §14.5 "Conservative forces and potential energy" (gravitational potential energy) | DOE-HDBK-1010-92, Module 5 [search] |

### Fluid mechanics

| Entry | First | Second |
| --- | --- | --- |
| Volumetric flow `Q = A v` | Munson, ch. 5, §5.1 "The continuity equation" | DOE-HDBK-1012/3-92, Module 3, "Continuity Equation" [search: the module covers it] |
| Mass flow `ṁ = ρ Q` | Munson, §5.1 | Same |
| Hydrostatic pressure `p = ρ g h` | Munson, ch. 2, "Pressure variation in a fluid at rest" (incompressible fluid) | DOE-HDBK-1012/3-92 [unverified that Module 3 has it; Module 1 or 2 may] |
| Bernoulli | Munson, ch. 3, `p + ½ρV² + γz` constant along a streamline, with γ = ρg [search: the form, through course notes that reproduce Munson's figures; Munson's own equation number not found] ([WSU/UW course deck](https://faculty.washington.edu/markbenj/CEE342/Topic%206_the%20Bernoulli%20&%20continuity%20eqns.pdf), [Iowa lecture notes](https://user.engineering.uiowa.edu/~fluids/posting/Lecture_Notes/Chapter3.pdf)) | DOE-HDBK-1012/3-92, Module 3, "Bernoulli's Equation" and "Extended Bernoulli" [search] |
| Reynolds number | Munson, ch. 8, §8.1 (laminar and turbulent pipe flow) | NASA Glenn, "Reynolds Number": `Re = ρVL/μ = VL/ν` [search] |
| Darcy–Weisbach head loss | Munson, ch. 8, §8.4 "Major losses" (the friction factor and the Moody chart); or White, ch. 6 (the equation number varies by edition [search: not found]) | DOE-HDBK-1012/3-92, Module 3, "Head Loss" (Darcy's equation, friction factor from Reynolds number and relative roughness) [search] |
| Hydraulic power `P = Q Δp` | Munson, ch. 5, energy equation and shaft power (`Ẇ = γ Q h_s`); or White, ch. 11 (pumps, `P = ρ g Q H`) | DOE-HDBK-1012/3-92, Module 3, "Extended Bernoulli" (pump head) [search: the extended equation adds pump head and head loss] |

### Electricity and magnetism

| Entry | First | Second |
| --- | --- | --- |
| Ohm's law with power | Nilsson & Riedel, ch. 1 (power `p = vi`) and ch. 2 "Circuit Elements" (Ohm's law, `p = i²R = v²/R`) [search: the 11th edition opens with "Circuit Variables, Circuit Elements, Simple Resistive Circuits"] | DOE-HDBK-1011/1-92, *Basic Electrical Theory* and *Basic DC Theory* [unverified module numbers] |
| Series and parallel resistors | Nilsson & Riedel, ch. 3 "Simple Resistive Circuits" [search: chapter title] | DOE-HDBK-1011/1-92 or /2-92 (DC circuits) [unverified] |
| RC time constant `τ = R C` | Nilsson & Riedel, ch. 7 "Response of First-Order RL and RC Circuits" [search: chapter 7 in the 12th edition's contents; the 11th is likely the same, not confirmed] | DOE-HDBK-1011, *Basic DC Theory* or the inductance and capacitance module (time constants) [unverified] |
| Energy in a capacitor `½ C U²` and an inductor `½ L I²` | Nilsson & Riedel, ch. 6 "Inductance, Capacitance, and Mutual Inductance" | DOE-HDBK-1011, same module [unverified] |
| Force on a conductor | Halliday, Resnick & Walker, *Fundamentals of Physics*, "Magnetic Fields", section "Magnetic Force on a Current-Carrying Wire" (ch. 28 in the 10th edition) [unverified]. Engineering alternative: Chapman, ch. 1, "Production of induced force on a wire" | None free to copy. OpenStax *University Physics* Vol. 2 §11.4 as a pointer [search] |
| Three-phase power | Nilsson & Riedel, the balanced three-phase chapter (its "power calculations in balanced three-phase circuits" section). Alternative: Chapman, appendix on three-phase circuits | DOE-HDBK-1011/4-92 or /3-92, AC power [search: Vol. 4 lists AC power and AC generators among its topics; the three-phase module was not confirmed] |

## Formulas whose usual form differs

| Formula | How sources differ | Use in the entry | Why |
| --- | --- | --- | --- |
| Three-phase power | `P = sqrt(3) U_L I_L cos φ` with line-to-line voltage and line current; or `P = 3 U_ph I_ph cos φ` with phase quantities. In a star connection `U_L = sqrt(3) U_ph`, `I_L = I_ph`; in delta `U_L = U_ph`, `I_L = sqrt(3) I_ph` [search: a Red Seal formula sheet and a lab text give these ([Red Seal](https://www.red-seal.ca/_conf/assets/custom/docms/const-elect/formulas.pdf))]. US texts write `V`, IEC texts `U` | `P = sqrt(3) U_L I_L cos(phi)`, with the inputs named and described as line-to-line voltage and line current, and the assumptions (balanced, sinusoidal) in the entry's text. Example 400 V line-to-line | Nameplates and supply voltages are quoted line-to-line (400 V, 480 V); 230/400 V and 120/208 V name both [unverified: IEC 60038 not read]. The form holds for star and delta alike, so the user need not know the connection. `φ` is the angle between a phase's voltage and its current, not between line voltages; `cos φ` is the displacement power factor and ignores harmonics. Say both in the entry |
| Darcy–Weisbach friction factor | Darcy (Moody) `f_D` or Fanning `f_F = f_D / 4`; laminar `64/Re` vs `16/Re`. Darcy is usual in civil and mechanical texts, Fanning in chemical engineering [search: [summary](https://engineerexcel.com/darcy-vs-fanning-friction-factor/); the Wikipedia article as a pointer]. `fluids` returns the Darcy value and calls Fanning "1/4 of the Darcy value" [[fetched] `fluids/friction.py`](https://raw.githubusercontent.com/CalebBell/fluids/master/fluids/friction.py) | Darcy. Name the input "Darcy friction factor f (Moody chart)" | A user reading `f` from a Moody chart gets the Darcy value. A Fanning value in a Darcy formula is out by four with no warning, so the input's name carries the convention |
| Head loss: head or pressure | `h_f = f (L/D) v²/(2g)` (a length) or `Δp = f (L/D) ρ v²/2` (a pressure); `Δp = ρ g h_f` [search: [Iowa lecture](https://user.engineering.uiowa.edu/~fluids/posting/Lecture_Notes/Chapter8_summary.pdf)] | Head as the result, `h_f`, and `Δp = rho gravity h_f` as a second line | The entry is named "head loss" (#351). The pressure line costs one line and serves the hydraulic power entry, which needs a `Δp` |
| Bernoulli | Per unit volume `p + ½ρv² + ρgz`, per unit weight (head) `p/(ρg) + v²/(2g) + z`, per unit mass `p/ρ + v²/2 + gz`; Munson and the Iowa notes give the first and the head form [search, links above] | Per unit volume, solved for the downstream pressure: `p_2 = p_1 + ½ρ(v_1² − v_2²) + ρ g (z_1 − z_2)` | Inputs and result are pressures in Pa or bar, which the user has in hand. The head form is one division away. Say in the entry: steady, incompressible, inviscid, along a streamline, no pump |
| Reynolds number | `ρ v D / μ` or `v D / ν` [search: NASA; [fetched] `fluids`, which takes either]. The length is the pipe's inner diameter, a hydraulic diameter `4A/P` for other ducts, or a body length for external flow (NASA uses `L`). The laminar limit is quoted as 2000, 2100 or 2300 [unverified which source uses which] | `Re = rho v D / mu`, `D` the inner diameter. Mention `ν` and `D_h` in the text. Print no regime | Dynamic viscosity is what tables and the app's `cP` give. A regime would need one threshold, and sources disagree |
| rpm to angular velocity | `ω = 2π n / 60` (n in r/min, ω in rad/s); SI treats rad/s as the unit of angular velocity and r/min as outside the SI [search] | `omega = 2 pi n`, with `n` in the app's `rpm` unit and no `/60` and no `rad` | The app's `rpm` is `1 / minute` (`src/math/appUnits.ts`), so the units do the `/60`. `rad` breaks the result (next section) |
| Power from torque | `P = T ω`; trade shortcuts `P[kW] = T[N·m]·n[rpm] / 9549` and `P[hp] = T[lbf·ft]·n[rpm] / 5252` (60000/2π and 33000/2π, computed) | `P = T omega` | The constants are unit conversions the engine already does |
| Torque from force | `T = F r` with `r` the perpendicular lever arm, or `T = F r sin θ` | `T = F r`, `r` described as the perpendicular distance | One input fewer; the general case is `r sin θ`, said in the text |
| Rotational kinetic energy | `I = ½ m r²` for a solid uniform disc about its axis; `m r²` for a thin ring | Solid disc, said in the title | #351 names "a disc's inertia" |
| Potential energy, weights | `g = 9.81` in most worked examples, `9.80665 m/s²` as standard gravity (the CGPM value, given by NIST SP 811 [unverified]) | The engine's `gravity` constant, 9.80665 m/s² (`src/math/constants.ts`) | Tests computed with 9.81 differ in the fourth digit. Say "standard gravity" in the entry. `h` is measured from a chosen datum |
| Hydrostatic pressure | Gauge `ρ g h` or absolute `p_0 + ρ g h` | Gauge, `p = rho gravity h`, with "gauge" in the title | One input fewer; absolute is one added line |
| Hydraulic power | `P = Q Δp` or `P = ρ g Q H`; US "hydraulic horsepower" `= gpm · psi / 1714` [unverified constant] | `P = Q Δp`, called fluid (hydraulic) power, with "shaft power = P / η" in the text | Pressure inputs match the Δp line of the head-loss entry; units handle gpm and psi |
| Ohm's law with power | `V = I R` (US) or `U = R I` (IEC); `P = U I = I² R = U² / R` | `U = R I`, `P = U I`; the other two in the text | `V` is the volt in the engine (next section); `U` is the IEC symbol. For AC, values are RMS and the load resistive |
| Force on a conductor | `F = B I L` (perpendicular) or `F = B I L sin θ`; vector `F = I L × B` [search: OpenStax §11.4, pointer] | `F = B I L sin(theta)`, example `theta = 90 deg` | One more input covers every angle; the example shows the usual case |
| RC time constant | `τ = RC`; "fully charged after 5τ" in some texts, 4τ in others [unverified] | `tau = R C` only | The rule of thumb is a convention, not a formula. Note: `tau` is a math.js built-in (2π), see below |

## What the engine does with these formulas

Run through `evaluateSheet` in this repository [observed]. These do not change
which source to cite, but they settle how the entry must be typed.

- **`rad` is not dimensionless in math.js.** `w = 157 rad/s; T = 10 N m;
  P = T w` shows `1570 (kg m^2 rad) / s^3`, and `P to W` shows `1570 W rad`.
  The same stray `rad` appears in `v = omega r` and `½ I ω²`. Typed as
  `n = 1500 rpm; omega = 2 pi n`, the chain works: `P = T omega` is
  `1.571 kW` and `v = omega r` with `r = 0.2 m` is `31.42 m / s`.
- **`omega = 2 pi n` shows as `157.1 Hz`.** The number is right for rad/s,
  but Hz reads as cycles per second, which is off by 2π for a reader. `omega
  to 1/s` shows `157.1 s^-1`; `omega to rad/s` shows `157.1 (rad / s)
  rad^-1`. The entry should show ω with a display unit of `1/s`. Whether the
  engine should show an angular velocity differently is a units question
  outside this ticket.
- **Usual symbols are units.** `m = 2 kg` then `r = 0.1 m` gives `r` as
  `200 g`: the new `m` shadows the metre below it, and the entry broke
  itself. math.js treats as units `V`, `A`, `F`, `L`, `C`, `T`, `B` (byte),
  `W`, `H`, `h`, `g`, `m`, `N`, `t`, `S`, `K`, `J`; `tau`, `phi` and `e` are
  built-ins (2π, the golden ratio, Euler's number) [observed with
  `math.Unit.isValuelessUnit`]. So `F = B I L`, `T = F r`, `U = R I` with
  `C`, and `m g h` cannot be typed with their textbook letters without
  shadowing. The spec's rule for this (CONTEXT.md, ADR 0003) makes it a
  warning, not an error, and an inserted block also shadows the user's units
  below it. Picking names that are not units (`U`, `I`, `R`, `P`, `Q`,
  `rho`, `mu`, `omega`, and subscripted names such as `m_1`, `F_1`, `L_1`,
  `C_1`, `T_1`) belongs to whichever ticket decides an entry's names; it is
  flagged here because it affects all three groups.
- **Checked as written:** `Q dp` with `0.01 m^3/s` and `2 bar` is `2 kW`;
  `sqrt(3) V I cos(phi)` with `V = 400 V`, 10 A, 30 deg is `6 kW` (with a
  shadow warning on `V`); `rho v D / mu`
  with 1000 kg/m³, 2 m/s, 0.05 m and `1 cP` is `1·10⁵` [observed].

## Not verified

- Every textbook chapter, section and equation number above, apart from the
  chapter and section titles marked [search]. No book could be opened.
- Which DOE Fundamentals Handbook module covers each electrical entry and
  hydrostatic pressure, and whether each handbook is free of copyright.
- NIST SP 811's own text on rpm and standard gravity (only a secondary
  pointer to Appendix B.8 was seen), and the NASA Glenn pages' current text
  (`grc.nasa.gov` did not resolve).
- The licence of Penn State's *Mechanics Map*.
- IEC 60038's nominal voltages and IEC 60050's definitions.
- Which sources put the laminar limit at 2000, 2100 or 2300, and the 4τ or
  5τ rule.
