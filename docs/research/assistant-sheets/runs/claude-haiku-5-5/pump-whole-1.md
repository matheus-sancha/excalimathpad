# claude-haiku-5-5, pump, guide whole, trial 1

Cost $0.0063, 39.1 s in all.

> I want to size a centrifugal pump. Water at 20 °C, 30 L/s, from an open tank to another one 12 m higher, through 85 m of 4 inch schedule 40 steel pipe with two 90° elbows and a gate valve. Draft a sheet I can use as a template: velocity, Reynolds number, friction factor (solve Colebrook), system head and shaft power at 70 % efficiency, a check that velocity is under 3 m/s, then the operating point against a pump curve H = 28 m - k Q^2 that I can edit, a table of system head and pump head over 0 to 40 L/s, and a plot of both curves.

## First answer

39.1 s, 18490 tokens in, 9001 out.
7 elements, 38 lines, 5 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 5, note 14, solve 2, condition 2, display unit 7, rule 1, range 2, table 1, plot 1

**bare**

- `E2:4  K_tot = K_in + K_out + N_elb * K_elb + K_gv  =  3.5`
- `E3:3  f_d = fcol(Re_d, rr)  =  0.01765`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Inputs: check every value marked "check at source"
  2 | rho = 998 kg/m^3 # water at 20 °C: check at source
    = (input)
  3 | mu_w = 1.002 cP # water at 20 °C: check at source
    = (input)
  4 | Q_d = 30 L/s # design flow
    = (input)
  5 | D = 102.3 mm # 4 in schedule 40 inside diameter: check at source
    = (input)
  6 | eps_r = 0.046 mm # steel roughness: check at source
    = (input)
  7 | L_p = 85 m # pipe length
    = (input)
  8 | z_h = 12 m # static lift, tank surface to tank surface
    = (input)
  9 | eta = 0.7 # pump efficiency at the design point
    = (input)
 10 | N_elb = 2 # 90° elbows
    = (input)
 11 | K_elb = 0.9 # loss coefficient per elbow: check at source
    = (input)
 12 | K_gv = 0.2 # gate valve, fully open: check at source
    = (input)
 13 | K_in = 0.5 # tank entrance: check at source
    = (input)
 14 | K_out = 1.0 # discharge into the tank: check at source
    = (input)

