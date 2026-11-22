# claude-haiku-5-5, hydro, guide whole, trial 2

Cost $0.0049, 26.0 s in all.

> Draft a sheet for the hydrostatic body test of a pressure-containing body. Rated working pressure 10000 psi, test pressure 1.5 times rated. Bore 5.125 in, outside diameter 9 in, yield strength 75 ksi. I want the test pressure in psi and MPa, the hoop stress at the bore at test pressure as a thick-walled cylinder (Lamé), the same by the thin-wall formula for comparison, a check against an allowable fraction of yield that I set as an input, two hold periods as inputs with their total time, a pass/fail line for a measured pressure drop against a drop I allow, and a table of the bore hoop stress from 0 to the test pressure in ten steps.

## First answer

26.0 s, 18513 tokens in, 6009 out.
6 elements, 26 lines, 1 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 1, note 14, display unit 7, rule 2, condition 2, range 1, table 1

**bare**

- `E4:2  margin = 1 - sigma_L / S_all # fraction of allowable not used  =  0.3423`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Hydrostatic body test
  2 | P_r = 10000 psi # rated working pressure
    = (input)
  3 | k_t = 1.5 # test factor on rated pressure, set from your standard
    = (input)
  4 | d_i = 5.125 in # bore
    = (input)
  5 | d_o = 9 in # outside diameter
    = (input)
  6 | S_y = 75 ksi # yield strength of the body material
    = (input)
  7 | f_a = 0.9 # allowable fraction of yield, set from your standard
    = (input)
  8 | t_h1 = 10 minute # first hold period, set from your procedure
    = (input)
  9 | t_h2 = 30 minute # second hold period, set from your procedure
    = (input)
 10 | dP_meas = 25 psi # measured pressure drop over the hold, enter the test reading
    = (input)
 11 | dP_allow = 100 psi # pressure drop allowed, set from your standard
    = (input)

E2  title: "Test pressure"
  1 | P_t = k_t * P_r in psi
    = 1.5·10⁴ psi
  2 | P_t in MPa
    = 103.4 MPa

E3  title: "Hoop stress at the bore"
  1 | r_i = d_i / 2
    = 65.09 mm
  2 | r_o = d_o / 2
    = 114.3 mm
  3 | sigma_L = 2 * P_t * r_o^2 / (r_o^2 - r_i^2) in ksi # Lame thick-walled, at the bore
    = 44.4 ksi
  4 | t_w = (d_o - d_i) / 2
    = 49.21 mm
  5 | sigma_T = P_t * d_i / (2 * t_w) in ksi # thin-wall, for comparison only
    = 19.84 ksi

E4  title: "Check against allowable"
  1 | S_all = f_a * S_y in ksi
    = 67.5 ksi
  2 | margin = 1 - sigma_L / S_all # fraction of allowable not used
    = 0.3423
  3 | chk_yield = if(sigma_L <= S_all, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E5  title: "Hold and pressure drop"
  1 | t_tot = t_h1 + t_h2 in minute # total hold time
    = 40 minute
  2 | chk_drop = if(dP_meas <= dP_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass

E6  title: "Bore hoop stress from 0 to test pressure"
  1 | dP_step = P_t / 10
    = 10.34 MPa
  2 | P_s = 0 psi .. P_t step dP_step
    = 11 values, 0 … 103.4 MPa
  3 | sig_s = 2 * P_s * r_o^2 / (r_o^2 - r_i^2) in ksi
    = 11 values, 0 … 44.4 ksi
  4 | table(P_s in psi, sig_s in ksi)
    = table, 11 rows; first 3:
      {P}_{s} (psi) | {\mathit{sig}}_{s} (ksi)
      0 | 0
      1500 | 4.440
      3000 | 8.879

```

### The answer as written

Title: Inputs
~~~
# Hydrostatic body test
P_r = 10000 psi # rated working pressure
k_t = 1.5 # test factor on rated pressure, set from your standard
d_i = 5.125 in # bore
d_o = 9 in # outside diameter
S_y = 75 ksi # yield strength of the body material
f_a = 0.9 # allowable fraction of yield, set from your standard
t_h1 = 10 minute # first hold period, set from your procedure
t_h2 = 30 minute # second hold period, set from your procedure
dP_meas = 25 psi # measured pressure drop over the hold, enter the test reading
dP_allow = 100 psi # pressure drop allowed, set from your standard
~~~

Title: Test pressure
~~~
P_t = k_t * P_r in psi
P_t in MPa
~~~

Title: Hoop stress at the bore
~~~
r_i = d_i / 2
r_o = d_o / 2
sigma_L = 2 * P_t * r_o^2 / (r_o^2 - r_i^2) in ksi # Lame thick-walled, at the bore
t_w = (d_o - d_i) / 2
sigma_T = P_t * d_i / (2 * t_w) in ksi # thin-wall, for comparison only
~~~

Title: Check against allowable
~~~
S_all = f_a * S_y in ksi
margin = 1 - sigma_L / S_all # fraction of allowable not used
chk_yield = if(sigma_L <= S_all, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Hold and pressure drop
~~~
t_tot = t_h1 + t_h2 in minute # total hold time
chk_drop = if(dP_meas <= dP_allow, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Bore hoop stress from 0 to test pressure
~~~
dP_step = P_t / 10
P_s = 0 psi .. P_t step dP_step
sig_s = 2 * P_s * r_o^2 / (r_o^2 - r_i^2) in ksi
table(P_s in psi, sig_s in ksi)
~~~

The hold times, the drop allowance and the fraction of yield are placeholders: set them from your procedure and standard, and enter the measured drop. The thin-wall line is for comparison only; whether it applies at this outside-to-bore ratio must be checked at the source of your standard. The table's last row should read the test pressure; if it doesn't, the step didn't land on the end.
