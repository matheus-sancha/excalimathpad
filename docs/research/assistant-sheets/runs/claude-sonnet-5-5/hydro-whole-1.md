# claude-sonnet-5-5, hydro, guide whole, trial 1

Cost $0.1360, 40.4 s in all.

> Draft a sheet for the hydrostatic body test of a pressure-containing body. Rated working pressure 10000 psi, test pressure 1.5 times rated. Bore 5.125 in, outside diameter 9 in, yield strength 75 ksi. I want the test pressure in psi and MPa, the hoop stress at the bore at test pressure as a thick-walled cylinder (Lamé), the same by the thin-wall formula for comparison, a check against an allowable fraction of yield that I set as an input, two hold periods as inputs with their total time, a pass/fail line for a measured pressure drop against a drop I allow, and a table of the bore hoop stress from 0 to the test pressure in ten steps.

## First answer

31.9 s, 18513 tokens in, 4412 out.
5 elements, 29 lines, 4 comment lines; 0 errors, 1 warnings, 0 with failed points.
Forms: comment 4, note 10, display unit 12, rule 2, condition 2, range 1, table 1

**warnings**

- `E3:10  diff = (sigma_thin - sigma_L) / sigma_L in %  →  diff shadows the built-in diff`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Hydrostatic body test: inputs
  2 | p_r = 10000 psi # rated working pressure
    = (input)
  3 | k_t = 1.5 # test factor on rated pressure; confirm it in your governing spec
    = (input)
  4 | D_i = 5.125 in # bore
    = (input)
  5 | D_o = 9 in # outside diameter
    = (input)
  6 | S_y = 75 ksi # yield strength
    = (input)
  7 | f_a = 0.8 # allowable fraction of yield: placeholder, set yours
    = (input)
  8 | t_h1 = 3 minute # first hold: placeholder
    = (input)
  9 | t_h2 = 15 minute # second hold: placeholder
    = (input)
 10 | dp_allow = 100 psi # allowed pressure drop over the holds: placeholder
    = (input)
 11 | dp_meas = 40 psi # measured pressure drop: replace with the test reading
    = (input)

E2  title: "Test pressure"
  1 | p_t = k_t * p_r in psi
    = 1.5·10⁴ psi
  2 | p_t in MPa
    = 103.4 MPa

