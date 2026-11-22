# claude-sonnet-5-5, hydro, guide whole, trial 2

Cost $0.0764, 29.4 s in all.

> Draft a sheet for the hydrostatic body test of a pressure-containing body. Rated working pressure 10000 psi, test pressure 1.5 times rated. Bore 5.125 in, outside diameter 9 in, yield strength 75 ksi. I want the test pressure in psi and MPa, the hoop stress at the bore at test pressure as a thick-walled cylinder (Lamé), the same by the thin-wall formula for comparison, a check against an allowable fraction of yield that I set as an input, two hold periods as inputs with their total time, a pass/fail line for a measured pressure drop against a drop I allow, and a table of the bore hoop stress from 0 to the test pressure in ten steps.

## First answer

29.4 s, 18513 tokens in, 3935 out.
4 elements, 28 lines, 3 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 3, note 15, display unit 7, rule 2, condition 2, range 1, table 1

**bare**

- `E2:10  err_thin = (sigma_thin / sigma_L - 1) * 100    # percent, thin-wall vs Lame  =  -32.51`
- `E3:2  util = sigma_L / S_allow * 100                 # percent of allowable used  =  48.99`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Hydrostatic body test: inputs
  2 | p_r = 10000 psi          # rated working pressure
    = (input)
  3 | k_t = 1.5                # test factor on rated pressure
    = (input)
  4 | D_i = 5.125 in           # bore
    = (input)
  5 | D_o = 9 in               # outside diameter
    = (input)
  6 | S_y = 75 ksi             # yield strength
    = (input)
  7 | f_a = 0.8                # allowable fraction of yield: placeholder, set per your spec
    = (input)
  8 | t_h1 = 3 minute          # first hold period: placeholder
    = (input)
  9 | t_h2 = 15 minute         # second hold period: placeholder
    = (input)
 10 | dp_allow = 100 psi       # allowed pressure drop over the hold: placeholder
    = (input)
 11 | dp_meas = 40 psi         # measured pressure drop: enter the reading
    = (input)

E2  title: "Test pressure and bore hoop stress"
  1 | p_t = k_t * p_r in psi
    = 1.5·10⁴ psi
  2 | p_t in MPa
    = 103.4 MPa
  3 | r_i = D_i / 2
    = 65.09 mm
  4 | r_o = D_o / 2
    = 114.3 mm
  5 | t_w = r_o - r_i in in    # wall thickness
    = 1.938 in
  6 | # Lame, internal pressure only: hoop stress at the bore
  7 | sigma_L = p_t * (r_o^2 + r_i^2) / (r_o^2 - r_i^2) in ksi
    = 29.4 ksi
  8 | # Thin wall, on the bore diameter, for comparison only
  9 | sigma_thin = p_t * D_i / (2 t_w) in ksi
    = 19.84 ksi
 10 | err_thin = (sigma_thin / sigma_L - 1) * 100    # percent, thin-wall vs Lame
    = -32.51
 11 | t_w / r_i                                      # wall to bore radius ratio
    = 0.7561

E3  title: "Checks"
  1 | S_allow = f_a * S_y in ksi
    = 60 ksi
  2 | util = sigma_L / S_allow * 100                 # percent of allowable used
    = 48.99
  3 | check_S = if(sigma_L <= S_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass
  4 | t_hold = t_h1 + t_h2 in minute                 # total hold time
    = 18 minute
  5 | check_dp = if(dp_meas <= dp_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E4  title: "Bore hoop stress versus pressure"
  1 | i_s = 0 .. 10
    = 11 values, 0 … 10
  2 | p_s = i_s / 10 * p_t
    = 11 values, 0 … 103.4 MPa
  3 | sigma_s = p_s * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
    = 11 values, 0 … 202.7 MPa
  4 | table(p_s in psi, p_s in MPa, sigma_s in ksi)
    = table, 11 rows; first 3:
      {p}_{s} (psi) | {p}_{s} (MPa) | {\sigma}_{s} (ksi)
      0 | 0 | 0
      1500 | 10.34 | 2.940
      3000 | 20.68 | 5.879

```

### The answer as written

Placeholders to replace: `f_a`, `t_h1`, `t_h2`, `dp_allow` and `dp_meas`. Take them from your governing specification or procedure.

Title: Inputs
~~~
# Hydrostatic body test: inputs
p_r = 10000 psi          # rated working pressure
k_t = 1.5                # test factor on rated pressure
D_i = 5.125 in           # bore
D_o = 9 in               # outside diameter
S_y = 75 ksi             # yield strength
f_a = 0.8                # allowable fraction of yield: placeholder, set per your spec
t_h1 = 3 minute          # first hold period: placeholder
t_h2 = 15 minute         # second hold period: placeholder
dp_allow = 100 psi       # allowed pressure drop over the hold: placeholder
dp_meas = 40 psi         # measured pressure drop: enter the reading
~~~

Title: Test pressure and bore hoop stress
~~~
p_t = k_t * p_r in psi
p_t in MPa
r_i = D_i / 2
r_o = D_o / 2
t_w = r_o - r_i in in    # wall thickness
# Lame, internal pressure only: hoop stress at the bore
sigma_L = p_t * (r_o^2 + r_i^2) / (r_o^2 - r_i^2) in ksi
# Thin wall, on the bore diameter, for comparison only
sigma_thin = p_t * D_i / (2 t_w) in ksi
err_thin = (sigma_thin / sigma_L - 1) * 100    # percent, thin-wall vs Lame
t_w / r_i                                      # wall to bore radius ratio
~~~

Title: Checks
~~~
S_allow = f_a * S_y in ksi
util = sigma_L / S_allow * 100                 # percent of allowable used
check_S = if(sigma_L <= S_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
t_hold = t_h1 + t_h2 in minute                 # total hold time
check_dp = if(dp_meas <= dp_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Bore hoop stress versus pressure
~~~
i_s = 0 .. 10
p_s = i_s / 10 * p_t
sigma_s = p_s * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
table(p_s in psi, p_s in MPa, sigma_s in ksi)
~~~

The table uses the index `i_s / 10`, so its last row is exactly the test pressure. Four things are outside what the sheet can say:

- The thin-wall result is shown for comparison only. The wall is thick for the bore (`t_w / r_i` is large), so Lamé governs and the thin-wall figure will read low.
- The Lamé line covers internal pressure only. It does not include end loads, thermal effects, or stress concentrations at openings and transitions.
- Whether the allowable fraction applies to hoop stress alone or to a combined stress is for you to confirm at your specification.
- The sheet does not check a pressure drop against the hold times. Make sure the allowed drop in `dp_allow` is meant for the total hold in `t_hold`, or for each period separately.
