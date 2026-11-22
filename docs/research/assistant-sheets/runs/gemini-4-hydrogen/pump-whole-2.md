# gemini-4-hydrogen, pump, guide whole, trial 2

Cost $0.1120, 253.0 s in all.

> I want to size a centrifugal pump. Water at 20 °C, 30 L/s, from an open tank to another one 12 m higher, through 85 m of 4 inch schedule 40 steel pipe with two 90° elbows and a gate valve. Draft a sheet I can use as a template: velocity, Reynolds number, friction factor (solve Colebrook), system head and shaft power at 70 % efficiency, a check that velocity is under 3 m/s, then the operating point against a pump curve H = 28 m - k Q^2 that I can edit, a table of system head and pump head over 0 to 40 L/s, and a plot of both curves.

## First answer

253.0 s, 14467 tokens in, 12034 out.
5 elements, 42 lines, 3 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: note 16, comment 3, display unit 9, rule 1, condition 3, solve 2, range 2, table 1, plot 1

**bare**

- `E3:2  f_d = f_c(Re_d, rel_eps)  =  0.01759`
- `E3:3  K_tot = n_elbow * K_elbow + K_valve + K_ent + K_exit  =  3.5`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Design inputs & fluid properties"
  1 | Q_d = 30 L/s # design flow rate
    = (input)
  2 | # Water at 20 degC (check fluid property table)
  3 | rho = 998.2 kg/m^3 # water density
    = (input)
  4 | mu_w = 1.002 cP # water dynamic viscosity
    = (input)
  5 | eta_p = 0.70 # pump efficiency (70 %)
    = (input)
  6 | # Pipe & fittings (check pipe and K-factor sources)
  7 | dZ = 12 m # elevation rise between open tanks
    = (input)
  8 | L_p = 85 m # pipe length
    = (input)
  9 | D_p = 102.3 mm # 4 in Sch 40 steel pipe ID
    = (input)
 10 | eps = 0.045 mm # commercial steel roughness
    = (input)
 11 | n_elbow = 2 # number of 90 deg elbows
    = (input)
 12 | K_elbow = 0.9 # K-factor per 90 deg elbow
    = (input)
 13 | K_valve = 0.2 # K-factor for open gate valve
    = (input)
 14 | K_ent = 0.5 # tank-to-pipe entrance loss
    = (input)
 15 | K_exit = 1.0 # pipe-to-tank exit loss
    = (input)

E2  title: "Pipe velocity & Reynolds number"
  1 | A_p = pi * D_p^2 / 4 in cm^2
    = 82.19 cm^2
  2 | v_d = Q_d / A_p in m/s
    = 3.65 m / s
  3 | v_max = 3 m/s # velocity limit
    = (input)
  4 | v_check = if(v_d < v_max, "OK", "Exceeds 3 m/s") @text-green if result == "OK" @text-red if result != "OK"
    = Exceeds 3 m/s
  5 | Re_d = rho * v_d * D_p / mu_w
    = 3.72·10⁵
  6 | rel_eps = eps / D_p
    = 4.399·10⁻⁴

E3  title: "Friction, system head & shaft power"
  1 | f_c(Re, r) = solve 1/sqrt(f) = -2 * log10(r/3.7 + 2.51/(Re * sqrt(f))), guess f = 0.02
    = (function)
  2 | f_d = f_c(Re_d, rel_eps)
    = 0.01759
    solve: {"method":"Brent","iterations":6,"evaluations":10,"residual":"8.881784197001·10⁻¹⁶","bracket":"0.01758831546268 .. 0.01758831546269"}
  3 | K_tot = n_elbow * K_elbow + K_valve + K_ent + K_exit
    = 3.5
  4 | h_f = f_d * (L_p / D_p) * v_d^2 / (2 * gravity) in m
    = 9.926 m
  5 | h_m = K_tot * v_d^2 / (2 * gravity) in m
    = 2.377 m
  6 | H_sys = dZ + h_f + h_m in m
    = 24.3 m
  7 | P_hyd = rho * gravity * Q_d * H_sys in kW
    = 7.137 kW
  8 | P_shaft = P_hyd / eta_p in kW
    = 10.2 kW

E4  title: "Pump curve & operating point"
  1 | # Editable pump curve: H = H_0 - k_p * Q^2
  2 | H_0 = 28 m # shutoff head
    = (input)
  3 | k_p = 0.004 m / (1 L/s)^2 # pump curve coefficient
    = 4000 s^2 / m^5
  4 | Hp(Q) = H_0 - k_p * Q^2
    = (function)
  5 | v_Q(Q) = Q / A_p
    = (function)
  6 | Re_Q(Q) = rho * v_Q(Q) * D_p / mu_w
    = (function)
  7 | f_Q(Re, r) = if(Re < 2300, 64 / Re, f_c(Re, r))
    = (function)
  8 | Hs(Q) = dZ + if(Q <= 0 L/s, 0 m, (f_Q(Re_Q(Q), rel_eps) * (L_p / D_p) + K_tot) * v_Q(Q)^2 / (2 * gravity))
    = (function)
  9 | Q_op = solve Hp(Q) = Hs(Q), for Q = 0 L/s .. 50 L/s in L/s
    = 30.09 L / s
    solve: {"method":"scan","range":"0 .. 50 L / s","points":200,"roots":[{"value":"30.09297919817 L / s","residual":"0 m","touching":false}],"rejected":0}
 10 | H_op = Hp(Q_op) in m
    = 24.38 m