E3  title: "Bore hoop stress"
  1 | # Lamé, internal pressure only, hoop stress at the bore
  2 | r_i = D_i / 2 in in
    = 2.563 in
  3 | r_o = D_o / 2 in in
    = 4.5 in
  4 | t_w = r_o - r_i in in
    = 1.938 in
  5 | sig_h(p_x) = p_x * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
    = (function)
  6 | sigma_L = sig_h(p_t) in ksi
    = 29.4 ksi
  7 | sigma_L in MPa
    = 202.7 MPa
  8 | # Thin-wall comparison, on the inside diameter
  9 | sigma_thin = p_t * D_i / (2 t_w) in ksi
    = 19.84 ksi
 10 | diff = (sigma_thin - sigma_L) / sigma_L in %
    = -32.51 %
    ~ warning: diff shadows the built-in diff
 11 | # Check against the allowable fraction of yield
 12 | sigma_allow = f_a * S_y in ksi
    = 60 ksi
 13 | used = sigma_L / sigma_allow in %
    = 48.99 %
 14 | check_s = if(sigma_L <= sigma_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E4  title: "Holds and pressure drop"
  1 | t_hold = t_h1 + t_h2 in minute
    = 18 minute
  2 | check_dp = if(dp_meas <= dp_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E5  title: "Bore hoop stress vs pressure"
  1 | n_s = 0 .. 10
    = 11 values, 0 … 10
  2 | p_s = n_s / 10 * p_t
    = 11 values, 0 … 103.4 MPa
  3 | sigma_s = sig_h(p_s)
    = 11 values, 0 … 202.7 MPa
  4 | table(p_s in psi, sigma_s in ksi)
    = table, 11 rows; first 3:
      {p}_{s} (psi) | {\sigma}_{s} (ksi)
      0 | 0
      1500 | 2.940
      3000 | 5.879

```

### The answer as written

Title: Inputs
~~~
# Hydrostatic body test: inputs
p_r = 10000 psi # rated working pressure
k_t = 1.5 # test factor on rated pressure; confirm it in your governing spec
D_i = 5.125 in # bore
D_o = 9 in # outside diameter
S_y = 75 ksi # yield strength
f_a = 0.8 # allowable fraction of yield: placeholder, set yours
t_h1 = 3 minute # first hold: placeholder
t_h2 = 15 minute # second hold: placeholder
dp_allow = 100 psi # allowed pressure drop over the holds: placeholder
dp_meas = 40 psi # measured pressure drop: replace with the test reading
~~~

Title: Test pressure
~~~
p_t = k_t * p_r in psi
p_t in MPa
~~~

Title: Bore hoop stress
~~~
# Lamé, internal pressure only, hoop stress at the bore
r_i = D_i / 2 in in
r_o = D_o / 2 in in
t_w = r_o - r_i in in
sig_h(p_x) = p_x * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
sigma_L = sig_h(p_t) in ksi
sigma_L in MPa
# Thin-wall comparison, on the inside diameter
sigma_thin = p_t * D_i / (2 t_w) in ksi
diff = (sigma_thin - sigma_L) / sigma_L in %
# Check against the allowable fraction of yield
sigma_allow = f_a * S_y in ksi
used = sigma_L / sigma_allow in %
check_s = if(sigma_L <= sigma_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Holds and pressure drop
~~~
t_hold = t_h1 + t_h2 in minute
check_dp = if(dp_meas <= dp_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Bore hoop stress vs pressure
~~~
n_s = 0 .. 10
p_s = n_s / 10 * p_t
sigma_s = sig_h(p_s)
table(p_s in psi, sigma_s in ksi)
~~~

- **Placeholders:** `f_a`, both hold times, `dp_allow` and `dp_meas` are values I made up so the sheet runs. Take the test factor, hold durations, allowable stress fraction and drop criterion from the governing spec or your test procedure.
- **Thin-wall comparison:** the wall is thick relative to the bore, so the thin-wall formula is outside its usual range. Treat it only as a comparison, and check its validity limit at its source.
- **Not covered:** the sheet checks only the bore hoop stress. It does not check axial or equivalent stress, end effects, or stress concentrations.

## After one repair turn

8.5 s, 20863 tokens in, 1309 out.
5 elements, 29 lines, 4 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 4, note 10, display unit 12, rule 2, condition 2, range 1, table 1

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Hydrostatic body test: inputs
  2 | p_r = 10000 psi # rated working pressure
    = (input)
  3 | k_t = 1.5 # test factor on rated pressure; confirm it in your governing spec
    = (input)
  4 | D_i = 5.125 in # bore
    = (input)
  5 | D_o = 9 in # outside diameter
    = (input)
  6 | S_y = 75 ksi # yield strength
    = (input)
  7 | f_a = 0.8 # allowable fraction of yield: placeholder, set yours
    = (input)
  8 | t_h1 = 3 minute # first hold: placeholder
    = (input)
  9 | t_h2 = 15 minute # second hold: placeholder
    = (input)
 10 | dp_allow = 100 psi # allowed pressure drop over the holds: placeholder
    = (input)
 11 | dp_meas = 40 psi # measured pressure drop: replace with the test reading
    = (input)

E2  title: "Test pressure"
  1 | p_t = k_t * p_r in psi
    = 1.5·10⁴ psi
  2 | p_t in MPa
    = 103.4 MPa

E3  title: "Bore hoop stress"
  1 | # Lamé, internal pressure only, hoop stress at the bore
  2 | r_i = D_i / 2 in in
    = 2.563 in
  3 | r_o = D_o / 2 in in
    = 4.5 in
  4 | t_w = r_o - r_i in in
    = 1.938 in
  5 | sig_h(p_x) = p_x * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
    = (function)
  6 | sigma_L = sig_h(p_t) in ksi
    = 29.4 ksi
  7 | sigma_L in MPa
    = 202.7 MPa
  8 | # Thin-wall comparison, on the inside diameter
  9 | sigma_thin = p_t * D_i / (2 t_w) in ksi
    = 19.84 ksi
 10 | dev_thin = (sigma_thin - sigma_L) / sigma_L in %
    = -32.51 %
 11 | # Check against the allowable fraction of yield
 12 | sigma_allow = f_a * S_y in ksi
    = 60 ksi
 13 | used = sigma_L / sigma_allow in %
    = 48.99 %
 14 | check_s = if(sigma_L <= sigma_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E4  title: "Holds and pressure drop"
  1 | t_hold = t_h1 + t_h2 in minute
    = 18 minute
  2 | check_dp = if(dp_meas <= dp_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E5  title: "Bore hoop stress vs pressure"
  1 | n_s = 0 .. 10
    = 11 values, 0 … 10
  2 | p_s = n_s / 10 * p_t
    = 11 values, 0 … 103.4 MPa
  3 | sigma_s = sig_h(p_s)
    = 11 values, 0 … 202.7 MPa
  4 | table(p_s in psi, sigma_s in ksi)
    = table, 11 rows; first 3:
      {p}_{s} (psi) | {\sigma}_{s} (ksi)
      0 | 0
      1500 | 2.940
      3000 | 5.879

```

### The answer as written

The only line with a warning was [E3:10]: `diff` is a built-in function name. I renamed it to `dev_thin`. No line had an error. Nothing else changed.

Title: Inputs
~~~
# Hydrostatic body test: inputs
p_r = 10000 psi # rated working pressure
k_t = 1.5 # test factor on rated pressure; confirm it in your governing spec
D_i = 5.125 in # bore
D_o = 9 in # outside diameter
S_y = 75 ksi # yield strength
f_a = 0.8 # allowable fraction of yield: placeholder, set yours
t_h1 = 3 minute # first hold: placeholder
t_h2 = 15 minute # second hold: placeholder
dp_allow = 100 psi # allowed pressure drop over the holds: placeholder
dp_meas = 40 psi # measured pressure drop: replace with the test reading
~~~

Title: Test pressure
~~~
p_t = k_t * p_r in psi
p_t in MPa
~~~

Title: Bore hoop stress
~~~
# Lamé, internal pressure only, hoop stress at the bore
r_i = D_i / 2 in in
r_o = D_o / 2 in in
t_w = r_o - r_i in in
sig_h(p_x) = p_x * (r_o^2 + r_i^2) / (r_o^2 - r_i^2)
sigma_L = sig_h(p_t) in ksi
sigma_L in MPa
# Thin-wall comparison, on the inside diameter
sigma_thin = p_t * D_i / (2 t_w) in ksi
dev_thin = (sigma_thin - sigma_L) / sigma_L in %
# Check against the allowable fraction of yield
sigma_allow = f_a * S_y in ksi
used = sigma_L / sigma_allow in %
check_s = if(sigma_L <= sigma_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Holds and pressure drop
~~~
t_hold = t_h1 + t_h2 in minute
check_dp = if(dp_meas <= dp_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Bore hoop stress vs pressure
~~~
n_s = 0 .. 10
p_s = n_s / 10 * p_t
sigma_s = sig_h(p_s)
table(p_s in psi, sigma_s in ksi)
~~~

What I checked: the units carry through, and the Lamé line [E3:5] uses the inside and outside radii as a bore-pressure formula should. The thin-wall result [E3:9] is about 33 % below the Lamé result, which fits a wall this thick. The thin-wall formula is outside its usual range here, so use it only as a comparison.

What I could not check: the placeholders (`f_a`, `t_h1`, `t_h2`, `dp_allow`, `dp_meas`) and the test factor `k_t` must come from your spec or test procedure. The sheet checks only the bore hoop stress, so axial and equivalent stress, end effects and stress concentrations are not covered.
