# gemini-4-hydrogen, beam, guide whole, trial 1

Cost $0.0519, 287.8 s in all.

> I need to dimension a simply supported steel beam: 6 m span, uniform load 12 kN/m and a 20 kN point load at midspan. Make me a template sheet: reactions, maximum moment, the section modulus required for a yield strength of 275 MPa with a safety factor I can change, the midspan deflection for a section whose I and E I type in, and a pass/fail check against span/250, in green and red.

## First answer

287.8 s, 14412 tokens in, 4044 out.
4 elements, 16 lines, 3 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 3, note 16, display unit 8, rule 1, condition 1

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Beam geometry and loads"
  1 | # Self-weight is not included; add it to q if needed
  2 | L_b = 6 m # beam span
    = (input)
  3 | q = 12 kN/m # uniform load (verify load combination per governing code)
    = (input)
  4 | P_mid = 20 kN # point load at midspan
    = (input)

E2  title: "Material and trial section"
  1 | f_y = 275 MPa # nominal yield strength (verify for plate/flange thickness per standard)
    = (input)
  2 | SF = 1.15 # safety factor on yield (adjust per governing code)
    = (input)
  3 | E_s = 210 GPa # steel Young's modulus (typical assumption)
    = (input)
  4 | I_y = 2770 cm^4 # trial section second moment of area (example value; enter chosen profile)
    = (input)

E3  title: "Reactions, moment, and section modulus"
  1 | # Simply supported beam with symmetric uniform and midspan point loads
  2 | R_A = q * L_b / 2 + P_mid / 2 in kN # left support reaction
    = 46 kN
  3 | R_B = R_A in kN # right support reaction
    = 46 kN
  4 | M_max = q * L_b^2 / 8 + P_mid * L_b / 4 in kN*m # maximum bending moment at midspan
    = 84 kN m
  5 | sigma_allow = f_y / SF in MPa # allowable bending stress
    = 239.1 MPa
  6 | W_req = M_max / sigma_allow in cm^3 # required elastic section modulus
    = 351.3 cm^3

E4  title: "Midspan deflection check"
  1 | # Uses the entered loads; adjust q and P_mid to serviceability (SLS) values if required
  2 | delta_max = 5 * q * L_b^4 / (384 * E_s * I_y) + P_mid * L_b^3 / (48 * E_s * I_y) in mm # midspan deflection
    = 50.28 mm
  3 | delta_lim = L_b / 250 in mm # span/250 deflection limit
    = 24 mm
  4 | util_defl = delta_max / delta_lim in % # deflection utilization
    = 209.5 %
  5 | check_defl = if(delta_max <= delta_lim, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail" # deflection check
    = Fail

```

### The answer as written

Here is a template sheet split into four math elements, placed top to bottom in reading order.

Title: Beam geometry and loads
~~~
# Self-weight is not included; add it to q if needed
L_b = 6 m # beam span
q = 12 kN/m # uniform load (verify load combination per governing code)
P_mid = 20 kN # point load at midspan
~~~

Title: Material and trial section
~~~
f_y = 275 MPa # nominal yield strength (verify for plate/flange thickness per standard)
SF = 1.15 # safety factor on yield (adjust per governing code)
E_s = 210 GPa # steel Young's modulus (typical assumption)
I_y = 2770 cm^4 # trial section second moment of area (example value; enter chosen profile)
~~~

Title: Reactions, moment, and section modulus
~~~
# Simply supported beam with symmetric uniform and midspan point loads
R_A = q * L_b / 2 + P_mid / 2 in kN # left support reaction
R_B = R_A in kN # right support reaction
M_max = q * L_b^2 / 8 + P_mid * L_b / 4 in kN*m # maximum bending moment at midspan
sigma_allow = f_y / SF in MPa # allowable bending stress
W_req = M_max / sigma_allow in cm^3 # required elastic section modulus
~~~

Title: Midspan deflection check
~~~
# Uses the entered loads; adjust q and P_mid to serviceability (SLS) values if required
delta_max = 5 * q * L_b^4 / (384 * E_s * I_y) + P_mid * L_b^3 / (48 * E_s * I_y) in mm # midspan deflection
delta_lim = L_b / 250 in mm # span/250 deflection limit
util_defl = delta_max / delta_lim in % # deflection utilization
check_defl = if(delta_max <= delta_lim, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail" # deflection check
~~~

Update `SF`, `E_s`, `I_y`, and `f_y` to match your governing standard and steel section table, and check shear capacity, lateral-torsional buckling, and ULS vs. SLS load factors separately as required.
