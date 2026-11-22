# claude-sonnet-5-5, pump, guide whole, trial 2

Cost $0.1024, 46.9 s in all.

> I want to size a centrifugal pump. Water at 20 °C, 30 L/s, from an open tank to another one 12 m higher, through 85 m of 4 inch schedule 40 steel pipe with two 90° elbows and a gate valve. Draft a sheet I can use as a template: velocity, Reynolds number, friction factor (solve Colebrook), system head and shaft power at 70 % efficiency, a check that velocity is under 3 m/s, then the operating point against a pump curve H = 28 m - k Q^2 that I can edit, a table of system head and pump head over 0 to 40 L/s, and a plot of both curves.

## First answer

46.9 s, 18490 tokens in, 6539 out.
5 elements, 43 lines, 3 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 3, note 12, display unit 11, solve 2, rule 2, condition 3, range 2, table 1, plot 1

**bare**

- `E1:17  K_tot = n_elbow * K_elbow + K_gate + K_in + K_out  =  3.5`
- `E2:6  f_d = f_c(Re, r_rel)  =  0.01759`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs and assumptions"
  1 | # Water at 20 degC: check the properties at their source
  2 | rho = 998 kg/m^3
    = (input)
  3 | mu_w = 1.002 cP
    = (input)
  4 | Q_d = 30 L/s
    = (input)
  5 | # Pipe: 4 in schedule 40 steel
  6 | D = 102.3 mm # inner diameter, check against the pipe table
    = (input)
  7 | L_p = 85 m
    = (input)
  8 | e_abs = 0.045 mm # roughness for commercial steel, check at source
    = (input)
  9 | dz = 12 m # static lift between the two free surfaces
    = (input)
 10 | dp_t = 0 bar # both tanks open to atmosphere
    = (input)
 11 | # Fittings: loss coefficients are assumptions, check at source
 12 | n_elbow = 2
    = (input)
 13 | K_elbow = 0.9 # per 90 degree elbow
    = (input)
 14 | K_gate = 0.2 # gate valve, fully open
    = (input)
 15 | K_in = 0.5 # tank to pipe entrance, delete if not wanted
    = (input)
 16 | K_out = 1 # pipe to tank exit, delete if not wanted
    = (input)
 17 | K_tot = n_elbow * K_elbow + K_gate + K_in + K_out
    = 3.5
 18 | eta = 0.70 # pump and shaft efficiency
    = (input)
 19 | v_max = 3 m/s # velocity limit
    = (input)

E2  title: "Duty point"
  1 | A_p = pi * D^2 / 4 in cm^2
    = 82.19 cm^2
  2 | v_d = Q_d / A_p in m/s
    = 3.65 m / s
  3 | Re = rho * v_d * D / mu_w
    = 3.719·10⁵
  4 | r_rel = e_abs / D
    = 4.399·10⁻⁴
  5 | f_c(Re_n, r_q) = solve 1/sqrt(f) = -2 log10(r_q/3.7 + 2.51/(Re_n * sqrt(f))), guess f = 0.02
    = (function)
  6 | f_d = f_c(Re, r_rel)
    = 0.01759
    solve: {"method":"Brent","iterations":6,"evaluations":10,"residual":"-8.881784197001·10⁻¹⁶","bracket":"0.01758855071188 .. 0.01758855071189"}
  7 | H_static = dz + dp_t / (rho * gravity) in m
    = 12 m
  8 | h_f = f_d * (L_p / D) * v_d^2 / (2 * gravity) in m
    = 9.926 m
  9 | h_m = K_tot * v_d^2 / (2 * gravity) in m
    = 2.377 m
 10 | H_req = H_static + h_f + h_m in m
    = 24.3 m
 11 | P_h = rho * gravity * Q_d * H_req in kW
    = 7.136 kW
 12 | P_sh = P_h / eta in kW
    = 10.19 kW
 13 | check_v = if(v_d <= v_max, "OK", "Too fast") @text-green if result == "OK" @text-red if result == "Too fast"
    = Too fast

E3  title: "Pump curve, system curve and operating point"
  1 | H_0 = 28 m # shutoff head
    = (input)
  2 | k_p = 0.002 m / (L/s)^2 # placeholder, take it from the pump curve you have
    = (input)
  3 | Hp(Q_x) = H_0 - k_p * Q_x^2
    = (function)
  4 | Hs(Q_x) = if(Q_x <= 0 L/s, H_static, H_static + (f_c(rho * (Q_x / A_p) * D / mu_w, r_rel) * L_p / D + K_tot) * (Q_x / A_p)^2 / (2 * gravity))
    = (function)
  5 | Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 40 L/s in L/s
    = 32 L / s
    solve: {"method":"scan","range":"1 .. 40 L / s","points":200,"roots":[{"value":"32.00090172013 L / s","residual":"7.105427357601·10⁻¹⁵ m","touching":false}],"rejected":0}
  6 | H_op = Hp(Q_op) in m
    = 25.95 m
  7 | P_op = rho * gravity * Q_op * H_op / eta in kW
    = 11.61 kW
  8 | check_q = if(Q_op >= Q_d, "Meets duty flow", "Short of duty flow") @text-green if result == "Meets duty flow" @text-red if result != "Meets duty flow"
    = Meets duty flow

