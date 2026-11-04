"""Reference calc for the Excalimathpad v1 acceptance sheet (pump sizing).

Plain floats in SI base units, no math.js, so it checks the app independently.
Run: python pump-sizing.py
"""
from math import log10, pi, sqrt

# Inputs
rho = 998.2          # kg/m^3, water 20 C
mu = 1.002e-3        # Pa s (1.002 cP)
L = 150.0            # m
eps = 0.045e-3       # m, commercial steel
K = 4 * 0.9 + 2 * 0.15 + 0.5 + 1.0   # 4 elbows, 2 gate valves, entry, exit
dz = 12.0            # m
g_n = 9.80665        # m/s^2
Q_d = 15e-3          # m^3/s (15 L/s)
eta = 0.70
H_0, H_r, Q_r = 25.0, 20.0, 20e-3    # pump: shutoff head, rated head at rated flow


def bisect(fn, a, b, tol=1e-15):
    fa = fn(a)
    for _ in range(200):
        m = (a + b) / 2
        fm = fn(m)
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
        if b - a < tol:
            break
    return (a + b) / 2


def colebrook(Re, r):
    return bisect(lambda f: 1 / sqrt(f) + 2 * log10(r / 3.7 + 2.51 / (Re * sqrt(f))), 1e-4, 1.0)


def sheet(D):
    A = pi * D**2 / 4
    v = lambda Q: Q / A
    Re = lambda Q: rho * v(Q) * D / mu
    Hs = lambda Q: dz + (colebrook(Re(Q), eps / D) * L / D + K) * v(Q) ** 2 / (2 * g_n)
    Hp = lambda Q: H_0 - (H_0 - H_r) * (Q / Q_r) ** 2

    v_d, Re_d = v(Q_d), Re(Q_d)
    f_d = colebrook(Re_d, eps / D)
    H_d = Hs(Q_d)
    Q_op = bisect(lambda Q: Hp(Q) - Hs(Q), 1e-3, 30e-3)
    H_op = Hp(Q_op)
    lines = [
        ("K", K, 1, ""),
        ("A", A, 1e-4, "cm^2"),
        ("eps/D", eps / D, 1, ""),
        ("v_d", v_d, 1, "m/s"),
        ("Re_d", Re_d, 1, ""),
        ("f_d", f_d, 1, ""),
        ("dP_pipe", f_d * L / D * rho * v_d**2 / 2, 1e3, "kPa"),
        ("dP_K", K * rho * v_d**2 / 2, 1e3, "kPa"),
        ("dP_z", rho * g_n * dz, 1e3, "kPa"),
        ("H_d", H_d, 1, "m"),
        ("P_d", rho * g_n * Q_d * H_d / eta, 1e3, "kW"),
        ("Q_op", Q_op, 1e-3, "L/s"),
        ("H_op", H_op, 1, "m"),
        ("P_op", rho * g_n * Q_op * H_op / eta, 1e3, "kW"),
    ]
    table = [(q, Hs(q / 1000), Hp(q / 1000)) for q in range(1, 31)]
    return lines, table


for D_mm in (102.3, 128.2):
    lines, table = sheet(D_mm / 1000)
    print(f"\n## D = {D_mm} mm\n")
    print("| Line | Expected |\n|---|---|")
    for name, val, scale, unit in lines:
        print(f"| `{name}` | {val / scale:.4g} {unit} |")
    print("\n| Qs [L/s] | Hs [m] | Hp [m] |\n|---|---|---|")
    for q, hs, hp in table:
        print(f"| {q} | {hs:.4g} | {hp:.4g} |")
