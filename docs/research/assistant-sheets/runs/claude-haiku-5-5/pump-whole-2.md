# claude-haiku-5-5, pump, guide whole, trial 2

Cost $0.0115, 70.4 s in all.

> I want to size a centrifugal pump. Water at 20 °C, 30 L/s, from an open tank to another one 12 m higher, through 85 m of 4 inch schedule 40 steel pipe with two 90° elbows and a gate valve. Draft a sheet I can use as a template: velocity, Reynolds number, friction factor (solve Colebrook), system head and shaft power at 70 % efficiency, a check that velocity is under 3 m/s, then the operating point against a pump curve H = 28 m - k Q^2 that I can edit, a table of system head and pump head over 0 to 40 L/s, and a plot of both curves.

## First answer

35.8 s, 18490 tokens in, 8000 out.
0 elements, 0 lines, 0 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: 

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

```

### The answer as written



## After one repair turn

34.6 s, 18569 tokens in, 7499 out.
7 elements, 35 lines, 1 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 1, note 15, rule 1, condition 1, solve 2, display unit 6, range 2, table 1, plot 1

**bare**

- `E1:13  K_t = K_ent + 2 K_elb + K_gate + K_exit   # total minor loss coefficient  =  3.17`
- `E3:2  f_d = colebrook(Re_d, r_d)  =  0.01759`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Inputs: edit these. Check each value at its source.
  2 | Q_d = 30 L/s                       # design flow
    = (input)
  3 | D = 102.3 mm                       # ID, 4 in sch 40: check at source
    = (input)
  4 | eps_r = 0.045 mm                   # steel roughness: check at source
    = (input)
  5 | rho = 998 kg/m^3                   # water at 20 degC: check at source
    = (input)
  6 | mu = 1.002 cP                      # dynamic viscosity at 20 degC: check at source
    = (input)
  7 | L_p = 85 m                         # pipe length
    = (input)
  8 | z_s = 12 m                         # static lift, tank to tank
    = (input)
  9 | K_ent = 0.5                        # entrance loss: check at source
    = (input)
 10 | K_elb = 0.75                       # one 90 deg elbow, each: check at source
    = (input)
 11 | K_gate = 0.17                      # gate valve, open: check at source
    = (input)
 12 | K_exit = 1.0                       # exit into tank: check at source
    = (input)
 13 | K_t = K_ent + 2 K_elb + K_gate + K_exit   # total minor loss coefficient
    = 3.17
 14 | eta_p = 0.70                       # pump efficiency, 70 %
    = (input)
 15 | H_0 = 28 m                         # pump head at no flow (curve: H = H_0 - k_p (Q/(1 L/s))^2)
    = (input)
 16 | k_p = 0.0034 m                     # pump curve coefficient: edit to move the curve
    = (input)