E2  title: "Friction and system curve"
  1 | # Colebrook friction factor, solved implicitly
  2 | fcol(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02
    = (function)
  3 | rr = eps_r / D
    = 4.497·10⁻⁴
  4 | K_tot = K_in + K_out + N_elb * K_elb + K_gv
    = 3.5
  5 | A_p = pi D^2 / 4
    = 82.19 cm^2
  6 | vel(Q) = Q / A_p
    = (function)
  7 | Rey(Q) = rho * vel(Q) * D / mu_w
    = (function)
  8 | # At zero flow there is no friction, so the solve is skipped
  9 | Hsys(Q) = if(Q <= 0 L/s, z_h, z_h + fcol(Rey(Q), rr) * (L_p/D) * vel(Q)^2 / (2 gravity) + K_tot * vel(Q)^2 / (2 gravity))
    = (function)

E3  title: "Design flow"
  1 | v_d = Q_d / A_p
    = 3.65 m / s
  2 | Re_d = rho * v_d * D / mu_w
    = 3.719·10⁵
  3 | f_d = fcol(Re_d, rr)
    = 0.01765
    solve: {"method":"Brent","iterations":6,"evaluations":10,"residual":"-8.881784197001·10⁻¹⁶","bracket":"0.01764922022002 .. 0.01764922022003"}
  4 | hf_d = f_d * (L_p/D) * v_d^2 / (2 gravity) in m
    = 9.96 m
  5 | hm_d = K_tot * v_d^2 / (2 gravity) in m
    = 2.377 m
  6 | H_d = Hsys(Q_d) in m
    = 24.34 m
  7 | P_d = rho * gravity * Q_d * H_d / eta in kW
    = 10.21 kW

E4  title: "Velocity check"
  1 | # Limit of 3 m/s: check it against your own design standard
  2 | check_v = if(v_d <= 3 m/s, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Fail

E5  title: "Pump curve and operating point"
  1 | # Pump curve H = H_0 - k_p (Q/(1 L/s))^2: replace k_p with your pump's data
  2 | H_0 = 28 m
    = (input)
  3 | k_p = 0.01 m # head lost per (L/s)^2: placeholder, editable
    = (input)
  4 | Hpump(Q) = H_0 - k_p * (Q / (1 L/s))^2
    = (function)
  5 | Q_op = solve Hpump(Q) = Hsys(Q), for Q = 1 L/s .. 40 L/s in L/s
    = 25.92 L / s
    solve: {"method":"scan","range":"1 .. 40 L / s","points":200,"roots":[{"value":"25.91662991174 L / s","residual":"0 m","touching":false}],"rejected":0}
  6 | H_op = Hpump(Q_op) in m
    = 21.28 m
  7 | P_op = rho * gravity * Q_op * H_op / eta in kW
    = 7.712 kW

E6  title: "Head table"
  1 | Q_t = 0 L/s .. 40 L/s step 5 L/s
    = 9 values, 0 … 40 L / s
  2 | table(Q_t in L/s, Hsys(Q_t) in m, Hpump(Q_t) in m)
    = table, 9 rows; first 3:
      {Q}_{t} (L / s) | \mathit{Hsys}\left( {Q}_{t}\right) (m) | \mathit{Hpump}\left( {Q}_{t}\right) (m)
      0 | 12.00 | 28.00
      5 | 12.40 | 27.75
      10 | 13.49 | 27.00

E7  title: "Curves plot"
  1 | Q_c = 0 L/s .. 40 L/s step 1 L/s
    = 41 values, 0 … 40 L / s
  2 | plot(Q_c, Hsys(Q_c), Hpump(Q_c)), mark Q_op, labels direct, title "Pump and system curves"
    = plot, 41 points, 2 series, 0 dots, 0 circles, 0 failed; x Q_c [L/s], y Hsys(Q_c), Hpump(Q_c) [m]

```

### The answer as written

Here is the sheet as six math elements. Paste each block into its own element, in order. The inputs marked "check at source" are my placeholders, not verified values. The pump coefficient `k_p` is also a placeholder until you take it from your pump's curve. At 30 L/s in 102.3 mm pipe the velocity check may fail, so watch that line.

Title: Inputs

~~~
# Inputs: check every value marked "check at source"
rho = 998 kg/m^3 # water at 20 °C: check at source
mu_w = 1.002 cP # water at 20 °C: check at source
Q_d = 30 L/s # design flow
D = 102.3 mm # 4 in schedule 40 inside diameter: check at source
eps_r = 0.046 mm # steel roughness: check at source
L_p = 85 m # pipe length
z_h = 12 m # static lift, tank surface to tank surface
eta = 0.7 # pump efficiency at the design point
N_elb = 2 # 90° elbows
K_elb = 0.9 # loss coefficient per elbow: check at source
K_gv = 0.2 # gate valve, fully open: check at source
K_in = 0.5 # tank entrance: check at source
K_out = 1.0 # discharge into the tank: check at source
~~~

Title: Friction and system curve

~~~
# Colebrook friction factor, solved implicitly
fcol(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02
rr = eps_r / D
K_tot = K_in + K_out + N_elb * K_elb + K_gv
A_p = pi D^2 / 4
vel(Q) = Q / A_p
Rey(Q) = rho * vel(Q) * D / mu_w
# At zero flow there is no friction, so the solve is skipped
Hsys(Q) = if(Q <= 0 L/s, z_h, z_h + fcol(Rey(Q), rr) * (L_p/D) * vel(Q)^2 / (2 gravity) + K_tot * vel(Q)^2 / (2 gravity))
~~~

Title: Design flow

~~~
v_d = Q_d / A_p
Re_d = rho * v_d * D / mu_w
f_d = fcol(Re_d, rr)
hf_d = f_d * (L_p/D) * v_d^2 / (2 gravity) in m
hm_d = K_tot * v_d^2 / (2 gravity) in m
H_d = Hsys(Q_d) in m
P_d = rho * gravity * Q_d * H_d / eta in kW
~~~

Title: Velocity check

~~~
# Limit of 3 m/s: check it against your own design standard
check_v = if(v_d <= 3 m/s, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
~~~

Title: Pump curve and operating point

~~~
# Pump curve H = H_0 - k_p (Q/(1 L/s))^2: replace k_p with your pump's data
H_0 = 28 m
k_p = 0.01 m # head lost per (L/s)^2: placeholder, editable
Hpump(Q) = H_0 - k_p * (Q / (1 L/s))^2
Q_op = solve Hpump(Q) = Hsys(Q), for Q = 1 L/s .. 40 L/s in L/s
H_op = Hpump(Q_op) in m
P_op = rho * gravity * Q_op * H_op / eta in kW
~~~

Title: Head table

~~~
Q_t = 0 L/s .. 40 L/s step 5 L/s
table(Q_t in L/s, Hsys(Q_t) in m, Hpump(Q_t) in m)
~~~

Title: Curves plot

~~~
Q_c = 0 L/s .. 40 L/s step 1 L/s
plot(Q_c, Hsys(Q_c), Hpump(Q_c)), mark Q_op, labels direct, title "Pump and system curves"
~~~
