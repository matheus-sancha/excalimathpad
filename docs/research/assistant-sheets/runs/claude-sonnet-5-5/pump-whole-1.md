# claude-sonnet-5-5, pump, guide whole, trial 1

Cost $0.1153, 55.7 s in all.

> I want to size a centrifugal pump. Water at 20 °C, 30 L/s, from an open tank to another one 12 m higher, through 85 m of 4 inch schedule 40 steel pipe with two 90° elbows and a gate valve. Draft a sheet I can use as a template: velocity, Reynolds number, friction factor (solve Colebrook), system head and shaft power at 70 % efficiency, a check that velocity is under 3 m/s, then the operating point against a pump curve H = 28 m - k Q^2 that I can edit, a table of system head and pump head over 0 to 40 L/s, and a plot of both curves.

## First answer

55.7 s, 18490 tokens in, 7836 out.
5 elements, 40 lines, 3 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 3, note 18, display unit 9, solve 2, rule 2, condition 3, range 2, table 1, plot 1

**bare**

- `E1:16  K_t = n_el * K_el + K_gv + K_inlet + K_exit  =  3.5`
- `E2:6  f_d = f_c(Re_d, r_d)  =  0.01759`

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Inputs"
  1 | # Water at 20 degC, open tank to open tank
  2 | rho_w = 998 kg/m^3 # density, check at its source
    = (input)
  3 | mu_w = 1.002 cP # dynamic viscosity, check at its source
    = (input)
  4 | Q_d = 30 L/s # design flow
    = (input)
  5 | dz = 12 m # level difference; open tanks, so no pressure or surface velocity terms
    = (input)
  6 | # 4 in schedule 40 steel pipe
  7 | D = 102.3 mm # inside diameter, check against the pipe table
    = (input)
  8 | eps_p = 0.045 mm # absolute roughness of commercial steel, check
    = (input)
  9 | L_p = 85 m # pipe length
    = (input)
 10 | # Minor losses, all K values are assumptions to check
 11 | n_el = 2 # number of 90 degree elbows
    = (input)
 12 | K_el = 0.9 # per elbow, depends on type
    = (input)
 13 | K_gv = 0.2 # gate valve, fully open
    = (input)
 14 | K_inlet = 0.5 # tank outlet
    = (input)
 15 | K_exit = 1 # exit into the tank
    = (input)
 16 | K_t = n_el * K_el + K_gv + K_inlet + K_exit
    = 3.5
 17 | eta_p = 0.7 # pump efficiency
    = (input)
 18 | v_max = 3 m/s # velocity limit
    = (input)

E2  title: "Design point"
  1 | A_p = pi D^2 / 4 in cm^2
    = 82.19 cm^2
  2 | v_d = Q_d / A_p in m/s
    = 3.65 m / s
  3 | Re_d = rho_w v_d D / mu_w
    = 3.719·10⁵
  4 | r_d = eps_p / D
    = 4.399·10⁻⁴
  5 | f_c(Re_x, r_x) = solve 1/sqrt(f) = -2 log10(r_x/3.7 + 2.51/(Re_x sqrt(f))), guess f = 0.02
    = (function)
  6 | f_d = f_c(Re_d, r_d)
    = 0.01759
    solve: {"method":"Brent","iterations":6,"evaluations":10,"residual":"-8.881784197001·10⁻¹⁶","bracket":"0.01758855071188 .. 0.01758855071189"}
  7 | h_fr = f_d * (L_p / D) * v_d^2 / (2 gravity) in m
    = 9.926 m
  8 | h_mi = K_t * v_d^2 / (2 gravity) in m
    = 2.377 m
  9 | H_d = dz + h_fr + h_mi in m
    = 24.3 m
 10 | P_sh = rho_w gravity Q_d H_d / eta_p in kW
    = 10.19 kW
 11 | check_v = if(v_d <= v_max, "Velocity OK", "Velocity too high") @text-green if result == "Velocity OK" @text-red if result != "Velocity OK"
    = Velocity too high

E3  title: "Operating point"
  1 | v_f(Q) = Q / A_p
    = (function)
  2 | Re_f(Q) = rho_w * v_f(Q) * D / mu_w
    = (function)
  3 | Hs(Q) = if(Q > 0 L/s, dz + (f_c(Re_f(Q), r_d) * L_p / D + K_t) * v_f(Q)^2 / (2 gravity), dz) # system head
    = (function)
  4 | H_sh = 28 m # pump shutoff head
    = (input)
  5 | k_p = 0.002 m/(L/s)^2 # placeholder, set it from the pump's data
    = (input)
  6 | Hp(Q) = H_sh - k_p * Q^2 # pump head
    = (function)
  7 | Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 40 L/s in L/s
    = 32 L / s
    solve: {"method":"scan","range":"1 .. 40 L / s","points":200,"roots":[{"value":"32.00090172013 L / s","residual":"7.105427357601·10⁻¹⁵ m","touching":false}],"rejected":0}
  8 | H_op = Hp(Q_op) in m
    = 25.95 m
  9 | P_op = rho_w gravity Q_op H_op / eta_p in kW
    = 11.61 kW
 10 | check_q = if(Q_op >= Q_d, "Pump meets the design flow", "Pump falls short of the design flow") @text-green if result == "Pump meets the design flow" @text-red if result != "Pump meets the design flow"
    = Pump meets the design flow