E2  title: "Velocity and Reynolds number"
  1 | A_p = pi D^2 / 4
    = 82.19 cm^2
  2 | v_d = Q_d / A_p @text-blue
    = 3.65 m / s
  3 | check_v = if(v_d < 3 m/s, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Fail
  4 | Re_d = rho v_d D / mu
    = 3.719·10⁵
  5 | r_d = eps_r / D
    = 4.399·10⁻⁴

E3  title: "Friction factor (Colebrook)"
  1 | colebrook(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02
    = (function)
  2 | f_d = colebrook(Re_d, r_d)
    = 0.01759
    solve: {"method":"Brent","iterations":6,"evaluations":10,"residual":"-8.881784197001·10⁻¹⁶","bracket":"0.01758855071188 .. 0.01758855071189"}

E4  title: "System head and shaft power"
  1 | h_f_d = (f_d * L_p / D + K_t) * v_d^2 / (2 * gravity) in m
    = 12.08 m
  2 | K_sys = h_f_d / (Q_d / (1 L/s))^2
    = 13.42 mm
  3 | H_sys(Q) = z_s + K_sys * (Q / (1 L/s))^2
    = (function)
  4 | H_pump(Q) = H_0 - k_p * (Q / (1 L/s))^2
    = (function)
  5 | H_d = H_sys(Q_d) in m
    = 24.08 m
  6 | P_d = rho * gravity * Q_d * H_d / eta_p in kW
    = 10.1 kW

E5  title: "Operating point"
  1 | Q_op = solve H_pump(Q) = H_sys(Q), for Q = 1 L/s .. 60 L/s in L/s
    = 30.84 L / s
    solve: {"method":"scan","range":"1 .. 60 L / s","points":200,"roots":[{"value":"30.8409725695 L / s","residual":"-7.105427357601·10⁻¹⁵ m","touching":false}],"rejected":0}
  2 | H_op = H_sys(Q_op) in m
    = 24.77 m
  3 | P_op = rho * gravity * Q_op * H_op / eta_p in kW
    = 10.68 kW

E6  title: "Table of heads"
  1 | Q_t = 0 L/s .. 40 L/s step 5 L/s
    = 9 values, 0 … 40 L / s
  2 | table(Q_t in L/s, H_sys(Q_t) in m, H_pump(Q_t) in m)
    = table, 9 rows; first 3:
      {Q}_{t} (L / s) | {H}_{\mathrm{sys}}\left( {Q}_{t}\right) (m) | {H}_{\mathrm{pump}}\left( {Q}_{t}\right) (m)
      0 | 12.00 | 28.00
      5 | 12.34 | 27.92
      10 | 13.34 | 27.66

E7  title: "Pump and system curves"
  1 | Q_c = 0 L/s .. 40 L/s step 2 L/s
    = 21 values, 0 … 40 L / s
  2 | plot(Q_c in L/s, H_sys(Q_c) in m, H_pump(Q_c) in m), mark Q_op, labels direct, title "Pump and system curves"
    = plot, 21 points, 2 series, 0 dots, 0 circles, 0 failed; x Q_c [L/s], y H_sys(Q_c), H_pump(Q_c) [m]

```

### The answer as written

I don't have the listing with your sheet's results, errors and warnings, so I can't tell which lines failed. Rather than guess at fixes, I've written the sheet again from the Math guide's rules. I haven't run it, so paste the listing if any line still fails. Check the pipe ID, roughness, loss coefficients and water properties at their sources. The values below are placeholders.

Expect the velocity check to fail. A 4 in pipe at 30 L/s runs at about 3.6 m/s, above your 3 m/s limit. The sheet will show this, and it may mean a larger pipe.

Title: Inputs
~~~sheet
# Inputs: edit these. Check each value at its source.
Q_d = 30 L/s                       # design flow
D = 102.3 mm                       # ID, 4 in sch 40: check at source
eps_r = 0.045 mm                   # steel roughness: check at source
rho = 998 kg/m^3                   # water at 20 degC: check at source
mu = 1.002 cP                      # dynamic viscosity at 20 degC: check at source
L_p = 85 m                         # pipe length
z_s = 12 m                         # static lift, tank to tank
K_ent = 0.5                        # entrance loss: check at source
K_elb = 0.75                       # one 90 deg elbow, each: check at source
K_gate = 0.17                      # gate valve, open: check at source
K_exit = 1.0                       # exit into tank: check at source
K_t = K_ent + 2 K_elb + K_gate + K_exit   # total minor loss coefficient
eta_p = 0.70                       # pump efficiency, 70 %
H_0 = 28 m                         # pump head at no flow (curve: H = H_0 - k_p (Q/(1 L/s))^2)
k_p = 0.0034 m                     # pump curve coefficient: edit to move the curve
~~~

Title: Velocity and Reynolds number
~~~sheet
A_p = pi D^2 / 4
v_d = Q_d / A_p @text-blue
check_v = if(v_d < 3 m/s, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
Re_d = rho v_d D / mu
r_d = eps_r / D
~~~

Title: Friction factor (Colebrook)
~~~sheet
colebrook(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02
f_d = colebrook(Re_d, r_d)
~~~

Title: System head and shaft power
~~~sheet
h_f_d = (f_d * L_p / D + K_t) * v_d^2 / (2 * gravity) in m
K_sys = h_f_d / (Q_d / (1 L/s))^2
H_sys(Q) = z_s + K_sys * (Q / (1 L/s))^2
H_pump(Q) = H_0 - k_p * (Q / (1 L/s))^2
H_d = H_sys(Q_d) in m
P_d = rho * gravity * Q_d * H_d / eta_p in kW
~~~

Title: Operating point
~~~sheet
Q_op = solve H_pump(Q) = H_sys(Q), for Q = 1 L/s .. 60 L/s in L/s
H_op = H_sys(Q_op) in m
P_op = rho * gravity * Q_op * H_op / eta_p in kW
~~~

Title: Table of heads
~~~sheet
Q_t = 0 L/s .. 40 L/s step 5 L/s
table(Q_t in L/s, H_sys(Q_t) in m, H_pump(Q_t) in m)
~~~

Title: Pump and system curves
~~~sheet
Q_c = 0 L/s .. 40 L/s step 2 L/s
plot(Q_c in L/s, H_sys(Q_c) in m, H_pump(Q_c) in m), mark Q_op, labels direct, title "Pump and system curves"
~~~