E4  title: "System head and pump head"
  1 | Q_t = 0 L/s .. 40 L/s step 5 L/s
    = 9 values, 0 … 40 L / s
  2 | H_sys = Hs(Q_t)
    = 9 values, 12 … 33.57 m
  3 | H_pump = Hp(Q_t)
    = 9 values, 28 … 24.8 m
  4 | table(Q_t in L/s, H_sys in m, H_pump in m)
    = table, 9 rows; first 3:
      {Q}_{t} (L / s) | {H}_{\mathrm{sys}} (m) | {H}_{\mathrm{pump}} (m)
      0 | 12.00 | 28.00
      5 | 12.40 | 27.95
      10 | 13.49 | 27.80

E5  title: "Curves"
  1 | Q_p = 0 L/s .. 40 L/s step 1 L/s
    = 41 values, 0 … 40 L / s
  2 | plot(Q_p in L/s, Hs(Q_p) in m, Hp(Q_p) in m), mark Q_op, title "System and pump curves"
    = plot, 41 points, 2 series, 0 dots, 0 circles, 0 failed; x Q_p [L/s], y Hs(Q_p), Hp(Q_p) [m]

```

### The answer as written

Place the five elements in this order, one under the other, because each line only sees names above it.

Title: Inputs and assumptions
~~~
# Water at 20 degC: check the properties at their source
rho = 998 kg/m^3
mu_w = 1.002 cP
Q_d = 30 L/s
# Pipe: 4 in schedule 40 steel
D = 102.3 mm # inner diameter, check against the pipe table
L_p = 85 m
e_abs = 0.045 mm # roughness for commercial steel, check at source
dz = 12 m # static lift between the two free surfaces
dp_t = 0 bar # both tanks open to atmosphere
# Fittings: loss coefficients are assumptions, check at source
n_elbow = 2
K_elbow = 0.9 # per 90 degree elbow
K_gate = 0.2 # gate valve, fully open
K_in = 0.5 # tank to pipe entrance, delete if not wanted
K_out = 1 # pipe to tank exit, delete if not wanted
K_tot = n_elbow * K_elbow + K_gate + K_in + K_out
eta = 0.70 # pump and shaft efficiency
v_max = 3 m/s # velocity limit
~~~

Title: Duty point
~~~
A_p = pi * D^2 / 4 in cm^2
v_d = Q_d / A_p in m/s
Re = rho * v_d * D / mu_w
r_rel = e_abs / D
f_c(Re_n, r_q) = solve 1/sqrt(f) = -2 log10(r_q/3.7 + 2.51/(Re_n * sqrt(f))), guess f = 0.02
f_d = f_c(Re, r_rel)
H_static = dz + dp_t / (rho * gravity) in m
h_f = f_d * (L_p / D) * v_d^2 / (2 * gravity) in m
h_m = K_tot * v_d^2 / (2 * gravity) in m
H_req = H_static + h_f + h_m in m
P_h = rho * gravity * Q_d * H_req in kW
P_sh = P_h / eta in kW
check_v = if(v_d <= v_max, "OK", "Too fast") @text-green if result == "OK" @text-red if result == "Too fast"
~~~

Title: Pump curve, system curve and operating point
~~~
H_0 = 28 m # shutoff head
k_p = 0.002 m / (L/s)^2 # placeholder, take it from the pump curve you have
Hp(Q_x) = H_0 - k_p * Q_x^2
Hs(Q_x) = if(Q_x <= 0 L/s, H_static, H_static + (f_c(rho * (Q_x / A_p) * D / mu_w, r_rel) * L_p / D + K_tot) * (Q_x / A_p)^2 / (2 * gravity))
Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 40 L/s in L/s
H_op = Hp(Q_op) in m
P_op = rho * gravity * Q_op * H_op / eta in kW
check_q = if(Q_op >= Q_d, "Meets duty flow", "Short of duty flow") @text-green if result == "Meets duty flow" @text-red if result != "Meets duty flow"
~~~

Title: System head and pump head
~~~
Q_t = 0 L/s .. 40 L/s step 5 L/s
H_sys = Hs(Q_t)
H_pump = Hp(Q_t)
table(Q_t in L/s, H_sys in m, H_pump in m)
~~~

Title: Curves
~~~
Q_p = 0 L/s .. 40 L/s step 1 L/s
plot(Q_p in L/s, Hs(Q_p) in m, Hp(Q_p) in m), mark Q_op, title "System and pump curves"
~~~

- **Velocity check:** with a 102.3 mm bore, 30 L/s is about twice the guide's 15 L/s example (1.825 m/s). I expect `check_v` to read "Too fast". That is what the check is for, so try a larger pipe in `D` and compare.
- **Check at source:** the inner diameter, the roughness, the water properties and every K value are my assumptions, not facts. The entrance and exit losses are included as assumptions, and you can remove them.
- **Pump curve:** `k_p` is only a placeholder so that the curves cross. Replace `H_0` and `k_p` with your pump's data, and `Q_op` follows.
- **Not covered:** the sheet has no NPSH or suction-side check, and the shaft power uses a single 70 % efficiency, also at the operating point.
