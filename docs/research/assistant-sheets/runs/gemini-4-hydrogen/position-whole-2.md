# gemini-4-hydrogen, position, guide whole, trial 2

Cost $0.0335, 213.3 s in all.

> Hole position check to ASME Y14.5, RFS. Measured deviation from true position: dx = 0.08 mm, dy = -0.05 mm. Position tolerance 0.25 mm (a diameter). I want the true position value, a Pass/Fail line in green and red, the percentage of the tolerance used, the margin, and a plot of the point inside the tolerance circle.

## First answer

213.3 s, 14396 tokens in, 1581 out.
1 elements, 8 lines, 1 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 1, note 6, display unit 3, rule 1, condition 1, plot 1

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "Hole true position (RFS)"
  1 | # Measured hole deviations and diametral tolerance, RFS
  2 | dx = 0.08 mm # measured x deviation
    = (input)
  3 | dy = -0.05 mm # measured y deviation
    = (input)
  4 | T_p = 0.25 mm # position tolerance diameter (RFS)
    = (input)
  5 | TP = 2 * sqrt(dx^2 + dy^2) in mm # true position
    = 0.1887 mm
  6 | check = if(TP <= T_p, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass
  7 | used = TP / T_p in % # tolerance used
    = 75.47 %
  8 | margin = T_p - TP in mm # diametral margin
    = 0.06132 mm
  9 | plot(dx, dy), circle T_p / 2, title "True position"
    = plot, 0 points, 0 series, 1 dots, 1 circles, 0 failed; x dx [mm], y dy [mm]

```

### The answer as written

Title: Hole true position (RFS)
~~~text
# Measured hole deviations and diametral tolerance, RFS
dx = 0.08 mm # measured x deviation
dy = -0.05 mm # measured y deviation
T_p = 0.25 mm # position tolerance diameter (RFS)
TP = 2 * sqrt(dx^2 + dy^2) in mm # true position
check = if(TP <= T_p, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
used = TP / T_p in % # tolerance used
margin = T_p - TP in mm # diametral margin
plot(dx, dy), circle T_p / 2, title "True position"
~~~

Verify the RFS true-position formula `TP = 2 * sqrt(dx^2 + dy^2)` and tolerance zone interpretation against the applicable edition of ASME Y14.5. The tolerance circle radius is `T_p / 2` since `T_p` is a diameter; adjust `dx`, `dy`, and `T_p` as needed.