E4  title: "System and pump head table"
  1 | Q_t = 0 L/s .. 40 L/s step 5 L/s
    = 9 values, 0 … 40 L / s
  2 | table(Q_t in L/s, Hs(Q_t) in m, Hp(Q_t) in m)
    = table, 9 rows; first 3:
      {Q}_{t} (L / s) | \mathit{Hs}\left( {Q}_{t}\right) (m) | \mathit{Hp}\left( {Q}_{t}\right) (m)
      0 | 12.00 | 28.00
      5 | 12.40 | 27.95
      10 | 13.49 | 27.80

E5  title: "System and pump curves"
  1 | Q_p = 0 L/s .. 40 L/s step 1 L/s
    = 41 values, 0 … 40 L / s
  2 | plot(Q_p in L/s, Hs(Q_p) in m, Hp(Q_p) in m), mark Q_op, labels direct, title "System and pump curves"
    = plot, 41 points, 2 series, 0 dots, 0 circles, 0 failed; x Q_p [L/s], y Hs(Q_p), Hp(Q_p) [m]

```

### The answer as written

Place the elements top to bottom in this order. Each line sees only the names above it.

Title: Inputs
~~~
# Water at 20 degC, open tank to open tank
rho_w = 998 kg/m^3 # density, check at its source
mu_w = 1.002 cP # dynamic viscosity, check at its source
Q_d = 30 L/s # design flow
dz = 12 m # level difference; open tanks, so no pressure or surface velocity terms
# 4 in schedule 40 steel pipe
D = 102.3 mm # inside diameter, check against the pipe table
eps_p = 0.045 mm # absolute roughness of commercial steel, check
L_p = 85 m # pipe length
# Minor losses, all K values are assumptions to check
n_el = 2 # number of 90 degree elbows
K_el = 0.9 # per elbow, depends on type
K_gv = 0.2 # gate valve, fully open
K_inlet = 0.5 # tank outlet
K_exit = 1 # exit into the tank
K_t = n_el * K_el + K_gv + K_inlet + K_exit
eta_p = 0.7 # pump efficiency
v_max = 3 m/s # velocity limit
~~~

Title: Design point
~~~
A_p = pi D^2 / 4 in cm^2
v_d = Q_d / A_p in m/s
Re_d = rho_w v_d D / mu_w
r_d = eps_p / D
f_c(Re_x, r_x) = solve 1/sqrt(f) = -2 log10(r_x/3.7 + 2.51/(Re_x sqrt(f))), guess f = 0.02
f_d = f_c(Re_d, r_d)
h_fr = f_d * (L_p / D) * v_d^2 / (2 gravity) in m
h_mi = K_t * v_d^2 / (2 gravity) in m
H_d = dz + h_fr + h_mi in m
P_sh = rho_w gravity Q_d H_d / eta_p in kW
check_v = if(v_d <= v_max, "Velocity OK", "Velocity too high") @text-green if result == "Velocity OK" @text-red if result != "Velocity OK"
~~~

Title: Operating point
~~~
v_f(Q) = Q / A_p
Re_f(Q) = rho_w * v_f(Q) * D / mu_w
Hs(Q) = if(Q > 0 L/s, dz + (f_c(Re_f(Q), r_d) * L_p / D + K_t) * v_f(Q)^2 / (2 gravity), dz) # system head
H_sh = 28 m # pump shutoff head
k_p = 0.002 m/(L/s)^2 # placeholder, set it from the pump's data
Hp(Q) = H_sh - k_p * Q^2 # pump head
Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 40 L/s in L/s
H_op = Hp(Q_op) in m
P_op = rho_w gravity Q_op H_op / eta_p in kW
check_q = if(Q_op >= Q_d, "Pump meets the design flow", "Pump falls short of the design flow") @text-green if result == "Pump meets the design flow" @text-red if result != "Pump meets the design flow"
~~~

Title: System and pump head table
~~~
Q_t = 0 L/s .. 40 L/s step 5 L/s
table(Q_t in L/s, Hs(Q_t) in m, Hp(Q_t) in m)
~~~

Title: System and pump curves
~~~
Q_p = 0 L/s .. 40 L/s step 1 L/s
plot(Q_p in L/s, Hs(Q_p) in m, Hp(Q_p) in m), mark Q_op, labels direct, title "System and pump curves"
~~~

- **Assumptions to check at their source:** the water properties, the 102.3 mm bore, the roughness and every K value are my placeholders, not verified data. `k_p` is only a curve shape; replace it, and `H_sh`, with the real pump data.
- **Velocity:** a 4 inch pipe at 30 L/s may well fail the `v_max` check. If it does, change `D` and see how the rest follows.
- **Zero flow:** `Hs` returns `dz` at zero flow. Without that branch the Colebrook solve would divide by zero in the first row of the table and the plot.
- **Shaft power:** `P_sh` is at the design flow on the system curve. `P_op` is at the operating point, which is where the pump will actually run.