E5  title: "System vs. pump curve (0 to 40 L/s)"
  1 | Q_t = 0 L/s .. 40 L/s step 5 L/s
    = 9 values, 0 … 40 L / s
  2 | Hs_t = Hs(Q_t)
    = 9 values, 12 … 33.57 m
  3 | Hp_t = Hp(Q_t)
    = 9 values, 28 … 21.6 m
  4 | table(Q_t in L/s, Hs_t in m, Hp_t in m)
    = table, 9 rows; first 3:
      {Q}_{t} (L / s) | {\mathit{Hs}}_{t} (m) | {\mathit{Hp}}_{t} (m)
      0 | 12.00 | 28.00
      5 | 12.40 | 27.90
      10 | 13.49 | 27.60
  5 | Q_p = 0 L/s .. 40 L/s step 1 L/s
    = 41 values, 0 … 40 L / s
  6 | plot(Q_p in L/s, Hp(Q_p) in m, Hs(Q_p) in m), mark Q_op, title "System vs. pump curve"
    = plot, 41 points, 2 series, 0 dots, 0 circles, 0 failed; x Q_p [L/s], y Hp(Q_p), Hs(Q_p) [m]

```

### The answer as written

Title: Design inputs & fluid properties
~~~
Q_d = 30 L/s # design flow rate
# Water at 20 degC (check fluid property table)
rho = 998.2 kg/m^3 # water density
mu_w = 1.002 cP # water dynamic viscosity
eta_p = 0.70 # pump efficiency (70 %)
# Pipe & fittings (check pipe and K-factor sources)
dZ = 12 m # elevation rise between open tanks
L_p = 85 m # pipe length
D_p = 102.3 mm # 4 in Sch 40 steel pipe ID
eps = 0.045 mm # commercial steel roughness
n_elbow = 2 # number of 90 deg elbows
K_elbow = 0.9 # K-factor per 90 deg elbow
K_valve = 0.2 # K-factor for open gate valve
K_ent = 0.5 # tank-to-pipe entrance loss
K_exit = 1.0 # pipe-to-tank exit loss
~~~

Title: Pipe velocity & Reynolds number
~~~
A_p = pi * D_p^2 / 4 in cm^2
v_d = Q_d / A_p in m/s
v_max = 3 m/s # velocity limit
v_check = if(v_d < v_max, "OK", "Exceeds 3 m/s") @text-green if result == "OK" @text-red if result != "OK"
Re_d = rho * v_d * D_p / mu_w
rel_eps = eps / D_p
~~~

Title: Friction, system head & shaft power
~~~
f_c(Re, r) = solve 1/sqrt(f) = -2 * log10(r/3.7 + 2.51/(Re * sqrt(f))), guess f = 0.02
f_d = f_c(Re_d, rel_eps)
K_tot = n_elbow * K_elbow + K_valve + K_ent + K_exit
h_f = f_d * (L_p / D_p) * v_d^2 / (2 * gravity) in m
h_m = K_tot * v_d^2 / (2 * gravity) in m
H_sys = dZ + h_f + h_m in m
P_hyd = rho * gravity * Q_d * H_sys in kW
P_shaft = P_hyd / eta_p in kW
~~~

Title: Pump curve & operating point
~~~
# Editable pump curve: H = H_0 - k_p * Q^2
H_0 = 28 m # shutoff head
k_p = 0.004 m / (1 L/s)^2 # pump curve coefficient
Hp(Q) = H_0 - k_p * Q^2
v_Q(Q) = Q / A_p
Re_Q(Q) = rho * v_Q(Q) * D_p / mu_w
f_Q(Re, r) = if(Re < 2300, 64 / Re, f_c(Re, r))
Hs(Q) = dZ + if(Q <= 0 L/s, 0 m, (f_Q(Re_Q(Q), rel_eps) * (L_p / D_p) + K_tot) * v_Q(Q)^2 / (2 * gravity))
Q_op = solve Hp(Q) = Hs(Q), for Q = 0 L/s .. 50 L/s in L/s
H_op = Hp(Q_op) in m
~~~

Title: System vs. pump curve (0 to 40 L/s)
~~~
Q_t = 0 L/s .. 40 L/s step 5 L/s
Hs_t = Hs(Q_t)
Hp_t = Hp(Q_t)
table(Q_t in L/s, Hs_t in m, Hp_t in m)
Q_p = 0 L/s .. 40 L/s step 1 L/s
plot(Q_p in L/s, Hp(Q_p) in m, Hs(Q_p) in m), mark Q_op, title "System vs. pump curve"
~~~

Check the assumed water properties (`rho`, `mu_w`), 4 in Sch 40 inside diameter (`D_p`), commercial steel roughness (`eps`), and fitting/entrance/exit loss coefficients (`K_elbow`, `K_valve`, `K_ent`, `K_exit`) against your engineering references. Edit `H_0` and `k_p` to match your candidate pump curve; if `Q_op` falls above `50 L/s`, widen the search range in the `Q_op` solve line.
