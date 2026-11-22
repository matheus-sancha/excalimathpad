# claude-haiku-5-5, hydro, guide whole, trial 1

Cost $0.0042, 20.7 s in all.

> Draft a sheet for the hydrostatic body test of a pressure-containing body. Rated working pressure 10000 psi, test pressure 1.5 times rated. Bore 5.125 in, outside diameter 9 in, yield strength 75 ksi. I want the test pressure in psi and MPa, the hoop stress at the bore at test pressure as a thick-walled cylinder (Lamé), the same by the thin-wall formula for comparison, a check against an allowable fraction of yield that I set as an input, two hold periods as inputs with their total time, a pass/fail line for a measured pressure drop against a drop I allow, and a table of the bore hoop stress from 0 to the test pressure in ten steps.

## First answer

20.7 s, 18513 tokens in, 4614 out.
5 elements, 33 lines, 6 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 6, note 19, display unit 8, rule 2, condition 2, range 1, table 1

**bare**

- `E2:8  wall_ratio = t_w / r_i               # wall to inside radius, for the thin-wall validity check  =  0.7561`
- `E4:4  util_L = S_L / S_allow               # utilisation, thick-walled  =  0.4355`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Hydrostatic body test: inputs
  2 | P_rated = 10000 psi                  # rated working pressure
    = (input)
  3 | k_test = 1.5                         # test factor on rated pressure (assumption, confirm at source)
    = (input)
  4 | d_bore = 5.125 in                    # bore diameter
    = (input)
  5 | D_od = 9 in                          # outside diameter
    = (input)
  6 | S_y = 75 ksi                         # yield strength
    = (input)
  7 | f_allow = 0.9                        # allowable fraction of yield (placeholder, set from code)
    = (input)
  8 | t_hold1 = 10 minute                  # hold period 1 (placeholder)
    = (input)
  9 | t_hold2 = 10 minute                  # hold period 2 (placeholder)
    = (input)
 10 | dP_allow = 5 psi                     # allowed pressure drop over the hold (placeholder)
    = (input)
 11 | dP_meas = 2 psi                      # measured pressure drop over the hold (placeholder, enter reading)
    = (input)

E2  title: "Test pressure and geometry"
  1 | # Test pressure and geometry
  2 | P_test = k_test * P_rated
    = 103.4 MPa
  3 | P_test_psi = P_test in psi           # test pressure, psi
    = 1.5·10⁴ psi
  4 | P_test_MPa = P_test in MPa           # test pressure, MPa
    = 103.4 MPa
  5 | r_i = d_bore / 2                     # inside radius
    = 65.09 mm
  6 | r_o = D_od / 2                       # outside radius
    = 114.3 mm
  7 | t_w = r_o - r_i                      # wall thickness
    = 49.21 mm
  8 | wall_ratio = t_w / r_i               # wall to inside radius, for the thin-wall validity check
    = 0.7561

E3  title: "Bore hoop stress at test pressure"
  1 | # Lamé, internal pressure only, outside at zero
  2 | S_L = P_test * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)    # hoop stress at bore, thick-walled
    = 202.7 MPa
  3 | S_L_ksi = S_L in ksi
    = 29.4 ksi
  4 | S_L_MPa = S_L in MPa
    = 202.7 MPa
  5 | # Thin-wall comparison: S = P * d / (2 t)
  6 | S_T = P_test * d_bore / (2 * t_w)                    # hoop stress, thin-walled formula
    = 136.8 MPa
  7 | S_T_ksi = S_T in ksi
    = 19.84 ksi
  8 | S_T_MPa = S_T in MPa
    = 136.8 MPa

E4  title: "Allowable check and hold"
  1 | # Allowable and pass/fail
  2 | S_allow = f_allow * S_y
    = 465.4 MPa
  3 | S_allow_ksi = S_allow in ksi
    = 67.5 ksi
  4 | util_L = S_L / S_allow               # utilisation, thick-walled
    = 0.4355
  5 | stress_check = if(S_L <= S_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass
  6 | t_total = t_hold1 + t_hold2 in minute
    = 20 minute
  7 | drop_check = if(dP_meas <= dP_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E5  title: "Bore hoop stress from 0 to test pressure"
  1 | # Ten steps from 0 to test pressure
  2 | P_step = P_test / 10
    = 10.34 MPa
  3 | P_s = 0 psi .. P_test step P_step
    = 11 values, 0 … 103.4 MPa
  4 | S_s = P_s * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
    = 11 values, 0 … 202.7 MPa
  5 | table(P_s in psi, S_s in ksi)
    = table, 11 rows; first 3:
      {P}_{s} (psi) | {S}_{s} (ksi)
      0 | 0
      1500 | 2.940
      3000 | 5.879

```

### The answer as written

Below is the draft as five math elements. Replace the two placeholder values in the Inputs element (`dP_allow` and `dP_meas`) and set `f_allow` from your governing code. The 1.5 factor, the hold times and the table's 1/10 steps are also assumptions to confirm at their source.

Title: Inputs
~~~
# Hydrostatic body test: inputs
P_rated = 10000 psi                  # rated working pressure
k_test = 1.5                         # test factor on rated pressure (assumption, confirm at source)
d_bore = 5.125 in                    # bore diameter
D_od = 9 in                          # outside diameter
S_y = 75 ksi                         # yield strength
f_allow = 0.9                        # allowable fraction of yield (placeholder, set from code)
t_hold1 = 10 minute                  # hold period 1 (placeholder)
t_hold2 = 10 minute                  # hold period 2 (placeholder)
dP_allow = 5 psi                     # allowed pressure drop over the hold (placeholder)
dP_meas = 2 psi                      # measured pressure drop over the hold (placeholder, enter reading)
~~~

Title: Test pressure and geometry
~~~
# Test pressure and geometry
P_test = k_test * P_rated
P_test_psi = P_test in psi           # test pressure, psi
P_test_MPa = P_test in MPa           # test pressure, MPa
r_i = d_bore / 2                     # inside radius
r_o = D_od / 2                       # outside radius
t_w = r_o - r_i                      # wall thickness
wall_ratio = t_w / r_i               # wall to inside radius, for the thin-wall validity check
~~~

Title: Bore hoop stress at test pressure
~~~
# Lamé, internal pressure only, outside at zero
S_L = P_test * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)    # hoop stress at bore, thick-walled
S_L_ksi = S_L in ksi
S_L_MPa = S_L in MPa
# Thin-wall comparison: S = P * d / (2 t)
S_T = P_test * d_bore / (2 * t_w)                    # hoop stress, thin-walled formula
S_T_ksi = S_T in ksi
S_T_MPa = S_T in MPa
~~~

Title: Allowable check and hold
~~~
# Allowable and pass/fail
S_allow = f_allow * S_y
S_allow_ksi = S_allow in ksi
util_L = S_L / S_allow               # utilisation, thick-walled
stress_check = if(S_L <= S_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
t_total = t_hold1 + t_hold2 in minute
drop_check = if(dP_meas <= dP_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Bore hoop stress from 0 to test pressure
~~~
# Ten steps from 0 to test pressure
P_step = P_test / 10
P_s = 0 psi .. P_test step P_step
S_s = P_s * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
table(P_s in psi, S_s in ksi)
~~~

Things to check at source:
- The Lamé form above is for internal pressure with the outside at zero. The thin-wall formula's validity limit depends on the wall ratio (`wall_ratio`) and must be checked against your code.
- The thin-wall result is shown for comparison only; the pass/fail uses the Lamé value.
- `f_allow`, `k_test` and the hold times need their values from your code or procedure.
- The table has 11 rows: the 0 row plus ten steps.
